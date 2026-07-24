"""FastAPI backend for the mujoco-mcp web dashboard."""

import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "src"))

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from mujoco_mcp.server import mcp, sim_status
from web_sota.backend.log_buffer import activity_log
from web_sota.backend.routes.ai import router as ai_router
from web_sota.backend.routes.logging import router as logging_router
from web_sota.backend.routes.models import router as models_router

_server_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.activity_log = activity_log
    log_dir = Path(__file__).resolve().parent.parent.parent / "logs"
    log_dir.mkdir(exist_ok=True)
    activity_log.start_file_watch(log_dir / "server.log")
    activity_log.info("server", "Server started")
    yield
    activity_log.info("server", "Server stopped")


app = FastAPI(title="mujoco-mcp", lifespan=lifespan)

_tauri_desktop = os.environ.get("MUJOCO_MCP_TAURI", "").lower() in ("1", "true", "yes")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_origin_regex=r"https?://tauri\.localhost(:\d+)?" if _tauri_desktop else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai_router)
app.include_router(logging_router)
app.include_router(models_router)


@app.get("/health")
@app.get("/api/health")
async def health():
    status = sim_status()
    return {
        "status": "ok" if status.get("mujoco_available") else "degraded",
        "server": "mujoco-mcp",
        "version": "0.2.1",
        "uptime_seconds": int(time.time() - _server_start_time),
        "tool_count": 14,
        **status,
    }


@app.get("/api/v1/diagnostics")
async def diagnostics():
    status = sim_status()
    return {
        "status": "ok" if status.get("mujoco_available") else "degraded",
        "server": "mujoco-mcp",
        "version": "0.2.1",
        "uptime_seconds": int(time.time() - _server_start_time),
        "tool_count": 14,
        "tools": [
            {"name": "sim_status"},
            {"name": "load_model"},
            {"name": "start_sim"},
            {"name": "stop_sim"},
            {"name": "get_state"},
            {"name": "apply_control"},
            {"name": "list_models"},
            {"name": "list_jobs"},
            {"name": "export_frame"},
            {"name": "agentic_sim_workflow"},
            {"name": "natural_language_control"},
            {"name": "analyze_sim_state"},
            {"name": "analyze_sim_logs"},
            {"name": "discover_model"},
        ],
        "system": {"windows": sys.platform == "win32"},
        "errors": [],
    }


_SKILLS_DIR = Path(__file__).resolve().parents[2] / "src" / "mujoco_mcp" / "skills"


@app.get("/api/skills")
async def list_skills():
    if not _SKILLS_DIR.is_dir():
        return {"skills": []}
    skills = []
    for d in _SKILLS_DIR.iterdir():
        if d.is_dir() and (d / "SKILL.md").exists():
            skills.append({"name": d.name, "title": d.name.replace("-", " ").title()})
    return {"skills": skills}


@app.get("/api/skills/{skill_name}")
async def get_skill(skill_name: str):
    skill_path = _SKILLS_DIR / skill_name / "SKILL.md"
    if skill_path.exists():
        return {"name": skill_name, "content": skill_path.read_text(encoding="utf-8")}
    return {"error": "Skill not found"}, 404


@app.get("/api/llm/providers")
async def llm_providers():
    import asyncio

    import httpx

    PROBES = {
        "ollama": (
            "http://127.0.0.1:11434/api/tags",
            lambda d: [{"name": m["name"]} for m in d.get("models", [])],
        ),
        "lm-studio": (
            "http://127.0.0.1:1234/v1/models",
            lambda d: [{"name": m["id"]} for m in d.get("data", [])],
        ),
        "vllm": (
            "http://127.0.0.1:8000/v1/models",
            lambda d: [{"name": m["id"]} for m in d.get("data", [])],
        ),
    }

    async def probe(name: str, url: str, parser) -> dict:
        try:
            async with httpx.AsyncClient(timeout=3) as c:
                r = await c.get(url)
                r.raise_for_status()
                models = parser(r.json())
                return {"name": name, "status": "detected", "models": models}
        except Exception:
            return {"name": name, "status": "not_found", "models": []}

    results = await asyncio.gather(*[probe(n, u, p) for n, (u, p) in PROBES.items()])
    out = {}
    for r in results:
        out[r["name"]] = {"status": r["status"], "models": r["models"]}
    return out


@app.post("/api/llm/chat")
async def llm_chat(body: dict):
    import httpx

    provider = body.get("provider", "ollama")
    model = body.get("model", "llama3.2:3b")
    prompt = body.get("prompt", "")
    system = body.get("system", "")

    if provider == "ollama":
        try:
            resp = httpx.post(
                "http://127.0.0.1:11434/api/generate",
                json={
                    "model": model,
                    "prompt": f"{system}\n\n{prompt}" if system else prompt,
                    "stream": False,
                },
                timeout=60,
            )
            return resp.json()
        except Exception as e:
            return {"error": str(e)}

    base = {"lm-studio": "http://127.0.0.1:1234", "vllm": "http://127.0.0.1:8000"}.get(
        provider
    )
    if not base:
        return {"error": f"Unknown provider: {provider}"}
    try:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        resp = httpx.post(
            f"{base}/v1/chat/completions",
            json={"model": model, "messages": messages, "stream": False},
            timeout=60,
        )
        data = resp.json()
        return {"response": data["choices"][0]["message"]["content"]}
    except Exception as e:
        return {"error": str(e)}


# Mount MCP HTTP
app.mount("/mcp", mcp.http_app(path="/"))

# Serve frontend static files (if dist exists)
dist = Path(__file__).resolve().parent.parent / "dist"
if dist.is_dir():
    app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")


def run_dev() -> None:
    import uvicorn

    port = int(os.environ.get("MUJOCO_MCP_PORT", "11046"))
    uvicorn.run(
        "web_sota.backend.server:app",
        host="127.0.0.1",
        port=port,
        log_level="info",
        reload=True,
    )


if __name__ == "__main__":
    if "--port" in sys.argv:
        idx = sys.argv.index("--port")
        if idx + 1 < len(sys.argv):
            os.environ["MUJOCO_MCP_PORT"] = sys.argv[idx + 1]
    run_dev()
