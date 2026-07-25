# Changelog

## 0.3.0 (2026-07-25)

### Real-Time 3D WebGL Viewer
- New **3D Viewer** page: Three.js live rendering of running simulations
- WebSocket endpoint `/ws/sim/{job_id}` streams body positions/orientations every 50ms
- `_sim_runner.py` now dumps `body_positions`, `body_orientations`, `body_parents` for scene reconstruction
- OrbitControls for camera, bone connections between parent/child bodies

### Trajectory Recorder + Timeline Playback
- New `record_trajectory` MCP tool — touch `record.signal` to start recording
- `list_trajectories` tool — query trajectory metadata
- Trajectory Viewer page with play/pause, range slider, frame counter
- REST endpoint `GET /api/trajectory/{job_id}` — returns full frame array + metadata

### Population Runner
- New `run_population` MCP tool — launch N parallel sims with parameter sweeps
- New `population_results` MCP tool — aggregate completion status and final states
- Population Runner page with model selection, sweep config, results table
- Generic `POST /api/mcp/{tool_name}` bridge routes frontend to MCP tools

### Gestural MJCF Editor
- New **Model Editor** page: add/delete bodies, set name/size/color/parent
- Three.js canvas with TransformControls (translate/rotate/scale)
- One-click MJCF XML export

### RL Training Playground
- New `train_policy` MCP tool — trains PPO/SAC via stable-baselines3
- New `rl_trainer.py` — Gymnasium MuJoCoEnv wrapper with configurable reward
- RL Playground page with algorithm/timestep selection, training status
- Optional dependency: `uv sync --extra rl` (stable-baselines3, sb3-contrib, tensorboard)

### Infrastructure
- WebSocket route `sim_ws.py` registered in backend
- Vite proxy configured for `/ws` → ws://127.0.0.1:11046
- Three.js (`three`, `@types/three`) added to webapp dependencies
- `websockets>=10` added to Python dependencies
- Sidebar grew to 12 entries: Dashboard, Simulations, **3D Viewer**, **Trajectory**, **Population**, **Editor**, **RL**, Models, Skills, Logging, LLM, Settings, Help

## 0.2.1 (2026-07-24)

### SOTA Provider Detection
- Replaced free-text LLM provider/model config with SOTA provider detection stack
- Settings page now probes Ollama (11434), LM Studio (1234), and vLLM (8000) in parallel on mount
- Per-provider status indicators (green Detected / gray Not found / pulse Probing)
- Provider dropdown populated only from detected providers
- Model dropdown populated from selected provider's model list
- Amber fallback prompt when no local LLM is detected
- Selection persisted to localStorage across sessions

### Backend
- `GET /api/llm/providers` now probes all 3 providers via `asyncio.gather` + `httpx.AsyncClient`
- `POST /api/llm/chat` routes to correct provider: Ollama `/api/generate`, LM Studio/vLLM `/v1/chat/completions`

### Fixes
- Created missing `web_sota/src/lib/api.ts` (fixed TS2307 crash in FloatingChat)
- Fixed TRY401 redundant exception arg in `state_machine.py`
- Fixed S110/S112 bare `except: pass/continue` — added logging
- Applied ruff format (8 files reformatted)
- Added `ruff` to dev dependencies

## 0.2.0 (2026-07-04)

This release brings the repo to full fleet certification bar: NSIS build pipeline, standard compliance, and rich web UI features.

### NSIS/Tauri Build Pipeline
- Created `run_server.py` — dual-transport entry point (HTTP when MUJOCO_MCP_PORT set, stdio otherwise)
- Created `mujoco-mcp-backend.spec` — PyInstaller spec with strip=False, upx=False, noarchive=True
- Fixed `tauri.conf.json`: frontendDist path, CSP port, bundled .env.example instead of .env
- Fixed `backend.rs`: port 10700→11046, hardened free_port() with multi-layer kill loop
- Fixed `build.ps1`: entry-point gate, frozen binary smoke test, size gate (>= 5 MB)
- Created `.env.example` — safe template for user credentials

