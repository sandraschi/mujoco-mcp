# mujoco-mcp Architecture

## Overview

mujoco-mcp exposes MuJoCo physics simulation as MCP tools. Each simulation runs as an isolated OS subprocess, communicating with the MCP server over a JSON pipe. This design prioritises crash isolation and clean lifecycle management over in-process performance.

```
MCP client (Claude Desktop, Cursor, etc.)
    |
    | stdio / HTTP
    v
FastMCP server (port 11046)
    |
    | subprocess.Popen
    v
Runner subprocess (runner.py)
    |
    | mu.MjModel.from_xml_path()
    | mu.mj_step() loop
    | JSON state sync
    v
Simulation state (mjData)
```

## Process Model

Each call to `sim_start` spawns a new Python subprocess running `runner.py` with:
- A unique simulation ID (UUID4)
- The path to the MJCF/URDF model file
- Initial conditions (joint positions, velocities)
- Simulation parameters (timestep, frequency, integrator)

The runner loads the model via `mu.MjModel.from_xml_path()`, creates `mu.MjData`, and enters a control loop. The parent MCP server keeps a registry of running simulations keyed by ID.

### Why Subprocess?

| Aspect | Subprocess | In-process |
|--------|------------|------------|
| Crash isolation | Simulation crash does not take down the MCP server | Any segfault in MuJoCo C bindings kills the server |
| Resource cleanup | OS handles memory/GPU on process exit | Manual cleanup, risk of leaks |
| Parallel sims | True OS-level parallelism | GIL-bound, thread-safety concerns |
| GPU context | Each process has its own CUDA context | Shared context can conflict |
| Simulation speed | Independent | Same event loop |

The overhead of subprocess IPC (~1ms round-trip) is negligible compared to typical simulation timesteps (2-10ms).

## Runner Lifecycle

```
sim_start
    |
    v
[Spawn runner.py]
    |
    v
[Load MJCF]  -> mu.MjModel.from_xml_path()
    |
    v
[Init mjData] -> mu.mj_makeData()
    |
    v
[Control loop]
    |   while running:
    |     read command from stdin (JSON)
    |     if cmd == "step": mu.mj_step(model, data)
    |     if cmd == "apply": set ctrl[], then mu.mj_step()
    |     if cmd == "sync":  serialize data to JSON, write to stdout
    |     if cmd == "reset": mu.mj_resetData()
    |     if cmd == "stop":  break
    |
    v
[Cleanup] -> exit()

sim_stop -> sends "stop" command -> wait for process exit
```

## State Sync

The runner serialises relevant parts of `mjData` to JSON on request:
- `qpos` — joint positions
- `qvel` — joint velocities
- `sensordata` — sensor readings (if sensors are defined)
- `time` — simulation time
- `energy` — kinetic + potential energy
- `contact` — contact forces, positions, and normals (truncated to active contacts)
- `geomp` — geom positions (for visualisation)

Sync is pull-based (the MCP server requests state when needed, not streamed continuously). This avoids flooding the MCP connection and keeps bandwidth proportional to query frequency.

## Depot

Models are stored in `~/.mujoco-mcp/models/` (configurable via `MUJOCO_MCP_DEPOT` env var).

The depot is a flat filesystem directory keyed by filename:
- `*.xml` — MJCF model files
- `*.urdf` — URDF model files (converted to MJCF on load via `mu.MjModel.from_xml_path()`)
- `*.stl` / `*.obj` — mesh files referenced by models

The `model_list`, `model_load`, `model_info`, `model_delete`, and `model_search` tools manage this directory.

## Job Lifecycle

```
State: IDLE -> STARTING -> RUNNING -> STOPPING -> IDLE
         |                    |
         v                    v
      (deleted)          (crashed — runner exits unexpectedly)
```

The MCP server monitors each runner subprocess via a watchdog thread:
- If the runner exits unexpectedly (non-zero exit), the simulation transitions to CRASHED state.
- The `sim_status` tool reports the reason from stderr.
- Cleanup kills any orphan processes and releases resources.

## Design Decisions

**Subprocess isolation over in-process threading**: Crash resilience is the overriding concern. MuJoCo's C API can segfault on malformed models, and losing the entire MCP server is worse than losing one simulation.

**Pull-based sync over streaming**: Reduces MCP message volume. Agents typically query state once per decision step, not every physics timestep.

**JSON over protobuf**: Simpler debugging, no schema compilation, good enough for sub-kilobyte state messages. If throughput becomes an issue, switch to msgpack.

**Flat file depot over database**: Models are small XML files. A database adds complexity with no benefit at this scale. Migration to SQLite (for tagging/search) is considered if the model count exceeds 500.

**Runner is a standalone script**: `runner.py` can be invoked directly for debugging: `python runner.py --model pendulum.xml --port 51001`. This decouples the sim executable from the MCP server for independent testing.
