# mujoco-mcp — Product Requirements Document

**Version**: 0.3.0
**Status**: Active
**Last Updated**: 2026-07-25

## 1. Purpose

General-purpose MuJoCo physics simulation server. Start, control, and query MuJoCo simulations from any MCP client (Claude Desktop, Cursor) — designed for robotics sim2real, RL training, differentiable physics pipelines, and fast parallel simulation.

## 2. Scope

### In scope (v0.3.0)

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
| Tauri/NSIS installer | P1 | Native desktop wrapper with embedded backend |
| Tool annotations | P1 | READ_ONLY/MUTATING on all 14 tools |
| Glama registry | P1 | glama.json for MCP registry indexing |
| Skills page | P2 | REST endpoint + frontend page for skill content |
| Chat personality selector | P2 | 4 personalities, localStorage persistence |
| Ctrl+Scroll zoom | P2 | Tauri WebView zoom with localStorage persistence |
| Diagnostics endpoint | P1 | GET /api/v1/diagnostics for CUA smoke testing |
| 3D WebGL Viewer | P1 | Three.js live rendering via WebSocket, body bones, OrbitControls |
| Trajectory Recorder | P2 | Record sim states to trajectory.jsonl, playback with timeline |
| Population Runner | P2 | N parallel sims with parameter sweeps, results aggregation |
| MJCF Editor | P2 | Drag-and-drop body editor with TransformControls, MJCF export |
| RL Training | P2 | PPO/SAC training via stable-baselines3, policy checkpoint export |

### In scope (future / v0.4.0)

- Multi-GPU parallel sim (MuJoCo CUDA is a future option)
- Real hardware control
- WebSocket-backed RL reward streaming to the browser
- Gesture-based robot posing (drag a limb → sim applies it)

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

## 4. Tools (19 total)

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

### Trajectory Tools (2)
- `record_trajectory` — start recording state trajectory
- `list_trajectories` — query trajectory frame count and time range

### Population Tools (2)
- `run_population` — launch N parallel sims with parameter sweeps
- `population_results` — aggregate results from completed sims

### RL Training Tool (1)
- `train_policy` — train PPO/SAC policy via stable-baselines3

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
