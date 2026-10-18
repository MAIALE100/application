$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
$ConfigPath = Join-Path $RepoRoot ".three-apps.local.json"
$ExpectedBranch = "frame-integration-test"

function Mirror-Resource([string]$Name, [string]$TargetRoot) {
    $src = Join-Path $RepoRoot $Name
    $dst = Join-Path $TargetRoot $Name
    if (-not (Test-Path -LiteralPath $src -PathType Container)) { throw "Missing repository resource: $src" }
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    & robocopy.exe $src $dst /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
    if ($LASTEXITCODE -gt 7) { throw "robocopy failed for $Name (exit $LASTEXITCODE)." }
    Write-Host "  synced: $Name"
}

Write-Host ""
Write-Host "=== Flecity 3 Apps - Update ==="
Write-Host ""

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    Write-Host "First setup has not been run yet." -ForegroundColor Yellow
    Write-Host "Opening 3apps-setup.cmd..."
    Start-Process -FilePath (Join-Path $RepoRoot "3apps-setup.cmd")
    exit 0
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$resourcesPath = [string]$config.resourcesPath
if (-not (Test-Path -LiteralPath $resourcesPath -PathType Container)) { throw "Configured resources folder no longer exists: $resourcesPath" }

Set-Location $RepoRoot
$branch = (git branch --show-current).Trim()
if ($branch -ne $ExpectedBranch) {
    throw "Safety stop: current branch is '$branch'. Expected '$ExpectedBranch'."
}

Write-Host "[1/4] Pulling latest GitHub changes..."
git pull --ff-only origin $ExpectedBranch
if ($LASTEXITCODE -ne 0) { throw "git pull failed." }

Write-Host "[2/4] Building PuriPhoto UI..."
$PuriUi = Join-Path $RepoRoot "puriphoto\ui"
if (Test-Path (Join-Path $PuriUi "package.json")) {
    Push-Location $PuriUi
    try {
        npm.cmd install --package-lock=false --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "PuriPhoto dependency install failed." }
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "PuriPhoto build failed." }
    } finally { Pop-Location }
} else {
    Write-Host "  package.json not found; using committed dist build."
}

Write-Host "[3/4] Syncing resources to FiveM..."
Mirror-Resource "puriphoto" $resourcesPath
Mirror-Resource "photo_diary" $resourcesPath
Mirror-Resource "frame" $resourcesPath
Mirror-Resource "three_apps_bootstrap" $resourcesPath

Write-Host "[4/4] Preflight..."
$required = @(
    (Join-Path $resourcesPath "puriphoto\fxmanifest.lua"),
    (Join-Path $resourcesPath "photo_diary\fxmanifest.lua"),
    (Join-Path $resourcesPath "frame\fxmanifest.lua"),
    (Join-Path $resourcesPath "three_apps_bootstrap\fxmanifest.lua")
)
foreach ($p in $required) { if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "Missing after sync: $p" } }

Write-Host ""
Write-Host "========================================"
Write-Host " 3 apps updated and synced successfully"
Write-Host "========================================"
Write-Host "Target: $resourcesPath"
Write-Host ""
Write-Host "If the FiveM server is already running, restart these resources (or restart the server):"
Write-Host "  restart three_apps_bootstrap"
Write-Host "  (bootstrap restarts PuriPhoto / Photo Diary / FRAME in order)"
Write-Host ""
