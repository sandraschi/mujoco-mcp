# mujoco-mcp — Agent Context

## What this is
General-purpose MuJoCo physics simulation via MCP. 14 tools (9 sim + 5 AI).
State machine reference implementation (SimState/SimJob pattern).

## Key paths
- `src/mujoco_mcp/server.py` — all 14 MCP tools
- `src/mujoco_mcp/_sim_runner.py` — background sim subprocess
- `web_sota/backend/server.py` — FastAPI backend (port 11046)
- `web_sota/src/` — React frontend (port 11047)
- `models/` — loaded MJCF model depot
- `jobs/` — sim job state files

## Commands
- `uv run python -m mujoco_mcp` — start MCP stdio
- `.\start.ps1` — full web dashboard
- `uv run pytest tests/ -q` — run tests
- `npx playwright test` — e2e tests (from web_sota/)
- `just lint` — ruff check
- `.\mcpb\pack.ps1` — rebuild MCPB bundle

## Gotchas
- Sim runs as subprocess for crash isolation
- State sync via JSON files (state.json, control.json, stop.signal)
- Offscreen rendering requires mujoco.Renderer (EGL/OSMesa on headless Linux)
- AI tools fall back to Ollama when ctx.sample unavailable
