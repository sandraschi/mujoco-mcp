---
name: mujoco-mcp
description: Session context for the MuJoCo MCP server - physics simulation tools, model depot, and simulation jobs. Load when working with MuJoCo physics, simulation workflows, or model control.
---

## Session Context (MuJoCo MCP)

You have access to a MuJoCo physics simulation server with 19 tools. You can load MJCF models, run simulations, apply controls, analyze state, and execute multi-step AI workflows.

**Before starting work:**
1. Check server health: sim_status()
2. List available models: list_models()
3. List running jobs: list_jobs()

**At end of work, save findings:**
- Stop any running simulations: stop_sim(job_id=...)
- Export any useful render frames: export_frame(job_id=...)
