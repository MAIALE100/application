param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [int]$PollSeconds = 30,
    [int]$StableSeconds = 45,
    [int]$RetrySeconds = 120
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'games/platform-core'
$UpdateScript = Join-Path $RepoRoot 'games-update.ps1'
$StateDir = Join-Path $env:LOCALAPPDATA 'FlecityGamesAutoUpdate'
$LogPath = Join-Path $StateDir 'auto-update.log'
$Destination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_games'
$BuildMarker = Join-Path $Destination 'dev-build.txt'
$WatcherPath = $MyInvocation.MyCommand.Path

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Write-AutoLog([string]$Message) {
    try {
        if (Test-Path $LogPath) {
            $item = Get-Item $LogPath -ErrorAction SilentlyContinue
            if ($item -and $item.Length -gt 2MB) {
                $old = $LogPath + '.1'
                Remove-Item $old -Force -ErrorAction SilentlyContinue
                Move-Item $LogPath $old -Force -ErrorAction SilentlyContinue
            }
        }
        $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message
        Add-Content -Path $LogPath -Value $line -Encoding UTF8
    }
    catch {}
}

function Invoke-Git([string[]]$Arguments) {
    $output = & git -C $RepoRoot @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ('git {0} failed: {1}' -f ($Arguments -join ' '),(($output | Out-String).Trim()))
    }
    return (($output | Out-String).Trim())
}

function Get-RemoteSha {
    $output = & git -C $RepoRoot ls-remote origin "refs/heads/$Branch" 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ('git ls-remote failed: ' + (($output | Out-String).Trim()))
    }
    $line = @($output)[0]
    if (-not $line -or $line -notmatch '^([0-9a-fA-F]{40})\s+') {
        throw 'Could not resolve the remote Flecity Games commit.'
    }
    return $Matches[1].ToLowerInvariant()
}

function Get-DeployedBuild {
    if (-not (Test-Path $BuildMarker)) { return '' }
    try { return (Get-Content $BuildMarker -Raw -ErrorAction Stop).Trim().ToLowerInvariant() }
    catch { return '' }
}

function Test-Deployed([string]$RemoteSha,[string]$DeployedBuild) {
    if ([string]::IsNullOrWhiteSpace($RemoteSha) -or [string]::IsNullOrWhiteSpace($DeployedBuild)) { return $false }
    if ($DeployedBuild.Length -lt 7) { return $false }
    return $RemoteSha.StartsWith($DeployedBuild,[System.StringComparison]::OrdinalIgnoreCase)
}

function Restart-Watcher {
    $q = [char]34
    $args = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $q$WatcherPath$q -ServerBase $q$ServerBase$q -PollSeconds $PollSeconds -StableSeconds $StableSeconds -RetrySeconds $RetrySeconds"
    Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $args | Out-Null
}

$mutex = New-Object System.Threading.Mutex($false,'Local\FlecityGamesAutoUpdate')
$ownsMutex = $false

try {
    try { $ownsMutex = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $ownsMutex = $true }
    if (-not $ownsMutex) { exit 0 }

    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
        throw "Dedicated auto-update Git worktree was not found: $RepoRoot"
    }
    if (-not (Test-Path $UpdateScript)) {
        throw "Update script was not found: $UpdateScript"
    }

    $PollSeconds = [Math]::Max(10,$PollSeconds)
    $StableSeconds = [Math]::Max(15,$StableSeconds)
    $RetrySeconds = [Math]::Max(30,$RetrySeconds)

    Write-AutoLog ("Watcher started. poll={0}s stable={1}s server={2}" -f $PollSeconds,$StableSeconds,$ServerBase)

    $candidateSha = ''
    $candidateSince = [DateTimeOffset]::UtcNow
    $lastAttemptSha = ''
    $lastAttemptAt = [DateTimeOffset]::MinValue

    while ($true) {
        try {
            $now = [DateTimeOffset]::UtcNow
            $remoteSha = Get-RemoteSha
            $deployed = Get-DeployedBuild

            if (Test-Deployed $remoteSha $deployed) {
                $candidateSha = $remoteSha
                $candidateSince = $now
            }
            else {
                if ($candidateSha -ne $remoteSha) {
                    $candidateSha = $remoteSha
                    $candidateSince = $now
                    Write-AutoLog ("Update detected: {0}. Waiting for commit to stabilize." -f $remoteSha.Substring(0,7))
                }
                elseif (($now - $candidateSince).TotalSeconds -ge $StableSeconds) {
                    $retryBlocked = $lastAttemptSha -eq $remoteSha -and (($now - $lastAttemptAt).TotalSeconds -lt $RetrySeconds)
                    if (-not $retryBlocked) {
                        $lastAttemptSha = $remoteSha
                        $lastAttemptAt = $now
                        Write-AutoLog ("Preparing update {0}." -f $remoteSha.Substring(0,7))

                        $selfHashBefore = if (Test-Path $WatcherPath) { (Get-FileHash $WatcherPath -Algorithm SHA256).Hash } else { '' }

                        Invoke-Git @('fetch','--prune','origin',$Branch) | Out-Null
                        $fetchedSha = (Invoke-Git @('rev-parse',"origin/$Branch")).Trim().ToLowerInvariant()

                        if ($fetchedSha -ne $remoteSha) {
                            $candidateSha = $fetchedSha
                            $candidateSince = [DateTimeOffset]::UtcNow
                            Write-AutoLog ("Remote moved during fetch. New candidate: {0}." -f $fetchedSha.Substring(0,7))
                        }
                        else {
                            Invoke-Git @('reset','--hard',"origin/$Branch") | Out-Null
                            Invoke-Git @('clean','-fd') | Out-Null

                            $selfHashAfter = if (Test-Path $WatcherPath) { (Get-FileHash $WatcherPath -Algorithm SHA256).Hash } else { '' }
                            if ($selfHashBefore -and $selfHashAfter -and $selfHashBefore -ne $selfHashAfter) {
                                Write-AutoLog 'Watcher updated itself. Restarting watcher.'
                                Restart-Watcher
                                exit 0
                            }

                            $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $UpdateScript -ServerBase $ServerBase -NoGitSync 2>&1
                            $exitCode = $LASTEXITCODE
                            foreach ($line in @($output)) {
                                if ($null -ne $line -and "$line".Trim() -ne '') { Write-AutoLog ("deploy> " + "$line") }
                            }

                            if ($exitCode -ne 0) {
                                throw "Deployment exited with code $exitCode. The previous test-server build remains in place."
                            }

                            $after = Get-DeployedBuild
                            if (-not (Test-Deployed $remoteSha $after)) {
                                throw "Deployment completed but build marker does not match $($remoteSha.Substring(0,7))."
                            }

                            Write-AutoLog ("Update deployed successfully: {0}." -f $remoteSha.Substring(0,7))
                            $candidateSha = $remoteSha
                            $candidateSince = [DateTimeOffset]::UtcNow
                        }
                    }
                }
            }
        }
        catch {
            Write-AutoLog ("ERROR: " + $_.Exception.Message)
        }

        Start-Sleep -Seconds $PollSeconds
    }
}
finally {
    if ($ownsMutex) {
        try { $mutex.ReleaseMutex() } catch {}
    }
    $mutex.Dispose()
}
