import argparse
import json
import sys
import time
from pathlib import Path

import mujoco
import numpy as np


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


def _write_state(path: Path, model, data, step: int, actuator_map: dict, sensor_map: dict):
    sensor_readings = {}
    for i, name in enumerate(sensor_map.keys()):
        try:
            adr = data.sensor_adr[i]
            dim = data.sensor_dim[i]
            sensor_readings[name] = data.sensordata[adr : adr + dim].tolist()
        except Exception:
            sensor_readings[name] = []

    state = {
        "time": float(data.time),
        "step": step,
        "qpos": data.qpos.tolist() if model.nq > 0 else [],
        "qvel": data.qvel.tolist() if model.nv > 0 else [],
        "actuator_values": {name: float(data.ctrl[idx]) for name, idx in actuator_map.items()},
        "sensor_readings": sensor_readings,
    }
    path.write_text(json.dumps(state))


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
        except Exception as e:
            print(f"Renderer init failed (continuing without): {e}", file=sys.stderr)
            renderer = None

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
        "joint_names": [
            mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT, i) or f"joint_{i}"
            for i in range(model.njnt)
        ],
    }
    (job_dir / "metadata.json").write_text(json.dumps(metadata, indent=2))

    dt = model.opt.timestep
    step = 0
    _write_state(state_path, model, data, step, actuator_map, sensor_map)

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
                except Exception:
                    pass

            mujoco.mj_step(model, data)
            step += 1

            if step % 5 == 0:
                _write_state(state_path, model, data, step, actuator_map, sensor_map)

            if renderer and step % args.frame_interval == 0:
                try:
                    renderer.update_scene(data)
                    rgb = renderer.render()
                    height, width = rgb.shape[:2]
                    png = _png_encode(rgb, width, height)
                    (frame_dir / f"frame_{step:08d}.png").write_bytes(png)
                except Exception as e:
                    print(f"Render failed at step {step}: {e}", file=sys.stderr)

            time.sleep(max(dt * 0.5, 0.001))
    except Exception as e:
        (job_dir / "error.txt").write_text(str(e))
        raise
    finally:
        (job_dir / "completed.txt").write_text(f"completed at step {step}")
        _write_state(state_path, model, data, step, actuator_map, sensor_map)


if __name__ == "__main__":
    main()
