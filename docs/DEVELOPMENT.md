# Development Guide

## Layout

```
src/mujoco_mcp/           FastMCP server (19 tools, 3 Prefab cards)
  server.py               All MCP tools + REST bridge helpers
  state_machine.py        SimState enum + SimJob dataclass (IDLE -> RUNNING -> STOPPED)
  _sim_runner.py          Background sim subprocess (JSON file IPC)
  rl_trainer.py           Optional stable-baselines3 Gymnasium wrapper
web_sota/                 React + Vite + Tailwind dashboard (12 pages)
  backend/server.py       FastAPI backend (port 11046) + WebSocket + REST
  src/pages/              One file per dashboard page
native/                   Tauri 2.0 shell (PyInstaller backend embedded)
tests/                    pytest suite (server + backend)
mcpb/                     MCPB bundle layout (src/ is a pack artifact - edit src/, not mcpb/src/)
```

## Commands

```powershell
uv sync                        # install core deps
uv sync --extra rl             # + stable-baselines3 (large)
uv run python -m mujoco_mcp    # MCP stdio mode
.\start.ps1                    # full stack (backend 11046 + frontend 11047)
uv run pytest tests/ -q        # test suite
cd web_sota; bunx tsc --noEmit # TS typecheck
cd web_sota; bunx @biomejs/biome check src/   # JS/TS lint
just lint / just fix           # ruff check / auto-fix
just e2e                       # Playwright e2e (from web_sota/)
.\mcpb\pack.ps1                # rebuild MCPB bundle (wipes + recopies src/)
```

## Adding a Tool

1. Add `@mcp.tool(annotations=...)` to `src/mujoco_mcp/server.py`.
2. Docstring: summary + `## Return Format` + `## Examples` (see existing tools).
3. If the tool lists/statuses/stats: also add a Prefab `@mcp.tool(app=True)` card.
4. Return `{"success", "message", ...}` dialogic dicts.
5. Add to `README.md` tools table, `docs/TOOLS.md`, `llms-full.txt`, `glama.json`.
6. Update the session-injection text in `.cursorrules`, `hooks/hooks.json`, and
   `web_sota/src/pages/LLM.tsx` `buildSystemPrompt()` (tool counts go stale).
7. `uv run pytest tests/ -q` + `just lint` + `cd web_sota; bunx tsc --noEmit`.

## Sim Architecture

Simulations run as isolated subprocesses (`_sim_runner.py`), one per job, with
JSON file IPC (`state.json`, `control.json`, `stop.signal`) for crash isolation.
The state machine lives in `state_machine.py`; never mutate `SimState` values
without updating the transition functions.

## Native / Packaging

- `native/build.ps1` runs: frontend build -> tsc gate -> PyInstaller -> 5 MB size
  gate -> Tauri NSIS. Requires MSVC + Rust toolchain.
- Backend binary: `{repo}-backend.spec` (PyInstaller). Keep `strip=False`,
  `upx=False`, `noarchive=True`.
- `just build-native` + `just cua-nsis-test` (pywinauto smoke) before release.

## RL Extras

`rl_trainer.py` imports stable-baselines3 lazily; `train_policy` returns a
structured error when the `rl` extra is not installed. CI does not install it
(keeps test time sane) - the tool surface degrades gracefully.
