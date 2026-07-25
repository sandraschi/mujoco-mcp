# mujoco-mcp — Agent Context

## What this is
General-purpose MuJoCo physics simulation via MCP. 19 tools (9 sim + 5 AI + 2 trajectory + 2 population + 1 RL).
State machine reference implementation (SimState/SimJob pattern). Three.js 3D viewer, WebSocket streaming.

## Key paths
- `src/mujoco_mcp/server.py` — all 19 MCP tools
- `src/mujoco_mcp/_sim_runner.py` — background sim subprocess (body positions in state.json)
- `src/mujoco_mcp/rl_trainer.py` — optional stable-baselines3 Gymnasium wrapper
- `src/mujoco_mcp/state_machine.py` — SimState enum, SimJob dataclass
- `web_sota/backend/server.py` — FastAPI backend (port 11046), WebSocket /ws/sim/
- `web_sota/backend/routes/sim_ws.py` — WebSocket state streaming endpoint
- `web_sota/src/lib/sim-renderer.ts` — Three.js scene builder
- `web_sota/src/pages/Viewer3D.tsx` — 3D Viewer (live sim)
- `web_sota/src/pages/TrajectoryViewer.tsx` — Trajectory playback
- `web_sota/src/pages/PopulationViewer.tsx` — Parameter sweep launcher
- `web_sota/src/pages/ModelEditor.tsx` — MJCF editor (add/delete bodies, export)
- `web_sota/src/pages/RLPlayground.tsx` — PPO/SAC training UI
- `models/` — loaded MJCF model depot
- `jobs/` — sim job state files

## Commands
- `uv run python -m mujoco_mcp` — start MCP stdio
- `.\start.ps1` — full web dashboard (12 pages)
- `uv run pytest tests/ -q` — run tests
- `npx playwright test` — e2e tests (from web_sota/)
- `uv sync --extra rl` — install RL extras (stable-baselines3)
- `just lint` — ruff check
- `.\mcpb\pack.ps1` — rebuild MCPB bundle

## New v0.3.0 tools
- `record_trajectory` / `list_trajectories` — record and inspect sim trajectories
- `run_population` / `population_results` — parallel param sweeps
- `train_policy` — PPO/SAC RL training (requires --extra rl)
- `POST /api/mcp/{tool_name}` — REST bridge for frontend MCP tool calling

## Gotchas
- Sim runs as subprocess for crash isolation
- State sync via JSON files (state.json, control.json, stop.signal)
- Body positions/orientations now in state.json for 3D rendering
- Recording trajectory: call `record_trajectory`, then trajectory.jsonl is written until sim stops
- RL training requires `uv sync --extra rl` (huge install)
- WebSocket endpoint is /ws/sim/{job_id}
- Offscreen rendering requires mujoco.Renderer (EGL/OSMesa on headless Linux)
- AI tools fall back to Ollama when ctx.sample unavailable
