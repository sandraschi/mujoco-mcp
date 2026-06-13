# mujoco-mcp Setup

## Prerequisites

- Python 3.11+
- `uv` package manager ([install guide](https://docs.astral.sh/uv/#getting-started))
- MuJoCo is a pip package — no external simulator installation needed

## Installation

```powershell
git clone https://github.com/sandraschi/mujoco-mcp.git
cd mujoco-mcp
uv sync
uv pip install mujoco
```

## Simulator Setup

No separate simulator setup required. MuJoCo is installed as a Python package (`mujoco`). The MCP server launches MuJoCo as a managed subprocess.

For offscreen rendering (the `render=True` option on `start_sim`), ensure your system has:
- **Linux:** `libegl1-mesa` or `libosmesa6` (`apt install libegl1-mesa libgl1-mesa-glx`)
- **Windows:** Works out of the box with EGL
- **macOS:** Works out of the box

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MUJOCO_MCP_MODELS_DIR` | `./models/` | Model depot directory |
| `MUJOCO_MCP_JOBS_DIR` | `./jobs/` | Simulation job state directories |

### Ports

| Service | Port |
|---------|------|
| Backend (REST + MCP HTTP) | 11046 |
| Frontend (Vite dev) | 11047 |

## Running

### MCP stdio (for Claude Desktop, Cursor, etc.)

```powershell
uv run python -m mujoco_mcp
```

### Web Dashboard

```powershell
.\web_sota\start.ps1
```

Or manually:

```powershell
# Terminal 1: backend
cd web_sota
uv run uvicorn backend.server:app --host 127.0.0.1 --port 11046

# Terminal 2: frontend
cd web_sota
npm install
npm run dev -- --port 11047
```

### Docker

Not recommended — MuJoCo is already a pip package. If needed:

```dockerfile
FROM python:3.11-slim
RUN pip install uv && uv pip install mujoco
COPY . /app
WORKDIR /app
CMD ["uv", "run", "python", "-m", "mujoco_mcp"]
```

## Testing

```powershell
uv run pytest tests/ -q
npx playwright test       # e2e tests (from web_sota/)
ruff check src/ web_sota/backend/
```

## Troubleshooting

### "mujoco not available" in sim_status

**Cause:** The `mujoco` Python package is not installed.  
**Fix:** `uv pip install mujoco`

### Simulation exits immediately

**Cause:** Missing model file or invalid MJCF XML.  
**Fix:** Check the job log at `jobs/<job_id>/runner.log`. Validate XML: `uv run python -c "import mujoco; mujoco.MjModel.from_xml_path('models/your_model.xml')"`

### Offscreen rendering returns empty frames

**Cause:** EGL/OSMesa not available on Linux.  
**Fix:** `apt install libegl1-mesa libgl1-mesa-glx` or use `start_sim(render=False)`

### "No state data" on get_state

**Cause:** The sim runner hasn't written state.json yet (race condition on startup).  
**Fix:** Wait a few seconds and retry. Check the job is still alive with `get_state` or `list_jobs`.

### Port 11046/11047 already in use

**Cause:** Another process is bound to the port.  
**Fix:** 
```powershell
Get-NetTCPConnection -LocalPort 11046 | ForEach { Stop-Process $_.OwningProcess -Force }
```

### uv sync fails

**Cause:** Outdated uv or missing system dependencies.  
**Fix:** `uv self update` then retry. On Windows, ensure Visual C++ Redistributable is installed.

### Subprocess pipe deadlock

**Cause:** The server uses log files instead of PIPE for subprocess stdout/stderr.  
**Fix:** This is by design. If you see "File not found" errors, check `jobs/<job_id>/runner.log` exists.
