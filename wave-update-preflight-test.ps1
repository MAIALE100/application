# Regression: a resource changed during staging must not be overwritten or rolled back.
# Run: pwsh -NoProfile -File ./wave-update-preflight-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
$start = $updater.IndexOf('function Assert-SafeResourceTree(')
$end = $updater.IndexOf('function Invoke-BackupRetention(', $start)
if ($start -lt 0 -or $end -le $start) { throw 'Deployment preflight helpers not found' }
. ([ScriptBlock]::Create($updater.Substring($start, $end - $start)))

$deploy = $updater.IndexOf("    Step 'Deploying WAVE to the test server'")
$guard = $updater.IndexOf('    Assert-DeploymentPreconditions $Destination $ActiveBackup', $deploy)
$started = $updater.IndexOf('    $DeploymentStarted=$true', $deploy)
if ($deploy -lt 0 -or $guard -le $deploy -or $started -le $guard) {
    throw 'DeploymentStarted must be set only after successful preflight'
}

function Assert-Blocked([string]$Installed,[string]$Backup,[string]$ExpectedMessage) {
    $blocked = $false
    try { Assert-DeploymentPreconditions $Installed $Backup }
    catch {
        if ($_.Exception.Message -eq $ExpectedMessage) { $blocked = $true }
        else { throw }
    }
    if (-not $blocked) { throw ('Expected deployment refusal: ' + $ExpectedMessage) }
}

$root = Join-Path ([IO.Path]::GetTempPath()) ('wave-preflight-test-' + [guid]::NewGuid().ToString('N'))
$installed = Join-Path $root 'installed'
$backup = Join-Path $root 'backup'
try {
    New-Item -ItemType Directory -Force -Path $installed | Out-Null
    [IO.File]::WriteAllText((Join-Path $installed 'fxmanifest.lua'), 'original')
    Copy-Item -LiteralPath $installed -Destination $backup -Recurse -Force
    Assert-DeploymentPreconditions $installed $backup
    Write-Host 'PASS unchanged resource matches verified backup'

    [IO.File]::WriteAllText((Join-Path $installed 'fxmanifest.lua'), 'newer content')
    Assert-Blocked $installed $backup 'Installed WAVE changed since backup; deployment aborted'
    if ([IO.File]::ReadAllText((Join-Path $installed 'fxmanifest.lua')) -ne 'newer content') {
        throw 'Changed resource was overwritten during preflight'
    }
    Write-Host 'PASS post-backup modifications are preserved'

    [IO.File]::WriteAllText((Join-Path $installed 'extra.lua'), 'new file')
    Assert-Blocked $installed $backup 'Installed WAVE changed since backup; deployment aborted'
    Write-Host 'PASS newly added installed files prevent replacement'

    Remove-Item -LiteralPath $installed -Recurse -Force
    Assert-DeploymentPreconditions $installed ''
    Write-Host 'PASS fresh installation with missing destination'

    New-Item -ItemType Directory -Force -Path $installed | Out-Null
    [IO.File]::WriteAllText((Join-Path $installed 'fxmanifest.lua'), 'concurrent install')
    Assert-Blocked $installed '' 'WAVE destination appeared after preflight; deployment aborted'
    if ([IO.File]::ReadAllText((Join-Path $installed 'fxmanifest.lua')) -ne 'concurrent install') {
        throw 'Concurrent installation was overwritten'
    }
    Write-Host 'PASS concurrent first installation is preserved'
    Write-Host 'WAVE deployment preflight regression: PASS'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
