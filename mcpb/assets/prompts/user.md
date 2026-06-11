# mujoco-mcp — User Guide

## Getting Started

### Prerequisites

1. **Python 3.11+** with uv package manager installed
2. **MuJoCo physics** installed on your system
3. Repository cloned: `git clone https://github.com/sandraschi/mujoco-mcp.git`
4. Dependencies installed: `cd mujoco-mcp && uv sync`

### Starting the Server

#### MCP Stdio Mode (for Claude Desktop, Cursor, etc.)

```bash
cd mujoco-mcp
uv run python -m mujoco_mcp
```

#### Web Dashboard

```powershell
cd mujoco-mcp
.\web_sota\start.ps1
```

This starts both the FastAPI backend and Vite React frontend,
then opens the dashboard in your browser at http://localhost:11047.

### Quick Start

Run a complete sim lifecycle in 5 steps:

```python
# 1. Health check
status = sim_status()
print(status)  # Verify simulator is available

# 2. Start simulation
sim = start_sim(...)
job_id = sim["job_id"]
print(f"Sim started: {job_id}")

# 3. Read state
state = get_state(job_id=job_id)
print(f"Sim time: {state.get("time", "N/A")}")

# 4. Apply control
result = apply_control(job_id=job_id, ...)

# 5. Stop when done
stop_sim(job_id=job_id)
```

## Tutorial 1: Health Check and Asset Management

### Checking Server Status

