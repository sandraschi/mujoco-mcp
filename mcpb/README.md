# mujoco-mcp

**General-purpose MuJoCo[^1] physics simulation via MCP. Load any MJCF[^2] model, control actuators, monitor state — through 14 MCP tools.**

[![CI](https://github.com/sandraschi/mujoco-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sandraschi/mujoco-mcp/actions/workflows/ci.yml)
[![Ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![FastMCP](https://img.shields.io/badge/FastMCP-3.2+-blue)](https://github.com/jlowin/fastmcp)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

mujoco-mcp exposes the MuJoCo physics engine as an MCP server. Load any MJCF/URDF model, start and stop simulations, read full state (positions, velocities, contacts), apply joint torques or position targets, and export render frames. The server manages a model depot, a job queue, and a per-job state machine so agents can run concurrent or sequential sims without collision.

Built for the fleet simulation pipeline: upstream from VLA[^3] policy inference (limx-robotics-mcp), downstream from reward computation (ros-mcp), and parallel to GPU-accelerated sims (isaac-mcp).

## Table of Contents

- [Quick Start](#quick-start)
- [Tools](#tools)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Ports](#ports)
- [Footnotes](#footnotes)

## Quick Start

```powershell
# 1. Clone and enter
git clone https://github.com/sandraschi/mujoco-mcp
cd mujoco-mcp

# 2. Run the MCP server
uv run python -m mujoco_mcp

# 3. Or launch the full web dashboard
.\start.ps1
```

## Tools

| # | Tool | Description |
|---|------|-------------|
| 1 | `sim_status` | Health check — MuJoCo availability, active jobs, model depot count |
| 2 | `load_model` | Load an MJCF or URDF model into the depot |
| 3 | `start_sim` | Start a simulation job from a depot model |
| 4 | `stop_sim` | Stop a running simulation job |
| 5 | `get_state` | Read full simulation state (qpos, qvel, contacts, sensor data) |
| 6 | `apply_control` | Apply joint torque, position, or velocity control |
| 7 | `list_models` | List all models in the depot |
| 8 | `list_jobs` | List active and completed simulation jobs |
| 9 | `export_frame` | Export a render frame as PNG from the current sim view |
| 10 | `agentic_sim_workflow` | Multi-step simulation workflow via LLM sampling |
| 11 | `natural_language_control` | Control the sim via natural language ("raise the arm 30 degrees") |
| 12 | `analyze_sim_state` | State vector analysis — contact forces, energy, stability metrics |
| 13 | `analyze_sim_logs` | Parse sim logs for timestep warnings, solver failures |
| 14 | `discover_model` | Search and download models from the MuJoCo Menagerie |

[Full tool reference →](docs/TOOLS.md)

## Architecture

mujoco-mcp runs `mujoco-py` in subprocess workers, one per simulation job. The server uses a lightweight SQLite-backed state machine for job lifecycle (queued → running → paused → completed → failed). Models are stored in a depot at `models/` with automatic format detection (MJCF, URDF, XML).

```
MCP Client  ──►  mujoco-mcp (FastMCP 3.2)
                        │
              ┌─────────┴──────────┐
              │  Job Scheduler      │
              │  (state machine)    │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  MuJoCo Worker     │
              │  (mujoco-py, GLX)  │
              └────────────────────┘
```

[Architecture deep-dive →](docs/ARCHITECTURE.md)

## Documentation

| Doc | Contents |
|-----|----------|
| `docs/TOOLS.md` | Full reference for all 14 tools with inputs, outputs, examples |
| `docs/SETUP.md` | Installation, configuration, MuJoCo Menagerie setup, troubleshooting |
| `docs/ARCHITECTURE.md` | State machine design, job lifecycle, worker pool |

## Ports

| Port | Service |
|------|---------|
| 11046 | FastAPI backend + MCP HTTP |
| 11047 | Vite React frontend |

## Footnotes

[^1]: **MuJoCo** — Multi-Joint dynamics with Contact. Open-source physics engine by Google DeepMind. [mujoco.org](https://mujoco.org)
[^2]: **MJCF** — MuJoCo XML Format, the native model descriptor used by MuJoCo. Equivalent to URDF but more compact.
[^3]: **VLA** — Vision-Language-Action model. An embodied AI paradigm that maps visual and language inputs directly to motor commands.
