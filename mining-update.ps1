param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [switch]$NoGitSync
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'jobs/mining-dev'

$MiningSource = Join-Path $RepoRoot 'flecity_mining'
$MiningDestination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_mining'

$BridgeSource = Join-Path $RepoRoot 'flecity_mining_devbridge'
$BridgeDestination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_mining_devbridge'

$ServerCfg = Join-Path $ServerBase 'server.cfg'

function Write-Step {
    param([string]$Message)

    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Copy-CleanResource {
    param(
        [string]$From,
        [string]$To
    )

    if (-not (Test-Path $From)) {
        throw "Resource source not found: $From"
    }

    if (Test-Path $To) {
        Remove-Item -Path $To -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $To | Out-Null
    Copy-Item -Path (Join-Path $From '*') -Destination $To -Recurse -Force
}

function Copy-OverlayResource {
    param(
        [string]$From,
        [string]$To
    )

    if (-not (Test-Path $From)) {
        throw "Resource source not found: $From"
    }

    New-Item -ItemType Directory -Force -Path $To | Out-Null
    Copy-Item -Path (Join-Path $From '*') -Destination $To -Recurse -Force
}

function Ensure-ServerCfgLine {
    param(
        [string]$CfgPath,
        [string]$Line
    )

    if (-not (Test-Path $CfgPath)) {
        return
    }

    $existing = Get-Content -Path $CfgPath -ErrorAction Stop
    if ($existing -notcontains $Line) {
        Add-Content -Path $CfgPath -Value $Line
        Write-Host ("Added server.cfg line: {0}" -f $Line) -ForegroundColor Green
    }
}

try {
    Write-Step 'Checking repository'

    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
        throw "Git repository was not found: $RepoRoot"
    }

    if (-not $NoGitSync) {
        Write-Step 'Fetching latest mining build'

        & git -C $RepoRoot fetch origin
        if ($LASTEXITCODE -ne 0) {
            throw 'git fetch failed.'
        }

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

    Write-Step 'Running mining safety checks'

    $requiredFiles = @(
        (Join-Path $MiningSource 'fxmanifest.lua'),
        (Join-Path $MiningSource 'config\gameplay.lua'),
        (Join-Path $MiningSource 'config\economy.lua'),
        (Join-Path $MiningSource 'config\locations.lua'),
        (Join-Path $MiningSource 'client\main.lua'),
        (Join-Path $MiningSource 'server\main.lua'),
        (Join-Path $MiningSource 'server\selftest.lua'),
        (Join-Path $BridgeSource 'fxmanifest.lua'),
        (Join-Path $BridgeSource 'server\main.lua')
    )

    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            throw "Missing required file: $file"
        }
    }

    $manifest = Get-Content -Path (Join-Path $MiningSource 'fxmanifest.lua') -Raw
    $serverMain = Get-Content -Path (Join-Path $MiningSource 'server\main.lua') -Raw

    if ($manifest -notmatch "fx_version\s+'cerulean'") {
        throw 'fxmanifest.lua does not use cerulean.'
    }

    if ($manifest -notmatch "dependency\s+'qbx_core'") {
        throw 'fxmanifest.lua does not declare qbx_core dependency.'
    }

    if (
        $manifest -notmatch 'config/gameplay.lua' -or
        $manifest -notmatch 'config/economy.lua' -or
        $manifest -notmatch 'config/locations.lua'
    ) {
        throw 'Split operator config files are not loaded by fxmanifest.lua.'
    }

    if ($serverMain -notmatch 'exports\.qbx_core:AddMoney') {
        throw 'Server payout path could not be verified.'
    }

    if ($serverMain -notmatch 'isNear\(src') {
        throw 'Server-side distance validation could not be verified.'
    }

    if ($serverMain -notmatch 'minFinishAt') {
        throw 'Server-side action duration validation could not be verified.'
    }

    Write-Step 'Deploying flecity_mining'
    Copy-CleanResource -From $MiningSource -To $MiningDestination

    Write-Step 'Deploying DEV reload bridge'
    # Overlay rather than delete: a running bridge may be watching reload.request.
    Copy-OverlayResource -From $BridgeSource -To $BridgeDestination

    if (Test-Path $ServerCfg) {
        Ensure-ServerCfgLine -CfgPath $ServerCfg -Line 'add_ace resource.flecity_mining_devbridge command.stop allow'
        Ensure-ServerCfgLine -CfgPath $ServerCfg -Line 'add_ace resource.flecity_mining_devbridge command.start allow'
        Ensure-ServerCfgLine -CfgPath $ServerCfg -Line 'ensure flecity_mining_devbridge'
        Ensure-ServerCfgLine -CfgPath $ServerCfg -Line 'ensure flecity_mining'
    }
    else {
        Write-Host "server.cfg was not found at $ServerCfg; deployment still completed." -ForegroundColor Yellow
    }

    Write-Step 'Deployment complete'
    Write-Host "Mining resource: $MiningDestination" -ForegroundColor Green
    Write-Host "DEV bridge:      $BridgeDestination" -ForegroundColor Green
    Write-Host ''
    Write-Host 'Normal test command:' -ForegroundColor Yellow
    Write-Host '    mining-test.cmd' -ForegroundColor White
    Write-Host ''
    Write-Host 'First-time bootstrap on an already-running server only:' -ForegroundColor Yellow
    Write-Host '    add_ace resource.flecity_mining_devbridge command.stop allow' -ForegroundColor White
    Write-Host '    add_ace resource.flecity_mining_devbridge command.start allow' -ForegroundColor White
    Write-Host '    refresh' -ForegroundColor White
    Write-Host '    ensure flecity_mining_devbridge' -ForegroundColor White
}
catch {
    Write-Host ''
    Write-Host ('Mining update failed: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
