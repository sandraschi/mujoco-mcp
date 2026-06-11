serve:
    uv run python -m mujoco_mcp

lint:
    ruff check src/ web_sota/backend/

fix:
    ruff check --fix src/ web_sota/backend/

test:
    uv run pytest tests/ -q

web:
    Set-Location web_sota && .\start.ps1
