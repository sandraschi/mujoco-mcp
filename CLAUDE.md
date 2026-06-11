# mujoco-mcp — Agent Context

## What this is
General-purpose MuJoCo physics simulation via MCP. Load any MJCF/XML model,
control it, monitor state — all through MCP tools. 14 tools total (9 sim + 5 AI).

## Key paths
- `src/mujoco_mcp/server.py` — 14 MCP tools
- `src/mujoco_mcp/_sim_runner.py` — background sim subprocess
- `web_sota/backend/server.py` — FastAPI backend (port 11046)
- `web_sota/src/` — React frontend (port 11047)
- `models/` — loaded MJCF model depot
- `jobs/` — sim job state/control dirs

## Commands
- `uv run pytest tests/ -q` — unit tests
- `npx playwright test` — e2e tests (from web_sota/)
- `ruff check src/ web_sota/backend/` — lint
- `uv run python -m mujoco_mcp` — start MCP stdio
- `.\web_sota\start.ps1` — full web dashboard

## Gotchas
- Sim runs as subprocess for isolation (crash-safe)
- State sync via JSON files (state.json, control.json, stop.signal)
- Offscreen rendering uses mujoco.Renderer — requires EGL or OSMesa on headless
- AI tools fall back to Ollama when ctx.sample is unavailable
