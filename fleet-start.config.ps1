# Per-repo fleet start config for mujoco-mcp
# Edit ports/backend target here - start.ps1 is fleet-standard.
@{
    Name         = 'mujoco-mcp'
    BackendPort  = 11046
    FrontendPort = 11047
    HealthPath   = '/health'
    WebRoot      = 'web_sota'
    Backend = @{
        Kind          = 'uvicorn'
        UvicornTarget = 'web_sota.backend.server:app'
        Env           = @{ WEB_PORT = '11046' }
    }
    Frontend = @{
        Kind = 'none'
    }
}
