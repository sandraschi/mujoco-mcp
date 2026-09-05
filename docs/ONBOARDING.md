# Onboarding — mujoco-mcp

**Wrappee:** [MuJoCo](https://mujoco.org) (Google DeepMind, open-source). **Account needed? No** — MuJoCo itself needs no account. Optional extras: [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie) models (anonymous git/https), Ollama / LM Studio / vLLM for AI tools (local, no account).

## What for

Load any MJCF/URDF robot model, run crash-isolated sims, drive actuators, inspect state, record trajectories, sweep populations, train RL policies — via 20 MCP tools, a 13-page dashboard, and a Tauri/NSIS native app. Data flow: MCP tools ↔ job scheduler / state machine ↔ subprocess sim runner (JSON-file IPC) ↔ WebSocket 3D viewer.

## Costs

- **MuJoCo**: free, Apache-2.0. `pip install mujoco` (`mujoco>=3.2` pinned in `pyproject.toml`).
- **AI tools**: pay nothing if you use the bundled Ollama fallback (`llama3.2:3b` on `http://127.0.0.1:11434`). Bring your own Ollama/LM Studio/vLLM if you prefer.
- **NSIS build** (optional): Windows SDK + Rust + Tauri — also free.

## Pitfalls

- **Offscreen rendering on headless Linux needs EGL/OSMesa** (otherwise `export_frame` / `render=True` fails with `Renderer init failed` in `jobs/<id>/runner.log`).
- **`pip install mujoco` on Windows wants MSVC Build Tools.** If you see compiler errors, install "Desktop development with C++" from the Visual Studio Installer, then `uv sync`.
- **Ollama not running → AI tools still work** (degraded: host LLM via `ctx.sample` if the MCP host supports sampling; otherwise the tool returns `LLM unavailable` rather than a hallucination).
- **Jobs dir fills up** if you run many sims — safe to delete `jobs/` anytime (also clears job history).

## Quick sanity check

```powershell
# 1. From repo root
uv sync

# 2. Health probe (no models yet)
uv run python -c "from mujoco_mcp.server import sim_status; import json, pprint; pprint.pp(sim_status())"
# Expect: {"mujoco_available": True, "mujoco_version": "3.x", ...}

# 3. Dashboard
.\start.ps1
# → backend http://127.0.0.1:11046/health  ({"status":"ok"})
# → frontend http://127.0.0.1:11047

# 4. Seed a toy model (no download, already in repo):
uv run python scripts/seed_depot.py
uv run python -c "from mujoco_mcp.server import list_models; print(list_models())"
```

Then on the Dashboard click **Start MuJoCo Quickstart** (or Simulations → pick the seeded pendulum → Start sim → 3D Viewer shows live bodies).
