# mujoco-mcp

**General-purpose MuJoCo[^1] physics simulation via MCP. Load any MJCF[^2] model, control actuators, monitor state — through 14 MCP tools with AI workflows, a web dashboard, and a Tauri/NSIS native installer.**

[![CI](https://github.com/sandraschi/mujoco-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sandraschi/mujoco-mcp/actions/workflows/ci.yml)
[![Ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![FastMCP](https://img.shields.io/badge/FastMCP-3.4-blue)](https://github.com/jlowin/fastmcp)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

mujoco-mcp exposes the MuJoCo physics engine as an MCP server. Load any MJCF/URDF model, start and stop simulations, read full state (positions, velocities, contacts), apply joint torques or position targets, and export render frames. The server manages a model depot, a job queue, and a per-job state machine so agents can run concurrent or sequential sims without collision.

Built for the fleet simulation pipeline: upstream from VLA[^3] policy inference (limx-robotics-mcp), downstream from reward computation (ros-mcp), and parallel to GPU-accelerated sims (isaac-mcp).

**New in 0.3.0:** Real-Time 3D WebGL Viewer with WebSocket state streaming, Trajectory Recorder + Timeline Playback, Population Runner for parallel parameter sweeps, Gestural MJCF Editor with TransformControls, RL Training Playground (PPO/SAC via stable-baselines3).

## Table of Contents

- [Quick Start](#quick-start)
- [Tools](#tools)
- [Web Dashboard](#web-dashboard)
- [Architecture](#architecture)
- [Documentation](#documentation)
- [Ports](#ports)
- [Footnotes](#footnotes)

## Quick Start

```powershell
# 1. Clone and enter
git clone https://github.com/sandraschi/mujoco-mcp
cd mujoco-mcp

# 2. Run the MCP server (stdio)
uv run python -m mujoco_mcp

# 3. Or launch the full web dashboard
.\start.ps1
```

## Tools

All 19 tools are annotated with READ_ONLY or MUTATING for agent safety.

### Sim Tools (9)
| Tool | Annotation | Description |
|------|-----------|-------------|
| `sim_status` | READ_ONLY | Health check — MuJoCo availability, active jobs, model depot count |
| `load_model` | MUTATING | Load an MJCF or URDF model into the depot |
| `start_sim` | MUTATING | Start a simulation job from a depot model |
| `stop_sim` | MUTATING | Stop a running simulation job |
| `get_state` | READ_ONLY | Read full simulation state (qpos, qvel, contacts, sensor data) |
| `apply_control` | MUTATING | Apply joint torque, position, or velocity control |
| `list_models` | READ_ONLY | List all models in the depot |
| `list_jobs` | READ_ONLY | List active and completed simulation jobs |
| `export_frame` | READ_ONLY | Export a render frame as PNG from the current sim view |

### AI Tools (5)
| Tool | Annotation | Description |
|------|-----------|-------------|
| `agentic_sim_workflow` | MUTATING | Multi-step simulation workflow via LLM sampling |
| `natural_language_control` | MUTATING | Control the sim via natural language ("raise the arm 30 degrees") |
| `analyze_sim_state` | READ_ONLY | State vector analysis — contact forces, energy, stability metrics |
| `analyze_sim_logs` | READ_ONLY | Parse sim logs for timestep warnings, solver failures |
| `discover_model` | MUTATING | Search and download models from the MuJoCo Menagerie |

### Trajectory Tools (2)
| Tool | Annotation | Description |
|------|-----------|-------------|
| `record_trajectory` | MUTATING | Start recording state trajectory to trajectory.jsonl |
| `list_trajectories` | READ_ONLY | Query trajectory metadata (frame count, time range) |

### Population Tools (2)
| Tool | Annotation | Description |
|------|-----------|-------------|
| `run_population` | MUTATING | Launch N parallel sims with parameter sweeps |
| `population_results` | READ_ONLY | Aggregate results from completed population sims |

### RL Training Tool (1)
| Tool | Annotation | Description |
|------|-----------|-------------|
| `train_policy` | MUTATING | Train PPO/SAC policy via stable-baselines3 |

## Web Dashboard

12-page React + Vite + Three.js dashboard at `http://localhost:11047`:

| Page | Features |
|------|----------|
| **Dashboard** | KPI cards (MuJoCo, models, jobs, server status), exponential backoff health polling, `backend-status` Tauri event listener, "Restart Backend" button, AI workflow quick-input |
| **Simulations** | Start/stop sims, model selection, state inspection, AI analyze |
| **3D Viewer** | Live Three.js rendering of running sims via WebSocket, OrbitControls, body bones |
| **Trajectory** | Recorded sim playback with play/pause, range slider, frame counter |
| **Population** | Launch N parallel sims with parameter sweeps, results aggregation table |
| **Editor** | Drag-and-drop MJCF model builder with add/delete bodies, TransformControls, MJCF export |
| **RL** | Train PPO/SAC policies on loaded models, algorithm/timestep config, training status |
| **Models** | Load from URL/path, list with metadata, two tabs: Local Depot + MuJoCo Menagerie browser with search and one-click download |
| **Skills** | Browse and load the MuJoCo expert skill for agent guidance |
| **Logging** | Log viewer with filters, tail mode, export JSON/CSV |
| **LLM** | Chat with 4 personalities (Research Assistant, Expert Reviewer, Quick Summarizer, Custom), localStorage history persistence (100-msg cap), Export .txt, Clear |
| **Settings** | Model dir, jobs dir, SOTA provider detection (Ollama/LM Studio/vLLM probe, status indicators, provider + model dropdowns) |
| **Help** | 4-tab help: Overview, Tools, Setup, Troubleshooting |

AI features use the LLM through the `/api/llm/chat` endpoint, with auto-discovery of local providers (Ollama, LM Studio, vLLM). The Settings page probes all three on mount, shows per-provider status indicators, and populates provider/model dropdowns. The chat page includes a personality selector that composes system prompts from the loaded skill content.

## Architecture

mujoco-mcp runs simulations as isolated subprocesses (one per job), communicating over JSON files on disk for crash isolation. The server uses a state machine (SimState: IDLE → MODEL_LOADED → STARTING → RUNNING → STOPPING → STOPPED/CRASHED) for lifecycle management.

```
MCP Client  ──►  mujoco-mcp (FastMCP 3.4)
                        │
              ┌─────────┴──────────┐
              │  Job Scheduler      │
              │  (state machine)    │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  MuJoCo Worker     │
              │  (subprocess)      │
              │  JSON file IPC     │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  WebSocket Stream  │ ←── 3D Viewer
              │  /ws/sim/{job_id}  │
              └─────────┬──────────┘
                        │
              ┌─────────▼──────────┐
              │  REST Bridge       │ ←── Population / RL / Trajectory
              │  /api/mcp/{tool}   │
              └────────────────────┘

Desktop:  Tauri Shell ──► FastAPI Backend (11046)
                                  │
                          React Frontend (11047) — Three.js + 12 pages
```

## Documentation

| Doc | Contents |
|-----|----------|
| `docs/TOOLS.md` | Full reference for all 19 tools with inputs, outputs, examples |
| `docs/SETUP.md` | Installation, configuration, MuJoCo Menagerie setup, troubleshooting |
| `docs/ARCHITECTURE.md` | State machine design, job lifecycle, worker pool |
| `llms.txt` | LLM index for Claude Desktop discovery |
| `llms-full.txt` | Full LLM reference — all tools, env vars, architecture, troubleshooting |
| `PRD.md` | Product requirements document |
| `CHANGELOG.md` | Version history |
| `STATUS.md` | Current compliance and known gaps |
| `TODO.md` | Upcoming work items |
| `mcp-central-docs/projects/mujoco-mcp/v0.3.0-PLAN.md` | Feature plan document |

## Ports

| Port | Service |
|------|---------|
| 11046 | FastAPI backend + MCP HTTP + REST API |
| 11047 | Vite React frontend (dev) |

### Additional Files

| File | Purpose |
|------|---------|
| `.cursorrules` / `.windsurfrules` | Session context injection for Cursor/Windsurf |
| `.claude-plugin/plugin.json` | Claude Code session-start hook |
| `.github/copilot-instructions.md` | GitHub Copilot custom instructions |
| `scripts/install-mcp-clients.ps1` | Register MCP in Cursor/Claude Desktop |
| `biome.json` | JS/TS linting config |
| `Dockerfile` / `docker-compose.yml` | Containerized deployment |

## Footnotes

[^1]: **MuJoCo** — Multi-Joint dynamics with Contact. Open-source physics engine by Google DeepMind. [mujoco.org](https://mujoco.org)
[^2]: **MJCF** — MuJoCo XML Format, the native model descriptor used by MuJoCo. Equivalent to URDF but more compact.
[^3]: **VLA** — Vision-Language-Action model. An embodied AI paradigm that maps visual and language inputs directly to motor commands.
