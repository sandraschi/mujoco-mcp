# Changelog

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
