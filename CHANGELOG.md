# Changelog

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
