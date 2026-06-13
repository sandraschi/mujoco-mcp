# mujoco-mcp Tool Reference

14 tools: 9 simulation lifecycle + 5 AI workflow assistants.

---

## Sim Tools (1-9)

### sim_status

**Description:** Health check — verifies MuJoCo is importable, model depot and jobs directories exist, reports active/completed jobs.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters |

**Output:**
```json
{
  "mujoco_available": true,
  "mujoco_version": "3.1.6",
  "model_dir_exists": true,
  "models_in_depot": 3,
  "active_jobs": 1,
  "job_states": {"idle": 0, "running": 1, "stopped": 3, "crashed": 0},
  "jobs_dir_exists": true
}
```

**Examples:**
```python
await sim_status()
```

**State machine effect:** None — read-only.

---

### load_model

**Description:** Download an MJCF/XML model from a URL or copy from a local path into the model depot. Parses the XML to extract joint, body, and actuator counts.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| uri | str | Yes | Local file path or http(s)/ftp URL to an MJCF/XML model file |
| name | str | Yes | Friendly name for the depot entry |

**Output:**
```json
{"success": true, "name": "h1", "path": "D:/.../models/h1.xml", "joint_count": 19, "body_count": 17, "actuator_count": 14}
```

**Examples:**
```python
await load_model(uri="https://raw.githubusercontent.com/unitreerobotics/unitree_mujoco/main/data/h1.xml", name="h1")
await load_model(uri="C:/models/my_robot.xml", name="my_robot")
```

**State machine effect:** IDLE → MODEL_LOADED

---

### start_sim

**Description:** Launch a MuJoCo simulation as a background subprocess. Polls for a metadata.json to confirm the runner initialised. Returns a job_id for lifecycle management.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| model_name | str | Yes | Name from load_model or list_models |
| headless | bool | No | Run without GUI viewer (default: True) |
| render | bool | No | Enable offscreen frame rendering (requires headless=True; default: False) |

**Output:**
```json
{"success": true, "message": "Simulation running.", "job_id": "a1b2c3d4", "model_name": "h1", "headless": true, "render": false, "state": "running"}
```

**Examples:**
```python
await start_sim(model_name="h1", headless=True)
await start_sim(model_name="go2", headless=False)
await start_sim(model_name="h1", headless=True, render=True)
```

**State machine effect:** MODEL_LOADED → STARTING → RUNNING (or CRASHED)

---

### stop_sim

**Description:** Stop a running simulation by writing a stop.signal and terminating the process. Waits 5 seconds for graceful exit, then kills.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | str | Yes | Job ID returned by start_sim |

**Output:**
```json
{"success": true, "message": "Job a1b2c3d4: stopped.", "job_id": "a1b2c3d4", "state": "stopped", "error": null}
```

**Examples:**
```python
await stop_sim(job_id="a1b2c3d4")
```

**State machine effect:** RUNNING → STOPPING → STOPPED (or CRASHED on timeout)

---

### get_state

**Description:** Read the latest simulation state from the job directory — joint positions (qpos), velocities (qvel), sensor readings, and simulation time.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | str | Yes | Job ID returned by start_sim |

**Output:**
```json
{"success": true, "job_id": "a1b2c3d4", "qpos": [0.0, ...], "qvel": [0.0, ...], "time": 1.234, "sensors": {...}}
```

**Examples:**
```python
await get_state(job_id="a1b2c3d4")
```

**State machine effect:** None — read-only.

---

### apply_control

**Description:** Write actuator control values to the job's control.json for the sim runner to pick up on its next step.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | str | Yes | Target simulation job ID |
| ctrl | dict | Yes | Dict mapping actuator names or indices to float values |

**Output:**
```json
{"success": true, "job_id": "a1b2c3d4", "applied": ["hip_joint", "knee_joint"]}
```

**Examples:**
```python
await apply_control(job_id="a1b2c3d4", ctrl={"hip_joint": 0.5, "knee_joint": -0.3})
await apply_control(job_id="a1b2c3d4", ctrl={"0": 0.0, "1": 0.5})
```

**State machine effect:** None — control write is transparent to state.

---

### list_models

**Description:** List all models stored in the depot with their source URI and parsed metadata.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters |

**Output:**
```json
{"success": true, "models": {"h1": {"uri": "https://...", "path": "D:/...", "metadata": {...}}}, "count": 3}
```