### Standard Compliance
- Added tool annotations (READ_ONLY / MUTATING) to all 14 tools
- Added `## Return Format` and `## Examples` docstrings to all sim tools
- Created `glama.json` for Glama MCP registry
- Created `llms-full.txt` — comprehensive LLM documentation
- Added `prefab-ui>=0.14.0` to core dependencies
- Added `GET /api/v1/diagnostics` endpoint for CUA smoke testing
- Fixed `/api/health` to return standard fleet format (version, uptime_seconds, tool_count)
- Added CORS origins for Tauri WebView (tauri://localhost)

### Web Dashboard Improvements
- Ctrl+Scroll zoom with localStorage persistence (`useZoom` hook)
- `backend-status` Tauri event listener + "Restart Backend" button
- Exponential backoff health polling in Dashboard
- Chat personality selector (4 personalities: Research Assistant, Expert Reviewer, Quick Summarizer, Custom)
- Chat history persistence in localStorage (100-msg cap)
- Export .txt and Clear buttons on LLM page
- Skills page with REST endpoint (`GET /api/skills`, `GET /api/skills/{name}`)
- Added `/mcp` proxy in Vite config
- `data-testid` attributes on Dashboard, sidebar, LLM page
- `color-scheme: dark` CSS for native form controls

### Repository
- Fixed pre-existing TypeScript gate failures (installed @types/react/@types/react-dom)
- Fixed pre-existing ruff warnings (ambiguous variable l, deprecated regex→pattern)
- Cleaned up stale .bak file
- MCPB bundle: `dist/mujoco-mcp-v0.2.0.mcpb` (27.7 KB, 12 files)
- Prefab UI cards: `show_sim_status_card`, `show_models_card`, `show_jobs_card`
- MCP resources: `skill://{name}` for skill content via MCP protocol
- Prompt templates: `debug_crashed_sim`, `tune_control_policy`, `compare_two_models`
- Session context injection: `.claude-plugin/`, `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`
- Biome JS/TS linting config (`web_sota/biome.json`) with CI integration
- `scripts/install-mcp-clients.ps1` — registers MCP URL in Cursor and Claude Desktop
- Pre-commit config (`.pre-commit-config.yaml` with ruff)
- Dockerfile + docker-compose.yml for containerized deployment
- CI improvements: push/PR triggers, tsc --noEmit + biome + vite build steps
- nightly schedule (06:00 UTC), ty job with continue-on-error
- Help.tsx dark theme fix (24 light-mode classes → dark equivalents)
- Models page backend routes (GET /api/models, POST /api/models/load, POST /api/models/seed)
- MuJoCo Menagerie browser: GET /api/menagerie (GitHub API), POST /api/menagerie/load, frontend tab with search + download
- Unitree H1 and Go2 added to seed script
- starrt.ps1 frontend launch fix (cmd.exe /c for npx.cmd)
- Updated README, CHANGELOG, PRD, projects page, STATUS.md, TODO.md
- 22 pytest tests passing, tsc --noEmit clean, Vite build clean, Biome check clean

## 0.2.0-alpha (2026-06-11)

- Initial release: 14 MCP tools (9 sim + 5 AI)
- Sim tools: sim_status, load_model, start_sim, stop_sim, get_state, apply_control, list_models, list_jobs, export_frame
- AI tools: agentic_sim_workflow, natural_language_control, analyze_sim_state, analyze_sim_logs, discover_model
- State machine reference implementation: SimState enum (8 states), SimJob dataclass, 7 transition helpers (loaded/starting/running/stopping/stopped/crashed/reset), guard assertions, lifecycle callbacks
- Web dashboard (7 pages): Dashboard, Simulations, Models, Model Detail, Logging, LLM, Help
- 22 pytest unit tests (sim lifecycle, model depot, AI fallbacks, state transitions)
- 6 Playwright e2e tests (health, frontend load, console errors, nav, LLM page, help tabs)
- GitHub CI with ruff lint + pytest on push/PR
- docs/ARCHITECTURE.md — full system design doc
- docs/MUJOCO_VS_OTHERS.md — comparison with Gazebo, Isaac Sim, PyBullet
- PRD.md, CHANGELOG.md, AGENTS.md, CLAUDE.md
- Fleet-standard port registration (11046/11047)
- llms.txt / llms-full.txt for Claude Desktop discovery
- start.ps1, start.bat, justfile, pyproject.toml
- Tauri native app scaffolding (future)
