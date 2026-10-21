import argparse
import json
import logging
import time
from pathlib import Path

import mujoco
import numpy as np

logger = logging.getLogger("mujoco_mcp.sim_runner")


def _png_encode(rgb: np.ndarray, width: int, height: int) -> bytes:
    import struct
    import zlib

    raw = b""
    for y in range(height):
        # One filter byte per scanline, then that scanline's RGB bytes.
        # rgb is (H, W, 3); rgb[y] is one row.
        raw += b"\x00" + rgb[y].tobytes()
    compressed = zlib.compress(raw)

    chunks = []

    def chunk(ctype: bytes, data: bytes):
        c = ctype + data
        chunks.append(struct.pack(">I", len(data)))
        chunks.append(c)
        chunks.append(struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF))

    chunks.insert(0, b"\x89PNG\r\n\x1a\n")
    chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
    chunk(b"IDAT", compressed)
    chunk(b"IEND", b"")
    return b"".join(chunks)


TRAJECTORY_SCHEMA_VERSION = 1


def _state_dict(model, data, step: int, actuator_map: dict, sensor_map: dict) -> dict:
    """Serialize the current simulation state as a JSON-ready dict."""
    sensor_readings = {}
    for i, name in enumerate(sensor_map.keys()):
        try:
            adr = data.sensor_adr[i]
            dim = data.sensor_dim[i]
            sensor_readings[name] = data.sensordata[adr : adr + dim].tolist()
        except (IndexError, ValueError):
            sensor_readings[name] = []

    body_pos = []
    body_quat = []
    for i in range(model.nbody):
        body_pos.append(data.xpos[i].tolist())
        body_quat.append(data.xquat[i].tolist())

    return {
        "time": float(data.time),
        "step": step,
        "qpos": data.qpos.tolist() if model.nq > 0 else [],
        "qvel": data.qvel.tolist() if model.nv > 0 else [],
        "actuator_values": {name: float(data.ctrl[idx]) for name, idx in actuator_map.items()},
        "sensor_readings": sensor_readings,
        "body_positions": body_pos,
        "body_orientations": body_quat,
    }


def _write_state(path: Path, model, data, step: int, actuator_map: dict, sensor_map: dict):
    path.write_text(json.dumps(_state_dict(model, data, step, actuator_map, sensor_map)))