**Examples:**
```python
await list_models()
```

**State machine effect:** None — read-only.

---

### list_jobs

**Description:** List active and completed simulation jobs with state machine info.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| — | — | — | No parameters |

**Output:**
```json
{"success": true, "active": [{"job_id": "a1b2c3d4", ...}], "completed": [...], "total": 4}
```

**Examples:**
```python
await list_jobs()
```

**State machine effect:** None — read-only.

---

### export_frame

**Description:** Export the most recent offscreen render frame as a base64-encoded PNG. Requires the job to have been started with `render=True`.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | str | Yes | Sim job ID |

**Output:**
```json
{"success": true, "job_id": "a1b2c3d4", "frame_base64": "iVBORw0KGgo...", "frame_count": 47, "latest_frame": "frame_0047.png"}
```

**Examples:**
```python
await export_frame(job_id="a1b2c3d4")
```

**State machine effect:** None — read-only.

---

## AI Workflow Tools (10-14)

### agentic_sim_workflow

**Description:** Uses the host LLM (via MCP sampling) to plan and execute a multi-step simulation workflow. Falls back to Ollama when sampling is unavailable.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| goal | str | Yes | Natural language description of what to achieve |
| ctx | Context | Yes | FastMCP context (injected automatically) |

**Output:**
```json
{"success": true, "message": "Workflow completed.", "plan_and_result": "1. Load model... 2. Start sim...", "sampling_used": true}
```

**Examples:**
```python
await agentic_sim_workflow(goal="Load the Unitree H1 model and start a sim")
await agentic_sim_workflow(goal="Start a sim, apply some torques, then check the state")
```

**State machine effect:** Depends on the tools the LLM calls.

---

### natural_language_control

**Description:** Converts a natural language command to actuator values. Reads actuator names from metadata, asks the LLM to produce values, and writes the result to control.json.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| prompt | str | Yes | Natural language command (e.g. "bend the right knee 30 degrees") |
| job_id | str | Yes | Active sim job ID |
| ctx | Context | Yes | FastMCP context (injected automatically) |

**Output:**
```json
{"success": true, "message": "Generated 3 actuator commands.", "controls": {"hip_joint": 0.5}, "source": "sampling"}
```

**Examples:**
```python
await natural_language_control(prompt="stand up straight", job_id="a1b2c3d4")
await natural_language_control(prompt="bend the right knee 30 degrees", job_id="a1b2c3d4")
```

**State machine effect:** None — writes control.json, no state transition.

---

### analyze_sim_state

**Description:** Reads the current sim state (joint positions, velocities, sensors) and asks the LLM to produce a natural-language analysis of robot behaviour.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | str | Yes | Sim job ID to analyze |
| ctx | Context | Yes | FastMCP context (injected automatically) |

**Output:**
```json
{"success": true, "message": "State analyzed.", "analysis": "The robot is standing upright...", "sampling_used": true}
```

**Examples:**
```python
await analyze_sim_state(job_id="a1b2c3d4")
```

**State machine effect:** None — read-only.

---

### analyze_sim_logs

**Description:** Reads the sim runner log and asks the LLM to diagnose any issues. Useful after a crash or unexpected behaviour.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| job_id | str | Yes | Sim job ID |
| ctx | Context | Yes | FastMCP context (injected automatically) |

**Output:**
```json
{"success": true, "message": "Logs analyzed.", "analysis": "The simulation crashed because...", "sampling_used": true}
```

**Examples:**
```python
await analyze_sim_logs(job_id="a1b2c3d4")
```

**State machine effect:** None — read-only.

---

### discover_model

**Description:** Given a natural-language description, asks the LLM to suggest GitHub raw URLs for matching MuJoCo MJCF/XML models. Downloads and validates each URL; valid models are loaded into the depot.

**Inputs:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| description | str | Yes | Description of the model to find |
| ctx | Context | Yes | FastMCP context (injected automatically) |

**Output:**
```json
{"success": true, "message": "Loaded 2/3 models.", "models_loaded": [{"url": "...", "name": "h1", ...}], "urls_tried": [...]}
```

**Examples:**
```python
await discover_model(description="Unitree H1 humanoid MuJoCo model")
await discover_model(description="Boston Dynamics Spot MJCF")
```

**State machine effect:** None — only modifies the depot.
