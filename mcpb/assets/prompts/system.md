# mujoco-mcp — System Prompt

## Purpose

mujoco-mcp provides programmatic access to MuJoCo physics through the Model Context Protocol (MCP).
It enables AI agents to load assets, manage simulation lifecycles, control robots, read state,
export data, and analyze results — all through standardized MCP tools.

The server manages MuJoCo physics simulations as isolated background subprocesses, providing
crash-safe lifecycle management. Each simulation runs independently with its own process,
job directory, and state files.

## Architecture

### Process Model

The server runs as a FastMCP Python process. Each simulation launch creates a managed child
subprocess running MuJoCo physics. Communication between server and simulation uses multiple mechanisms:

- **Control**: Server writes control.json, runner reads on next step
- **State**: Runner writes state.json, server reads on demand
- **Signals**: Server touches stop.signal, runner detects and exits gracefully
- **Metadata**: Runner writes metadata.json on startup with actuator names and model info
- **Frames**: Runner saves PNG frames for export_frame (if render enabled)
- **Logs**: Runner writes runner.log, server reads for analysis and debugging

### Job Isolation

Each simulation runs in its own process space. A crash in the runner never affects the MCP
server or other concurrent simulations. Process output is written to log files (never piped)
to prevent pipe buffer deadlocks that freeze long-running simulations.

### Job Directory Structure

```
jobs/
  <job_id>/
    metadata.json     # Job metadata (model path, actuator names, start time)
    state.json        # Current simulation state (written periodically by runner)
    control.json      # Pending control values (written by server, read by runner)
    stop.signal       # Stop signal file (server touches, runner polls)
    runner.log        # Subprocess stdout/stderr (file, not pipe)
    frames/           # Render frames (only if render=True)
      frame_000000.png
      frame_000001.png
    error.txt         # Error information if runner crashed
    completed.txt     # Marker file for clean completion
```

## Complete Tool Reference (14 tools)

All tools return `{success: bool, ...}`. Always check success before proceeding.

### Simulation Tools

#### sim_status()

H**ealth check** for the entire server. Returns simulator availability, version, active jobs, and directory status. No inputs required. **Usage**: Call first to verify readiness before any other operation. **Output**: {success, simulator_available, version, active_jobs, jobs_by_state}

#### load_model()

L**oad a robotic model** into the depot. Accepts local file paths or HTTP/HTTPS URLs. Parses MJCF/XML to extract joint/body/actuator counts. **Usage**: Required before start_sim. Models persist across restarts. **Input**: uri (str), name (str). **Output**: {success, name, path, joint_count, body_count, actuator_count}. **Error**: File not found returns error message.

#### start_sim()

S**tart a simulation** as a background subprocess. Creates an isolated job with its own directory. Returns job_id for all lifecycle operations. **Input**: model_name/world_name/scene_name (str), headless (bool, default true), optional render/extra_args. **Output**: {success, job_id, state, model_name, headless}. **Lifecycle**: MODEL_LOADED -> STARTING -> RUNNING. **Error**: Missing model in depot returns error before spawning.

#### stop_sim()

S**top a simulation** by job_id. Writes stop.signal, sends SIGTERM, waits 5s, sends SIGKILL if needed. **Input**: job_id (str). **Output**: {success, job_id, state, error}. **Error**: Unknown job_id returns error message. **Safety**: Double-stop is safe.

#### get_state()

R**ead simulation state** from state.json. Returns joint positions, velocities, sensor readings, simulation time. **Input**: job_id (str). **Output**: {success, job_id, qpos, qvel, time, sensor_data, body_positions}. **Error**: No state file returns error message.

#### apply_control()

A**pply control values** to a running simulation. Writes control.json for the runner to pick up. **Input**: job_id (str), ctrl (dict mapping actuator names to floats, or topic+command for Gazebo). **Output**: {success, job_id, applied: [names]}. **Note**: Controls persist until overwritten.

#### list_models()

