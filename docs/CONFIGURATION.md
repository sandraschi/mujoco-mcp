# Configuration — mujoco-mcp

Port registry: `mcp-central-docs/operations/WEBAPP_PORTS.md` — backend **11046**, frontend **11047** (adjacent pair, forbidden-range free).

## Env vars (all optional, defaults shown)

| Var | Default | Where read | Purpose |
|-----|---------|------------|---------|
| `MUJOCO_MCP_PORT` | `11046` | `run_server.py`, `web_sota/backend/server.py` | HTTP port (Tauri sets via `MUJOCO_MCP_PORT`; `MCP_PORT` alias also accepted) |
| `MUJOCO_MCP_HOST` | `127.0.0.1` | `run_server.py` | Bind host |
| `MUJOCO_MCP_TAURI` | — | `web_sota/backend/server.py` | Tauri mode flag (set by NSIS wrapper) |
| `MUJOCO_MCP_OLLAMA_MODEL` | `llama3.2:3b` | `src/mujoco_mcp/server.py` | Ollama fallback model for AI tools (`agentic_sim_workflow`, `natural_language_control`, `analyze_sim_state`, `analyze_sim_logs`, `discover_model`) |
| `WEB_PORT` | `11046` | `fleet-start.config.ps1` Backend.Env | Fleet launcher mirror of `MUJOCO_MCP_PORT` |

Copy `.env.example` → `.env` to set local values (`.env` is gitignored).

## File locations (relative to repo root)

| Path | What |
|------|------|
| `models/` | MJCF/URDF model depot (created on first `load_model`) |
| `models/.depot/registry.json` | Depot registry (written by `load_model` / `discover_model`) |
| `jobs/<job_id>/` | Per-job dir: `state.json`, `metadata.json`, `control.json`, `stop.signal`, `runner.log`, `frames/`, `trajectory.jsonl`, `sweep.json`, `error.txt`, `completed.txt` |
| `logs/server.log` | File-watch log source for Logging page |

## Backend CORS

`web_sota/backend/server.py` allows `http://localhost:11046`, `http://127.0.0.1:11046`, `http://localhost:11047`, `http://127.0.0.1:11047`, `http://tauri.localhost`, `https://tauri.localhost`, `tauri://localhost`, plus `allow_origin_regex` for Tailscale (`*.ts.net`) and LAN (`192.168.*`, `10.*`, `100.*`) — no `allow_origins=["*"]`.

## Frontend proxy (Vite, dev only)

`web_sota/vite.config.ts` proxies `/api`, `/health`, `/mcp` → `http://127.0.0.1:11046` and `/ws` → `ws://127.0.0.1:11046`.

## Fleet launcher

`fleet-start.config.ps1` is the single source of truth for `start.ps1` / NSIS `backend.rs`:

```powershell
@{
  Name         = 'mujoco-mcp'
  BackendPort  = 11046
  FrontendPort = 11047
  HealthPath   = '/health'
  WebRoot      = 'web_sota'
  Backend = @{ Kind='uvicorn'; UvicornTarget='web_sota.backend.server:app' }
  Frontend = @{ Kind='none' }
}
```

`WebRoot` is relative (fleet engine resolves it from the repo root). `FrontendPort` must stay 11047 even though the frontend is served by Vite in dev — the engine probes it for readiness.

## Troubleshooting

- Offscreen renders need EGL/OSMesa on headless Linux.
- AI tools prefer host LLM via `ctx.sample`; fallback is `http://127.0.0.1:11434` (Ollama).
- Reset: delete `jobs/` and `models/.depot/registry.json`.
