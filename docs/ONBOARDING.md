# Onboarding — mujoco-mcp

## What this is for

MuJoCo physics for the fleet: load any MJCF/URDF robot model and run crash-isolated simulations from Claude/Cursor or the 16-page dashboard (3D Viewer, Trajectory, Population, Editor, RL). Built for VLA policy prototyping, contact-rich manipulation (grasping/stacking), and legged locomotion on a CPU laptop — no ROS, no Docker, no GPU required. This MCP does **not** do photoreal rendering, lidar/camera noise, or outdoor terrain; for those use `gazebo-mcp` or `isaac-mcp` instead.

## Cost and accounts (money / CC)

| Question | Answer |
|----------|--------|
| Do I need an account? | **No** — MuJoCo itself needs no account. Optional: Menagerie models are anonymous `https` downloads; Ollama/LM Studio/vLLM are local. |
| Free tier? | **Yes, fully free** — MuJoCo Apache 2.0, Menagerie open-source, local LLMs. |
| Credit card required? | **No** — never. Cloud LLM via `openai` provider would bill, but fleet defaults to local Ollama `llama3.2:3b`. |
| Ongoing cost? | **Free** — CPU sim is free. GPU `isaac-mcp` path would bill if you use it. |
| Who bills? | **No one** for MuJoCo path — you run your own pip wheel. |

## Prerequisites outside this repo

- **Python 3.11+** (`uv` handles venv; verify: `uv --version`)
- **MuJoCo `>=3.2` pip wheel** — installed by `uv sync` (wheels for Windows/macOS/Linux). No separate download.
- **MSVC Build Tools on Windows** if you ever `pip install --no-binary` — see Pitfalls.
- **Node.js 20+** only for the dashboard dev (`web_sota/` Vite). Not needed for `uv run python -m mujoco_mcp` (stdio MCP).
- **Optional local LLM:** Ollama (`https://ollama.com`), LM Studio, or vLLM. Without one, AI tools fall back to host `ctx.sample` or return `LLM unavailable`.
- **Optional offscreen rendering:** On headless Linux, EGL/OSMesa for `export_frame` / `render=True` (Windows usually works out of the box).

## First-timer setup steps

> `uv sync` is the happy-path single step — it installs MuJoCo. The checklist below is what to run when `sim_status` still says `mujoco_available: false`.

1. **Clone and sync (installs MuJoCo):**
   ```powershell
   git clone https://github.com/sandraschi/mujoco-mcp
   cd mujoco-mcp
   uv sync
   ```
2. **Verify MuJoCo is importable (health probe):**
   ```powershell
   # One-liner the docs promise in Sanity check:
   uv run python -c "from mujoco_mcp.server import sim_status; import pprint; pprint.pp(sim_status())"
   # Expect: {"success": True, "mujoco_available": True, "mujoco_version": "3.x", ...}
   # If you see mujoco_available: False -> step 3.
   ```
3. **If `mujoco_available: False` on Windows — install MSVC and re-sync:**
   ```powershell
   # Install "Desktop development with C++" from Visual Studio Installer
   # (https://visualstudio.microsoft.com/downloads/ → Build Tools)
   # Then clean-reinstall the wheel:
   uv pip install --force-reinstall mujoco
   uv run python -c "import mujoco; print(mujoco.__version__)"
   ```
4. **If on headless Linux and `render=True` will be used:**
   ```powershell
   sudo apt-get install -y libosmesa6 libgl1 libglfw3 libegl1
   # Verify: uv run python -c "import mujoco; print(mujoco.__version__)"
   ```
5. **Launch the dashboard:**
   ```powershell
   .\start.ps1
   # backend  http://127.0.0.1:11046/health  → {"status":"ok","mujoco_available":true,...}
   # frontend http://127.0.0.1:11047
   ```
6. **Seed a toy model (no network after this):**
   ```powershell
   uv run python scripts/seed_depot.py
   uv run python -c "from mujoco_mcp.server import list_models; print(list_models())"
   # → {"success": True, "count": 7, "models": {"cartpole": {...}, "hopper": {...}}}
   ```
