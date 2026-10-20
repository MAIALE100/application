param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base'
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'games/platform-core'
$Source = Join-Path $RepoRoot 'flecity_games'
$Resources = Join-Path $ServerBase 'resources'
$Destination = Join-Path $Resources 'flecity_games'
$ServerCfg = Join-Path $ServerBase 'server.cfg'

function Step([string]$message) {
    Write-Host ''
    Write-Host ('==> ' + $message) -ForegroundColor Cyan
}

try {
    Step 'Checking repository'
    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
        throw "Git repository was not found: $RepoRoot"
    }

    Step 'Pulling latest Flecity Games'
    & git -C $RepoRoot fetch origin
    if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }

    $currentBranch = (& git -C $RepoRoot branch --show-current).Trim()
    if ($currentBranch -ne $Branch) {
        throw "Current branch is '$currentBranch'. Switch to '$Branch' once before using this updater."
    }

    & git -C $RepoRoot pull --ff-only origin $Branch
    if ($LASTEXITCODE -ne 0) { throw 'git pull failed. Resolve local Git conflicts before updating.' }

    if (-not (Test-Path $Source)) {
        throw "Source resource was not found: $Source"
    }
    if (-not (Test-Path $Resources)) {
        throw "Test server resources folder was not found: $Resources"
    }

    Step 'Mirroring flecity_games to the test server'
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null

    & robocopy $Source $Destination /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP
    $robocopyCode = $LASTEXITCODE
    if ($robocopyCode -gt 7) {
        throw "robocopy failed with exit code $robocopyCode."
    }

    Set-Content -Path (Join-Path $Destination 'dev-auto-reload.enabled') -Value '1' -NoNewline -Encoding ascii
    $token = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    Set-Content -Path (Join-Path $Destination 'dev-reload.token') -Value $token -NoNewline -Encoding ascii

    Step 'Checking server.cfg'
    if (Test-Path $ServerCfg) {
        $cfg = Get-Content $ServerCfg -Raw
        if ($cfg -notmatch '(?m)^\s*ensure\s+flecity_games\s*$') {
            $addition = [Environment]::NewLine + [Environment]::NewLine + '# Flecity Games test resource' + [Environment]::NewLine + 'ensure flecity_games'
            Add-Content -Path $ServerCfg -Value $addition
            Write-Host 'Added: ensure flecity_games' -ForegroundColor Yellow
        }
    } else {
        Write-Host "server.cfg not found: $ServerCfg" -ForegroundColor Yellow
    }

    Step 'Update complete'
    Write-Host "Source : $Source"
    Write-Host "Target : $Destination"
    Write-Host ''
    Write-Host 'If auto-reload is already initialized, flecity_games will restart by itself in about 1 second.' -ForegroundColor Green
    Write-Host 'For the FIRST setup only, run this once in the server console:' -ForegroundColor Yellow
    Write-Host '    restart flecity_games' -ForegroundColor White
    Write-Host 'After that, future updates only need games-update.cmd.' -ForegroundColor Green
    Write-Host ''
}
catch {
    Write-Host ''
    Write-Host ('UPDATE FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
