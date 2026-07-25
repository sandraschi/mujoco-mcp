"""WebSocket endpoint for streaming sim state to the 3D viewer."""

import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

_REPO_ROOT = Path(__file__).resolve().parents[3]
_JOBS_DIR = _REPO_ROOT / "jobs"

router = APIRouter()


@router.websocket("/ws/sim/{job_id}")
async def sim_state_stream(ws: WebSocket, job_id: str):
    await ws.accept()
    job_dir = _JOBS_DIR / job_id
    if not job_dir.is_dir():
        await ws.send_json({"error": f"Job {job_id} not found"})
        await ws.close()
        return

    state_path = job_dir / "state.json"
    meta_path = job_dir / "metadata.json"
    meta = {}
    if meta_path.exists():
        meta = json.loads(meta_path.read_text())

    await ws.send_json({"type": "meta", "data": meta})

    last_mtime = 0
    try:
        while True:
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=5)
                if raw == "ping":
                    await ws.send_json({"type": "pong"})
            except TimeoutError:
                pass
            except WebSocketDisconnect:
                break

            if state_path.exists():
                mtime = state_path.stat().st_mtime
                if mtime != last_mtime:
                    last_mtime = mtime
                    state = json.loads(state_path.read_text())
                    await ws.send_json({"type": "state", "data": state})

            done = (job_dir / "completed.txt").exists()
            crashed = (job_dir / "error.txt").exists()
            if done or crashed:
                if crashed:
                    err = job_dir / "error.txt"
                    await ws.send_json(
                        {
                            "type": "done",
                            "error": err.read_text() if err.exists() else "crashed",
                        }
                    )
                else:
                    await ws.send_json({"type": "done", "error": None})
                break

            await asyncio.sleep(0.05)
    except WebSocketDisconnect:
        pass
    except Exception:
        import logging
        logging.getLogger(__name__).exception("WebSocket error for job %s", job_id)
