# Troubleshooting

## Server won't start

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ModuleNotFoundError: mujoco` | MuJoCo not installed | `uv sync` (adds `mujoco>=3.2`) |
| Port 11046 already in use | Stale backend process | `Get-NetTCPConnection -LocalPort 11046 \| ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }` |
| `RuntimeError: XML model not found` | Model not in depot | `load_model(uri=..., name=...)` first, or `just models` to inspect depot |

## Web dashboard issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Dashboard shows Offline | Backend down / wrong port | Ensure backend on 11046 (`Invoke-WebRequest http://127.0.0.1:11046/health`); the dashboard retries with backoff and offers a Restart Backend button (Tauri) |
| Blank 3D Viewer | WebSocket stream not connected | Check `GET /api/jobs` for a RUNNING job; viewer requires an active sim |
| CORS errors in console | `allow_origins` missing the origin | Only affects non-localhost origins; `*.ts.net` / LAN / tauri://localhost are covered by the regex in `web_sota/backend/server.py` |
| "Failed to fetch" in NSIS install | API_BASE pointing at wrong port in built dist | Verify `web_sota/src/lib/api.ts` port matches 11046 before `native/build.ps1` |

## Simulation issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Job stuck in STARTING | Runner crashed before state write | Read `jobs/<job_id>/runner.log`; `analyze_sim_logs(job_id=...)` summarizes |
| Job flips to CRASHED | Solver error / missing mesh file | Check runner.log tail; re-load model from a valid MJCF |
| `apply_control` does nothing | Wrong actuator name | `list_models` -> load metadata shows `actuator_count`; use exact names from the MJCF |
| No frames from `export_frame` | `render=True` not set at `start_sim` | Restart with `start_sim(model_name, headless=True, render=True)` |

## RL training

| Symptom | Cause | Fix |
|---------|-------|-----|
| `train_policy` returns error | `rl` extra not installed | `uv sync --extra rl` (stable-baselines3 + tensorboard) |
| Training runs but no progress logs | tensorboard not started | `uv run tensorboard --logdir jobs/<job_id>/rl` |
| OOM during training | Model too large for RAM | Reduce `total_timesteps` or use a lighter model (e.g. pendulum) |

## Reset / cleanup

Delete `jobs/` for all sim state, `models/.depot/registry.json` to clear the
depot (keep `models/` XML files), and `logs/` for server logs. The dashboard
Settings page exposes the same directories.

## Native installer

- NSIS build fails at PyInstaller: read `build/{repo}-backend/warn-*.txt` for
  hidden import warnings; the 5 MB size gate in `native/build.ps1` aborts on
  runt binaries - do not bypass it.
- Installer hangs during uninstall: `hooks.nsh` kills `mujoco-mcp-backend.exe`
  and `mujoco-mcp-native.exe`; if a process is file-locked, kill it manually
  with `taskkill /F /IM mujoco-mcp-backend.exe /T`.
- Backend health check FAILED in backend-spawn.log: port 11046 was not freed;
  `free_port()` polls up to 240s with multi-layer kill before giving up.

See also: `docs/SETUP.md` (install), `docs/ARCHITECTURE.md` (state machine),
`mcp-central-docs/troubleshooting/BUGS_DEPOT.md` (fleet-wide issues).
