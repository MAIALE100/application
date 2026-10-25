param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [switch]$NoGitSync
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'jobs/mining-dev'

$Source = Join-Path $RepoRoot 'flecity_mining'
$Destination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_mining'

$BridgeSource = Join-Path $RepoRoot 'flecity_mining_devbridge'
$BridgeDestination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_mining_devbridge'

$ServerCfg = Join-Path $ServerBase 'server.cfg'

function Step([string]$message) {
    Write-Host ''
    Write-Host ('==> ' + $message) -ForegroundColor Cyan
}

function Copy-Resource {
    param([string]$From,[string]$To)

    if (-not (Test-Path $From)) {
        throw "Resource source not found: $From"
    }

    if (Test-Path $To) {
        Remove-Item $To -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $To | Out-Null
    Copy-Item (Join-Path $From '*') $To -Recurse -Force
}

function Ensure-ServerCfgLine {
    param([string]$CfgPath,[string]$ResourceName)

    if (-not (Test-Path $CfgPath)) {
        return
    }

    $cfg = Get-Content $CfgPath -Raw
    $pattern = '(?m)^\s*ensure\s+' + [regex]::Escape($ResourceName) + '\s*$'
    if ($cfg -notmatch $pattern) {
        Add-Content -Path $CfgPath -Value ("\r\nensure " + $ResourceName)
        Write-Host ("Added ensure {0} to server.cfg." -f $ResourceName) -ForegroundColor Green
    }
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
        (Join-Path $Source 'config\gameplay.lua'),
        (Join-Path $Source 'config\economy.lua'),
        (Join-Path $Source 'config\locations.lua'),
        (Join-Path $Source 'client\main.lua'),
        (Join-Path $Source 'server\main.lua'),
        (Join-Path $Source 'server\selftest.lua'),
        (Join-Path $BridgeSource 'fxmanifest.lua'),
        (Join-Path $BridgeSource 'server\main.lua')
    )

    foreach ($file in $required) {
        if (-not (Test-Path $file)) { throw "Missing required file: $file" }
    }

    $manifest = Get-Content (Join-Path $Source 'fxmanifest.lua') -Raw
    $server = Get-Content (Join-Path $Source 'server\main.lua') -Raw

    if ($manifest -notmatch "dependency\s+'qbx_core'") {
        throw 'fxmanifest.lua does not declare qbx_core dependency.'
    }
    if ($manifest -notmatch "config/economy.lua" -or $manifest -notmatch "config/gameplay.lua" -or $manifest -notmatch "config/locations.lua") {
        throw 'Split operator config files are not loaded by fxmanifest.lua.'
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

    Step 'Deploying DEV reload bridge'
    Copy-Resource -From $BridgeSource -To $BridgeDestination

    if (Test-Path $ServerCfg) {
        Ensure-ServerCfgLine -CfgPath $ServerCfg -ResourceName 'flecity_mining_devbridge'
        Ensure-ServerCfgLine -CfgPath $ServerCfg -ResourceName 'flecity_mining'
    }
    else {
        Write-Host "server.cfg was not found at $ServerCfg; deployment still completed." -ForegroundColor Yellow
    }

    Step 'Deployment complete'
    Write-Host "Mining resource: $Destination" -ForegroundColor Green
    Write-Host "DEV bridge:      $BridgeDestination" -ForegroundColor Green
    Write-Host ''
    Write-Host 'Recommended for normal testing:' -ForegroundColor Yellow
    Write-Host '    mining-test.cmd' -ForegroundColor White
    Write-Host ''
    Write-Host 'First-time bridge bootstrap on an already-running server only:' -ForegroundColor Yellow
    Write-Host '    refresh' -ForegroundColor White
    Write-Host '    ensure flecity_mining_devbridge' -ForegroundColor White
    Write-Host ''
    Write-Host 'After that, mining-test.cmd can deploy, restart, and run diagnostics automatically.' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host ('Mining update failed: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