def _trajectory_meta(
    model,
    data,
    step: int,
    metadata: dict,
    actuator_map: dict,
    sensor_map: dict,
) -> dict:
    """Bind a recording session to the measured state it started from.

    ``expected_start`` is the frame the recording begins at, so a consumer can
    tell whether a playback is anchored to the state it claims to be.
    """
    return {
        "schema_version": TRAJECTORY_SCHEMA_VERSION,
        "recorded_at_step": step,
        "expected_start": _state_dict(model, data, step, actuator_map, sensor_map),
        "model_path": metadata.get("model_path"),
        "nq": metadata.get("nq"),
        "nv": metadata.get("nv"),
        "nu": metadata.get("nu"),
        "joint_names": metadata.get("joint_names", []),
        "actuator_names": metadata.get("actuator_names", []),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-path", required=True)
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--jobs-dir", required=True)
    parser.add_argument("--headless", action="store_true", default=True)
    parser.add_argument("--render", action="store_true", default=False)
    parser.add_argument("--frame-interval", type=int, default=50)
    args = parser.parse_args()

    job_dir = Path(args.jobs_dir) / args.job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    state_path = job_dir / "state.json"
    control_path = job_dir / "control.json"
    stop_path = job_dir / "stop.signal"
    record_path = job_dir / "record.signal"
    trajectory_path = job_dir / "trajectory.jsonl"
    meta_path = job_dir / "trajectory.meta.json"
    frame_dir = job_dir / "frames" if args.render else None

    if frame_dir:
        frame_dir.mkdir(exist_ok=True)

    model = mujoco.MjModel.from_xml_path(args.model_path)
    data = mujoco.MjData(model)

    actuator_map = {}
    for i in range(model.nu):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_ACTUATOR, i) or f"actuator_{i}"
        actuator_map[name] = i

    sensor_map = {}
    for i in range(model.nsensor):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_SENSOR, i) or f"sensor_{i}"
        sensor_map[name] = i

    renderer = None
    if args.render:
        try:
            renderer = mujoco.Renderer(model)
        except (RuntimeError, ImportError) as e:
            logger.warning("Renderer init failed (continuing without): %s", e)
            renderer = None

    body_parents = []
    for i in range(model.nbody):
        parent = model.body_parentid[i]
        body_parents.append(int(parent) if parent >= 0 else -1)

    metadata = {
        "model_path": args.model_path,
        "headless": args.headless,
        "nq": model.nq,
        "nv": model.nv,
        "nu": model.nu,
        "actuator_names": list(actuator_map.keys()),
        "sensor_names": list(sensor_map.keys()),
        "body_names": [
            mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, i) or f"body_{i}"
            for i in range(model.nbody)
        ],
        "body_parents": body_parents,
        "joint_names": [
            mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT, i) or f"joint_{i}"
            for i in range(model.njnt)
        ],
    }
    (job_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    dt = model.opt.timestep
    step = 0
    _write_state(state_path, model, data, step, actuator_map, sensor_map)

    recording = False

    try:
        while not stop_path.exists():
            if control_path.exists():
                try:
                    ctrl_cmds = json.loads(control_path.read_text())
                    for key, val in ctrl_cmds.items():
                        if key in actuator_map:
                            data.ctrl[actuator_map[key]] = float(val)
                        else:
                            try:
                                idx = int(key)
                                if 0 <= idx < model.nu:
                                    data.ctrl[idx] = float(val)
                            except ValueError:
                                pass
                    control_path.unlink(missing_ok=True)
                except (json.JSONDecodeError, OSError, ValueError):
                    logger.warning("Control parse failed")

            mujoco.mj_step(model, data)
            step += 1

            if step % 5 == 0:
                _write_state(state_path, model, data, step, actuator_map, sensor_map)
                if recording:
                    # Append - write_text() here truncated the file to the
                    # newest frame, so a "recording" was always one frame long.
                    with trajectory_path.open("a", encoding="utf-8") as handle:
                        handle.write(state_path.read_text(encoding="utf-8") + "\n")

            if record_path.exists():
                record_path.unlink(missing_ok=True)
                if not recording:
                    recording = True
                    meta_path.write_text(
                        json.dumps(
                            _trajectory_meta(model, data, step, metadata, actuator_map, sensor_map),
                            indent=2,
                        ),
                        encoding="utf-8",
                    )
                    # The first frame IS expected_start, so the binding is exact
                    # rather than "whatever the runner saw a few steps later".
                    trajectory_path.write_text(
                        json.dumps(_state_dict(model, data, step, actuator_map, sensor_map)) + "\n",
                        encoding="utf-8",
                    )
                    logger.info("Recording started at step %d", step)
                else:
                    logger.info("Ignoring record.signal at step %d - already recording", step)

            if renderer and step % args.frame_interval == 0:
                try:
                    renderer.update_scene(data)
                    rgb = renderer.render()
                    height, width = rgb.shape[:2]
                    png = _png_encode(rgb, width, height)
                    (frame_dir / f"frame_{step:08d}.png").write_bytes(png)
                except (RuntimeError, OSError) as e:
                    logger.warning("Render failed at step %d: %s", step, e)

            time.sleep(max(dt * 0.5, 0.001))
    except Exception as e:
        (job_dir / "error.txt").write_text(str(e))
        raise
    finally:
        (job_dir / "completed.txt").write_text(f"completed at step {step}")
        _write_state(state_path, model, data, step, actuator_map, sensor_map)


if __name__ == "__main__":
    main()
