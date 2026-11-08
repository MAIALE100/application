$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$workRoot = Split-Path -Parent $packageRoot
$baseV19 = Join-Path $workRoot 'base-v19'
$sourceUpdater = Join-Path $packageRoot 'scripts\WAVE_v20_Update.ps1'
$tempRoot = Join-Path $env:TEMP ('WAVE_v20_UpdaterTest_' + [guid]::NewGuid().ToString('N'))
$testPackage = Join-Path $tempRoot 'package'
$resource = Join-Path $tempRoot 'resources\[lb-phone]\wave'
$backupRoot = Join-Path $tempRoot 'backups\WAVE'

function Get-TreeHashes([string]$Root) {
  $absoluteRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')
  $map = @{}
  foreach ($file in Get-ChildItem -LiteralPath $Root -File -Recurse -Force) {
    $relative = $file.FullName.Substring($absoluteRoot.Length + 1).Replace('\', '/')
    $map[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToUpperInvariant()
  }
  return ,$map
}

function Invoke-Updater([string]$Mode, [int]$ExpectedExit, [string]$ExpectedText) {
  $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $testUpdater -Mode $Mode -ResourcePath $resource -BackupRoot $backupRoot 2>&1 | Out-String
  $actualExit = $LASTEXITCODE
  if ($actualExit -ne $ExpectedExit) { throw "${Mode} exit code $actualExit, expected $ExpectedExit. Output: $output" }
  if ($ExpectedText -and $output -notmatch [regex]::Escape($ExpectedText)) { throw "${Mode} output lacked '$ExpectedText'. Output: $output" }
  Write-Output ("SMOKE PASS: {0} (exit {1})" -f $Mode, $actualExit)
}

try {
  New-Item -ItemType Directory -Path (Split-Path -Parent $resource) -Force | Out-Null
  New-Item -ItemType Directory -Path $testPackage -Force | Out-Null
  foreach ($folder in @('manifests', 'payload', 'scripts')) {
    Copy-Item -LiteralPath (Join-Path $packageRoot $folder) -Destination (Join-Path $testPackage $folder) -Recurse -Force
  }
  Copy-Item -LiteralPath $baseV19 -Destination $resource -Recurse -Force

  $testUpdater = Join-Path $testPackage 'scripts\WAVE_v20_Update.ps1'
  $driftFile = Join-Path $resource 'web\sample-engine.js'
  Add-Content -LiteralPath $driftFile -Value "`n-- unapproved fixture drift"
  $driftHash = (Get-FileHash -LiteralPath $driftFile -Algorithm SHA256).Hash
  Invoke-Updater 'Plan' 2 'CONFLICT_STOP'
  if ((Get-FileHash -LiteralPath $driftFile -Algorithm SHA256).Hash -cne $driftHash) { throw 'Plan changed a conflicted file.' }
  Copy-Item -LiteralPath (Join-Path $baseV19 'web\sample-engine.js') -Destination $driftFile -Force

  Invoke-Updater 'Plan' 0 'PLAN PASS'
  Invoke-Updater 'Apply' 0 'APPLY PASS'
  Invoke-Updater 'Verify' 0 'VERIFY PASS'
  Invoke-Updater 'Rollback' 0 'ROLLBACK PASS'

  $baseline = Get-Content -LiteralPath (Join-Path $testPackage 'manifests\v19-baseline.json') -Raw | ConvertFrom-Json
  $expected = @{}
  foreach ($property in $baseline.PSObject.Properties) { $expected[$property.Name] = [string]$property.Value }
  $actual = Get-TreeHashes $resource
  $missing = @($expected.Keys | Where-Object { -not $actual.ContainsKey($_) })
  $extra = @($actual.Keys | Where-Object { -not $expected.ContainsKey($_) })
  $changed = @($expected.Keys | Where-Object { $actual.ContainsKey($_) -and $actual[$_] -cne $expected[$_] })
  if ($missing.Count -or $extra.Count -or $changed.Count) { throw 'Full resource hash differs after rollback.' }
  Write-Output ('SMOKE PASS: conflict stop, apply, full verify, rollback; baseline files={0}.' -f $actual.Count)
} finally {
  if (Test-Path -LiteralPath $tempRoot -PathType Container) {
    $tempBase = (Resolve-Path -LiteralPath $env:TEMP).Path.TrimEnd('\') + '\'
    $resolvedTempRoot = (Resolve-Path -LiteralPath $tempRoot).Path
    if (-not $resolvedTempRoot.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to remove path outside TEMP: $resolvedTempRoot" }
    Remove-Item -LiteralPath $resolvedTempRoot -Recurse -Force
  }
}
