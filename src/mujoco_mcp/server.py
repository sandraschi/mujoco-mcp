import base64
import json
import re
import shutil
import subprocess
import sys
import time
import uuid
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx
from fastmcp import Context, FastMCP

from .state_machine import (
    SimJob,
    SimState,
    transition_crashed,
    transition_model_loaded,
    transition_running,
    transition_starting,
    transition_stopped,
    transition_stopping,
)
from typing import Any

mcp = FastMCP("mujoco-mcp")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
MODEL_DIR = REPO_ROOT / "models"
JOBS_DIR = REPO_ROOT / "jobs"
DEPOT_FILE = MODEL_DIR / ".depot" / "registry.json"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
JOBS_DIR.mkdir(parents=True, exist_ok=True)
DEPOT_FILE.parent.mkdir(parents=True, exist_ok=True)

_jobs: dict[str, Any] = {}  # job_id -> raw dict (legacy, will migrate to SimJob)
_job_states: dict[str, "SimJob"] = {}  # job_id -> state machine instance


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
            1 for j in _job_states.values() if j.state == SimState.RUNNING
        ),
        "job_states": {s.value: sum(1 for j in _job_states.values() if j.state == s) for s in SimState},
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
    job = SimJob(job_id=job_id, model_name=model_name, headless=headless, render=render)

    # IDLE → MODEL_LOADED
    transition_model_loaded(job, model_name)

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

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    # MODEL_LOADED → STARTING
    transition_starting(job, proc, headless, render)
    _job_states[job_id] = job
    _jobs[job_id] = {"process": proc, "model_name": model_name, "headless": headless, "render": render, "started_at": time.time()}

    for _ in range(100):
        if (JOBS_DIR / job_id / "metadata.json").exists():
            transition_running(job)
            break
        if proc.poll() is not None:
            transition_crashed(job, f"Process exited immediately (code {proc.returncode})", proc.returncode)
            break
        time.sleep(0.1)

    return {
        "success": job.state != SimState.CRASHED,
        "message": f"Simulation {job.state.value}." if job.state != SimState.CRASHED else f"Simulation crashed: {job.error_message}",
        "job_id": job_id,
        "model_name": model_name,
        "headless": headless,
        "render": render,
        "state": job.state.value,
    }


@mcp.tool()
def stop_sim(job_id: str) -> dict:
    """Stop a running simulation by job_id."""
    job = _job_states.get(job_id)
    if not job:
        return {"success": False, "error": f"Job '{job_id}' not found"}

    job_dir = JOBS_DIR / job_id
    (job_dir / "stop.signal").touch()

    if job.state == SimState.RUNNING:
        transition_stopping(job)

    proc = _jobs.get(job_id, {}).get("process")
    if proc and proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=5)
            transition_stopped(job, proc.returncode)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)
            transition_crashed(job, "Killed after stop timeout", proc.returncode)
    else:
        exit_code = proc.poll() if proc else None
        transition_stopped(job, exit_code)

    return {
        "success": True,
        "message": f"Job {job_id}: {job.state.value}.",
        "job_id": job_id,
        "state": job.state.value,
        "error": job.error_message,
    }


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
    """List active and completed simulation jobs with state machine info."""
    active = []
    completed = []

    for jid, job in list(_job_states.items()):
        d = job.info()
        if job.state in (SimState.RUNNING, SimState.STARTING, SimState.STOPPING, SimState.MODEL_LOADED):
            active.append(d)
        else:
            completed.append(d)

    for job_dir in sorted(JOBS_DIR.iterdir()):
        if not job_dir.is_dir() or job_dir.name in _job_states:
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


# ---------------------------------------------------------------------------
# AI workflow helpers
# ---------------------------------------------------------------------------


def _job_dir_for(job_id: str) -> Path:
    return JOBS_DIR / job_id


def _extract_json(text: str) -> dict | None:
    for m in re.finditer(r'\{[^{}]*\}', text):
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            continue
    return None


