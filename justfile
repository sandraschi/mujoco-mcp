set windows-shell := ["powershell.exe", "-NoProfile", "-Command"]

import 'scripts/just/fleet.just'

# === Fleet-standard ===
bootstrap:
    uv sync --group dev
    uv run pre-commit install
    if (Test-Path "web_sota\package.json") { Set-Location web_sota; bun install }
    Write-Host "Pre-commit hooks installed." -ForegroundColor Green

serve:
    uv run python -m mujoco_mcp

lint:
    uv run ruff check src/ web_sota/backend/

fix:
    uv run ruff check --fix src/ web_sota/backend/

fmt:
    uv run ruff format src/ web_sota/backend/

test:
    uv run pytest tests/ -q

e2e:
    cd web_sota && npx playwright test

web:
    powershell.exe -NoProfile -File ./web_sota/start.ps1

clean:
    powershell.exe -NoProfile -c "Remove-Item -Recurse -Force -Path dist,.venv,__pycache__ -ErrorAction SilentlyContinue"

# === Repo-specific ===
sim-runner:
    uv run python src/mujoco_mcp/_sim_runner.py --help

state-machine:
    uv run python -c "from mujoco_mcp.state_machine import SimState; print('States:', [s.value for s in SimState]); print('Terminal:', {s.value: s.terminal() for s in SimState})"

models:
    uv run python -c "from pathlib import Path; p = Path('models'); print('Depot:', list(p.iterdir()) if p.exists() else 'empty')"

jobs:
    uv run python -c "from pathlib import Path; p = Path('jobs'); print('Jobs:', [d.name for d in p.iterdir()]) if p.exists() else print('no jobs dir')"

# Pack the MCPB bundle (wipes + recopies mcpb/src first)
mcpb-pack:
    powershell.exe -NoProfile -File ./mcpb/pack.ps1

# Build the PyInstaller backend + Tauri NSIS installer
build-native:
    $env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
    powershell.exe -NoProfile -File ./native/build.ps1

# CUA-NSIS smoke test (install -> launch -> verify -> uninstall)
cua-nsis-test:
    uv run python scripts/cua-smoke.py

# Full verification: lint + format + tests + types + e2e
certify:
    just lint
    just fmt
    uv run pytest tests/ -q
    cd web_sota && bunx tsc --noEmit
