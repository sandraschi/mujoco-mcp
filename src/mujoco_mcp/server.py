import base64
import json
import shutil
import subprocess
import sys
import time
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx
from fastmcp import FastMCP

mcp = FastMCP("mujoco-mcp")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_DIR = REPO_ROOT / "models"
JOBS_DIR = REPO_ROOT / "jobs"
DEPOT_FILE = MODEL_DIR / ".depot" / "registry.json"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)
DEPOT_FILE.parent.mkdir(parents=True, exist_ok=True)

_jobs: dict = {}


def _load_depot() -> dict:
    if DEPOT_FILE.exists():
        return json.loads(DEPOT_FILE.read_text())
    return {}


def _save_depot(depot: dict):
    DEPOT_FILE.write_text(json.dumps(depot, indent=2))


def _parse_mjcf(path: str) -> dict:
    tree = ET.parse(path)
    root = tree.getroot()

    joints = [j.get("name", "") for j in root.iter("joint") if j.get("name")]
    bodies = [b.get("name", "") for b in root.iter("body") if b.get("name")]

    actuators = []
    for act in root.iter("actuator"):
        for child in act:
            name = child.get("name", "")
            if name:
                actuators.append(name)

    return {
        "joint_count": len(joints),
        "body_count": len(bodies),
        "actuator_count": len(actuators),
    }


@mcp.tool()
def sim_status() -> dict:
    """Health check: mujoco importable, model dirs exist, active jobs."""

    mj_version = None
    try:
        import mujoco
        mj_version = getattr(mujoco, "__version__", None) or getattr(mujoco, "version", None)
    except ImportError:
        pass

    return {
        "mujoco_available": mj_version is not None,
        "mujoco_version": mj_version,
        "model_dir_exists": MODEL_DIR.exists(),
        "models_in_depot": len(_load_depot()),
        "active_jobs": sum(
            1 for j in _jobs.values()
            if j.get("process") and j["process"].poll() is None
        ),
        "jobs_dir_exists": JOBS_DIR.exists(),
    }


@mcp.tool()
def load_model(uri: str, name: str) -> dict:
    """Load an MJCF/XML model into the simulation depot.

    uri: local file path or URL (will download via httpx)
    name: friendly name for the depot

    Returns model metadata (joint count, body count, actuator count).
    """
    depot = _load_depot()
    dest = MODEL_DIR / f"{name}.xml"

    if uri.startswith(("http://", "https://", "ftp://")):
        resp = httpx.get(uri, follow_redirects=True, timeout=60)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
    else:
        src = Path(uri)
        if not src.exists():
            return {"success": False, "error": f"File not found: {uri}"}
        shutil.copy2(src, dest)

    meta = _parse_mjcf(str(dest))
    depot[name] = {"uri": uri, "path": str(dest.resolve()), "metadata": meta}
    _save_depot(depot)

    return {"success": True, "name": name, "path": str(dest), **meta}


@mcp.tool()
def start_sim(model_name: str, headless: bool = True, render: bool = False) -> dict:
    """Start a simulation in a background process.

    model_name: name from load_model / list_models
    headless: if False, opens the MuJoCo viewer window
    render: enable offscreen frame rendering (requires headless=True)

    Returns job_id for use with get_state, stop_sim, apply_control, export_frame.
    """
    depot = _load_depot()
    if model_name not in depot:
        return {"success": False, "error": f"Model '{model_name}' not found in depot"}

    runner = Path(__file__).parent / "_sim_runner.py"
    if not runner.exists():
        return {"success": False, "error": f"Sim runner not found at {runner}"}

    job_id = uuid.uuid4().hex[:8]

    cmd = [
        sys.executable, str(runner),
        "--model-path", depot[model_name]["path"],
        "--job-id", job_id,
        "--jobs-dir", str(JOBS_DIR),
    ]
    if headless:
        cmd.append("--headless")
    if render:
        cmd.append("--render")

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    _jobs[job_id] = {
        "process": proc,
        "model_name": model_name,
        "headless": headless,
        "render": render,
        "started_at": time.time(),
    }

    for _ in range(100):
        if (JOBS_DIR / job_id / "metadata.json").exists():
            break
        time.sleep(0.1)

    return {
        "success": True,
        "job_id": job_id,
        "model_name": model_name,
        "headless": headless,
        "render": render,
    }


@mcp.tool()
def stop_sim(job_id: str) -> dict:
    """Stop a running simulation by job_id."""
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return {"success": False, "error": f"Job '{job_id}' not found"}

    (job_dir / "stop.signal").touch()

    if job_id in _jobs:
        proc = _jobs[job_id].get("process")
        if proc and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        _jobs[job_id]["process"] = None

    completed = (job_dir / "completed.txt").exists()
    return {"success": True, "job_id": job_id, "stopped": True, "completed": completed}


@mcp.tool()
def get_state(job_id: str) -> dict:
    """Get current simulation state: qpos, qvel, sensor readings, time."""
    state_path = JOBS_DIR / job_id / "state.json"
    if not state_path.exists():
        return {"success": False, "error": f"No state data for job '{job_id}'"}

    state = json.loads(state_path.read_text())
    return {"success": True, "job_id": job_id, **state}


@mcp.tool()
def apply_control(job_id: str, ctrl: dict) -> dict:
    """Apply actuator controls.

    ctrl: dict of {actuator_name: value} or {actuator_index: value}
    """
    job_dir = JOBS_DIR / job_id
    if not job_dir.exists():
        return {"success": False, "error": f"Job '{job_id}' not found"}

    (job_dir / "control.json").write_text(json.dumps(ctrl))
    return {"success": True, "job_id": job_id, "applied": list(ctrl.keys())}


@mcp.tool()
def list_models() -> dict:
    """List all loaded models in the depot with metadata."""
    depot = _load_depot()
    return {"success": True, "models": depot, "count": len(depot)}


@mcp.tool()
def list_jobs() -> dict:
    """List active and completed simulation jobs."""
    active = []
    completed = []

    for jid, info in _jobs.items():
        proc = info.get("process")
        if proc and proc.poll() is None:
            active.append({"job_id": jid, "model_name": info["model_name"], "running": True})
        else:
            completed.append({"job_id": jid, "model_name": info["model_name"], "running": False})

    for job_dir in sorted(JOBS_DIR.iterdir()):
        if not job_dir.is_dir() or job_dir.name in _jobs:
            continue
        meta_path = job_dir / "metadata.json"
        if meta_path.exists():
            meta = json.loads(meta_path.read_text())
            model_name = Path(meta.get("model_path", "")).stem
            completed.append({
                "job_id": job_dir.name,
                "model_name": model_name,
                "completed": (job_dir / "completed.txt").exists(),
            })

    return {
        "success": True,
        "active": active,
        "completed": completed,
        "total": len(active) + len(completed),
    }


@mcp.tool()
def export_frame(job_id: str) -> dict:
    """Export the most recent render frame as base64 PNG.

    Only available for jobs started with render=True.
    """
    frame_dir = JOBS_DIR / job_id / "frames"
    if not frame_dir or not frame_dir.exists():
        return {
            "success": False,
            "error": "No frames directory. Start sim with render=True for offscreen rendering.",
        }

    frames = sorted(frame_dir.glob("*.png"))
    if not frames:
        return {"success": False, "error": "No frames captured yet."}

    png_bytes = frames[-1].read_bytes()
    b64 = base64.b64encode(png_bytes).decode()

    return {
        "success": True,
        "job_id": job_id,
        "frame_base64": b64,
        "frame_count": len(frames),
        "latest_frame": frames[-1].name,
    }


def main():
    mcp.run()
