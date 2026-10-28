# Regression: reject junctions, symlinks and dangling links before WAVE replacement.
# Run: pwsh -NoProfile -File ./wave-update-path-safety-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
$start = $updater.IndexOf('function Assert-SafeResourceTree(')
$end = $updater.IndexOf('function Test-DeploymentMatches(', $start)
if ($start -lt 0 -or $end -le $start) { throw 'WAVE path safety helper not found' }
. ([ScriptBlock]::Create($updater.Substring($start, $end - $start)))

function Assert-Rejected([string]$Path,[bool]$InspectChildren = $true) {
    $rejected = $false
    try { Assert-SafeResourceTree $Path $InspectChildren }
    catch {
        if ($_.Exception.Message -match 'Unsafe WAVE path \(reparse point\)') { $rejected = $true }
        else { throw }
    }
    if (-not $rejected) { throw ('Reparse point was accepted: ' + $Path) }
}
$root = Join-Path ([IO.Path]::GetTempPath()) ('wave-path-safety-test-' + [guid]::NewGuid().ToString('N'))
$installed = Join-Path $root 'wave'
$external = Join-Path $root 'external'
try {
    New-Item -ItemType Directory -Force -Path $installed,$external | Out-Null
    [IO.File]::WriteAllText((Join-Path $installed 'fxmanifest.lua'), 'test')
    Assert-SafeResourceTree $installed
    Assert-SafeResourceTree (Join-Path $root 'not-installed')
    Write-Host 'PASS ordinary resource and missing path'

    $nestedLink = Join-Path $installed 'nested-link'
    New-Item -ItemType SymbolicLink -Path $nestedLink -Target $external | Out-Null
    Assert-Rejected $installed
    Remove-Item -LiteralPath $nestedLink -Force
    Write-Host 'PASS nested directory link rejected'

    $brokenLink = Join-Path $installed 'broken-link'
    New-Item -ItemType SymbolicLink -Path $brokenLink -Target (Join-Path $root 'missing-target') | Out-Null
    Assert-Rejected $installed
    Remove-Item -LiteralPath $brokenLink -Force
    Write-Host 'PASS dangling link rejected'

    $resourceLink = Join-Path $root 'wave-link'
    New-Item -ItemType SymbolicLink -Path $resourceLink -Target $installed | Out-Null
    Assert-Rejected $resourceLink $false
    Remove-Item -LiteralPath $resourceLink -Force
    Write-Host 'PASS resource root link rejected'

    $backupLink = Join-Path $root '.wave-backups'
    New-Item -ItemType SymbolicLink -Path $backupLink -Target $external | Out-Null
    Assert-Rejected $backupLink $false
    Write-Host 'PASS backup root link rejected'
    Write-Host 'WAVE path safety regression: PASS'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