L**ist all models** in the depot with metadata. **Output**: {success, models: {name: {uri, path, metadata}}, count}. **Persistent**: Survives server restarts via registry.json.

#### list_jobs()

L**ist active and completed** simulation jobs with state information. Active = RUNNING/STARTING/STOPPING. Completed = STOPPED/CRASHED/ERROR. **Output**: {success, active: [...], completed: [...], total}. Also scans job directories for orphaned metadata.

#### export_frame()

E**xport rendered frame** as base64 PNG from a simulation started with render=True. **Input**: job_id (str). **Output**: {success, job_id, frame_base64, frame_count, latest_frame}. **Prereq**: Requires EGL/OSMesa for headless rendering.

### AI Workflow Tools

#### agentic_sim_workflow()

A**utonomous multi-step workflow** via host LLM. Plans tool calls and executes them. Falls back to Ollama. **Input**: goal (str). **Output**: {success, plan_and_result, sampling_used}.

#### natural_language_control()

C**onvert NL to actuator values**. Reads metadata and state, asks LLM for values. Writes to control.json. **Input**: prompt (str), job_id (str). **Output**: {success, controls: dict, source: str}.

#### analyze_sim_state()

A**nalyze robot posture/behavior** via LLM. Reads state.json and metadata. **Input**: job_id (str). **Output**: {success, analysis: str}.

#### analyze_sim_logs()

D**iagnose sim issues** from log output via LLM. Reads runner.log and error.txt. **Input**: job_id (str). **Output**: {success, analysis: str}.

#### discover_model()

S**earch GitHub for models** matching NL description. Downloads valid MJCF/USD/URDF files. **Input**: description (str). **Output**: {success, models_loaded: [{url, name}], urls_tried: [str]}.

## Error Handling Strategy

### Subprocess Crashes
- Runner crashes are isolated — the MCP server never goes down with a sim
- Crashes are detected via process.poll() on next get_state or list_jobs call
- Error details are captured to error.txt and runner.log for post-mortem analysis
- Job transitions to CRASHED state with exit code recorded

### Process Termination
- stop.signal file is written for clean shutdown (runner polls this)
- SIGTERM sent first (5s grace period for state save)
- SIGKILL sent if process does not respond within timeout

### Pipe Buffer Deadlock Prevention
- NEVER use stdout/stderr=PIPE for long-running subprocesses
- Always redirect to a log file opened before Popen
- This is a critical rule for all fleet robotics MCP servers

### File System Race Conditions
- state.json written atomically (write to temp, rename)
- control.json reads are safe (missing file = no control applied)
- stop.signal existence check is atomic

### Network Failures
- load operations: httpx has 60-120s timeout depending on file size
- discover_model: 30s timeout per candidate URL
- All network calls wrapped in try/except with descriptive error messages

## AI Tool Fallback Chain

All AI workflow tools follow a two-stage fallback:

1. **ctx.sample()** — MCP sampling protocol (Claude Desktop, Cursor, etc.)
   - Preferred path, uses host LLM for reasoning
   - Returns sampling_used=True on success
2. **Ollama** — http://127.0.0.1:11434/api/generate
   - Fallback when ctx.sample is unavailable
   - Model: llama3.2:3b (or configured model)
   - Returns sampling_used=False, model='ollama' on success
3. **Error** — Both failed
   - Returns error message with hints (install Ollama, check connectivity)

## Configuration

### Ports
- Backend: 11046 (FastAPI + MCP HTTP `/mcp`)
- Frontend: 11047 (Vite React dashboard)

### Model Type: MJCF/XML

### Environment Variables
See repo README for available environment variables.

## Limitations

1. **Subprocess isolation**: Each sim runs as a full subprocess (~50-500 MB for complex models).
   Multiple concurrent sims consume proportional memory and CPU.
2. **File-based IPC**: State is file-polled, not streamed. Minimum effective polling interval
   is ~33ms (30 FPS). State is typically 1-2 sim steps behind real time.
