"""Tests for mujoco-mcp server tools."""

from pathlib import Path
from typing import Any

import pytest

from mujoco_mcp.server import (
    sim_status,
    list_models,
    list_jobs,
)


@pytest.fixture
def empty_depot(tmp_path: Path) -> Any:
    """Patch MODEL_DIR and JOBS_DIR to temp dirs."""
    import mujoco_mcp.server as srv

    original_model = srv.MODEL_DIR
    original_jobs = srv.JOBS_DIR
    original_depot = srv.DEPOT_FILE

    srv.MODEL_DIR = tmp_path / "models"
    srv.JOBS_DIR = tmp_path / "jobs"
    srv.DEPOT_FILE = srv.MODEL_DIR / ".depot" / "registry.json"
    srv.MODEL_DIR.mkdir(parents=True, exist_ok=True)
    srv.JOBS_DIR.mkdir(parents=True, exist_ok=True)
    srv.DEPOT_FILE.parent.mkdir(parents=True, exist_ok=True)

    # Reset the in-memory depot
    srv._save_depot({})

    yield

    srv.MODEL_DIR = original_model
    srv.JOBS_DIR = original_jobs
    srv.DEPOT_FILE = original_depot


class TestSimStatus:
    def test_sim_status_returns_dict(self):
        result = sim_status()
        assert isinstance(result, dict)
        assert "mujoco_available" in result

    def test_sim_status_keys(self):
        result = sim_status()
        expected_keys = {
            "mujoco_available", "mujoco_version",
            "model_dir_exists", "models_in_depot",
            "active_jobs", "jobs_dir_exists",
        }
        assert expected_keys.issubset(result.keys())


class TestListModels:
    def test_list_models_empty(self, empty_depot):
        result = list_models()
        assert result["success"] is True
        assert result["count"] == 0
        assert isinstance(result["models"], dict)

    def test_list_models_success(self, empty_depot):
        import json
        depot_path = empty_depot  # This is tmp_path from fixture
        # Actually we need the depot file path from the earlier setup
        result = list_models()
        assert result["success"] is True


class TestListJobs:
    def test_list_jobs_empty(self, empty_depot):
        result = list_jobs()
        assert result["success"] is True
        assert result["total"] == 0
        assert isinstance(result["active"], list)
        assert isinstance(result["completed"], list)


class TestLoadModel:
    def test_load_model_file_not_found(self, empty_depot):
        from mujoco_mcp.server import load_model
        result = load_model(uri="/nonexistent/file.xml", name="test_bot")
        assert result["success"] is False
        assert "error" in result

    def test_load_model_success(self, empty_depot, tmp_path):
        from mujoco_mcp.server import load_model, list_models

        # Create a minimal MJCF file
        mjcf_content = '''<?xml version="1.0"?>
<mujoco>
  <worldbody>
    <body name="base">
      <joint name="hinge" type="hinge" axis="0 1 0"/>
      <geom type="box" size="0.1 0.1 0.1"/>
    </body>
  </worldbody>
</mujoco>'''

        xml_path = tmp_path / "test_robot.xml"
        xml_path.write_text(mjcf_content)

        result = load_model(uri=str(xml_path), name="test_bot")
        assert result["success"] is True
        assert result["name"] == "test_bot"
        assert result["joint_count"] >= 1
        assert result["body_count"] >= 1

        models = list_models()
        assert models["count"] == 1
        assert "test_bot" in models["models"]


class TestStartStopSim:
    def test_start_sim_no_such_model(self, empty_depot):
        from mujoco_mcp.server import start_sim
        result = start_sim(model_name="nonexistent", headless=True)
        assert result["success"] is False
        assert "error" in result

    def test_stop_sim_unknown_job(self, empty_depot):
        from mujoco_mcp.server import stop_sim
        result = stop_sim(job_id="bad_job_id")
        assert result["success"] is False


class TestAiTools:
    @pytest.mark.asyncio
    async def test_agentic_workflow_ollama_fallback(self, empty_depot):
        from mujoco_mcp.server import agentic_sim_workflow
        result = await agentic_sim_workflow(goal="test", ctx=None)
        # Should fall back to Ollama which isn't available in CI
        assert result["success"] is False
        assert "message" in result

    @pytest.mark.asyncio
    async def test_discover_model_no_llm(self, empty_depot):
        from mujoco_mcp.server import discover_model
        result = await discover_model(description="test", ctx=None)
        # Should fail gracefully with no LLM
        assert "success" in result

    @pytest.mark.asyncio
    async def test_nl_control_unknown_job(self, empty_depot):
        from mujoco_mcp.server import natural_language_control
        result = await natural_language_control(prompt="test", job_id="bad_id", ctx=None)
        assert result["success"] is False

    @pytest.mark.asyncio
    async def test_analyze_state_unknown_job(self, empty_depot):
        from mujoco_mcp.server import analyze_sim_state
        result = await analyze_sim_state(job_id="bad_id", ctx=None)
        assert result["success"] is False