7. **Click through:** Dashboard → big red **Start MuJoCo Quickstart — docs/ONBOARDING.md** (or Simulations → pick `cartpole` → Start sim → 3D Viewer shows live bodies).

See `INSTALL.md` Options A–D for MCPB/NSIS/pipx variants; this file is the human wrappee path.

## Pitfalls (read before you click Start)

- **Offscreen rendering on headless Linux needs EGL/OSMesa** — `export_frame` fails with `Renderer init failed` in `jobs/<id>/runner.log` until you `apt-get install libosmesa6`.
- **Windows pip without MSVC shows `error: Microsoft Visual C++ 14.0` — fix is `uv pip install --force-reinstall mujoco` after installing Build Tools, not a source build.
- **Ollama not running → AI tools degrade cleanly:** `agentic_sim_workflow` / `natural_language_control` try host `ctx.sample` first, then `http://127.0.0.1:11434/api/generate`, then return `{success: False, message: "LLM unavailable"}`. They never hallucinate fake actuator values.
- **Jobs dir fills up:** `jobs/` accumulates `runner.log` + `frames/`. Safe to delete `jobs/` anytime (also clears job history).
- **Port collision:** If Tauri desktop holds `11046/11047`, `.\start.ps1` warns `WARNING: mujoco-mcp desktop app is running (PID …)`. Stop the desktop app or use `.\start.ps1 -BackendOnly`.
- **Model depot is gitignored** — `models/.depot/registry.json` + `models/*.xml` are not committed. Re-seed on each clone.

## Sanity check

How you know onboarding worked:

- **Health endpoint:** `GET http://127.0.0.1:11046/health` returns `{"status":"ok","mujoco_available":true,"mujoco_version":"3.x","tool_count":20,...}`. When MuJoCo is missing it returns `"status":"degraded","mujoco_available":false` — the dashboard then shows `MOCK` badges (see Declared doubles).
- **Settings page:** probing all three local LLMs (Ollama/LM Studio/vLLM) via `GET /api/llm/providers` — green dot `Detected` when found.
- **One dry-run tool call (no sim needed):**
  ```powershell
  uv run python -c "from mujoco_mcp.server import sim_status; print(sim_status()['mujoco_available'])"
  # True → onboarding done. False → still on MOCK, fix per step 3.
  ```
- **One live tool call (needs a seeded model):**
  ```powershell
  uv run python -c "from mujoco_mcp.server import list_models, sim_status; print('health', sim_status()['status']); print('models', list_models()['count'])"
  ```

## Declared doubles

What works **without** finishing onboarding (MuJoCo not installed / `mujoco_available: false`):

- `GET /api/health` always returns 200 with `mujoco_available: false` + `tool_count: 20` — the server starts even without the wheel.
- `GET /api/capabilities` and `GET /api/v1/diagnostics` return tool lists with `state: "degraded"`.
- `POST /api/mcp/sim_status` returns `{success: True, mujoco_available: false, message: "MuJoCo not available — 0 models …"}`.
- **Mock-until-onboarded UI** in `web_sota/` (`src/lib/mockOnboarding.ts` + `Dashboard.tsx` + `Inbox.tsx`): when `GET /api/health` reports `mujoco_available: false` or `mujoco_version == null`, the dashboard and job list render **declared** sample data so the UI is not a blank desert. Rules:
  - Every mock surface carries a visible **MOCK** badge (`data-testid="mock-badge"`), dashed rose/red border, and `[MOCK]` in body text — never real names.
  - Sample actors use obviously fake names (e.g. **Joe Mocky**, **Sandra Mockinger**) — never real users.
  - Page banner `data-testid="mock-data-banner"` explains “Displaying sample data — complete ONBOARDING.md to see live MuJoCo”.
  - When `GET /api/health` later reports `mujoco_available: true` and `status: "ok"`, **all mock content is removed** and live (or honestly empty) data is shown. No toggle to keep mocks.

No silent fake success that looks live — mock KPIs are labelled `MOCK` and never contribute to job counts.
