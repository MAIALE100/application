# Regression: rollback of an existing install must preserve unverified changes.
# Run: pwsh -NoProfile -File ./wave-update-rollback-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
$start = $updater.IndexOf('function Assert-SafeResourceTree(')
$end = $updater.IndexOf('function Test-FirstInstallRollbackSafe(', $start)
if ($start -lt 0 -or $end -le $start) { throw 'Existing-install rollback helpers not found' }
. ([ScriptBlock]::Create($updater.Substring($start, $end - $start)))

# Ensure the real catch path decides whether it owns the destination before deletion.
$catchStart = $updater.IndexOf('} catch {', $updater.IndexOf("    Step 'WAVE deployment complete'"))
$decision = $updater.IndexOf('Get-ExistingInstallRollbackAction $Source $Destination $ActiveBackup', $catchStart)
$preserve = $updater.IndexOf("if ($rollbackAction -eq 'preserve')", $decision)
$delete = $updater.IndexOf('Remove-Item -LiteralPath $Destination -Recurse -Force', $decision)
if ($catchStart -lt 0 -or $decision -le $catchStart -or $preserve -le $decision -or $delete -le $preserve) {
    throw 'Rollback must check destination ownership before removing it'
}

$root = Join-Path ([IO.Path]::GetTempPath()) ('wave-rollback-test-' + [guid]::NewGuid().ToString('N'))
$built = Join-Path $root 'built'
$installed = Join-Path $root 'installed'
$backup = Join-Path $root 'backup'
try {
    New-Item -ItemType Directory -Force -Path $built,$backup | Out-Null
    [IO.File]::WriteAllText((Join-Path $built 'fxmanifest.lua'), 'new build')
    [IO.File]::WriteAllText((Join-Path $backup 'fxmanifest.lua'), 'old build')
    Copy-Item -LiteralPath $backup -Destination $installed -Recurse
    if ((Get-ExistingInstallRollbackAction $built $installed $backup) -ne 'unchanged') {
        throw 'Unmodified old installation should not be replaced again'
    }
    Write-Host 'PASS intact previous resource needs no rollback'

    Remove-Item -LiteralPath $installed -Recurse -Force
    if ((Get-ExistingInstallRollbackAction $built $installed $backup) -ne 'restore') {
        throw 'Missing destination must permit restoration'
    }
    Write-Host 'PASS missing destination can be restored'

    Copy-Item -LiteralPath $built -Destination $installed -Recurse
    if ((Get-ExistingInstallRollbackAction $built $installed $backup) -ne 'restore') {
        throw 'Updater-owned staged build must permit rollback'
    }
    [IO.File]::WriteAllText((Join-Path $installed '.wave-build.txt'), 'installed metadata')
    if ((Get-ExistingInstallRollbackAction $built $installed $backup) -ne 'restore') {
        throw 'Updater build metadata must not prevent rollback'
    }
    Write-Host 'PASS staged build with or without build metadata can be restored'

    [IO.File]::WriteAllText((Join-Path $installed 'fxmanifest.lua'), 'concurrent edit')
    if ((Get-ExistingInstallRollbackAction $built $installed $backup) -ne 'preserve') {
        throw 'Concurrent edits must be preserved'
    }
    if ([IO.File]::ReadAllText((Join-Path $installed 'fxmanifest.lua')) -ne 'concurrent edit') {
        throw 'Rollback decision changed external data'
    }
    Write-Host 'PASS concurrent edits are preserved'

    Remove-Item -LiteralPath $installed -Recurse -Force
    Copy-Item -LiteralPath $built -Destination $installed -Recurse
    [IO.File]::WriteAllText((Join-Path $installed 'extra.lua'), 'new external file')
    if ((Get-ExistingInstallRollbackAction $built $installed $backup) -ne 'preserve') {
        throw 'New external files must be preserved'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $installed 'extra.lua'))) {
        throw 'New external file was removed'
    }
    Write-Host 'PASS unexpected new files are preserved'
    Write-Host 'WAVE existing-install rollback regression: PASS'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
