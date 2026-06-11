# === Fleet-standard ===
bootstrap:
    uv sync

serve:
    uv run python -m mujoco_mcp

lint:
    ruff check src/ web_sota/backend/

fix:
    ruff check --fix src/ web_sota/backend/

test:
    uv run pytest tests/ -q

e2e:
    cd web_sota && npx playwright test

web:
    pwsh -NoProfile -File ./web_sota/start.ps1

mcpb-pack:
    pwsh -NoProfile -File ./mcpb/pack.ps1

clean:
    pwsh -NoProfile -c "Remove-Item -Recurse -Force -Path dist,.venv,__pycache__ -ErrorAction SilentlyContinue"

# === Repo-specific ===
sim-runner:
    uv run python src/mujoco_mcp/_sim_runner.py --help

state-machine:
    uv run python -c "from mujoco_mcp.state_machine import SimState; print('States:', [s.value for s in SimState]); print('Terminal:', {s.value: s.terminal() for s in SimState})"

models:
    uv run python -c "from pathlib import Path; p = Path('models'); print('Depot:', list(p.iterdir()) if p.exists() else 'empty')"

jobs:
    uv run python -c "from pathlib import Path; p = Path('jobs'); print('Jobs:', [d.name for d in p.iterdir()]) if p.exists() else print('no jobs dir')"