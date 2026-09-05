# Install — mujoco-mcp

> **First time?** Complete [docs/ONBOARDING.md](docs/ONBOARDING.md) before expecting live MuJoCo calls — it explains wrappee, costs, and the `mujoco_available: false` → MOCK → live flow.

## Requirements

- **Python 3.11+** + `uv` (`pip install uv` or `winget install --id=astral-sh.uv`)
- **Node 20+ + bun** (`https://bun.sh`) — only for dashboard dev
- **MuJoCo `>=3.2`** — pip wheel, installed by `uv sync` (Windows may need MSVC Build Tools — see ONBOARDING Pitfalls)

## Option A — Source (dev, Windows-first)

```powershell
git clone https://github.com/sandraschi/mujoco-mcp
cd mujoco-mcp
uv sync
uv run python -m mujoco_mcp              # stdio MCP — dies on disconnect, correct for Claude Desktop
# or
.\start.ps1                               # FastAPI 11046 + Vite 11047 (checks ports, uses fleet-start.config.ps1)
```

Verify (also the ONBOARDING Sanity check):
```powershell
uv run python -c "from mujoco_mcp.server import sim_status; print(sim_status())"
curl http://127.0.0.1:11046/health
```

## Option B — MCPB bundle (Claude Desktop / mcp-remote)

```powershell
just mcpb-pack                    # wipes mcpb/src, recopies, packs .mcpb
# then in Claude Desktop → Install .mcpb, or mcp-remote http://127.0.0.1:11046/mcp
```

`mcpb/.mcpbignore` keeps `.venv`, `web_sota`, `native`, `jobs`, `models`, `data` out of the bundle.

## Option C — Tauri Desktop (NSIS)

```powershell
just build-native                # needs Rust + Tauri 2 + WebView2 + VC++ redist
# dist → mujoco-mcp_{version}_x64-setup.exe (currentUser NSIS)
```

Config lives in `native/tauri.conf.json` → `beforeDevCommand` Vite 11047, `resources/mujoco-mcp-backend.exe`.

## Option D — Docker

```powershell
docker compose up --build        # backend 11046, frontend 11047
```

## Verify

```powershell
just ci                          # ruff + format --check + pytest (22, 30% cov) + tsc + biome + pyright
.\start.ps1 -Headless            # backend only
uv run pytest tests/ -q
curl http://127.0.0.1:11046/api/capabilities | jq .tools
```

Troubleshooting: `docs/TROUBLESHOOTING.md`, `docs/CONFIGURATION.md` (env, ports, Vite proxy), `native/BUILD_LOG.md` for NSIS pitfalls.
