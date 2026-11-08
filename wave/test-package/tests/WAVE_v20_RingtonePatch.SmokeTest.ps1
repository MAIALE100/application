$ErrorActionPreference = 'Stop'
$packageRoot = Split-Path -Parent $PSScriptRoot
$sourceScript = Join-Path $packageRoot 'scripts\WAVE_v20_RingtonePatch.ps1'
$tempRoot = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd('\')
$testRoot = Join-Path $tempRoot ('WAVE_v20_RingtonePatch_Smoke_' + [guid]::NewGuid().ToString('N'))
$testServer = Join-Path $testRoot 'FiveM_Test_Server'
$fixturePackage = Join-Path $testRoot 'package'
$resource = Join-Path $testServer 'resources\wave'
$backupRoot = Join-Path $testServer 'backups\WAVE'
$oldText = 'integration = false'
$newText = 'integration = true'
$utf8 = [System.Text.UTF8Encoding]::new($false)
$passed = $false

function Invoke-PatchScript([string]$Mode) {
  $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $fixturePackage 'scripts\WAVE_v20_RingtonePatch.ps1') -Mode $Mode -ResourcePath $resource -BackupRoot $backupRoot 2>&1
  $code = $LASTEXITCODE
  if ($output) { $output | ForEach-Object { Write-Host $_ } }
  return $code
}

try {
  New-Item -ItemType Directory -Path (Join-Path $fixturePackage 'scripts'), (Join-Path $fixturePackage 'manifests'), (Join-Path $fixturePackage 'payload\config'), (Join-Path $resource 'config'), $backupRoot -Force | Out-Null
  Copy-Item -LiteralPath $sourceScript -Destination (Join-Path $fixturePackage 'scripts\WAVE_v20_RingtonePatch.ps1')
  $oldFile = Join-Path $resource 'config\shared.lua'
  $newFile = Join-Path $fixturePackage 'payload\config\shared.lua'
  [System.IO.File]::WriteAllText($oldFile, $oldText, $utf8)
  [System.IO.File]::WriteAllText($newFile, $newText, $utf8)
  $oldHash = (Get-FileHash -LiteralPath $oldFile -Algorithm SHA256).Hash
  $newHash = (Get-FileHash -LiteralPath $newFile -Algorithm SHA256).Hash
  [ordered]@{'config/shared.lua' = $oldHash} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixturePackage 'manifests\v20-pre-ringtone-integration.json') -Encoding UTF8
  [ordered]@{'config/shared.lua' = $newHash} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $fixturePackage 'manifests\v20-target.json') -Encoding UTF8

  if ((Invoke-PatchScript 'Apply') -ne 0) { throw 'Apply smoke test failed.' }
  if ((Get-Content -LiteralPath $oldFile -Raw) -cne $newText) { throw 'Apply did not install the target file.' }
  if ((Invoke-PatchScript 'Verify') -ne 0) { throw 'Verify smoke test failed.' }
  if ((Invoke-PatchScript 'Rollback') -ne 0) { throw 'Rollback smoke test failed.' }
  if ((Get-Content -LiteralPath $oldFile -Raw) -cne $oldText) { throw 'Rollback did not restore the original file.' }

  [System.IO.File]::WriteAllText($oldFile, 'outside change', $utf8)
  if ((Invoke-PatchScript 'Apply') -ne 2) { throw 'Conflict was not rejected.' }
  if ((Get-Content -LiteralPath $oldFile -Raw) -cne 'outside change') { throw 'Conflict check altered the mismatched resource.' }
  Write-Host 'SMOKE PASS: apply, full-tree verify, rollback, and conflict stop.'
  $passed = $true
} finally {
  $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot).TrimEnd('\')
  if ($passed -and $resolvedTestRoot.StartsWith($tempRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolvedTestRoot) -like 'WAVE_v20_RingtonePatch_Smoke_*') {
    Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
  }
}
