$ErrorActionPreference = 'SilentlyContinue'

$TaskName = 'Flecity Games Auto Update'
$StateDir = Join-Path $env:LOCALAPPDATA 'FlecityGamesAutoUpdate'
$InstalledMarker = Join-Path $StateDir 'installed.flag'
$DisabledMarker = Join-Path $StateDir 'disabled.flag'
$LogPath = Join-Path $StateDir 'auto-update.log'
$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base'
$BuildMarker = Join-Path (Join-Path (Join-Path $ServerBase 'resources') 'flecity_games') 'dev-build.txt'

Write-Host ''
Write-Host '=== Flecity Games Auto Update Status ===' -ForegroundColor Cyan

$installed = Test-Path $InstalledMarker
$disabled = Test-Path $DisabledMarker
$task = $null

try {
    Import-Module ScheduledTasks -ErrorAction Stop
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
} catch {}

if ($disabled) {
    Write-Host 'Auto update : DISABLED' -ForegroundColor Yellow
}
elseif ($installed) {
    Write-Host 'Auto update : INSTALLED' -ForegroundColor Green
}
else {
    Write-Host 'Auto update : NOT INSTALLED YET' -ForegroundColor Yellow
}

if ($task) {
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName -ErrorAction SilentlyContinue
    Write-Host ('Task state  : ' + $task.State)
    if ($taskInfo) {
        Write-Host ('Last run    : ' + $taskInfo.LastRunTime)
        Write-Host ('Last result : ' + $taskInfo.LastTaskResult)
    }
} else {
    Write-Host 'Task state  : not found'
}

if (Test-Path $BuildMarker) {
    $build = (Get-Content $BuildMarker -Raw).Trim()
    Write-Host ('Server build: ' + $build)
} else {
    Write-Host 'Server build: marker not found'
}

if (Test-Path $InstalledMarker) {
    Write-Host ''
    Write-Host 'Install info:' -ForegroundColor DarkCyan
    Get-Content $InstalledMarker | ForEach-Object { Write-Host ('  ' + $_) }
}

Write-Host ''
Write-Host 'Recent log:' -ForegroundColor DarkCyan
if (Test-Path $LogPath) {
    Get-Content $LogPath -Tail 12 | ForEach-Object { Write-Host ('  ' + $_) }
} else {
    Write-Host '  No auto-update log yet.'
}

Write-Host ''
if ($installed -and -not $disabled) {
    Write-Host 'Automatic update setup looks installed.' -ForegroundColor Green
} else {
    Write-Host 'Automatic update is not confirmed yet.' -ForegroundColor Yellow
}
Write-Host ''
