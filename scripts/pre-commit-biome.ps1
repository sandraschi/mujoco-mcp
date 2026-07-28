# Fleet: mcp-central-docs/templates/pre-commit-biome.ps1
# Runs biome check in webapp/ or web_sota/ when package.json exists.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

$webRoot = $null
foreach ($candidate in @("webapp", "web_sota")) {
    $path = Join-Path $repoRoot $candidate
    if (Test-Path (Join-Path $path "package.json")) {
        $webRoot = $path
        break
    }
}

if (-not $webRoot) {
    exit 0
}

Push-Location $webRoot
try {
    if (-not (Test-Path "node_modules")) {
        npm ci --silent
        if ($LASTEXITCODE -ne 0) {
            npm install --silent
        }
    }
    npm run biome:ci
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
