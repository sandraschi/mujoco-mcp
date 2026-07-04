param([switch]$Interactive)

$ErrorActionPreference = "Stop"
$backendPort = 11046
$mcpUrl = "http://127.0.0.1:${backendPort}/mcp"

function Register-Cursor {
    $cursorConfig = "$env:USERPROFILE\.cursor\mcp.json"
    $existing = @{}
    if (Test-Path $cursorConfig) {
        $existing = Get-Content $cursorConfig -Raw | ConvertFrom-Json -AsHashtable
    }
    if (-not $existing.ContainsKey("mujoco-mcp")) {
        $existing["mujoco-mcp"] = @{
            "url" = $mcpUrl
        }
        $dir = Split-Path -Parent $cursorConfig
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $existing | ConvertTo-Json -Depth 10 | Set-Content $cursorConfig -Encoding utf8
        Write-Host "  Registered mujoco-mcp in Cursor" -ForegroundColor Green
    } else {
        Write-Host "  Already registered in Cursor" -ForegroundColor DarkGray
    }
}

function Register-ClaudeDesktop {
    $claudeConfig = "$env:APPDATA\Claude\claude_desktop_config.json"
    $existing = @{}
    if (Test-Path $claudeConfig) {
        $existing = Get-Content $claudeConfig -Raw | ConvertFrom-Json -AsHashtable
    }
    if (-not $existing.ContainsKey("mcpServers")) { $existing["mcpServers"] = @{} }
    if (-not $existing["mcpServers"].ContainsKey("mujoco-mcp")) {
        $existing["mcpServers"]["mujoco-mcp"] = @{
            "url" = $mcpUrl
        }
        $existing | ConvertTo-Json -Depth 10 | Set-Content $claudeConfig -Encoding utf8
        Write-Host "  Registered mujoco-mcp in Claude Desktop" -ForegroundColor Green
    } else {
        Write-Host "  Already registered in Claude Desktop" -ForegroundColor DarkGray
    }
}

Write-Host "Registering mujoco-mcp MCP server..." -ForegroundColor Cyan
Write-Host "  URL: $mcpUrl" -ForegroundColor DarkGray
Register-Cursor
Register-ClaudeDesktop
Write-Host "Done. Restart Cursor/Claude Desktop to apply changes." -ForegroundColor Cyan
