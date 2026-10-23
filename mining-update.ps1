param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [switch]$NoGitSync
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'jobs/mining-dev'
$Source = Join-Path $RepoRoot 'flecity_mining'
$Destination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_mining'
$ServerCfg = Join-Path $ServerBase 'server.cfg'

function Step([string]$message) {
    Write-Host ''
    Write-Host ('==> ' + $message) -ForegroundColor Cyan
}

function Copy-Resource {
    param([string]$From,[string]$To)

    if (-not (Test-Path $From)) {
        throw "Mining source not found: $From"
    }

    if (Test-Path $To) {
        Remove-Item $To -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $To | Out-Null
    Copy-Item (Join-Path $From '*') $To -Recurse -Force
}

try {
    Step 'Checking repository'
    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
        throw "Git repository was not found: $RepoRoot"
    }

    if (-not $NoGitSync) {
        Step 'Fetching latest mining build'
        & git -C $RepoRoot fetch origin
        if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }

        $currentBranch = (& git -C $RepoRoot branch --show-current).Trim()
        if ($currentBranch -ne $Branch) {
            & git -C $RepoRoot switch $Branch
            if ($LASTEXITCODE -ne 0) {
                throw "Could not switch to '$Branch'. Resolve local edits first."
            }
        }

        & git -C $RepoRoot pull --ff-only origin $Branch
        if ($LASTEXITCODE -ne 0) {
            throw 'git pull failed. Resolve local Git conflicts before updating.'
        }
    }

    Step 'Running mining safety checks'
    $required = @(
        (Join-Path $Source 'fxmanifest.lua'),
        (Join-Path $Source 'config.lua'),
        (Join-Path $Source 'client\main.lua'),
        (Join-Path $Source 'server\main.lua'),
        (Join-Path $Source 'server\selftest.lua')
    )

    foreach ($file in $required) {
        if (-not (Test-Path $file)) { throw "Missing required file: $file" }
    }

    $manifest = Get-Content (Join-Path $Source 'fxmanifest.lua') -Raw
    $server = Get-Content (Join-Path $Source 'server\main.lua') -Raw

    if ($manifest -notmatch "dependency\s+'qbx_core'") {
        throw 'fxmanifest.lua does not declare qbx_core dependency.'
    }
    if ($server -notmatch "exports\.qbx_core:AddMoney") {
        throw 'Server payout path could not be verified.'
    }
    if ($server -notmatch "isNear\(src") {
        throw 'Server-side distance validation could not be verified.'
    }
    if ($server -notmatch "minFinishAt") {
        throw 'Server-side action duration validation could not be verified.'
    }

    Step 'Deploying flecity_mining'
    Copy-Resource -From $Source -To $Destination

    if (Test-Path $ServerCfg) {
        $cfg = Get-Content $ServerCfg -Raw
        if ($cfg -notmatch '(?m)^\s*ensure\s+flecity_mining\s*$') {
            Add-Content -Path $ServerCfg -Value "`r`nensure flecity_mining"
            Write-Host 'Added ensure flecity_mining to server.cfg.' -ForegroundColor Green
        }
    }
    else {
        Write-Host "server.cfg was not found at $ServerCfg; deployment still completed." -ForegroundColor Yellow
    }

    Step 'Deployment complete'
    Write-Host "Resource: $Destination" -ForegroundColor Green
    Write-Host ''
    Write-Host 'For the currently running server, run this once in txAdmin console:' -ForegroundColor Yellow
    Write-Host '    ensure flecity_mining' -ForegroundColor White
    Write-Host ''
    Write-Host 'Then verify:' -ForegroundColor Yellow
    Write-Host '    mining_selftest' -ForegroundColor White
    Write-Host '    mining_healthcheck' -ForegroundColor White
}
catch {
    Write-Host ''
    Write-Host ('Mining update failed: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
