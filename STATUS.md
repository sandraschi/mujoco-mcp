# mujoco-mcp — Status

**Version:** 0.3.0
**Updated:** 2026-07-31

## Build Gates

| Gate | Status |
|------|--------|
| `ruff check src/ web_sota/backend/` | ✅ 0 errors |
| `ruff format --check` | ✅ clean |
| `tsc --noEmit` | ✅ 0 errors |
| `uv run pytest tests/ -q` | ✅ 22/22 pass (32% cov, gate 30%) |
| `bun run build` (Vite) | ✅ built, CSS 24.3 kB (Tailwind active) |
| `bunx @biomejs/biome check src/` | ✅ clean |

## Fleet Standards Compliance

| Standard | Status | Notes |
|----------|--------|-------|
| Port registration (11046/11047) | ✅ | In WEBAPP_PORTS.md |
| Tool annotations (READ_ONLY/MUTATING) | ✅ | All 20 tools |
| Docstrings (Return Format + Examples) | ✅ | All tools |
| `glama.json` | ✅ | Root |
| `llms.txt` + `llms-full.txt` | ✅ | Root |
| `prefab-ui` dependency | ✅ | In pyproject.toml |
| `justfile` with recipes | ✅ | 10 recipes |
| `start.ps1` + `start.bat` | ✅ | Port zombie clearing, health poll, browser open |
| Health API (`/api/health`) | ✅ | Fleet format (version, uptime, tool_count) |
| Diagnostics API (`/api/v1/diagnostics`) | ✅ | Tools, system info, errors |
| Tauri CORS origins | ✅ | tauri://localhost, http/s://tauri.localhost |
| NSIS build pipeline | ✅ | build.ps1 with all gates |
| NSIS hooks (PREINSTALL/PREUNINSTALL) | ✅ | Kill both processes |
| CUA smoke test | ✅ | 11-phase script |
| `backend.rs` free_port() | ✅ | Multi-layer + 240s poll + UAC escalation |
| Web zoom (Ctrl+Scroll) | ✅ | use-zoom.ts hook |
| `backend-status` event listener | ✅ | Dashboard |
| Exponential backoff health polling | ✅ | Dashboard |
| Chat personality selector | ✅ | 4 personalities |
| Chat history persistence | ✅ | localStorage, 100-msg cap |
| Skills page | ✅ | REST + frontend |
| `data-testid` attributes | ✅ | Dashboard, sidebar, LLM page |
| Dark theme (`color-scheme: dark`) | ✅ | CSS + Tailwind v4 |
| Vite `/mcp` proxy | ✅ | Dev proxy |
| `@tauri-apps/api` | ✅ | In package.json + installed |
| MCPB bundle | ✅ | `dist/mujoco-mcp-v0.2.0.mcpb` (27.7 KB) |
| `AGENTS.md` / `CLAUDE.md` | ✅ | Agent context files |
| `.env.example` | ✅ | Root, bundled in NSIS |
| `PRD.md` / `CHANGELOG.md` | ✅ | Updated to 0.2.0 |
| Session context injection | ✅ | `.claude-plugin/`, `.cursorrules`, `.windsurfrules`, copilot-instructions.md, `.opencode/skills/`, `.agents/skills/` |
| MCP resources (`skill://{name}`) | ✅ | Skills exposed via MCP protocol |
| MCP prompt templates | ✅ | debug_crashed_sim, tune_control_policy, compare_two_models |
| Prefab UI cards | ✅ | show_sim_status_card, show_models_card, show_jobs_card |
| `install-mcp-clients.ps1` | ✅ | NSIS POSTINSTALL registers in Cursor/Claude Desktop |
| Biome JS/TS linting | ✅ | Config in web_sota/biome.json, runs in CI |
| Pre-commit config | ✅ | `.pre-commit-config.yaml` with ruff |
| Docker support | ✅ | Dockerfile + docker-compose.yml |
| CI on push/PR | ✅ | tsc + biome + vite build added |

## Known Gaps

| Issue | Severity | Notes |
|-------|----------|-------|
| No active development CI | Low | CI runs on push/PR + tags. No nightly or scheduled runs |
