param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [int]$StableSeconds = 45
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'games/platform-core'
$UpdateScript = Join-Path $RepoRoot 'games-update.ps1'
$StateDir = Join-Path $env:LOCALAPPDATA 'FlecityGamesAutoUpdate'
$LogPath = Join-Path $StateDir 'auto-update.log'
$Destination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_games'
$BuildMarker = Join-Path $Destination 'dev-build.txt'

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Log([string]$Message){
    try {
        $line='[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'),$Message
        Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
    } catch {}
}
function Invoke-GitCli([string[]]$Args){
    $old=$ErrorActionPreference
    try {
        $ErrorActionPreference='Continue'
        $out=& git -C $RepoRoot @Args 2>&1
        $code=$LASTEXITCODE
    } finally {$ErrorActionPreference=$old}
    if($code -ne 0){throw ('git {0} failed ({1}): {2}' -f ($Args -join ' '),$code,(($out|Out-String).Trim()))}
    return (($out|Out-String).Trim())
}
function RemoteSha {
    $out=Invoke-GitCli @('ls-remote','origin',"refs/heads/$Branch")
    $line=@($out -split '[\r\n]+')[0]
    if($line -notmatch '^([0-9a-fA-F]{40})\s+'){throw 'Could not resolve remote branch SHA.'}
    return $Matches[1].ToLowerInvariant()
}
function DeployedBuild {
    if(-not (Test-Path -LiteralPath $BuildMarker)){return ''}
    try{return ([System.IO.File]::ReadAllText($BuildMarker)).Trim().ToLowerInvariant()}catch{return ''}
}
function IsDeployed([string]$Remote,[string]$Build){
    return $Build.Length -ge 7 -and $Remote.StartsWith($Build,[System.StringComparison]::OrdinalIgnoreCase)
}

$mutex=New-Object System.Threading.Mutex($false,'Local\FlecityGamesAutoUpdateOnce')
$owns=$false
try{
    try{$owns=$mutex.WaitOne(0)}catch [System.Threading.AbandonedMutexException]{$owns=$true}
    if(-not $owns){exit 0}
    if(-not (Test-Path -LiteralPath (Join-Path $RepoRoot '.git'))){throw "Auto-update worktree missing: $RepoRoot"}

    $remote1=RemoteSha
    $build=DeployedBuild
    if(IsDeployed $remote1 $build){exit 0}

    Log ("Update candidate {0}; verifying stability for {1}s." -f $remote1.Substring(0,7),$StableSeconds)
    Start-Sleep -Seconds ([Math]::Max(15,$StableSeconds))
    $remote2=RemoteSha
    if($remote2 -ne $remote1){
        Log ("Remote changed during stability window: {0} -> {1}; deferring." -f $remote1.Substring(0,7),$remote2.Substring(0,7))
        exit 0
    }

    Log ("Deploying stable update {0}." -f $remote2.Substring(0,7))
    Invoke-GitCli @('fetch','--prune','origin',$Branch) | Out-Null
    $fetched=(Invoke-GitCli @('rev-parse',"origin/$Branch")).Trim().ToLowerInvariant()
    if($fetched -ne $remote2){Log 'Fetched SHA moved; deferring.';exit 0}
    Invoke-GitCli @('reset','--hard',"origin/$Branch") | Out-Null
    Invoke-GitCli @('clean','-fd') | Out-Null

    $output=& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $UpdateScript -ServerBase $ServerBase -NoGitSync 2>&1
    $code=$LASTEXITCODE
    foreach($line in @($output)){if($null -ne $line -and "$line".Trim()){Log ("deploy> "+$line)}}
    if($code -ne 0){throw "Deployment exited with code $code"}

    $after=DeployedBuild
    if(-not (IsDeployed $remote2 $after)){throw "Deployment marker does not match $($remote2.Substring(0,7))"}
    Log ("Update deployed successfully: {0}." -f $remote2.Substring(0,7))
    exit 0
}catch{
    Log ("ERROR: "+$_.Exception.Message)
    exit 1
}finally{
    if($owns){try{$mutex.ReleaseMutex()}catch{}}
    $mutex.Dispose()
}