def _extract_json_array(text: str) -> list:
    for m in re.finditer(r'\[.*?\]', text, re.DOTALL):
        try:
            return json.loads(m.group())
        except json.JSONDecodeError:
            continue
    return []


# ---------------------------------------------------------------------------
# AI workflow tools (10-14)
# ---------------------------------------------------------------------------


@mcp.tool()
async def agentic_sim_workflow(goal: str, ctx: Context) -> dict:
    """Execute an autonomous multi-step simulation workflow using the host LLM.

    The LLM plans a sequence of tool calls (start_sim, get_state, apply_control,
    etc.) to achieve the described goal. Falls back to Ollama when ctx.sample
    is unavailable.

    ## Return Format
    {"success": bool, "message": str, "plan_and_result": str, "sampling_used": bool}

    ## Examples
    agentic_sim_workflow(goal="Load the Unitree H1 model and start a sim")
    agentic_sim_workflow(goal="Start a sim, apply some torques, then check the state")
    """
    tools_desc = """
Available tools (invoke with JSON):
- sim_status() — health check
- load_model(uri, name) — download MJCF model
- start_sim(model_name, headless, render) — launch sim, returns job_id
- stop_sim(job_id) — stop sim
- get_state(job_id) — read joint positions/velocities
- apply_control(job_id, ctrl) — set actuator controls
- list_models() — show depot models
- list_jobs() — show active/completed jobs
- export_frame(job_id) — get render frame as base64 PNG
- natural_language_control(prompt, job_id, ctx) — NL to actuator values
- analyze_sim_state(job_id, ctx) — describe robot posture
- analyze_sim_logs(job_id, ctx) — diagnose sim issues
- discover_model(description, ctx) — find + load MJCF from GitHub
"""
    prompt = f"""You are a robotics simulation engineer. Your goal: {goal}

{tools_desc}

Plan and execute the steps. Show your reasoning before each tool call.
After completion, summarize what happened and any observations."""

    try:
        result = await ctx.sample(prompt)
        text = getattr(result, "text", None) or str(result)
        return {"success": True, "message": "Workflow completed.", "plan_and_result": text.strip(), "sampling_used": True}
    except Exception as e:
        try:
            resp = httpx.post(
                "http://127.0.0.1:11434/api/generate",
                json={"model": "llama3.2:3b", "prompt": prompt, "stream": False},
                timeout=120,
            )
            return {"success": True, "message": "Workflow completed (Ollama).", "plan_and_result": resp.json().get("response", ""), "sampling_used": False, "model": "ollama"}
        except Exception as ollama_e:
            return {"success": False, "message": f"Both sampling and Ollama fallback failed: {e}; {ollama_e}"}


@mcp.tool()
async def natural_language_control(prompt: str, job_id: str, ctx: Context) -> dict:
    """Convert a natural language command to actuator control values for a running sim.

    Reads the job's metadata.json for actuator names and state.json for current
    values, then asks the LLM to produce actuator values that fulfill the user's
    intent. Writes the result to the job's control.json.

    ## Return Format
    {"success": bool, "message": str, "controls": dict, "source": str}

    ## Examples
    natural_language_control(prompt="bend the right knee 30 degrees", job_id="abc12345")
    natural_language_control(prompt="stand up straight", job_id="abc12345")
    """
    job_dir = _job_dir_for(job_id)
    meta_path = job_dir / "metadata.json"
    state_path = job_dir / "state.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    state = json.loads(state_path.read_text()) if state_path.exists() else {}

    nl_prompt = f"""You are a robot control engineer. The robot has these actuators:
{json.dumps(meta.get("actuator_names", []), indent=2)}

Current state:
{json.dumps(state, indent=2)}

The user says: "{prompt}"

Respond with ONLY a JSON object mapping actuator names to float values.
If an actuator is not relevant, omit it (it keeps its current value).
Example: {{"hip_joint": 0.5, "knee_joint": -0.3}}"""

    sampling_used = False
    try:
        result = await ctx.sample(nl_prompt)
        text = getattr(result, "text", None) or str(result)
        sampling_used = True
    except Exception:
        try:
            resp = httpx.post(
                "http://127.0.0.1:11434/api/generate",
                json={"model": "llama3.2:3b", "prompt": nl_prompt, "stream": False},
                timeout=30,
            )
            text = resp.json().get("response", "")
        except Exception as e:
            return {"success": False, "message": f"LLM unavailable: {e}"}

    ctrl = _extract_json(text)
    if not ctrl:
        return {"success": False, "message": "Could not parse LLM output as actuator commands.", "raw_llm_output": text}

    if job_dir.exists():
        (job_dir / "control.json").write_text(json.dumps(ctrl))

    return {"success": True, "message": f"Generated {len(ctrl)} actuator commands.", "controls": ctrl, "source": "sampling" if sampling_used else "ollama"}


