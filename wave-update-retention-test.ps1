# Regression: prune only updater-created backups and never remove rollback data.
# Run: pwsh -NoProfile -File ./wave-update-retention-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
$start = $updater.IndexOf('function Invoke-BackupRetention(')
$end = $updater.IndexOf('function Read-RemoteParts(', $start)
if ($start -lt 0 -or $end -le $start) { throw 'Backup retention helper not found' }
. ([ScriptBlock]::Create($updater.Substring($start, $end - $start)))

$root = Join-Path ([IO.Path]::GetTempPath()) ('wave-retention-test-' + [guid]::NewGuid().ToString('N'))
$names = @(
    '20261021-010101-00000001',
    '20261022-010101-00000002',
    '20261023-010101-00000003',
    '20261024-010101-00000004',
    '20261025-010101-00000005',
    '20261026-010101-00000006',
    '20261027-010101-00000007',
    'manual-archive',
    '20261027-010101-invalid'
)
$protected = Join-Path $root $names[0]
try {
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    foreach ($name in $names) {
        $dir = Join-Path $root $name
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        [IO.File]::WriteAllText((Join-Path $dir 'sentinel.txt'), $name)
    }
    Invoke-BackupRetention $root $protected 5
    foreach ($name in $names) {
        $shouldExist = ($name -eq $names[0]) -or ($name -in $names[4..8])
        $exists = Test-Path -LiteralPath (Join-Path $root $name) -PathType Container
        if ($exists -ne $shouldExist) {
            throw ('Retention mismatch for ' + $name + ': expected ' + $shouldExist)
        }
        if ($exists -and -not (Test-Path -LiteralPath (Join-Path (Join-Path $root $name) 'sentinel.txt'))) {
            throw ('Retained backup contents were modified: ' + $name)
        }
    }
    Write-Host 'PASS newest five, protected rollback and unrelated folders retained'
    Invoke-BackupRetention $root $protected 5
    Write-Host 'PASS repeated retention is idempotent'
    Invoke-BackupRetention (Join-Path $root 'missing') '' 5
    Write-Host 'PASS missing backup root is harmless'
    Write-Host 'WAVE safe backup retention regression: PASS'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
