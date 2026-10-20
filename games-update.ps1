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
        Write-Host ("Switching branch: {0} -> {1}" -f $currentBranch,$Branch) -ForegroundColor Yellow
        & git -C $RepoRoot switch $Branch
        if ($LASTEXITCODE -ne 0) {
            throw "Could not switch to '$Branch'. Local edits may conflict; no files were discarded."
        }
    }

    & git -C $RepoRoot pull --ff-only origin $Branch
    if ($LASTEXITCODE -ne 0) { throw 'git pull failed. Resolve local Git conflicts before updating.' }

    Step 'Checking GitHub Actions gate'
    $headCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()
    $repoSlug = (& git -C $RepoRoot remote get-url origin).Trim()
    if ($repoSlug -match 'github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$') {
        $repoSlug = $Matches[1]
    } else {
        throw 'Could not determine GitHub repository from origin remote.'
    }

    $workflowApi = "https://api.github.com/repos/$repoSlug/actions/runs?branch=$([uri]::EscapeDataString($Branch))&per_page=20"
    $workflowDeadline = (Get-Date).AddMinutes(3)
    $workflowReady = $false
    do {
        try {
            $headers = @{ 'User-Agent' = 'Flecity-Games-Updater'; 'Accept' = 'application/vnd.github+json' }
            $runs = Invoke-RestMethod -Uri $workflowApi -Headers $headers -Method Get -ErrorAction Stop
            $run = $runs.workflow_runs | Where-Object { $_.head_sha -eq $headCommit -and $_.name -eq 'Flecity Games Check' } | Select-Object -First 1
            if ($run) {
                if ($run.status -eq 'completed') {
                    if ($run.conclusion -ne 'success') {
                        throw "GitHub Actions rejected commit $($headCommit.Substring(0,7)) ($($run.conclusion)). Test server was not changed."
                    }
                    $workflowReady = $true
                    Write-Host ("GitHub Actions: PASS ({0})" -f $headCommit.Substring(0,7)) -ForegroundColor Green
                    break
                }
                Write-Host ("GitHub Actions: {0} - waiting..." -f $run.status) -ForegroundColor Yellow
            } else {
                Write-Host 'GitHub Actions run is not visible yet - waiting...' -ForegroundColor Yellow
            }
        }
        catch {
            if ($_.Exception.Message -like 'GitHub Actions rejected commit*') { throw }
            Write-Host ("Could not verify GitHub Actions yet: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
        }
        Start-Sleep -Seconds 5
    } while ((Get-Date) -lt $workflowDeadline)

    if (-not $workflowReady) {
        throw 'GitHub Actions did not report a successful check within 3 minutes. Test server was not changed.'
    }

    if (-not (Test-Path $Source)) {
        throw "Source resource was not found: $Source"
    }
    if (-not (Test-Path $Resources)) {
        throw "Test server resources folder was not found: $Resources"
    }

    Step 'Staging flecity_games update'
    $AutoReloadWasInstalled = Test-Path (Join-Path $Destination 'dev-auto-reload.enabled')
    $Stage = Join-Path $Resources '.flecity_games_stage'
    if (Test-Path $Stage) { Remove-Item $Stage -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Stage | Out-Null

    & robocopy $Source $Stage /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP /XF dev-auto-reload.enabled dev-reload.token
    $stageCode = $LASTEXITCODE
    if ($stageCode -gt 7) {
        throw "staging robocopy failed with exit code $stageCode."
    }

    Step 'Verifying staged test build'
    $DestinationForValidation = $Stage
    $manifestPath = Join-Path $DestinationForValidation 'fxmanifest.lua'
    $bridgePath = Join-Path $DestinationForValidation 'web\shared\bridge.js'
    $errorsPath = Join-Path $DestinationForValidation 'web\shared\errors.js'
    $playIndexPath = Join-Path $DestinationForValidation 'web\play\index.html'
    $partyIndexPath = Join-Path $DestinationForValidation 'web\party\index.html'
    $partyAppPath = Join-Path $DestinationForValidation 'web\party\app.js'
    $partyCorePath = Join-Path $DestinationForValidation 'server\core\party.lua'
    $clientMainPath = Join-Path $DestinationForValidation 'client\main.lua'
    $registryPath = Join-Path $DestinationForValidation 'shared\game_registry.lua'

    foreach ($required in @($manifestPath,$bridgePath,$errorsPath,$playIndexPath,$partyIndexPath,$partyAppPath,$partyCorePath,$clientMainPath,$registryPath)) {
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
    $registryText = Get-Content $registryPath -Raw

    if ($manifestText -match '(?m)^\s*ui_page\s+') { throw 'Global ui_page was detected. Refusing to deploy because it can cover the FiveM screen.' }
    if ($bridgeText -notmatch 'globalThis\.fetchNui' -or $bridgeText -notmatch "typeof fetchNui === 'function'") { throw 'LB Phone fetchNui compatibility check failed.' }
    if ($errorsText -notmatch 'NUI_UNAVAILABLE') { throw 'Shared error dictionary check failed.' }
    if ($playIndexText -notmatch 'componentsLoaded' -or $playIndexText -notmatch 'setTimeout\(loadApp,1500\)') { throw 'PLAY custom-app loader fallback check failed.' }
    if ($partyIndexText -notmatch 'componentsLoaded' -or $partyIndexText -notmatch 'setTimeout\(loadApp,1500\)') { throw 'PARTY custom-app loader fallback check failed.' }
    if ($partyAppText -notmatch 'registerPhonePushChannel' -or $partyAppText -notmatch 'lastRoomRevision') { throw 'PARTY push/revision client check failed.' }
    if ($partyCoreText -notmatch 'revision=tonumber\(room\.revision\)' -or $partyCoreText -notmatch 'disconnectedVoteIgnored' -or $partyCoreText -notmatch 'roundAbortLowPlayers' -or $partyCoreText -notmatch 'secretRoleDisconnectAbort') { throw 'PARTY server synchronization check failed.' }
    if ($clientMainText -notmatch "action=='bridgePing'") { throw 'LB Phone bridge diagnostic check failed.' }
    if ($clientMainText -notmatch 'fixBlur=false' -or $clientMainText -match 'fixBlur=true') { throw 'LB Phone fixBlur compatibility check failed.' }
    if ($registryText -notmatch "order=10,id='quick_tap'" -or $registryText -notmatch "order=80,id='memory'" -or $registryText -notmatch "order=90,id='color_match'" -or $registryText -notmatch "order=10,id='reaction'" -or $registryText -notmatch "order=80,id='telephone'") { throw 'Game registry order check failed.' }

    $version = 'unknown'
    if ($manifestText -match "(?m)^version\s+'([^']+)'") { $version = $Matches[1] }
    $commit = (& git -C $RepoRoot rev-parse --short HEAD).Trim()
    Write-Host ("Verified staged build: version={0} commit={1}" -f $version,$commit) -ForegroundColor Green

    Step 'Deploying verified build'
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    & robocopy $Stage $Destination /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP /XF dev-auto-reload.enabled dev-reload.token
    $robocopyCode = $LASTEXITCODE
    if ($robocopyCode -gt 7) {
        throw "deployment robocopy failed with exit code $robocopyCode."
    }
    $ResourceChanged = $robocopyCode -ne 0
    Set-Content -Path (Join-Path $Destination 'dev-build.txt') -Value $commit -NoNewline -Encoding ascii
    Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue

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