@mcp.tool()
async def analyze_sim_state(job_id: str, ctx: Context) -> dict:
    """Read the current sim state and produce a natural-language analysis of what the robot is doing.

    Analyzes joint positions, velocities, contacts, and sensor readings to
    describe the robot's behaviour (standing, walking, falling, etc.).

    ## Return Format
    {"success": bool, "message": str, "analysis": str, "sampling_used": bool}

    ## Examples
    analyze_sim_state(job_id="abc12345")
    """
    job_dir = _job_dir_for(job_id)
    meta_path = job_dir / "metadata.json"
    state_path = job_dir / "state.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {}
    state = json.loads(state_path.read_text()) if state_path.exists() else {}

    if not state:
        return {"success": False, "message": f"No state data found for job {job_id}."}

    analyze_prompt = f"""You are a robotics analyst. Given this robot metadata and state, describe what the robot is doing.

Metadata:
{json.dumps(meta, indent=2)}

State:
{json.dumps(state, indent=2)}

Describe in plain English:
1. What is the robot's posture/stance?
2. Is it stable or falling?
3. What are the key joint angles telling you?
4. Any anomalies or interesting observations?"""

    try:
        result = await ctx.sample(analyze_prompt)
        text = getattr(result, "text", None) or str(result)
        return {"success": True, "message": "State analyzed.", "analysis": text.strip(), "sampling_used": True}
    except Exception:
        try:
            resp = httpx.post(
                "http://127.0.0.1:11434/api/generate",
                json={"model": "llama3.2:3b", "prompt": analyze_prompt, "stream": False},
                timeout=30,
            )
            return {"success": True, "message": "State analyzed (Ollama).", "analysis": resp.json().get("response", ""), "sampling_used": False}
        except Exception as e:
            return {"success": False, "message": f"LLM unavailable: {e}"}


