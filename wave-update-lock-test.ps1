# Regression checks for the cross-process WAVE updater lock.
# Run: pwsh -NoProfile -File ./wave-update-lock-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
$start = $updater.IndexOf('function Enter-UpdateLock(')
$end = $updater.IndexOf('function Test-DeploymentMatches(', $start)
if ($start -lt 0 -or $end -le $start) { throw 'Update lock function not found' }
. ([ScriptBlock]::Create($updater.Substring($start, $end - $start)))

$path = Join-Path ([IO.Path]::GetTempPath()) ('wave-lock-test-' + [guid]::NewGuid().ToString('N') + '.lock')
$first = $null
$second = $null
try {
    $first = Enter-UpdateLock $path
    if (-not $first) { throw 'First update did not acquire the lock' }
    Write-Host 'PASS first updater acquires lock'

    $blocked = $false
    try {
        $second = Enter-UpdateLock $path
    } catch {
        if ($_.Exception.Message -match 'Another WAVE update is running') { $blocked = $true }
        else { throw }
    }
    if (-not $blocked) { throw 'Concurrent updater was not rejected' }
    Write-Host 'PASS concurrent updater is rejected'

    $first.Dispose()
    $first = $null
    $second = Enter-UpdateLock $path
    if (-not $second) { throw 'Lock was not released' }
    Write-Host 'PASS updater can restart after previous process exits'
    Write-Host 'WAVE update lock regression: PASS'
} finally {
    if ($second) { $second.Dispose() }
    if ($first) { $first.Dispose() }
    Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
}
