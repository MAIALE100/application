$ErrorActionPreference = 'Stop'
$TaskName = 'Flecity Games Auto Update'
$StateDir = Join-Path $env:LOCALAPPDATA 'FlecityGamesAutoUpdate'
$InstalledMarker = Join-Path $StateDir 'installed.flag'
$DisabledMarker = Join-Path $StateDir 'disabled.flag'

try {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

    try {
        Import-Module ScheduledTasks -ErrorAction Stop
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($task) {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        }
    }
    catch {}

    $startup = [Environment]::GetFolderPath('Startup')
    if (-not [string]::IsNullOrWhiteSpace($startup)) {
        Remove-Item (Join-Path $startup 'Flecity Games Auto Update.cmd') -Force -ErrorAction SilentlyContinue
    }

    try {
        Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
            Where-Object {
                $_.CommandLine -and (
                    $_.CommandLine -match 'games-auto-update\.ps1' -or
                    $_.CommandLine -match 'games-auto-update-once\.ps1'
                )
            } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    }
    catch {}

    Remove-Item $InstalledMarker -Force -ErrorAction SilentlyContinue
    Set-Content -Path $DisabledMarker -Value ('disabled=' + (Get-Date -Format o)) -Encoding UTF8

    Write-Host 'Flecity Games automatic updates are disabled.' -ForegroundColor Yellow
    Write-Host 'The dedicated Git worktree was left intact so it can be re-enabled safely later.'
    exit 0
}
catch {
    Write-Host ('Failed to disable automatic updates: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
