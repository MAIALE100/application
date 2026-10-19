$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$ConfigPath = Join-Path $RepoRoot ".three-apps.local.json"
$ExpectedBranch = "frame-integration-test"

function Mirror-Frame([string]$TargetRoot) {
    $src = Join-Path $RepoRoot "frame"
    $dst = Join-Path $TargetRoot "frame"

    if (-not (Test-Path -LiteralPath $src -PathType Container)) {
        throw "Missing repository resource: $src"
    }

    New-Item -ItemType Directory -Force -Path $dst | Out-Null

    & robocopy.exe $src $dst /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
    if ($LASTEXITCODE -gt 7) {
        throw "robocopy failed for FRAME (exit $LASTEXITCODE)."
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host " FRAME - GitHub Update"
Write-Host " FRAME only / PuriPhoto & Photo Diary untouched"
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    Write-Host "First setup has not been run yet." -ForegroundColor Yellow

    $setup = Join-Path $RepoRoot "3apps-setup.cmd"
    if (Test-Path -LiteralPath $setup -PathType Leaf) {
        Write-Host "Opening 3apps-setup.cmd..."
        Start-Process -FilePath $setup
        exit 0
    }

    throw "Missing local setup config: $ConfigPath"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$resourcesPath = [string]$config.resourcesPath

if (-not (Test-Path -LiteralPath $resourcesPath -PathType Container)) {
    throw "Configured resources folder no longer exists: $resourcesPath"
}

Set-Location $RepoRoot

Write-Host "[1/4] Checking Git branch..."
$branch = (git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0) {
    throw "Could not read the current Git branch."
}
if ($branch -ne $ExpectedBranch) {
    throw "Safety stop: current branch is '$branch'. Expected '$ExpectedBranch'."
}
Write-Host "  Branch: $branch"

Write-Host "[2/4] Pulling latest FRAME changes from GitHub..."
git pull --ff-only origin $ExpectedBranch
if ($LASTEXITCODE -ne 0) {
    throw "git pull failed."
}

Write-Host "[3/4] Syncing FRAME only..."
Mirror-Frame $resourcesPath
Write-Host "  synced: frame"

Write-Host "[4/4] Preflight..."
$manifest = Join-Path $resourcesPath "frame\fxmanifest.lua"
if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) {
    throw "FRAME fxmanifest.lua is missing after sync: $manifest"
}

$manifestText = Get-Content -LiteralPath $manifest -Raw
$version = "unknown"
if ($manifestText -match "(?m)^version\s+'([^']+)'") {
    $version = $Matches[1]
}

Write-Host ""
Write-Host "========================================"
Write-Host " FRAME update completed successfully"
Write-Host "========================================"
Write-Host "Version: $version"
Write-Host "Target : $(Join-Path $resourcesPath 'frame')"
Write-Host ""
Write-Host "PuriPhoto    : NOT TOUCHED"
Write-Host "Photo Diary  : NOT TOUCHED"
Write-Host ""
Write-Host "If the server is already running:"
Write-Host "  txAdmin -> restart frame"
Write-Host ""
