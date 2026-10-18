$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
$ConfigPath = Join-Path $RepoRoot ".three-apps.local.json"

function Read-ExistingDirectory([string]$Prompt) {
    while ($true) {
        $value = (Read-Host $Prompt).Trim().Trim('"')
        if (Test-Path -LiteralPath $value -PathType Container) { return (Resolve-Path -LiteralPath $value).Path }
        Write-Host "Folder not found: $value" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Flecity 3 Apps - First Setup ==="
Write-Host "PuriPhoto / Photo Diary / FRAME"
Write-Host ""

if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) { throw "Git is required." }
if (-not (Test-Path (Join-Path $RepoRoot ".git"))) { throw "Run this CMD from the cloned MAIALE100/application repository." }

Set-Location $RepoRoot
$branch = (git branch --show-current).Trim()
if ($branch -ne "frame-integration-test") {
    Write-Host "Switching to frame-integration-test..."
    git fetch origin frame-integration-test
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed." }
    git checkout frame-integration-test
    if ($LASTEXITCODE -ne 0) { throw "git checkout failed." }
}

Write-Host ""
Write-Host "Enter the FiveM folder that should directly contain puriphoto/photo_diary/frame."
Write-Host "Example: D:\FiveM_Dev\server-data\resources\[local]"
$resourcesPath = Read-ExistingDirectory "FiveM resources target folder"

$serverCfg = (Read-Host "server.cfg full path (press Enter to skip automatic patching)").Trim().Trim('"')
if ($serverCfg -and -not (Test-Path -LiteralPath $serverCfg -PathType Leaf)) {
    Write-Host "server.cfg was not found. Automatic patching will be skipped." -ForegroundColor Yellow
    $serverCfg = ""
}

$config = [ordered]@{
    resourcesPath = $resourcesPath
    serverCfg = $serverCfg
    branch = "frame-integration-test"
}
$config | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

if ($serverCfg) {
    $cfgText = Get-Content -LiteralPath $serverCfg -Raw
    $block = @"

# BEGIN FLECITY 3 APPS
ensure three_apps_bootstrap
# END FLECITY 3 APPS
"@
    if ($cfgText -notmatch '(?m)^# BEGIN FLECITY 3 APPS\s*$') {
        Add-Content -LiteralPath $serverCfg -Value $block -Encoding UTF8
        Write-Host "Added 3-app ensure block to server.cfg."
    } else {
        Write-Host "server.cfg already contains the 3-app block."
    }
}

Write-Host ""
Write-Host "Saved local setup to .three-apps.local.json"
Write-Host "Running the first update + sync now..."
& (Join-Path $RepoRoot "3apps-update.ps1")
