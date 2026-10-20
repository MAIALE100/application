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

    Step 'Checking local database service'
    $dbService = Get-Service -Name 'MariaDB' -ErrorAction SilentlyContinue
    if (-not $dbService) {
        $dbService = Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'mysql|maria' } | Select-Object -First 1
    }
    if ($dbService) {
        if ($dbService.Status -ne 'Running') {
            Write-Host ("Database service: {0} {1} - starting..." -f $dbService.Name,$dbService.Status) -ForegroundColor Yellow
            try {
                Start-Service -Name $dbService.Name -ErrorAction Stop
            }
            catch {
                Write-Host 'Administrator permission is required to start the database. Windows may show one UAC prompt.' -ForegroundColor Yellow
                try {
                    $command = "Start-Service -Name '$($dbService.Name)'"
                    $proc = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile','-Command',$command)
                    if ($proc.ExitCode -ne 0) { throw "elevated database start exited with code $($proc.ExitCode)" }
                }
                catch {
                    Write-Host ("Could not auto-start database: {0}" -f $_.Exception.Message) -ForegroundColor Red
                }
            }
            $dbService = Get-Service -Name $dbService.Name -ErrorAction SilentlyContinue
        }

        if ($dbService -and $dbService.Status -eq 'Running') {
            Write-Host ("Database service: {0} RUNNING" -f $dbService.Name) -ForegroundColor Green
        } else {
            Write-Host 'Database is still stopped. Resource files can update, but DB-backed tests will not work until it is started.' -ForegroundColor Yellow
        }
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
    $AutoReloadWasInstalled = Test-Path (Join-Path $Destination 'dev-auto-reload.enabled')
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null

    & robocopy $Source $Destination /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP /XF dev-auto-reload.enabled dev-reload.token
    $robocopyCode = $LASTEXITCODE
    if ($robocopyCode -gt 7) {
        throw "robocopy failed with exit code $robocopyCode."
    }
    $ResourceChanged = $robocopyCode -ne 0

    Step 'Verifying copied test build'
    $manifestPath = Join-Path $Destination 'fxmanifest.lua'
    $bridgePath = Join-Path $Destination 'web\shared\bridge.js'
    $errorsPath = Join-Path $Destination 'web\shared\errors.js'
    $playIndexPath = Join-Path $Destination 'web\play\index.html'
    $partyIndexPath = Join-Path $Destination 'web\party\index.html'
    $partyAppPath = Join-Path $Destination 'web\party\app.js'
    $partyCorePath = Join-Path $Destination 'server\core\party.lua'
    $clientMainPath = Join-Path $Destination 'client\main.lua'

    foreach ($required in @($manifestPath,$bridgePath,$errorsPath,$playIndexPath,$partyIndexPath,$partyAppPath,$partyCorePath,$clientMainPath)) {
        if (-not (Test-Path $required)) { throw "Required copied file missing: $required" }
    }

    $manifestText = Get-Content $manifestPath -Raw
    $bridgeText = Get-Content $bridgePath -Raw
    $errorsText = Get-Content $errorsPath -Raw
    $playIndexText = Get-Content $playIndexPath -Raw
    $partyIndexText = Get-Content $partyIndexPath -Raw
    $partyAppText = Get-Content $partyAppPath -Raw
    $partyCoreText = Get-Content $partyCorePath -Raw
    $clientMainText = Get-Content $clientMainPath -Raw

    if ($manifestText -match '(?m)^\s*ui_page\s+') { throw 'Global ui_page was detected. Refusing to deploy because it can cover the FiveM screen.' }
    if ($bridgeText -notmatch 'globalThis\.fetchNui') { throw 'LB Phone fetchNui bridge check failed.' }
    if ($errorsText -notmatch 'NUI_UNAVAILABLE') { throw 'Shared error dictionary check failed.' }
    if ($playIndexText -notmatch 'componentsLoaded' -or $playIndexText -notmatch 'setTimeout\(loadApp,1500\)') { throw 'PLAY custom-app loader fallback check failed.' }
    if ($partyIndexText -notmatch 'componentsLoaded' -or $partyIndexText -notmatch 'setTimeout\(loadApp,1500\)') { throw 'PARTY custom-app loader fallback check failed.' }
    if ($partyAppText -notmatch 'registerPhonePushChannel' -or $partyAppText -notmatch 'lastRoomRevision') { throw 'PARTY push/revision client check failed.' }
    if ($partyCoreText -notmatch 'revision=tonumber\(room\.revision\)' -or $partyCoreText -notmatch 'disconnectedVoteIgnored') { throw 'PARTY server synchronization check failed.' }
    if ($clientMainText -notmatch "action=='bridgePing'") { throw 'LB Phone bridge diagnostic check failed.' }

    $version = 'unknown'
    if ($manifestText -match "(?m)^version\s+'([^']+)'") { $version = $Matches[1] }
    $commit = (& git -C $RepoRoot rev-parse --short HEAD).Trim()
    Write-Host ("Verified build: version={0} commit={1}" -f $version,$commit) -ForegroundColor Green

    Set-Content -Path (Join-Path $Destination 'dev-auto-reload.enabled') -Value '1' -NoNewline -Encoding ascii
    if (-not $AutoReloadWasInstalled -or $ResourceChanged) {
        $token = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
        Set-Content -Path (Join-Path $Destination 'dev-reload.token') -Value $token -NoNewline -Encoding ascii
    }

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
    if ($AutoReloadWasInstalled -and $ResourceChanged) {
        Write-Host 'Resource files changed. flecity_games should restart itself in about 1 second.' -ForegroundColor Green
        Write-Host 'No full FiveM server restart is needed.' -ForegroundColor Green
    } elseif ($AutoReloadWasInstalled) {
        Write-Host 'flecity_games is already current. No resource restart was requested.' -ForegroundColor Green
    } else {
        Write-Host 'ONE-TIME SETUP: run this once in the server console:' -ForegroundColor Yellow
        Write-Host '    restart flecity_games' -ForegroundColor White
        Write-Host 'After this first restart, future updates only need games-update.cmd.' -ForegroundColor Green
    }
    Write-Host ''
}
catch {
    Write-Host ''
    Write-Host ('UPDATE FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
