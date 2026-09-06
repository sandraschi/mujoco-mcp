# mujoco-mcp

**General-purpose MuJoCo[^1] physics simulation via MCP. Load any MJCF[^2] model, control actuators, monitor state — through 20 MCP tools with AI workflows, a web dashboard, and a Tauri/NSIS native installer.**

[![CI](https://github.com/sandraschi/mujoco-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/sandraschi/mujoco-mcp/actions/workflows/ci.yml)
[![Ruff](https://img.shields.io/badge/code%20style-ruff-000000.svg)](https://github.com/astral-sh/ruff)
[![FastMCP](https://img.shields.io/badge/FastMCP-3.4-blue)](https://github.com/jlowin/fastmcp)
[![Python](https://img.shields.io/badge/python-3.11%2B-blue)](https://www.python.org)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)

> **First time?** Complete [docs/ONBOARDING.md](docs/ONBOARDING.md) before expecting live host calls — it covers `mujoco_available: false` → MOCK → live.

mujoco-mcp exposes the MuJoCo physics engine as an MCP server. Load any MJCF/URDF model, start and stop simulations, read full state (positions, velocities, contacts), apply joint torques or position targets, and export render frames. The server manages a model depot, a job queue, and a per-job state machine so agents can run concurrent or sequential sims without collision. When MuJoCo is not installed the server still starts (`status: "degraded"`, `mujoco_available: false`) and the dashboard shows **MOCK** sample data (Joe Mocky / Sandra Mockinger) until you `uv sync` + MSVC fix.

**New in 0.3.0:** Real-Time 3D WebGL Viewer with WebSocket state streaming, Trajectory Recorder + Timeline Playback, Population Runner for parallel parameter sweeps, Gestural MJCF Editor with TransformControls, RL Training Playground (PPO/SAC via stable-baselines3), plus two MuJoCo-specific pages (MuJoCo & Fleet) in the 16-page dashboard.

## Table of Contents

- [Quick Start](#quick-start)
- [Stack](#stack)
- [MuJoCo — History, Community & Comparison](#mujoco--history-community--comparison)
- [Fleet Integration — VR / Sim / Robotics](#fleet-integration--vr--sim--robotics)
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

Open theDashboard at `http://127.0.0.1:11047` → **MuJoCo** (engine deep dive) → **Fleet** (where this fits in 213-repo fleet).

## Stack

| Layer | Tech | Why |
|-------|------|-----|
| **Physics** | MuJoCo `>=3.2` (C, autodiff) | Soft contact, elliptic cone, built-in derivatives — 10–50× realtime on one CPU |
| **MCP** | FastMCP `>=3.4.4,<4` (Python) | `@mcp.tool(annotations=)` + `@mcp.resource` + `@mcp.prompt` + `ctx.sample` + Prefab cards |
| **Backend** | FastAPI + Uvicorn on `web_sota.backend.server:app` | REST `/api/*` + MCP streamable HTTP `/mcp` + WebSocket `/ws/sim/{job}` + CORS for Tauri/Tailscale |
| **IPC** | `_sim_runner.py` subprocess + JSON files (`state.json`, `control.json`, `metadata.json`) | Crash isolation — a bad MJCF cannot kill the MCP server |
| **Webapp** | React 19 + Vite 6 + Tailwind 4 + Zustand 5 + Three.js 0.185 + OrbitControls | Dark Slate-950, Lucide not emoji, `store/llm.ts` LLM global, `lib/use-zoom` Tauri zoom |
| **Desktop** | Tauri 2.0 (NSIS `currentUser`) | `native/tauri.conf.json` — `beforeDevCommand` → Vite 11047, `resources/mujoco-mcp-backend.exe` |
| **Tooling** | `uv`, `ruff` (E,W,F,I,B,UP,T20), `pyright` basic, `biome` 2.0, `tsc` 5.8, `pytest` 22 tests | `justfile` `ci` = ruff + format + pytest + tsc + biome + pyright |
| **Ports** | 11046 backend / 11047 frontend (adjacent, operations/WEBAPP_PORTS.md) | `fleet-start.config.ps1` `UvicornTarget=web_sota.backend.server:app` |

## MuJoCo — History, Community & Comparison

### What it is

MuJoCo solves articulated-body dynamics in generalized coordinates (joints *are* the coordinates, not constraints). Contacts use a convex, soft solver with analytic Jacobians (`mjd_transitionFD`) — stable at 2–5 ms timesteps, differentiable end-to-end for trajectory optimization and system ID. One MJCF XML defines bodies, joints, actuators (motor/muscle/tendon), sensors, equality constraints — compiler builds collision tables via convex decomposition.

### History

| Year | Event |
|------|-------|
| 2009–12 | Emanuel Todorov (U. Washington) builds MuJoCo at Roboti LLC — first engine to simulate humanoids with contacts faster than realtime on a single CPU. |
| 2015–21 | DM Control Suite + Gym adopt it; de-facto RL locomotion engine. Commercial license (~$3k/seat) but free for academics. |
| Oct 2021 | DeepMind acquires → Apache 2.0 on `google-deepmind/mujoco`. Menagerie (30+ robots: Unitree H1/Go2, Shadow Hand, Franka) added. |
| 2022–now | ~12k GitHub stars, 200+ contributors, `mujoco>=3.2` with autodiff, Brax/JAX GPU pipeline (10k parallel envs), MuJoCo Playground. This server wraps MuJoCo directly, no wrapper. |

### Community

- `mujoco.org` — docs + forum + 200+ MJCF examples
- Menagerie (`google-deepmind/mujoco_menagerie`) — 30+ open robots, one-click in the **Models** page
- DM Control Suite — cheetah / walker / humanoid benchmarks
- Brax (`google/brax`) — JAX GPU, 10k envs
- MuJoCo Playground — browser MJCF editor
- GitHub Discussions + Slack (~5k) — solver-tuning answers within hours

### Strengths vs Weaknesses

| Strengths | Weaknesses |
|-----------|------------|
| 10–50× realtime on one CPU; 1k+ envs on one GPU (Brax) | No lidar/camera noise, aerodynamics, hydrodynamics |
| Analytic derivatives — no PPO needed for some policies; iLQR/ALTRO | Minimal sensor suite vs Gazebo plugins |
| One-file `model.xml` (~10 MB wheel, <1 s cold start vs Gazebo ~2 GB, Isaac ~10 GB) | No multi-robot networking built in |
| Muscle/tendon/equality/sensors built in | EGL/OSMesa needed for headless offscreen |
| Muscle/muscle, tendon, welds — expressive | Deformables experimental (PyBullet/Flex better) |
| First-class Python, no ROS/C++ toolchain | Photoreal rendering needs Isaac/Omniverse |

### vs Alternatives (summary — full matrix in `docs/MUJOCO_VS_OTHERS.md`, also on the **MuJoCo** dashboard page)

| Feature | MuJoCo | Gazebo (Ignition) | Isaac Sim | PyBullet |
|---------|--------|-------------------|-----------|----------|
| License | Apache 2.0 | Apache 2.0 | NVIDIA EULA | MIT |
| Contact | soft + analytic grad | penalty | PhysX LCP | penalty |
| Differentiable | **yes** | no | no | no |
| Speed | 10–50× CPU | 0.5–1× | 1–5× GPU | 2–10× |
| Python | first-class | No (C++) | yes | yes |
| Cold start | <1 s · 10 MB | 10–60 s · 2 GB | 30–120 s · 10 GB | <1 s · 5 MB |
| When? | RL, contacts, diff, cheap 1k envs | ROS, sensors, outdoors | photoreal/synth data | simple pip, soft bodies |

**Decision short-circuit:**
```
photoreal?                -> Isaac Sim
camera/lidar plugins?     -> Gazebo
differentiable?           -> MuJoCo
1000s parallel envs?      -> MuJoCo (Brax) or Isaac
ROS already?              -> Gazebo
soft bodies?              -> PyBullet
CPU laptop only?          -> MuJoCo or PyBullet
```

MJCF vs URDF 10-line taste:

```xml
<!-- MJCF — one file -->
<mujoco><worldbody><body name="pendulum" pos="0 0 0">
  <joint name="hinge" type="hinge" axis="0 1 0"/>
  <geom type="capsule" size="0.02" fromto="0 0 0 0 0 0.5" mass="0.1"/>
</body></worldbody></mujoco>

<!-- URDF — verbose + meshes -->
<robot name="pendulum"><link name="base"/><link name="arm">
  <joint name="hinge" type="continuous"><axis xyz="0 1 0"/></joint>
</robot>
```

Try the MJCF live on the **Editor** page — drag bodies, generate XML, load directly into the depot.

## Fleet Integration — VR / Sim / Robotics

This repo lives in `D:\Dev\repos\` (213 repos). Within simulation it is the **CPU fast path**; Isaac is the GPU photoreal path; Gazebo is the sensor/ROS path. All three share the same verbs (`start_sim` / `get_state` / `apply_control`) so policies can move between them.

### Pipeline

```
VLA policy (limx / unitree / vla-mcp)  →  joint targets
        │
        ▼
mujoco-mcp ── 10–50× realtime ──► reward / contact check
        │                │
        │ ws:body_positions   json: state.json
        ▼                ▼
  3D Viewer        ros-mcp ──► real robot (Unitree / Yahboom / Nori)
        │
        │ WebXR pose (teleoperator-mcp)
        ▼
 Overte / Resonite / VRChat  (human teleop → joint targets loop)
```

Train cheap in MuJoCo, validate photoreal in `isaac-mcp`, field in `gazebo-mcp`, teleop in VR.

### Fleet map (ports adjacent; full registry `mcp-central-docs/operations/WEBAPP_PORTS.md`)

| Layer | Repo | Ports | Relation to `mujoco-mcp` |
|-------|------|-------|--------------------------|
| **Sim / ROS** | `gazebo-mcp` | 10990/10991 | SDF worlds + ROS 2 topics — use when you need full sensor suite (camera/lidar/IMU plugins). |
| | `isaac-mcp` | 11048/11049 | Isaac Sim/Lab + USD — photoreal + RTX domain randomization + synthetic data. |
| | `ros-mcp` | 11050/11051 | Native ROS 2 bridge (topics/services/bags/launch) — shims Gazebo ↔ MuJoCo. |
| **Robotics** | `limx-robotics-mcp` | 11044/11045 | LimX TRON 1 + Oli — wraps *this* MuJoCo server + VLA policies + real hardware. |
| | `unitree-mcp` | 11052/11053 | Go2/H1/G1 — same depot, different morphologies; sim → real via `ros-mcp`. |
| | `norirobotics-mcp` | 11970/11971 | Nori A3 (19-DoF bimanual) — LeRobot recording, feeds `vla-mcp`. |
| | `yahboom-mcp` | 10792/10793 | Yahboom ROSMaster — cheap arms/cars for real-world replay. |
| **VR / Teleop** | `overte-mcp` | 11110/11111 | Overte (open VR) — pair with 3D Viewer for teleop. |
| | `vrchat-mcp` | 10712 | VRChat OSC — drive a MuJoCo humanoid from VRChat tracking. |
| | `resonite-mcp` | 10978/10979 | Resonite — VR world import, pose streaming prot. |
| | `teleoperator-mcp` | 10900/10901 | WebXR (Pico 4 / Quest) → Goliath — streams head+hands to `apply_control`. |
| **Deploy** | `vla-mcp` | 11024/11025 | (alpha/shelfware) — future VLA training pipeline that would consume MuJoCo + Nori recordings. |

See also the **Fleet** page in the dashboard (live links to each) and the **MuJoCo** page’s comparison matrix — both render this map interactively.

## Tools

All 20 tools are annotated with READ_ONLY or MUTATING for agent safety.

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

### Server Tool (1)
| Tool | Annotation | Description |
|------|-----------|-------------|
| `shutdown_server` | MUTATING | Gracefully shut down the server (requires `confirm=True`) |

## Web Dashboard

16-page React + Vite + Three.js dashboard at `http://localhost:11047`:

| Page | Features |
|------|----------|
| **Dashboard** | KPI cards (MuJoCo, models, jobs, server status), exponential backoff health polling (1/2/4/8/16s), `backend-status` Tauri event listener, "Restart Backend" button, AI workflow quick-input, **Start MuJoCo Quickstart** onboarding CTA (`data-testid="onboarding-cue"`) |
| **Inbox** | Job queue — active vs completed jobs from `GET /api/jobs`, retry/refresh, empty/loading/error states |
| **Tools** | Tool browser — live list from `GET /api/capabilities`, filter by name, REST bridge `POST /api/mcp/{tool}` hints |
| **MuJoCo** | Engine deep dive — what it is, 2009→now history, community (Menagerie/Brax/Playground), strengths/weaknesses, comparison matrix vs Gazebo/Isaac/PyBullet, MJCF taste, decision flowchart |
| **Fleet** | Fleet VR/sim/robotics map — pipeline diagram, Sim/ROS vs Robotics vs VR tiles (gazebo-mcp, isaac-mcp, ros-mcp, limx/unitree/nori, overte/vrchat/resonite/teleoperator), when-to-use table |
| **Simulations** | Start/stop sims, model selection, state inspection, AI analyze — uses `POST /api/simulations/start` aliases so it works without raw MCP |
| **3D Viewer** | Live Three.js rendering of running sims via WebSocket, OrbitControls, body bones |
| **Trajectory** | Recorded sim playback with play/pause, range slider, frame counter |
| **Population** | Launch N parallel sims with parameter sweeps, results aggregation table |
| **Editor** | Drag-and-drop MJCF model builder with add/delete bodies, TransformControls, MJCF export |
| **RL** | Train PPO/SAC policies on loaded models, algorithm/timestep config, training status |
| **Models** | Load from URL/path, list with metadata, two tabs: Local Depot + MuJoCo Menagerie browser with search and one-click download |
| **Skills** | Browse and load the MuJoCo expert skill for agent guidance |
| **Logging** | Log viewer with filters, tail mode, export JSON/CSV |
| **LLM** | Chat with 4 personalities (Research Assistant, Expert Reviewer, Quick Summarizer, Custom), localStorage history persistence (100-msg cap), Export .txt, Clear — backed by `store/llm.ts` Zustand |
| **Settings** | Model dir, jobs dir, SOTA provider detection (Ollama/LM Studio/vLLM probe via `GET /api/llm/providers`, status indicators, provider + model dropdowns — Zustand) |
| **Help** | 7-tab help: Overview, MuJoCo, Compare, Fleet, Tools, Setup, Troubleshooting |

AI features use the LLM through the `/api/llm/chat` endpoint, with auto-discovery of local providers (Ollama, LM Studio, vLLM). The Settings page probes via `GET /api/llm/providers` on mount (no CORS fetch to `127.0.0.1:11434`), shows per-provider status indicators, and populates provider/model dropdowns. The chat page composes system prompts from the loaded skill content + Zustand-selected provider/model.

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
              │  REST Bridge       │ ←── Population / RL / Trajectory / Fleet
              │  /api/mcp/{tool}   │
              └────────────────────┘

Desktop:  Tauri Shell ──► FastAPI Backend (11046)  — web_sota.backend.server:app
                                  │
                          React Frontend (11047) — Three.js + 16 pages (MuJoCo + Fleet are the new engine/fleet deep dives)
```

## Documentation

| Doc | Contents |
|-----|----------|
| `docs/CONFIGURATION.md` | Env vars, ports (11046/11047), CORS, Vite proxy, fleet launcher |
| `docs/ONBOARDING.md` | Wrappee/account flow, costs, pitfalls, sanity check — big red **Start MuJoCo Quickstart** CTA on Dashboard (`data-testid="onboarding-cue"`) |
| `docs/TOOLS.md` | Full reference for all 20 tools with inputs, outputs, examples |
| `docs/SETUP.md` | Installation, configuration, MuJoCo Menagerie setup, troubleshooting |
| `docs/ARCHITECTURE.md` | State machine design, job lifecycle, worker pool |
| `docs/MUJOCO_VS_OTHERS.md` | Full comparison matrix, decision flowchart, MJCF vs URDF |
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

[^1]: **MuJoCo** — Multi-Joint dynamics with Contact. Open-source physics engine by Google DeepMind (orig. Roboti LLC, Emanuel Todorov 2009). [mujoco.org](https://mujoco.org)
[^2]: **MJCF** — MuJoCo XML Format, the native model descriptor used by MuJoCo. Equivalent to URDF but more compact.
[^3]: **VLA** — Vision-Language-Action model. An embodied AI paradigm that maps visual and language inputs directly to motor commands.