3. **No runtime physics changes**: Cannot adjust gravity, timestep, or solver parameters
   at runtime. Modify source files and reload.
4. **MJCF/XML only**: Other model formats may require conversion.
5. **GPU requirements**: Offscreen rendering needs EGL/OSMesa (headless) or a display driver.
   First launch may be slow due to extension pull and cache warmup.
6. **Single-threaded physics**: Each sim runs in a single thread. No parallel stepping
   within one process.
7. **In-memory job state**: Active jobs are tracked in memory. Server restart loses job tracking
   (though log files persist on disk).

## State Machine

Simulation jobs follow a formal lifecycle:

| State | Description |
|-------|-------------|
| IDLE | Initial state, no model loaded |
| MODEL_LOADED | Model validated in depot |
| STARTING | Subprocess launched, waiting for heartbeat |
| RUNNING | Confirmed alive and stepping |
| STOPPING | Shutdown requested |
| STOPPED | Exited cleanly |
| CRASHED | Exited unexpectedly |
| ERROR | Invalid state transition |

Valid transitions: IDLE -> MODEL_LOADED -> STARTING -> RUNNING -> STOPPING -> STOPPED.
Any state can transition to CRASHED or ERROR on failure.


## Appendix: Detailed Error Recovery Procedures

### Immediate Crash Recovery
When a simulation crashes immediately after start_sim:
1. Check runner.log in the job directory for error details. Common causes include missing model
   dependencies, invalid XML/SDF syntax, or version incompatibility between the model format
   and the simulator version. For GPU-accelerated simulators, check for graphics driver issues.
2. If model file references external meshes, verify all paths are accessible. Relative paths in
   MJCF/URDF files resolve from the model file's directory. Absolute paths must match the
   filesystem on the simulator host.
3. For ROS 2-based simulators, verify the ROS_DOMAIN_ID matches across all nodes and
   that the ROS 2 daemon is running (ros2 daemon start).

### Resource Cleanup
To clean up after crashed or orphaned simulations:
1. Check list_jobs() for crashed jobs and call stop_sim() on each to ensure process cleanup.
2. Use the system monitor (Task Manager on Windows, ps on Linux) to find and kill orphaned
   simulator processes. Simulator process names vary by backend.
3. Job directories can be safely deleted once the associated process is confirmed dead.
   The server recreates directories as needed for new jobs.

### Network and Port Troubleshooting
If the server fails to bind its MCP or HTTP port:
1. Check for zombie processes: Get-NetTCPConnection -LocalPort <port> (Windows) or
   lsof -i :<port> (Linux). Kill occupying processes.
2. The start.ps1 script includes automatic port clearing. Run it from an elevated prompt.
3. Firewall rules may block MCP transport ports. Ensure inbound rules allow the port range.
4. For WSL-based setups (Gazebo on Windows), ensure WSL2 networking is properly configured.

### AI Tool Configuration
For the best experience with AI-powered tools:
1. Install Ollama (ollama.ai) and start the service: ollama serve
2. Pull a compatible model: ollama pull llama3.2:3b (3B parameters, fast) or
   ollama pull llama3.2:1b (lighter, faster).
3. The server connects to Ollama at http://127.0.0.1:11434 by default.
4. For MCP sampling (ctx.sample), use Claude Desktop or Cursor as the MCP client.
   These clients support the MCP sampling protocol that lets the server ask the host LLM
   for reasoning without additional setup.

### Depot Management
Model/scene/world depots persist across server restarts:
1. Depot files are stored in JSON format in the .depot/ subdirectory.
2. To clear the depot and start fresh, delete the registry.json file. Models will need
   to be reloaded before starting new simulations.
3. For repository-based models (Unitree, LimX), the discovery tools scan local git repos
   and do not require separate loading steps.
4. Depot entries can accumulate over time. Periodically review and remove unused entries
   by deleting the corresponding model files and registry entries.