Always begin with sim_status() to verify {cfg['sim'] is available, check running jobs, and review loaded assets:

```python
status = sim_status()
if status.get("success"):
    print("Server is ready")
```

The response tells you:
- Whether the simulator binary or Python module is available
- Version information
- How many assets are in the depot
- How many jobs are active and their states

### Listing Available Assets

```python
assets = list_jobs()
print(f"{assets["count"]} assets available")
```

## Tutorial 2: Running and Controlling a Simulation

### Starting a Simulation

```python
result = start_sim(...)
if result["success"]:
    job_id = result["job_id"]
    print(f"Simulation running: {job_id}")
```

The returned job_id is required for all subsequent operations.

### Reading State Data

```python
state = get_state(job_id=job_id)
if state["success"]:
    print(f"Joints: {len(state.get("qpos", []))}")
```

State includes: qpos (joint positions), qvel (joint velocities), time, sensor data, body positions.

### Applying Controls

```python
# For actuator-based sims (MuJoCo, Isaac, Unitree, LimX):
ctrl = apply_control(job_id=job_id, ctrl={"hip_joint": 0.5})

# For topic-based sims (Gazebo):
ctrl = apply_control(job_id=job_id, topic="/cmd_vel", command="...")
```

### Stopping a Simulation

```python
result = stop_sim(job_id=job_id)
print(f"Stopped: {result["state"]}")
```

The stop signal is sent gracefully. If the process does not respond within 5 seconds,
it is force-killed.

## Tutorial 3: AI-Assisted Workflows

The server provides five AI-powered tools that use the host LLM (via MCP sampling)
or Ollama for autonomous multi-step operations:

### Autonomous Workflow

```python
result = await agentic_sim_workflow(goal="Start a simulation and check its state")
print(result["plan_and_result"])
```

The LLM plans each step, executes tool calls, and summarizes results.

### Natural Language Control

```python
result = await natural_language_control(
    prompt="make the robot stand up straight with all joints at neutral",
    job_id="abc12345"
)
print(result["controls"])
```

### State and Log Analysis

```python
analysis = await analyze_sim_state(job_id="abc12345")
diagnosis = await analyze_sim_logs(job_id="abc12345")
```

### Model Discovery

```python
models = await discover_model(description="Find a quadruped robot model for {cfg["model_type"]}")
```

## Tutorial 4: Batch Processing and CI Integration

For automated pipelines and continuous integration:

```bash
uv run python -c "from mujoco_mcp.server import sim_status; print(sim_status())"
```

The MCP server can also be run with stdin/stdout for stdio-based tools.

## Configuration

### Ports
- Backend API: 11046 (FastAPI REST + MCP HTTP endpoints)
- Frontend Dashboard: 11047 (Vite React SPA)

### Environment Variables
See the repo README for available environment variables and their defaults.

## Troubleshooting

### 1. "MuJoCo physics" not available from sim_status()
Ensure MuJoCo physics is installed and accessible. Check that the binary or Python module
is on PATH. For WSL-based setups, ensure the Linux environment has the software installed.

### 2. Simulation crashes immediately after start
Check the runner.log in the job directory for error messages. Common causes:
- Missing model dependencies (asset files referenced in the model)
- Invalid XML/SDF/USD syntax
- Version incompatibility between the model and simulator
- GPU/driver issues (for GPU-rendered simulators)
- Port conflicts with existing processes

### 3. Controls have no effect
Verify:
- The simulation is still running (use get_state() or list_jobs())
- Actuator/topic names match the model's definition
- Control values are within valid ranges
- For topic-based control, the ROS 2/Gazebo transport is active

### 4. AI tools fail with "Both sampling and Ollama fallback failed"
This means neither MCP sampling nor the Ollama fallback is available.
To fix:
```bash
ollama serve    # Start the Ollama service
ollama pull llama3.2:3b  # Pull a compatible model
```

### 5. Web dashboard not loading
Ensure both backend and frontend are running:
```powershell
Get-NetTCPConnection -LocalPort {cfg['be']},{cfg['fe']}
```
If ports 11046 or 11047 are in use, kill the occupying processes and restart.

### 6. Multiple simulations consuming too many resources
Each simulation runs as a separate OS process. On a typical system:
- Each MuJoCo sim: ~100-500 MB RAM, 1 CPU core
- Each Isaac Sim: ~2-8 GB RAM, 1-4 CPU cores, 1-4 GB GPU memory
- Each Gazebo sim: ~500 MB - 2 GB RAM, 1-2 CPU cores
Reduce concurrency or increase host resources.

### 7. State data seems stale or missing
State files are written periodically by the simulation runner. If the state is not updating:
- The runner may be blocked (check runner.log)
- The first write cycle may not have completed yet
- The sim may have crashed without writing final state

### 8. "Model not found" errors
You must load the model into the depot before starting a simulation:
- Use load_model() to load
- Use list_jobs() to verify it is present

### 9. Git submodule issues
If the repository uses submodules (common for robot description repos):
```bash
git submodule update --init --recursive
```

### 10. Port conflicts on restart
Zombie processes from previous sessions may hold old ports. The start script clears them:
```powershell
Get-NetTCPConnection -LocalPort {cfg['be']} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

## Best Practices

1. **Always check success**: Every tool returns success: bool. Validate before proceeding.
2. **Track job IDs**: Store returned job_ids in variables for lifecycle operations.
3. **Stop unused sims**: Unused simulations consume CPU and memory. Stop after experiments.
4. **Start simple**: Begin with basic built-in models before complex custom assets.
5. **Use AI tools**: The LLM can reason about control strategies, joint limits, and
   sequencing better than hardcoded values.
6. **Monitor periodically**: Call get_state every 5-10 steps during long runs.
7. **Headless for batch**: The interactive viewer is for debugging only.
8. **Handle errors gracefully**: Always have fallback plans for subprocess crashes.
9. **Clean up jobs**: Job directories accumulate. Remove old jobs periodically.
10. **Document experiments**: Use analysis tools to log observations and results.
11. **Check version compatibility**: Ensure model files match the simulator version.
12. **Pre-load models in CI**: Cache depot files across pipeline runs for speed.

## API Reference

| Tool | Category | Key Inputs | Returns |
|---|---|---|---|
| sim_status() | Sim | ... | {success, ...} |
| load_model() | Sim | ... | {success, ...} |
| start_sim() | Sim | ... | {success, ...} |
| stop_sim() | Sim | ... | {success, ...} |
| get_state() | Sim | ... | {success, ...} |
| apply_control() | Sim | ... | {success, ...} |
| list_models() | Sim | ... | {success, ...} |
| list_jobs() | Sim | ... | {success, ...} |
| export_frame() | Sim | ... | {success, ...} |
| agentic_sim_workflow() | AI | ... | {success, ...} |
| natural_language_control() | AI | ... | {success, ...} |
| analyze_sim_state() | AI | ... | {success, ...} |
| analyze_sim_logs() | AI | ... | {success, ...} |
| discover_model() | AI | ... | {success, ...} |

## Known Issues

1. **First launch latency**: The first MuJoCo physics launch may be significantly slower due to
   model caching, extension downloads, and warmup.
2. **GPU memory**: GPU-accelerated simulations consume VRAM. Scenes with complex geometry
   or high-resolution rendering may exceed available GPU memory.
3. **File sync latency**: State files are written at the sim step rate (~100-1000 Hz). File reads
   may return data that is 1-2 steps behind real time.
4. **In-memory state**: Active job tracking is in-memory. Restarting the MCP server loses
   current job references (though log files persist on disk).
5. **Process cleanup**: If the MCP server is killed abruptly, background sim processes
   may become orphaned. Use the start script or manual taskkill to clean up.

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
