param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [switch]$NoGitSync
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'games/platform-core'
$Source = Join-Path $RepoRoot 'flecity_games'
$SafetySource = Join-Path $RepoRoot 'flecity_dev_safety'
$Resources = Join-Path $ServerBase 'resources'
$Destination = Join-Path $Resources 'flecity_games'
$SafetyDestination = Join-Path $Resources 'flecity_dev_safety'
$ServerCfg = Join-Path $ServerBase 'server.cfg'
$UpdaterPath = $MyInvocation.MyCommand.Path
$UpdaterHashBefore = if (Test-Path $UpdaterPath) { (Get-FileHash $UpdaterPath -Algorithm SHA256).Hash } else { '' }

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

    if (-not $NoGitSync) {
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

        $UpdaterHashAfter = if (Test-Path $UpdaterPath) { (Get-FileHash $UpdaterPath -Algorithm SHA256).Hash } else { '' }
        if ($UpdaterHashBefore -and $UpdaterHashAfter -and $UpdaterHashBefore -ne $UpdaterHashAfter) {
            Step 'Updater refreshed'
            Write-Host 'The updater itself changed. Restarting with the new version...' -ForegroundColor Green
            $args = @('-NoProfile','-ExecutionPolicy','Bypass','-File',$UpdaterPath,'-ServerBase',$ServerBase)
            Start-Process powershell.exe -ArgumentList $args
            exit 0
        }
    }
    else {
        Step 'Using prepared auto-update source tree'
        Write-Host 'Git sync is managed by the dedicated auto-update watcher.' -ForegroundColor DarkGray
    }

    Step 'Checking build safety'
    $headCommit = (& git -C $RepoRoot rev-parse HEAD).Trim()
    $repoSlug = (& git -C $RepoRoot remote get-url origin).Trim()
    if ($repoSlug -match 'github\.com[:/]([^/]+/[^/]+?)(?:\.git)?$') {
        $repoSlug = $Matches[1]
    } else {
        throw 'Could not determine GitHub repository from origin remote.'
    }

    $workflowVerified = $false
    try {
        $headers = @{ 'User-Agent' = 'Flecity-Games-Updater'; 'Accept' = 'application/vnd.github+json' }

        # Reuse the same Windows Git Credential Manager credentials that made
        # git fetch/pull succeed. The token is kept in memory and never printed.
        try {
            $credentialRequest = 'protocol=https' + [Environment]::NewLine + 'host=github.com' + [Environment]::NewLine + [Environment]::NewLine
            $credentialLines = $credentialRequest | & git credential fill 2>$null
            if ($LASTEXITCODE -eq 0 -and $credentialLines) {
                $credential = @{}
                foreach ($line in $credentialLines) {
                    if ($line -match '^([^=]+)=(.*)$') { $credential[$Matches[1]] = $Matches[2] }
                }
                if ($credential.ContainsKey('password') -and $credential.password) {
                    $headers['Authorization'] = 'Bearer ' + $credential.password
                }
            }
        }
        catch {}

        $workflowApi = "https://api.github.com/repos/$repoSlug/actions/runs?branch=$([uri]::EscapeDataString($Branch))&per_page=20"
        $runs = Invoke-RestMethod -Uri $workflowApi -Headers $headers -Method Get -ErrorAction Stop
        $run = $runs.workflow_runs | Where-Object { $_.head_sha -eq $headCommit -and $_.name -in @('Flecity Games Static Check','Flecity Games Check') } | Select-Object -First 1

        if ($run -and $run.status -eq 'completed') {
            if ($run.conclusion -ne 'success') {
                throw "GitHub Actions rejected commit $($headCommit.Substring(0,7)) ($($run.conclusion)). Test server was not changed."
            }
            $workflowVerified = $true
            Write-Host ("GitHub Actions: PASS ({0})" -f $headCommit.Substring(0,7)) -ForegroundColor Green
        }
        elseif ($run) {
            Write-Host ("GitHub Actions is still {0}. Using local safety checks instead of waiting." -f $run.status) -ForegroundColor Yellow
        }
        else {
            Write-Host 'No matching GitHub Actions run was returned. Using local safety checks.' -ForegroundColor Yellow
        }
    }
    catch {
        if ($_.Exception.Message -like 'GitHub Actions rejected commit*') { throw }
        Write-Host 'GitHub Actions could not be verified from this PC. Using local safety checks instead.' -ForegroundColor Yellow
    }

    if (-not $workflowVerified) {
        Step 'Running local safety checks'
        Write-Host 'Using built-in PowerShell safety checks.' -ForegroundColor Yellow

        $localManifest = Join-Path $Source 'fxmanifest.lua'
        $localPlayLua = Join-Path $Source 'server\core\play.lua'
        $localProfileLua = Join-Path $Source 'server\core\profile.lua'
        $localPlayJs = Join-Path $Source 'web\play\app.js'
        $localPlayHtml = Join-Path $Source 'web\play\index.html'
        $localErrors = Join-Path $Source 'web\shared\errors.js'
        $localRegistry = Join-Path $Source 'shared\game_registry.lua'
        $localConfig = Join-Path $Source 'config\shared.lua'
        $localCss = Join-Path $Source 'web\shared\app.css'

        foreach ($required in @($localManifest,$localPlayLua,$localProfileLua,$localPlayJs,$localPlayHtml,$localErrors,$localRegistry,$localConfig,$localCss)) {
            if (-not (Test-Path $required)) {
                throw "Local safety check missing required file: $required"
            }
        }

        $manifestText = Get-Content $localManifest -Raw
        $playLuaText = Get-Content $localPlayLua -Raw
        $profileLuaText = Get-Content $localProfileLua -Raw
        $playJsText = Get-Content $localPlayJs -Raw
        $playHtmlText = Get-Content $localPlayHtml -Raw
        $errorsText = Get-Content $localErrors -Raw
        $registryText = Get-Content $localRegistry -Raw
        $configText = Get-Content $localConfig -Raw
        $cssText = Get-Content $localCss -Raw

        if ($manifestText -match '(?m)^\s*ui_page\s+') {
            throw 'Local safety check rejected a global ui_page.'
        }
        if ($manifestText -notmatch "(?m)^version\s+'[0-9]+\.[0-9]+\.[0-9]+-test'") {
            throw 'Local safety check could not verify the PLAY test version.'
        }
        if ($playJsText -notmatch 'startSessionWithRetry' -or $playJsText -notmatch 'submitScoreWithRetry') {
            throw 'Local safety check could not verify PLAY retry helpers.'
        }
        if ($playJsText -notmatch 'progressed!==true') {
            throw 'Local safety check could not verify untouched-save protection.'
        }
        if ($playLuaText -notmatch 'saveStateHasProgress' -or $playLuaText -notmatch 'startRequests') {
            throw 'Local safety check could not verify PLAY save/session hardening.'
        }
        if ($errorsText -notmatch 'NUI_UNAVAILABLE') {
            throw 'Local safety check could not verify shared PLAY errors.'
        }
        if ($playHtmlText -notmatch 'id="confirmOverlay"') {
            throw 'Local safety check could not verify PLAY confirmation UI.'
        }
        if ($cssText -match '(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b') {
            throw 'Local safety check found px units while LB Phone fixBlur is enabled.'
        }
        if ($cssText -match '(?s)(?:^|[}\s])(?:html|:root)\s*\{[^}]*font-size\s*:') {
            throw 'Local safety check found html/:root font-size overriding LB Phone fixBlur scaling.'
        }
        if ($playHtmlText -match 'name="viewport"') {
            throw 'Local safety check found a PLAY viewport override while LB Phone fixBlur is enabled.'
        }
        if ($playJsText -notmatch 'setGameIcon' -or $playJsText -notmatch 'icons/quick-tap\.svg' -or $playHtmlText -notmatch 'id="dailyIcon"') {
            throw 'Local safety check could not verify PLAY dedicated icon UI.'
        }
        if ($playJsText -notmatch 'renderRecent' -or $playJsText -notmatch 'filteredLibraryGames' -or $playJsText -notmatch 'randomPlay\.onclick') {
            throw 'Local safety check could not verify PLAY recent/filter/random navigation.'
        }
        if ($playHtmlText -notmatch 'id="recentCard"' -or $playHtmlText -notmatch 'id="libraryFilters"' -or $playHtmlText -notmatch 'id="randomPlay"') {
            throw 'Local safety check could not verify PLAY library navigation DOM.'
        }
        if ($playLuaText -notmatch 'MAX\(created_at\) AS last_played_at' -or $playLuaText -notmatch 'lastPlayedAt=row\.last_played_at') {
            throw 'Local safety check could not verify PLAY recent-game timestamps.'
        }
        if ($playJsText -notmatch 'toggleFavorite' -or $playJsText -notmatch 'favorite-toggle' -or $playHtmlText -notmatch 'data-filter="favorites"') {
            throw 'Local safety check could not verify PLAY favorites UI.'
        }
        if ($profileLuaText -notmatch 'normalizeFavorites' -or $profileLuaText -notmatch 'if data\.favorites~=nil' -or $profileLuaText -notmatch 'if data\.sound~=nil') {
            throw 'Local safety check could not verify merge-safe profile favorites.'
        }
        if ($playJsText -notmatch 'openSlide' -or $playJsText -notmatch 'persistSlide' -or $playJsText -notmatch 'finishSlide' -or $playHtmlText -notmatch 'id="slideGame"') {
            throw 'Local safety check could not verify SLIDE client flow.'
        }
        if ($playJsText -notmatch 'fallSwipeSteps') {
            throw 'Local safety check could not verify FALL scaled swipe controls.'
        }
        if ($playJsText -notmatch 'fallGravityDelay' -or $playJsText -notmatch 'fallGravityTick' -or $playJsText -notmatch 'startFallGravity') {
            throw 'Local safety check could not verify FALL gravity mode.'
        }
        if ($playJsText -notmatch 'fallPeekPieces' -or $playJsText -notmatch 'startFallSoftDrop' -or $playJsText -notmatch 'fallSoft') {
            throw 'Local safety check could not verify FALL soft drop / NEXT queue.'
        }
        if ($cssText -notmatch '\.fall-preview-cell\.filled\{background:currentColor' -or $cssText -notmatch 'width:min\(100%,14rem\)') {
            throw 'Local safety check could not verify FALL preview/board visual pass.'
        }
        if ($playJsText -notmatch 'holdFallPiece' -or $playLuaText -notmatch 'fallHoldReplay' -or $playLuaText -notmatch 'heldPiece=heldPiece or 0') {
            throw 'Local safety check could not verify FALL HOLD replay.'
        }
        if ($playJsText -notmatch 'slideMovePath' -or $playJsText -notmatch 'CHAIN SLIDE') {
            throw 'Local safety check could not verify SLIDE line-slide controls.'
        }
        if ($playJsText -notmatch 'sortPourCount' -or $playJsText -notmatch 'QUICK POUR') {
            throw 'Local safety check could not verify SORT quick-pour controls.'
        }
        if ($playJsText -notmatch 'crossNonogramDirect' -or $playJsText -notmatch 'nonogram\.crossed\.delete\(index\);nonogram\.filled\.add\(index\)' -or $playJsText -notmatch 'resetTransientInputState') {
            throw 'Local safety check could not verify NONOGRAM input separation / transition cleanup.'
        }
        if ($playJsText -notmatch 'openFall' -or $playJsText -notmatch 'persistFall' -or $playJsText -notmatch 'finishFall' -or $playHtmlText -notmatch 'id="fallGame"') {
            throw 'Local safety check could not verify FALL client flow.'
        }
        if ($playLuaText -notmatch 'replayFallState' -or $playLuaText -notmatch 'FALL_BASE_SHAPES' -or $playLuaText -notmatch 'INVALID_FALL_REPLAY') {
            throw 'Local safety check could not verify FALL server replay validation.'
        }
        if ($configText -notmatch 'FallMasterLines\s*=\s*20' -or $playLuaText -notmatch 'fall_master' -or $playJsText -notmatch 'fall_master') {
            throw 'Local safety check could not verify FALL MASTER achievement.'
        }
        if ($playJsText -notmatch 'fallPeekPieces' -or $playJsText -notmatch 'pieceRngState' -or $playHtmlText -notmatch 'id="fallNext"') {
            throw 'Local safety check could not verify FALL next-piece preview.'
        }
        if ($playJsText -notmatch 'game\.pieces%3===0' -or $playJsText -notmatch 'persistFall\(false,false\)' -or $playJsText -notmatch 'snapshotLength') {
            throw 'Local safety check could not verify FALL non-blocking autosave.'
        }
        if ($playLuaText -notmatch 'normalized\[#normalized\+1\]=\{x=applied\.x,rotation=applied\.rotation,hold=useHold\}' -or $playJsText -notmatch 'game\.history\.push\(\{x:game\.x,rotation:game\.rotation,hold:game\.holdUsed===true\}\)') {
            throw 'Local safety check could not verify compact FALL history.'
        }
        if ($playLuaText -notmatch 'generateSlideBoard' -or $playLuaText -notmatch 'replaySlideState' -or $playLuaText -notmatch 'INVALID_SLIDE_REPLAY') {
            throw 'Local safety check could not verify SLIDE server replay validation.'
        }
        if ($registryText -notmatch "id='slide'[^\r\n]*supportsDaily=true" -or $configText -notmatch "DailyCandidates\s*=\s*\{[^\r\n]*'slide'[^\r\n]*\}") {
            throw 'Local safety check could not verify Daily SLIDE registration.'
        }
        if ($playJsText -notmatch 'openSlide\(true,true\)' -or $playJsText -notmatch 'slideGame&&slideGame\.daily') {
            throw 'Local safety check could not verify Daily SLIDE client lifecycle.'
        }
        if ($configText -notmatch 'SlideMasterMs\s*=\s*90000' -or $configText -notmatch 'SlideMasterMoves\s*=\s*120' -or $playLuaText -notmatch 'slide_master' -or $playJsText -notmatch 'slide_master') {
            throw 'Local safety check could not verify SLIDE MASTER achievement.'
        }
        if ($playJsText -notmatch 'simonDaily' -or $playJsText -notmatch 'openSimon\(true\)' -or $playJsText -notmatch 'daily:simonDaily===true') {
            throw 'Local safety check could not verify Daily SIMON client flow.'
        }
        if ($registryText -notmatch "id='simon'[^\r\n]*supportsDaily=true") {
            throw 'Local safety check could not verify SIMON Daily registry support.'
        }
        if ($configText -notmatch "DailyCandidates\s*=\s*\{[^\r\n]*'simon'[^\r\n]*\}") {
            throw 'Local safety check could not verify SIMON in Daily rotation.'
        }
        if ($registryText -notmatch "id='color_match'[^\r\n]*supportsDaily=true" -or $configText -notmatch "DailyCandidates\s*=\s*\{[^\r\n]*'color_match'[^\r\n]*\}") {
            throw 'Local safety check could not verify Daily COLOR MATCH registration.'
        }
        if ($playJsText -notmatch 'openColorMatch\(true\)' -or $playJsText -notmatch "daily=colorMatchEl\.dataset\.daily==='1'") {
            throw 'Local safety check could not verify Daily COLOR MATCH client lifecycle.'
        }

        $enabledPlayMatches = [regex]::Matches($registryText,"id='([^']+)'[^\r\n]*app='play'[^\r\n]*enabled=true")
        $enabledPlayIds = @($enabledPlayMatches | ForEach-Object { $_.Groups[1].Value })
        $requiredPlayIds = @(
            'quick_tap','stop','stack','block','merge','mines','nonogram',
            'memory','sort','slide','fall','color_match','number_rush','high_low','simon'
        )
        $missingPlayIds = @($requiredPlayIds | Where-Object { $_ -notin $enabledPlayIds })
        if ($missingPlayIds.Count -gt 0) {
            throw ("Local safety check is missing required PLAY games: {0}" -f ($missingPlayIds -join ', '))
        }
        if ($enabledPlayIds.Count -lt $requiredPlayIds.Count) {
            throw ("Local safety check expected at least {0} enabled PLAY games, found {1}." -f $requiredPlayIds.Count,$enabledPlayIds.Count)
        }

        Write-Host ("PowerShell safety check: PASS ({0})" -f $headCommit.Substring(0,7)) -ForegroundColor Green
    }

    if (-not (Test-Path $Source)) {
        throw "Source resource was not found: $Source"
    }
    if (-not (Test-Path $SafetySource)) {
        throw "External reload helper source was not found: $SafetySource"
    }
    if (-not (Test-Path $Resources)) {
        throw "Test server resources folder was not found: $Resources"
    }

    Step 'Staging flecity_games update'
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
    $playAppPath = Join-Path $DestinationForValidation 'web\play\app.js'
    $playCorePath = Join-Path $DestinationForValidation 'server\core\play.lua'
    $profileCorePath = Join-Path $DestinationForValidation 'server\core\profile.lua'
    $partyIndexPath = Join-Path $DestinationForValidation 'web\party\index.html'
    $partyAppPath = Join-Path $DestinationForValidation 'web\party\app.js'
    $partyCorePath = Join-Path $DestinationForValidation 'server\core\party.lua'
    $clientMainPath = Join-Path $DestinationForValidation 'client\main.lua'
    $registryPath = Join-Path $DestinationForValidation 'shared\game_registry.lua'
    $cssPath = Join-Path $DestinationForValidation 'web\shared\app.css'

    foreach ($required in @($manifestPath,$bridgePath,$errorsPath,$playIndexPath,$playAppPath,$playCorePath,$profileCorePath,$partyIndexPath,$partyAppPath,$partyCorePath,$clientMainPath,$registryPath,$cssPath)) {
        if (-not (Test-Path $required)) { throw "Required copied file missing: $required" }
    }

    $manifestText = Get-Content $manifestPath -Raw
    $bridgeText = Get-Content $bridgePath -Raw
    $errorsText = Get-Content $errorsPath -Raw
    $playIndexText = Get-Content $playIndexPath -Raw
    $playAppText = Get-Content $playAppPath -Raw
    $playCoreText = Get-Content $playCorePath -Raw
    $profileCoreText = Get-Content $profileCorePath -Raw
    $partyIndexText = Get-Content $partyIndexPath -Raw
    $partyAppText = Get-Content $partyAppPath -Raw
    $partyCoreText = Get-Content $partyCorePath -Raw
    $clientMainText = Get-Content $clientMainPath -Raw
    $registryText = Get-Content $registryPath -Raw
    $cssText = Get-Content $cssPath -Raw

    if ($manifestText -match '(?m)^\s*ui_page\s+') { throw 'Global ui_page was detected. Refusing to deploy because it can cover the FiveM screen.' }
    if ($bridgeText -notmatch 'globalThis\.fetchNui' -or $bridgeText -notmatch "typeof fetchNui === 'function'") { throw 'LB Phone fetchNui compatibility check failed.' }
    if ($errorsText -notmatch 'NUI_UNAVAILABLE') { throw 'Shared error dictionary check failed.' }
    if ($playIndexText -notmatch 'componentsLoaded' -or $playIndexText -notmatch 'devMode=!window.invokeNative' -or $playIndexText -match 'setTimeout\(loadApp') { throw 'PLAY component-gated loader check failed.' }
    if ($playIndexText -notmatch 'id="recentCard"' -or $playIndexText -notmatch 'id="libraryFilters"' -or $playIndexText -notmatch 'id="randomPlay"') { throw 'PLAY library navigation DOM check failed.' }
    if ($playAppText -notmatch 'renderRecent' -or $playAppText -notmatch 'filteredLibraryGames' -or $playAppText -notmatch 'randomPlay\.onclick') { throw 'PLAY library navigation client check failed.' }
    if ($playCoreText -notmatch 'MAX\(created_at\) AS last_played_at' -or $playCoreText -notmatch 'lastPlayedAt=row\.last_played_at') { throw 'PLAY recent-game timestamp check failed.' }
    if ($playAppText -notmatch 'toggleFavorite' -or $playAppText -notmatch 'favorite-toggle' -or $playIndexText -notmatch 'data-filter="favorites"') { throw 'PLAY favorites UI check failed.' }
    if ($profileCoreText -notmatch 'normalizeFavorites' -or $profileCoreText -notmatch 'if data\.favorites~=nil' -or $profileCoreText -notmatch 'if data\.sound~=nil') { throw 'PLAY favorites profile persistence check failed.' }
    if ($playIndexText -notmatch 'id="slideGame"' -or $playAppText -notmatch 'openSlide' -or $playAppText -notmatch 'persistSlide' -or $playAppText -notmatch 'finishSlide') { throw 'SLIDE client flow check failed.' }
    if ($playAppText -notmatch 'stackCameraTarget' -or $playAppText -notmatch 'cameraOffset' -or $cssText -notmatch 'data-camera="follow"') { throw 'TOWER follow camera check failed.' }
    if ($playAppText -notmatch 'dropStackBlock' -or $playAppText -notmatch 'stackArena\.onclick' -or $playIndexText -notmatch 'id="stackArena"' -or $playIndexText -notmatch 'tabindex="0"') { throw 'TOWER direct-tap DROP check failed.' }
    if ($playAppText -notmatch 'layerCount\)\|\|0\)-5' -or $cssText -notmatch 'html,body,\.wrap\{scrollbar-width:none' -or $cssText -notmatch 'html::\-webkit\-scrollbar') { throw 'TOWER viewport / scrollbar suppression check failed.' }
    if ($cssText -notmatch 'PLAY submission home visual pass v24' -or $cssText -notmatch 'home-scroll-row' -or $playIndexText -notmatch 'home-utility-label' -or $playIndexText -notmatch 'class="home-top-safe"') { throw 'PLAY submission home visual pass check failed.' }
    if ($playIndexText -notmatch 'class="home-top-safe"' -or $cssText -notmatch '\.home-top-safe\{height:3rem' -or $playIndexText -match '<header class="header app-header">' -or $playIndexText -match 'id="runtimeVersion"') { throw 'PLAY clean home top check failed.' }
    if ($playAppText -notmatch 'enableHorizontalDragScroll' -or $cssText -notmatch 'touch-action:pan-y' -or $cssText -notmatch 'is-dragging') { throw 'PLAY home horizontal drag scroll check failed.' }
    if ($playAppText -notmatch "const inGame=document\.body\.classList\.contains\('game-active'\)" -or $cssText -notmatch 'body\.game-active \.app-status\{display:none!important\}') { throw 'PLAY in-game shared status suppression check failed.' }
    if ($playAppText -notmatch 'fallSwipeSteps') { throw 'FALL scaled swipe control check failed.' }
    if ($playAppText -notmatch 'fallGravityDelay' -or $playAppText -notmatch 'fallGravityTick' -or $playAppText -notmatch 'startFallGravity') { throw 'FALL gravity mode check failed.' }
    if ($playAppText -notmatch 'fallPeekPieces' -or $playAppText -notmatch 'startFallSoftDrop' -or $playAppText -notmatch 'fallSoft') { throw 'FALL soft drop / NEXT queue check failed.' }
    if ($cssText -notmatch '\.fall-preview-cell\.filled\{background:currentColor' -or $cssText -notmatch 'width:min\(100%,14rem\)') { throw 'FALL preview/board visual pass check failed.' }
    if ($playAppText -notmatch 'holdFallPiece' -or $playCoreText -notmatch 'fallHoldReplay' -or $playCoreText -notmatch 'heldPiece=heldPiece or 0') { throw 'FALL HOLD replay check failed.' }
    if ($playAppText -notmatch 'slideMovePath' -or $playAppText -notmatch 'CHAIN SLIDE') { throw 'SLIDE line-slide control check failed.' }
    if ($playAppText -notmatch 'sortPourCount' -or $playAppText -notmatch 'QUICK POUR') { throw 'SORT quick-pour control check failed.' }
    if ($playAppText -notmatch 'crossNonogramDirect' -or $playAppText -notmatch 'nonogram\.crossed\.delete\(index\);nonogram\.filled\.add\(index\)' -or $playAppText -notmatch 'resetTransientInputState') { throw 'NONOGRAM/transition UX check failed.' }
    if ($playIndexText -notmatch 'id="fallGame"' -or $playAppText -notmatch 'openFall' -or $playAppText -notmatch 'persistFall' -or $playAppText -notmatch 'finishFall') { throw 'FALL client flow check failed.' }
    if ($playCoreText -notmatch 'replayFallState' -or $playCoreText -notmatch 'FALL_BASE_SHAPES' -or $playCoreText -notmatch 'INVALID_FALL_REPLAY') { throw 'FALL server replay check failed.' }
    if ($playCoreText -notmatch 'fall_master' -or $playAppText -notmatch 'fall_master') { throw 'FALL MASTER achievement check failed.' }
    if ($playAppText -notmatch 'fallPeekPieces' -or $playAppText -notmatch 'pieceRngState' -or $playIndexText -notmatch 'id="fallNext"') { throw 'FALL next-piece preview check failed.' }
    if ($playAppText -notmatch 'game\.pieces%3===0' -or $playAppText -notmatch 'persistFall\(false,false\)' -or $playAppText -notmatch 'snapshotLength') { throw 'FALL autosave optimization check failed.' }
    if ($playCoreText -notmatch 'normalized\[#normalized\+1\]=\{x=applied\.x,rotation=applied\.rotation,hold=useHold\}' -or $playAppText -notmatch 'game\.history\.push\(\{x:game\.x,rotation:game\.rotation,hold:game\.holdUsed===true\}\)') { throw 'FALL compact history check failed.' }
    if ($playCoreText -notmatch 'generateSlideBoard' -or $playCoreText -notmatch 'replaySlideState' -or $playCoreText -notmatch 'INVALID_SLIDE_REPLAY') { throw 'SLIDE server replay check failed.' }
    if ($registryText -notmatch "id='slide'[^\r\n]*supportsDaily=true" -or $playAppText -notmatch 'openSlide\(true,true\)' -or $playAppText -notmatch 'slideGame&&slideGame\.daily') { throw 'Daily SLIDE wiring check failed.' }
    if ($registryText -notmatch "id='color_match'[^\r\n]*supportsDaily=true" -or $playAppText -notmatch 'openColorMatch\(true\)' -or $playAppText -notmatch "daily=colorMatchEl\.dataset\.daily==='1'") { throw 'Daily COLOR MATCH wiring check failed.' }
    if ($playCoreText -notmatch 'slide_master' -or $playAppText -notmatch 'slide_master') { throw 'SLIDE MASTER achievement check failed.' }
    if ($partyIndexText -notmatch 'componentsLoaded' -or $partyIndexText -notmatch 'devMode=!window.invokeNative' -or $partyIndexText -match 'setTimeout\(loadApp') { throw 'PARTY component-gated loader check failed.' }
    if ($partyAppText -notmatch 'registerPhonePushChannel' -or $partyAppText -notmatch 'lastRoomRevision') { throw 'PARTY push/revision client check failed.' }
    if ($partyCoreText -notmatch 'revision=tonumber\(room\.revision\)' -or $partyCoreText -notmatch 'disconnectedVoteIgnored' -or $partyCoreText -notmatch 'roundAbortLowPlayers' -or $partyCoreText -notmatch 'secretRoleDisconnectAbort') { throw 'PARTY server synchronization check failed.' }
    if ($clientMainText -notmatch "action=='bridgePing'") { throw 'LB Phone bridge diagnostic check failed.' }
    if ($clientMainText -notmatch 'fixBlur=true' -or $clientMainText -match 'fixBlur=false') { throw 'LB Phone fixBlur compatibility check failed.' }
    if ($clientMainText -notmatch 'RemoveCustomApp\(app\.identifier\)' -or $clientMainText -notmatch 'APP_ALREADY_EXISTS') { throw 'LB Phone custom app re-registration check failed.' }
    if ($registryText -notmatch "order=10,id='quick_tap'" -or $registryText -notmatch "order=55,id='fall'" -or $registryText -notmatch "order=80,id='memory'" -or $registryText -notmatch "order=87,id='slide'" -or $registryText -notmatch "order=90,id='color_match'" -or $registryText -notmatch "order=120,id='simon'" -or $registryText -notmatch "order=10,id='reaction'" -or $registryText -notmatch "order=80,id='telephone'") { throw 'Game registry order check failed.' }

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

    Step 'Updating external reload helper'
    New-Item -ItemType Directory -Force -Path $SafetyDestination | Out-Null
    $SafetyReloadMarkerPath = Join-Path $SafetyDestination 'games-reloader-v1.active'
    $SafetyReloadActive = $false
    if (Test-Path -LiteralPath $SafetyReloadMarkerPath) {
        $safetyMarker = Get-Content -LiteralPath $SafetyReloadMarkerPath -Raw -ErrorAction SilentlyContinue
        $SafetyReloadActive = $safetyMarker -match '(?m)^version=2$'
    }
    & robocopy $SafetySource $SafetyDestination /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP /XF games-reload.request games-reload.ack games-reloader-v1.active
    $safetyCopyCode = $LASTEXITCODE
    if ($safetyCopyCode -gt 7) {
        throw "external reload helper robocopy failed with exit code $safetyCopyCode."
    }

    $reloadRequestPath = Join-Path $SafetyDestination 'games-reload.request'
    $reloadAckPath = Join-Path $SafetyDestination 'games-reload.ack'
    $reloadToken = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
    Remove-Item -LiteralPath $reloadAckPath -Force -ErrorAction SilentlyContinue
    Set-Content -LiteralPath $reloadRequestPath -Value $reloadToken -NoNewline -Encoding ascii

    $ReloadActivated = $false
    $ReloadNeedsBootstrap = -not $SafetyReloadActive
    if ($SafetyReloadActive) {
        Step 'Activating verified build'
        $reloadDeadline = (Get-Date).AddSeconds(25)
        while ((Get-Date) -lt $reloadDeadline) {
            if (Test-Path -LiteralPath $reloadAckPath) {
                $ack = Get-Content -LiteralPath $reloadAckPath -Raw -ErrorAction SilentlyContinue
                $tokenOk = $ack -match ('(?m)^token=' + [regex]::Escape($reloadToken) + '$')
                $statusOk = $ack -match '(?m)^status=started$'
                $versionOk = $ack -match ('(?m)^version=' + [regex]::Escape($version) + '$')
                if ($tokenOk -and $statusOk -and $versionOk) {
                    $ReloadActivated = $true
                    break
                }
            }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ReloadActivated) {
            Set-Content -LiteralPath $reloadRequestPath -Value $reloadToken -NoNewline -Encoding ascii
            $ReloadNeedsBootstrap = $true
            Write-Host 'External reload helper did not acknowledge the new runtime. A one-time helper restart is required.' -ForegroundColor Yellow
        }
    }

    Step 'Checking server.cfg'
    if (Test-Path $ServerCfg) {
        $cfg = Get-Content $ServerCfg -Raw
        if ($cfg -notmatch '(?m)^\s*ensure\s+flecity_dev_safety\s*$') {
            $addition = [Environment]::NewLine + [Environment]::NewLine + '# Flecity development helper' + [Environment]::NewLine + 'ensure flecity_dev_safety'
            Add-Content -Path $ServerCfg -Value $addition
            Write-Host 'Added: ensure flecity_dev_safety' -ForegroundColor Yellow
            $cfg += $addition
        }
        if ($cfg -notmatch '(?m)^\s*ensure\s+flecity_games\s*$') {
            $addition = [Environment]::NewLine + [Environment]::NewLine + '# Flecity Games test resource' + [Environment]::NewLine + 'ensure flecity_games'
            Add-Content -Path $ServerCfg -Value $addition
            Write-Host 'Added: ensure flecity_games' -ForegroundColor Yellow
        }
    } else {
        Write-Host "server.cfg not found: $ServerCfg" -ForegroundColor Yellow
    }

    if (-not $NoGitSync) {
        $autoStateDir = Join-Path $env:LOCALAPPDATA 'FlecityGamesAutoUpdate'
        $autoInstalled = Join-Path $autoStateDir 'installed.flag'
        $autoDisabled = Join-Path $autoStateDir 'disabled.flag'
        $autoInstaller = Join-Path $RepoRoot 'games-auto-update-install.ps1'

        if ((Test-Path $autoInstaller) -and -not (Test-Path $autoInstalled) -and -not (Test-Path $autoDisabled)) {
            Step 'Enabling background automatic updates'
            & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $autoInstaller -ServerBase $ServerBase -SkipInitialDeploy
            if ($LASTEXITCODE -ne 0) {
                Write-Host 'Automatic update setup did not complete. Manual updates still work normally.' -ForegroundColor Yellow
            }
            else {
                Write-Host 'Automatic updates are now enabled. Future Flecity Games updates require no manual update command.' -ForegroundColor Green
            }
        }
    }

    Step 'Update complete'
    Write-Host "Source : $Source"
    Write-Host "Target : $Destination"
    Write-Host ''
    if ($ReloadActivated) {
        Write-Host ("Verified runtime activated: version={0} commit={1}" -f $version,$commit) -ForegroundColor Green
        Write-Host 'No full FiveM server restart is needed.' -ForegroundColor Green
    } elseif ($ReloadNeedsBootstrap) {
        Write-Host 'ONE-TIME HELPER ACTIVATION: run this once in txAdmin:' -ForegroundColor Yellow
        Write-Host '    restart flecity_dev_safety' -ForegroundColor White
        Write-Host 'A pending PLAY reload is already queued; do NOT restart flecity_games manually.' -ForegroundColor Yellow
        Write-Host 'After this one-time helper restart, future games-update.cmd runs can activate PLAY automatically.' -ForegroundColor Green
    } else {
        Write-Host 'Verified files deployed. External reload acknowledgement was not required.' -ForegroundColor Green
    }
    Write-Host ''
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('UPDATE FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
