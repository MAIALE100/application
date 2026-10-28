# Regression tests for the SHA256-based no-op deployment guard.
# Run: pwsh -NoProfile -File ./wave-update-noop-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
$start = $updater.IndexOf('function Test-DeploymentMatches(')
$end = $updater.IndexOf('function Read-RemoteParts(', $start)
if ($start -lt 0 -or $end -le $start) { throw 'No-op guard function not found' }
. ([ScriptBlock]::Create($updater.Substring($start, $end - $start)))

$root = Join-Path ([IO.Path]::GetTempPath()) ('wave-noop-test-' + [guid]::NewGuid().ToString('N'))
$source = Join-Path $root 'source'
$target = Join-Path $root 'installed'
function Assert-Match([bool]$Expected, [string]$Label, [bool]$IgnoreBuildMetadata = $true) {
    $actual = Test-DeploymentMatches $source $target $IgnoreBuildMetadata
    if ($actual -ne $Expected) { throw ('FAIL ' + $Label + ': expected ' + $Expected + ', got ' + $actual) }
    Write-Host ('PASS ' + $Label)
}
try {
    New-Item -ItemType Directory -Force -Path (Join-Path $source 'web') | Out-Null
    New-Item -ItemType Directory -Force -Path (Join-Path $target 'web') | Out-Null
    [IO.File]::WriteAllText((Join-Path $source 'fxmanifest.lua'), 'version test')
    [IO.File]::WriteAllText((Join-Path $source 'web/app.js'), 'const test = true;')
    [IO.File]::WriteAllText((Join-Path $target 'fxmanifest.lua'), 'version test')
    [IO.File]::WriteAllText((Join-Path $target 'web/app.js'), 'const test = true;')
    Assert-Match $true 'identical files'
    [IO.File]::WriteAllText((Join-Path $target '.wave-build.txt'), 'previous commit metadata')
    Assert-Match $true 'build metadata ignored'
    [IO.File]::WriteAllText((Join-Path $target 'web/app.js'), 'const test = false;')
    Assert-Match $false 'modified installed content'
    [IO.File]::WriteAllText((Join-Path $target 'web/app.js'), 'const test = true;')
    [IO.File]::WriteAllText((Join-Path $target 'extra.txt'), 'unexpected')
    Assert-Match $false 'unexpected installed file'
    Remove-Item -LiteralPath (Join-Path $target 'extra.txt') -Force
    Remove-Item -LiteralPath (Join-Path $target 'fxmanifest.lua') -Force
    Assert-Match $false 'missing installed file'
    Remove-Item -LiteralPath $target -Recurse -Force
    Assert-Match $false 'missing installation'

    New-Item -ItemType Directory -Force -Path (Join-Path $source 'web'),(Join-Path $target 'web') | Out-Null
    [IO.File]::WriteAllText((Join-Path $source 'fxmanifest.lua'), 'version test')
    [IO.File]::WriteAllText((Join-Path $target 'fxmanifest.lua'), 'version test')
    [IO.File]::WriteAllText((Join-Path $source 'web/app.js'), 'const test = true;')
    [IO.File]::WriteAllText((Join-Path $target 'web/app.js'), 'const test = true;')
    [IO.File]::WriteAllText((Join-Path $source '.wave-build.txt'), 'build one')
    [IO.File]::WriteAllText((Join-Path $target '.wave-build.txt'), 'build one')
    Assert-Match $true 'verified backup includes build metadata' $false
    [IO.File]::WriteAllText((Join-Path $target '.wave-build.txt'), 'build two')
    Assert-Match $false 'backup detects modified build metadata' $false
    Assert-Match $false 'source metadata is not silently excluded'
    Remove-Item -LiteralPath (Join-Path $source '.wave-build.txt') -Force
    Assert-Match $true 'deployment no-op ignores installed metadata'
    Write-Host 'WAVE no-op and backup verification regression: PASS'
} finally {
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