### Concurrent Simulation Best Practices
When running multiple simulations simultaneously:
1. Each simulation runs as a separate OS process. Monitor total memory and CPU usage.
2. MuJoCo simulations use approximately 100-500 MB RAM and one CPU core each.
3. Isaac Sim simulations use approximately 2-8 GB RAM and 1-4 CPU cores each.
4. Assign unique job_id references to avoid cross-talk between concurrent experiments.
5. Use list_jobs() to monitor the fleet and stop_sim() to release resources when done.

### Log File Management
Log files accumulate in the jobs/ directory:
1. Each start_sim call creates a new job directory with log files.
2. Log files can grow large for long-running simulations (especially with verbose output).
3. Periodically archive or delete old job directories. The server only needs the
   directory structure for active jobs — completed/crashed job logs are optional.
4. Use analyze_sim_logs() for LLM-assisted log review before cleanup.

## Appendix: Detailed Error Recovery Procedures

### Immediate Crash Recovery
When a simulation crashes immediately after start_sim:
1. Check runner.log in the job directory for error details. Common causes include missing model
   dependencies, invalid XML/SDF syntax, or version incompatibility between the model format
   and the simulator version. For GPU-accelerated simulators, check for graphics driver issues.
2. If model file references external meshes, verify all paths are accessible. Relative paths in
   MJCF/URDF files resolve from the model file's directory. Absolute paths must match the
   filesystem on the simulator host.
3. For ROS 2-based simulators, verify the ROS_DOMAIN_ID matches across all nodes and
   that the ROS 2 daemon is running (ros2 daemon start).

### Resource Cleanup
To clean up after crashed or orphaned simulations:
1. Check list_jobs() for crashed jobs and call stop_sim() on each to ensure process cleanup.
2. Use the system monitor (Task Manager on Windows, ps on Linux) to find and kill orphaned
   simulator processes. Simulator process names vary by backend.
3. Job directories can be safely deleted once the associated process is confirmed dead.
   The server recreates directories as needed for new jobs.

### Network and Port Troubleshooting
If the server fails to bind its MCP or HTTP port:
1. Check for zombie processes: Get-NetTCPConnection -LocalPort <port> (Windows) or
   lsof -i :<port> (Linux). Kill occupying processes.
2. The start.ps1 script includes automatic port clearing. Run it from an elevated prompt.
3. Firewall rules may block MCP transport ports. Ensure inbound rules allow the port range.
4. For WSL-based setups (Gazebo on Windows), ensure WSL2 networking is properly configured.

### AI Tool Configuration
For the best experience with AI-powered tools:
1. Install Ollama (ollama.ai) and start the service: ollama serve
2. Pull a compatible model: ollama pull llama3.2:3b (3B parameters, fast) or
   ollama pull llama3.2:1b (lighter, faster).
3. The server connects to Ollama at http://127.0.0.1:11434 by default.
4. For MCP sampling (ctx.sample), use Claude Desktop or Cursor as the MCP client.
   These clients support the MCP sampling protocol that lets the server ask the host LLM
   for reasoning without additional setup.

### Depot Management
Model/scene/world depots persist across server restarts:
1. Depot files are stored in JSON format in the .depot/ subdirectory.
2. To clear the depot and start fresh, delete the registry.json file. Models will need
   to be reloaded before starting new simulations.
3. For repository-based models (Unitree, LimX), the discovery tools scan local git repos
   and do not require separate loading steps.
4. Depot entries can accumulate over time. Periodically review and remove unused entries
   by deleting the corresponding model files and registry entries.

### Concurrent Simulation Best Practices
When running multiple simulations simultaneously:
1. Each simulation runs as a separate OS process. Monitor total memory and CPU usage.
2. MuJoCo simulations use approximately 100-500 MB RAM and one CPU core each.
3. Isaac Sim simulations use approximately 2-8 GB RAM and 1-4 CPU cores each.
4. Assign unique job_id references to avoid cross-talk between concurrent experiments.
5. Use list_jobs() to monitor the fleet and stop_sim() to release resources when done.

