# mujoco-mcp

**General-purpose MuJoCo physics simulation via MCP** — start, control, and query MuJoCo simulations from any MCP client (Claude Desktop, Cursor).

**Ports:** Backend 11046 / Frontend 11047

---

## Quick Start

```powershell
git clone https://github.com/sandraschi/mujoco-mcp
cd mujoco-mcp
uv sync
uv run python -m mujoco_mcp
```

Or use the start script:

```powershell
.\start.bat          # backend + webapp
.\start.ps1 -Headless # backend only
```

---

## Tools

| Tool | Description |
|------|-------------|
| `sim_status` | Health check: mujoco importable, model dir, active jobs |
| `load_model` | Download/load an MJCF/XML model into the depot |
| `start_sim` | Launch a MuJoCo simulation as an isolated subprocess |
| `stop_sim` | Stop a running simulation by job_id |
| `get_state` | Read joint positions, velocities, and sensor data |
| `apply_control` | Apply control signals (position, velocity, torque) |
| `list_models` | List all models in the depot with metadata |
| `list_jobs` | List active and completed simulation jobs |
| `export_frame` | Export the latest offscreen render frame as base64 PNG |
| `agentic_sim_workflow` | 🤖 Multi-step sim orchestration via host LLM |
| `natural_language_control` | 🎯 NL → actuator control values |
| `analyze_sim_state` | 📊 Describe robot posture/behaviour from state data |
| `analyze_sim_logs` | 🔍 Root-cause diagnosis from sim stderr |
| `discover_model` | 🌐 Find + download MJCF from GitHub by description |

---

## State Machine

Each simulation uses a proper state machine for deterministic lifecycle management:

```
IDLE → MODEL_LOADED → STARTING → RUNNING → STOPPING → STOPPED
                        ↓           ↓                    ↓
                     CRASHED     CRASHED              CRASHED
```

The `SimStateMachine` module (`src/mujoco_mcp/state_machine.py`) provides:
- **SimState** enum — 8 states: IDLE, MODEL_LOADED, STARTING, RUNNING, STOPPING, STOPPED, CRASHED, ERROR
- **SimJob** dataclass — job_id, process handle, timing, error tracking, lifecycle callbacks
- **7 transition helpers** — `transition_model_loaded`, `transition_starting`, `transition_running`, `transition_stopping`, `transition_stopped`, `transition_crashed`, `transition_reset`
- **Guard assertions** — each transition validates the source state before proceeding
- **Validity table** — `SimJob._valid_transitions()` defines the full directed graph

This is the fleet reference implementation for simulation MCP state machines.

## Architecture

```
MCP client -> FastMCP (11046) -> subprocess (runner.py)
                                   -> MuJoCo mjModel + mjData
                                   -> control loop at sim frequency
                                   -> state sync via JSON files
                                   -> state machine lifecycle
```

Each simulation runs as an isolated subprocess. See `docs/ARCHITECTURE.md`.

---

## Webapp

Vite + React dashboard at **11047** with 7 pages: Dashboard, Simulations, Models, Model Detail, Logging, LLM, Help.

---

## Models

The depot lives at `models/` in the repo (registry: `models/.depot/registry.json`).
Seed the seven built-in models with `.venv\Scripts\python.exe scripts\seed_depot.py`:
- `pendulum.xml` — single pendulum (built-in)
- `double_pendulum.xml` — chaotic double pendulum (built-in)
- `cartpole.xml` — classic cart-pole (Gymnasium inverted_pendulum)
- `hopper.xml` — one-legged hopper (Gymnasium)
- `walker.xml` — planar walker (Gymnasium walker2d)
- `ant.xml` — 4-legged ant (Gymnasium)
- `humanoid.xml` — full-body humanoid (Gymnasium)

---

## Fleet Integration

- **limx-robotics-mcp** (11044/11045) — MuJoCo sim lifecycle for TRON 1 biped and Oli humanoid
- **godot-mcp** (10992/10993) — MuJoCo simulation data visualized in Godot engine

---

## Development

```powershell
just lint              # ruff check
just test              # pytest (22 unit tests)
just e2e               # Playwright e2e tests (web_sota/)
just dev               # backend + frontend with hot reload
just build-native      # Tauri native app (future)
```

See `mcp-central-docs/standards/rules/` for fleet conventions.
