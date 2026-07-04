"""PyInstaller entry point — dual transport (stdio or HTTP).

Detects MUJOCO_MCP_PORT env var set by Tauri spawn:
  - If set → HTTP mode via uvicorn on the FastAPI app
  - If not → stdio mode via the MCP server's main()
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

port = os.environ.get("MUJOCO_MCP_PORT") or os.environ.get("MCP_PORT")
if port:
    host = os.environ.get("MUJOCO_MCP_HOST", "127.0.0.1")
    import uvicorn
    from web_sota.backend.server import app
    uvicorn.run(app, host=host, port=int(port), log_level="info")
else:
    from mujoco_mcp.server import main
    main()
