"""AI workflow routes — proxies MCP tool calls through REST with Ollama fallback."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "src"))

from fastapi import APIRouter
from pydantic import BaseModel
from mujoco_mcp.server import (
    agentic_sim_workflow,
    natural_language_control,
    analyze_sim_state,
    analyze_sim_logs,
    discover_model,
)

router = APIRouter(tags=["AI"], prefix="/api/ai")


class WorkflowBody(BaseModel):
    goal: str


class NLControlBody(BaseModel):
    prompt: str
    job_id: str


class AnalyzeStateBody(BaseModel):
    job_id: str


class AnalyzeLogsBody(BaseModel):
    job_id: str


class DiscoverModelBody(BaseModel):
    description: str


@router.post("/workflow")
async def post_workflow(body: WorkflowBody):
    return await agentic_sim_workflow(goal=body.goal, ctx=None)


@router.post("/nl-control")
async def post_nl_control(body: NLControlBody):
    return await natural_language_control(prompt=body.prompt, job_id=body.job_id, ctx=None)


@router.post("/analyze-state")
async def post_analyze_state(body: AnalyzeStateBody):
    return await analyze_sim_state(job_id=body.job_id, ctx=None)


@router.post("/analyze-logs")
async def post_analyze_logs(body: AnalyzeLogsBody):
    return await analyze_sim_logs(job_id=body.job_id, ctx=None)


@router.post("/discover-model")
async def post_discover_model(body: DiscoverModelBody):
    return await discover_model(description=body.description, ctx=None)
