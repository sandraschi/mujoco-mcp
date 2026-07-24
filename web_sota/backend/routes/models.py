"""Model depot routes — list, load, and seed from Menagerie."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "src"))

import httpx
from fastapi import APIRouter

from mujoco_mcp.server import MODEL_DIR, _load_depot, _parse_mjcf, _save_depot

router = APIRouter(tags=["Models"])

MENAGERIE = {
    "cartpole": "https://raw.githubusercontent.com/Farama-Foundation/Gymnasium/main/gymnasium/envs/mujoco/assets/inverted_pendulum.xml",
    "hopper": "https://raw.githubusercontent.com/Farama-Foundation/Gymnasium/main/gymnasium/envs/mujoco/assets/hopper.xml",
    "walker": "https://raw.githubusercontent.com/Farama-Foundation/Gymnasium/main/gymnasium/envs/mujoco/assets/walker2d.xml",
    "ant": "https://raw.githubusercontent.com/Farama-Foundation/Gymnasium/main/gymnasium/envs/mujoco/assets/ant.xml",
    "humanoid": "https://raw.githubusercontent.com/Farama-Foundation/Gymnasium/main/gymnasium/envs/mujoco/assets/humanoid.xml",
    "unitree_h1": "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/unitree_h1/scene.xml",
    "unitree_go2": "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main/unitree_go2/scene.xml",
}


@router.get("/api/models")
async def list_models():
    depot = _load_depot()
    return {"models": depot, "count": len(depot)}


@router.post("/api/models/load")
async def load_model(body: dict):
    name = body.get("name", "")
    uri = body.get("uri", "")
    if not name or not uri:
        return {"success": False, "error": "Both name and uri are required"}
    depot = _load_depot()
    dest = MODEL_DIR / f"{name}.xml"
    try:
        if uri.startswith(("http://", "https://")):
            resp = httpx.get(uri, follow_redirects=True, timeout=60)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
        else:
            src = Path(uri)
            if not src.exists():
                return {"success": False, "error": f"File not found: {uri}"}
            import shutil

            shutil.copy2(src, dest)
        meta = _parse_mjcf(str(dest))
        depot[name] = {"uri": uri, "path": str(dest.resolve()), "metadata": meta}
        _save_depot(depot)
        return {"success": True, "name": name, "path": str(dest), **meta}
    except Exception as e:
        return {"success": False, "error": str(e)}


@router.post("/api/models/seed")
async def seed_models():
    depot = _load_depot()
    ok, failed = [], []
    for name, url in MENAGERIE.items():
        if name in depot:
            ok.append(name)
            continue
        dest = MODEL_DIR / f"{name}.xml"
        try:
            resp = httpx.get(url, follow_redirects=True, timeout=60)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            meta = _parse_mjcf(str(dest))
            depot[name] = {"uri": url, "path": str(dest.resolve()), "metadata": meta}
            ok.append(name)
        except Exception as e:
            failed.append({"name": name, "error": str(e)})
    _save_depot(depot)
    return {"success": True, "seeded": ok, "failed": failed, "count": len(ok)}


_MENAGERIE_REPO = "google-deepmind/mujoco_menagerie"
_MENAGERIE_RAW = (
    "https://raw.githubusercontent.com/google-deepmind/mujoco_menagerie/main"
)
_MENAGERIE_CACHE: list[dict] | None = None


@router.get("/api/menagerie")
async def list_menagerie(search: str = ""):
    """List available models from the MuJoCo Menagerie GitHub repo."""
    global _MENAGERIE_CACHE
    if _MENAGERIE_CACHE is None:
        url = f"https://api.github.com/repos/{_MENAGERIE_REPO}/contents/"
        resp = httpx.get(url, timeout=15)
        resp.raise_for_status()
        _MENAGERIE_CACHE = [
            {
                "name": item["name"],
                "type": item["type"],
                "url": f"{_MENAGERIE_RAW}/{item['name']}/scene.xml",
            }
            for item in resp.json()
            if item["type"] == "dir"
        ]
    results = _MENAGERIE_CACHE
    if search:
        results = [m for m in results if search.lower() in m["name"].lower()]
    return {"models": results, "count": len(results), "total": len(_MENAGERIE_CACHE)}


@router.post("/api/menagerie/load")
async def load_from_menagerie(body: dict):
    """Download a model from the MuJoCo Menagerie by name."""
    name = body.get("name", "")
    if not name:
        return {"success": False, "error": "name is required"}
    url = f"{_MENAGERIE_RAW}/{name}/scene.xml"
    depot = _load_depot()
    dest = MODEL_DIR / f"{name}.xml"
    try:
        resp = httpx.get(url, follow_redirects=True, timeout=60)
        resp.raise_for_status()
        dest.write_bytes(resp.content)
        meta = _parse_mjcf(str(dest))
        depot[name] = {"uri": url, "path": str(dest.resolve()), "metadata": meta}
        _save_depot(depot)
        return {"success": True, "name": name, "path": str(dest), **meta}
    except Exception as e:
        return {"success": False, "error": str(e)}