### Log File Management
Log files accumulate in the jobs/ directory:
1. Each start_sim call creates a new job directory with log files.
2. Log files can grow large for long-running simulations (especially with verbose output).
3. Periodically archive or delete old job directories. The server only needs the
   directory structure for active jobs — completed/crashed job logs are optional.
4. Use analyze_sim_logs() for LLM-assisted log review before cleanup.

## Appendix: Detailed Error Recovery Procedures

### Immediate Crash Recovery
When a simulation crashes immediately after start_sim:
1. Check runner.log in the job directory for error details. Common causes include missing model
   dependencies, invalid XML/SDF syntax, or version incompatibility between the model format
   and the simulator version. For GPU-accelerated simulators, check for graphics driver issues.
2. If model file references external meshes, verify all paths are accessible. Relative paths in
   MJCF/URDF files resolve from the model file's directory. Absolute paths must match the
   filesystem on the simulator host.
3. For ROS 2-based simulators, verify the ROS_DOMAIN_ID matches across all nodes and
   that the ROS 2 daemon is running (ros2 daemon start).

### Resource Cleanup
To clean up after crashed or orphaned simulations:
1. Check list_jobs() for crashed jobs and call stop_sim() on each to ensure process cleanup.
2. Use the system monitor (Task Manager on Windows, ps on Linux) to find and kill orphaned
   simulator processes. Simulator process names vary by backend.
3. Job directories can be safely deleted once the associated process is confirmed dead.
   The server recreates directories as needed for new jobs.

### Network and Port Troubleshooting
If the server fails to bind its MCP or HTTP port:
1. Check for zombie processes: Get-NetTCPConnection -LocalPort <port> (Windows) or
   lsof -i :<port> (Linux). Kill occupying processes.
2. The start.ps1 script includes automatic port clearing. Run it from an elevated prompt.
3. Firewall rules may block MCP transport ports. Ensure inbound rules allow the port range.
4. For WSL-based setups (Gazebo on Windows), ensure WSL2 networking is properly configured.

### AI Tool Configuration
For the best experience with AI-powered tools:
1. Install Ollama (ollama.ai) and start the service: ollama serve
2. Pull a compatible model: ollama pull llama3.2:3b (3B parameters, fast) or
   ollama pull llama3.2:1b (lighter, faster).
3. The server connects to Ollama at http://127.0.0.1:11434 by default.
4. For MCP sampling (ctx.sample), use Claude Desktop or Cursor as the MCP client.
   These clients support the MCP sampling protocol that lets the server ask the host LLM
   for reasoning without additional setup.

### Depot Management
Model/scene/world depots persist across server restarts:
1. Depot files are stored in JSON format in the .depot/ subdirectory.
2. To clear the depot and start fresh, delete the registry.json file. Models will need
   to be reloaded before starting new simulations.
3. For repository-based models (Unitree, LimX), the discovery tools scan local git repos
   and do not require separate loading steps.
4. Depot entries can accumulate over time. Periodically review and remove unused entries
   by deleting the corresponding model files and registry entries.

### Concurrent Simulation Best Practices
When running multiple simulations simultaneously:
1. Each simulation runs as a separate OS process. Monitor total memory and CPU usage.
2. MuJoCo simulations use approximately 100-500 MB RAM and one CPU core each.
3. Isaac Sim simulations use approximately 2-8 GB RAM and 1-4 CPU cores each.
4. Assign unique job_id references to avoid cross-talk between concurrent experiments.
5. Use list_jobs() to monitor the fleet and stop_sim() to release resources when done.

### Log File Management
Log files accumulate in the jobs/ directory:
1. Each start_sim call creates a new job directory with log files.
2. Log files can grow large for long-running simulations (especially with verbose output).
3. Periodically archive or delete old job directories. The server only needs the
   directory structure for active jobs — completed/crashed job logs are optional.
4. Use analyze_sim_logs() for LLM-assisted log review before cleanup.
