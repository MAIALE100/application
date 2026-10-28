# Regression: reject junctions, symlinks and dangling links before WAVE replacement.
# Run: pwsh -NoProfile -File ./wave-update-path-safety-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
if (([regex]::Matches($updater, 'Assert-SafeResourceTree \$Destination')).Count -lt 3 -or
    -not $updater.Contains('Assert-SafeResourceTree $ActiveBackup')) {
    throw 'Deployment or rollback path safety guard missing'
}
# The no-backup rollback path also removes a directory. Ensure it checks
# for a swapped junction/link immediately before that recursive removal.
$firstInstallRollbackGuard = '(?s)elseif \(Test-Path -LiteralPath \$Destination\) \{(?:\s*\#[^\r\n]*\r?\n)*\s*Assert-SafeResourceTree \$Destination\s*' +
    'if \(Test-FirstInstallRollbackSafe \$Source \$Destination \$FirstInstallMoved\) \{\s*Write-Host ''Removing incomplete first installation\.\.\.''' +
    '[^\r\n]*\r?\n\s*Remove-Item -LiteralPath \$Destination -Recurse -Force'
if ($updater -notmatch $firstInstallRollbackGuard) {
    throw 'First-install rollback must validate path and ownership before recursive deletion'
}
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
    Remove-Item -LiteralPath $backupLink -Force
    Write-Host 'PASS backup root link rejected'

    # A link in an ancestor directory is just as dangerous as a linked
    # resource root, even if the requested resource does not exist yet.
    $linkedParent = Join-Path $root 'linked-parent'
    New-Item -ItemType SymbolicLink -Path $linkedParent -Target $external | Out-Null
    Assert-Rejected (Join-Path $linkedParent 'wave') $false
    Remove-Item -LiteralPath $linkedParent -Force
    Write-Host 'PASS linked ancestor rejected'

    $brokenParent = Join-Path $root 'broken-parent'
    New-Item -ItemType SymbolicLink -Path $brokenParent -Target (Join-Path $root 'missing-parent-target') | Out-Null
    Assert-Rejected (Join-Path $brokenParent 'wave') $false
    Remove-Item -LiteralPath $brokenParent -Force
    Write-Host 'PASS dangling ancestor rejected'
    Write-Host 'WAVE path safety regression: PASS'
} finally {
    # Remove links explicitly before recursive test cleanup.
    foreach ($linkName in @('linked-parent','broken-parent','.wave-backups')) {
        $linkPath = Join-Path $root $linkName
        $linkItem = Get-ChildItem -LiteralPath $root -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -eq $linkName } | Select-Object -First 1
        if ($linkItem -and ($linkItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            Remove-Item -LiteralPath $linkPath -Force -ErrorAction SilentlyContinue
        }
    }
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