@mcp.tool()
async def analyze_sim_logs(job_id: str, ctx: Context) -> dict:
    """Read the sim stderr log and ask the LLM for root-cause analysis.

    Checks for error.txt and reads stderr from the process if still tracked.
    Useful after a sim crash or unexpected behaviour.

    ## Return Format
    {"success": bool, "message": str, "analysis": str, "sampling_used": bool}

    ## Examples
    analyze_sim_logs(job_id="abc12345")
    """
    job_dir = _job_dir_for(job_id)
    error_path = job_dir / "error.txt"
    error_text = ""
    if error_path.exists():
        error_text = error_path.read_text()

    job_info = _jobs.get(job_id)
    stderr_text = ""
    if job_info and job_info.get("process"):
        proc = job_info["process"]
        if proc.stderr and proc.poll() is not None:
            try:
                stderr_text = proc.stderr.read().decode("utf-8", errors="replace")
            except Exception:
                pass

    log_sources = []
    if error_text:
        log_sources.append(f"=== error.txt ===\n{error_text}")
    if stderr_text:
        log_sources.append(f"=== stderr ===\n{stderr_text[-2000:]}")
    if not log_sources:
        completed = (job_dir / "completed.txt").exists()
        return {"success": True, "message": "No errors in log output.",
                "analysis": f"Job {job_id}: {'completed normally' if completed else 'still running or unknown'}. No error logs found."}

    combined = "\n\n".join(log_sources)

    log_prompt = f"""You are a robotics debug engineer. Given these simulation logs, diagnose any issues.

Job id: {job_id}

{combined}

Provide:
1. What went wrong (or is everything OK)?
2. Root cause hypotheses
3. Specific suggestions to fix or improve"""

    try:
        result = await ctx.sample(log_prompt)
        text = getattr(result, "text", None) or str(result)
        return {"success": True, "message": "Logs analyzed.", "analysis": text.strip(), "sampling_used": True}
    except Exception:
        try:
            resp = httpx.post(
                "http://127.0.0.1:11434/api/generate",
                json={"model": "llama3.2:3b", "prompt": log_prompt, "stream": False},
                timeout=30,
            )
            return {"success": True, "message": "Logs analyzed (Ollama).", "analysis": resp.json().get("response", ""), "sampling_used": False}
        except Exception as e:
            return {"success": False, "message": f"LLM unavailable: {e}"}


@mcp.tool()
async def discover_model(description: str, ctx: Context) -> dict:
    """Search for and download a MuJoCo MJCF/XML model from GitHub given a natural-language description.

    The LLM generates candidate GitHub raw URLs based on known open-source robot
    repos, then the tool attempts to download and validate each URL. Valid MJCFs
    are loaded into the depot via load_model's logic.

    ## Return Format
    {"success": bool, "message": str, "models_loaded": list, "urls_tried": list}

    ## Examples
    discover_model(description="Unitree H1 humanoid MuJoCo model")
    discover_model(description="Boston Dynamics Spot MJCF")
    """
    prompt = f"""Given this description: "{description}"

Suggest up to 4 GitHub raw URLs that might contain a MuJoCo MJCF/XML model file matching this description.
Focus on known open-source robot repos (Unitree, Google DeepMind, Boston Dynamics research, etc.).
Return ONLY a JSON array of URLs, nothing else.
Example: ["https://raw.githubusercontent.com/unitreerobotics/unitree_mujoco/main/data/h1.xml"]"""

    try:
        result = await ctx.sample(prompt)
        urls = _extract_json_array(getattr(result, "text", None) or str(result))
    except Exception:
        try:
            resp = httpx.post(
                "http://127.0.0.1:11434/api/generate",
                json={"model": "llama3.2:3b", "prompt": prompt, "stream": False},
                timeout=30,
            )
            urls = _extract_json_array(resp.json().get("response", ""))
        except Exception:
            return {"success": False, "message": "LLM unavailable for model discovery."}

    if not urls:
        return {"success": False, "message": "Could not generate model URLs from description."}

    loaded = []
    for url in urls[:4]:
        try:
            resp = httpx.get(url, follow_redirects=True, timeout=30)
            if resp.status_code == 200 and b"<mujoco" in resp.content[:500]:
                name = url.split("/")[-1].replace(".xml", "")
                dest = MODEL_DIR / f"{name}.xml"
                dest.write_bytes(resp.content)
                meta = _parse_mjcf(str(dest))
                depot = _load_depot()
                depot[name] = {"uri": url, "path": str(dest.resolve()), "metadata": meta}
                _save_depot(depot)
                loaded.append({"url": url, "name": name, "path": str(dest), **meta})
        except Exception:
            continue

    return {
        "success": len(loaded) > 0,
        "message": f"Loaded {len(loaded)}/{len(urls)} models." if loaded else "No models could be downloaded.",
        "models_loaded": loaded,
        "urls_tried": urls,
    }


def main():
    mcp.run()
