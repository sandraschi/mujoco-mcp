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
| `sim_start` | Launch a MuJoCo simulation from an MJCF file or built-in model |
| `sim_stop` | Stop a running simulation |
| `sim_status` | Query simulation state (time, framerate, contacts) |
| `sim_sync` | Read current joint positions, velocities, and sensor data |
| `sim_step` | Advance one or more timesteps |
| `sim_apply` | Apply control signals (position, velocity, torque, muscle) |
| `sim_reset` | Reset simulation to initial state |
| `sim_list` | List all running simulations |
| `model_list` | List available models in the depot |
| `model_load` | Load an MJCF or URDF model into the depot |
| `model_info` | Inspect model structure (bodies, joints, actuators, geoms) |
| `model_delete` | Remove a model from the depot |
| `model_search` | Search for models in the depot by keyword |
| `mcp_status` | Server health and capability overview |

---

## Architecture

```
MCP client -> FastMCP (11046) -> subprocess (runner.py)
                                   -> MuJoCo mjModel + mjData
                                   -> control loop at sim frequency
                                   -> state sync via JSON over pipe
```

Each simulation runs as an isolated subprocess. See `docs/ARCHITECTURE.md`.

---

## Models

The depot at `~/.mujoco-mcp/models/` stores MJCF files. Built-in models:
- `pendulum.xml` — single pendulum
- `double_pendulum.xml` — chaotic double pendulum
- `cartpole.xml` — classic cart-pole
- `hopper.xml` — one-legged hopper (DM Control)
- `walker.xml` — planar walker (DM Control)
- `ant.xml` — 4-legged ant (DM Control)
- `humanoid.xml` — full-body humanoid (DM Control)

---

## Webapp

Vite + React dashboard at **11047** with model depot browser, simulation control panel, real-time state viewer, and contact visualization.

---

## Fleet Integration

- **limx-robotics-mcp** (11044/11045) — MuJoCo sim lifecycle for TRON 1 biped and Oli humanoid
- **godot-mcp** (10992/10993) — MuJoCo simulation data visualized in Godot engine

---

## Development

```powershell
just lint              # ruff check
just test              # pytest
just dev               # backend + frontend with hot reload
just build-native      # Tauri native app (future)
```

See `mcp-central-docs/standards/rules/` for fleet conventions.
