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
