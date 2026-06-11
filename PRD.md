# mujoco-mcp — Product Requirements Document

**Version**: 0.2.0-alpha  
**Status**: Active  
**Last Updated**: 2026-06-11  

## 1. Purpose

General-purpose MuJoCo physics simulation server. Start, control, and query MuJoCo simulations from any MCP client (Claude Desktop, Cursor) — designed for robotics sim2real, RL training, differentiable physics pipelines, and fast parallel simulation.

## 2. Scope

### In scope (v0.2-alpha)

| Feature | Priority | Description |
|---------|----------|-------------|
| Sim lifecycle | P0 | start/stop/status/list for isolated MuJoCo subprocesses |
| Model depot | P0 | load/list/search/delete MJCF/URDF models with metadata |
| State sync | P0 | read joint positions, velocities, sensor data, contacts |
| Control apply | P0 | write position/velocity/torque/muscle actuator signals |
| Offscreen rendering | P1 | export PNG frames from headless sims |
| State machine | P0 | SimState enum, SimJob dataclass, guarded transitions |
| AI agentic workflows | P1 | Multi-step sim orchestration via ctx.sample + Ollama fallback |
| Natural language control | P1 | "Bend the knee" → LLM → actuator control.json |
| Conversational state/log analysis | P1 | LLM reads state, describes posture, diagnoses errors |
| Smart model discovery | P2 | LLM generates GitHub URLs, downloads + validates MJCF |
| Web dashboard | P2 | React + Vite at 11047 with 7 pages |
| CI | P1 | ruff lint + pytest on push/PR |

### Out of scope (future)

- Training new policies (defer to upstream RL libraries)
- Multi-GPU parallel sim (MuJoCo CUDA is a future option)
- Real hardware control

## 3. Architecture

```
MCP client -> FastMCP (11046) -> subprocess (runner.py)
                                   -> MuJoCo mjModel + mjData
                                   -> control loop at sim frequency
                                   -> state sync via JSON files
                                   -> state machine lifecycle
```

Each simulation runs as an isolated subprocess. State machine transitions:
```
IDLE → MODEL_LOADED → STARTING → RUNNING → STOPPING → STOPPED
                                    ↓                    ↓
                                 CRASHED               CRASHED
```

## 4. Tools (14 total)

### Sim Tools (9)
- `sim_status` — health check
- `load_model` — download/load MJCF into depot
- `start_sim` — launch background sim subprocess
- `stop_sim` — stop by job_id
- `get_state` — read joint positions, velocities, sensors
- `apply_control` — write actuator commands
- `list_models` — list models in depot
- `list_jobs` — list active/completed jobs
- `export_frame` — export render frame as base64 PNG

### AI Tools (5)
- `agentic_sim_workflow` — multi-step orchestration via host LLM
- `natural_language_control` — NL → actuator values
- `analyze_sim_state` — describe robot posture/behaviour
- `analyze_sim_logs` — diagnose sim errors from stderr
- `discover_model` — find + download MJCF from GitHub

## 5. User Stories

### US-001: Run a simulation
```python
result = await start_sim(model_name="cartpole", headless=True)
state = await get_state(job_id=result["job_id"])
await stop_sim(job_id=result["job_id"])
```

### US-002: Load and control a model
```python
await load_model(uri="https://example.com/robot.xml", name="my_bot")
await start_sim(model_name="my_bot")
await apply_control(job_id="abc12345", ctrl={"knee_joint": 0.5})
```

### US-003: Agentic workflow
```python
await agentic_sim_workflow(goal="Start a humanoid, make it stand, check stability")
```

### US-004: Offscreen rendering
```python
result = await start_sim(model_name="humanoid", render=True)
frame = await export_frame(job_id=result["job_id"])
```

## 6. Ports

| Service | Port |
|---------|------|
| FastMCP backend + HTTP | 11046 |
| Vite React frontend | 11047 |

## 7. External Dependencies

| Dependency | Purpose |
|-----------|---------|
| MuJoCo (mujoco) | Physics engine (Apache 2.0) |
| FastMCP | MCP server framework |
| httpx | HTTP downloads for model discovery |
| Ollama (optional) | AI fallback when ctx.sample unavailable |

## 8. Risks

| Risk | Mitigation |
|------|------------|
| EGL/OSMesa on headless Linux | detect at sim startup, fall back gracefully |
| MuJoCo version changes | pin in pyproject.toml, test on upgrade |
| Subprocess crash | each sim is isolated, state machine tracks properly |
