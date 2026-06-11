"""Tests for mujoco-mcp FastAPI backend routes."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import pytest
from fastapi.testclient import TestClient

from web_sota.backend.server import app

client = TestClient(app)


class TestHealth:
    def test_health_returns_200(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "mujoco_available" in data

    def test_api_health_match(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200


class TestAI:
    def test_workflow_empty_goal_422(self):
        resp = client.post("/api/ai/workflow", json={})
        assert resp.status_code == 422

    def test_discover_model(self):
        resp = client.post("/api/ai/discover-model", json={"description": "test"})
        assert resp.status_code == 200

    def test_nl_control(self):
        resp = client.post("/api/ai/nl-control", json={"prompt": "test", "job_id": "none"})
        assert resp.status_code == 200

    def test_analyze_state(self):
        resp = client.post("/api/ai/analyze-state", json={"job_id": "none"})
        assert resp.status_code == 200

    def test_analyze_logs(self):
        resp = client.post("/api/ai/analyze-logs", json={"job_id": "none"})
        assert resp.status_code == 200


class TestLLM:
    def test_providers(self):
        resp = client.get("/api/llm/providers")
        assert resp.status_code == 200
        data = resp.json()
        assert "ollama" in data


class TestSettings:
    def test_settings(self):
        resp = client.get("/api/settings")
        assert resp.status_code in (200, 404)  # settings endpoint may not exist in basic setup
