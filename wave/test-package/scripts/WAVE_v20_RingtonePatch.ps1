param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Apply', 'Verify', 'Rollback')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$ResourcePath,
  [Parameter(Mandatory = $true)]
  [string]$BackupRoot
)

$ErrorActionPreference = 'Stop'
$PackageRoot = Split-Path -Parent $PSScriptRoot
$PayloadFile = Join-Path $PackageRoot 'payload\config\shared.lua'
$BeforePath = Join-Path $PackageRoot 'manifests\v20-pre-ringtone-integration.json'
$TargetPath = Join-Path $PackageRoot 'manifests\v20-target.json'
$AllowedFile = 'config/shared.lua'

function Write-Log([string]$Message) {
  Write-Host ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message)
}

function Read-HashManifest([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Manifest missing: $Path" }
  $json = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  $map = @{}
  foreach ($property in $json.PSObject.Properties) { $map[$property.Name] = ([string]$property.Value).ToUpperInvariant() }
  return ,$map
}

function Get-TreeHashes([string]$Root) {
  $absoluteRoot = (Resolve-Path -LiteralPath $Root).Path.TrimEnd('\')
  $map = @{}
  foreach ($file in (Get-ChildItem -LiteralPath $Root -File -Recurse -Force)) {
    $relative = $file.FullName.Substring($absoluteRoot.Length + 1).Replace('\', '/')
    $map[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToUpperInvariant()
  }
  return ,$map
}

function Compare-HashMaps($Expected, $Actual) {
  $missing = @($Expected.Keys | Where-Object { -not $Actual.ContainsKey($_) })
  $extra = @($Actual.Keys | Where-Object { -not $Expected.ContainsKey($_) })
  $changed = @($Expected.Keys | Where-Object { $Actual.ContainsKey($_) -and $Actual[$_] -cne $Expected[$_] })
  return [pscustomobject]@{ Missing = $missing; Extra = $extra; Changed = $changed; Pass = ($missing.Count -eq 0 -and $extra.Count -eq 0 -and $changed.Count -eq 0) }
}

function Assert-ExactTree([string]$Root, $Expected, [string]$Label) {
  $actual = Get-TreeHashes $Root
  $comparison = Compare-HashMaps $Expected $actual
  if (-not $comparison.Pass) {
    Write-Log ('CONFLICT_STOP {0}: missing={1}; extra={2}; changed={3}' -f $Label, ($comparison.Missing -join ','), ($comparison.Extra -join ','), ($comparison.Changed -join ','))
    throw "CONFLICT_STOP: $Label does not match the approved manifest. No files were changed."
  }
  Write-Log ('SHA256 PASS: {0} files match {1}.' -f $actual.Count, $Label)
  return $actual
}

function Assert-Package($Before, $Target) {
  if ($Before.Count -ne $Target.Count) { throw 'CONFLICT_STOP: v20 manifest file counts differ.' }
  foreach ($relative in $Before.Keys) {
    if (-not $Target.ContainsKey($relative)) { throw "CONFLICT_STOP: target file missing: $relative" }
  }
  $changed = @($Before.Keys | Where-Object { $Before[$_] -cne $Target[$_] })
  if ($changed.Count -ne 1 -or $changed[0] -cne $AllowedFile) { throw 'CONFLICT_STOP: incremental patch must change only config/shared.lua.' }
  if (-not (Test-Path -LiteralPath $PayloadFile -PathType Leaf)) { throw 'CONFLICT_STOP: patch payload is missing.' }
  $payloadHash = (Get-FileHash -LiteralPath $PayloadFile -Algorithm SHA256).Hash.ToUpperInvariant()
  if ($payloadHash -cne $Target[$AllowedFile]) { throw 'CONFLICT_STOP: config/shared.lua payload does not match the target manifest.' }
}

function Get-VerifiedBackup($Before) {
  foreach ($candidate in @(Get-ChildItem -LiteralPath $BackupRoot -Directory -Filter 'WAVE_v20_Ringtone_Integration_*' | Sort-Object Name -Descending)) {
    $metadataPath = Join-Path $candidate.FullName 'backup-metadata.json'
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { continue }
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    if ($metadata.resourcePath -cne (Resolve-Path -LiteralPath $ResourcePath).Path -or $metadata.beforeManifest -cne 'v20-pre-ringtone-integration.json') { continue }
    if (-not (Test-Path -LiteralPath $metadata.backupResource -PathType Container)) { continue }
    try { [void](Assert-ExactTree $metadata.backupResource $Before 'verified pre-patch full WAVE backup'); return $metadata }
    catch { Write-Log ('Ignoring unverified backup: ' + $candidate.Name) }
  }
  throw 'No verified full WAVE backup for the v20 ringtone patch is available.'
}

try {
  if (-not (Test-Path -LiteralPath $ResourcePath -PathType Container)) { throw "Test resource not found: $ResourcePath" }
  $resolvedResource = (Resolve-Path -LiteralPath $ResourcePath).Path.TrimEnd('\')
  if ((Split-Path -Leaf $resolvedResource) -cne 'wave' -or $resolvedResource -notmatch '(?i)(^|[\\/])FiveM_Test_Server([\\/]|$)') {
    throw 'CONFLICT_STOP: this package only updates a wave resource below a FiveM_Test_Server folder.'
  }
  if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container) -and $Mode -ne 'Apply') { throw 'WAVE backup directory does not exist.' }
  if ($Mode -eq 'Apply' -and -not (Test-Path -LiteralPath $BackupRoot -PathType Container)) { New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null }

  $before = Read-HashManifest $BeforePath
  $target = Read-HashManifest $TargetPath
  Assert-Package $before $target

  switch ($Mode) {
    'Verify' {
      [void](Assert-ExactTree $resolvedResource $target 'complete v20 ringtone-integration target')
      Write-Log 'VERIFY PASS: installed test resource matches the approved v20 target.'
    }
    'Apply' {
      [void](Assert-ExactTree $resolvedResource $before 'previous v20 test installation')
      $stamp = Get-Date -Format 'yyyyMMdd_HHmmss_fff'
      $backupDir = Join-Path $BackupRoot ('WAVE_v20_Ringtone_Integration_' + $stamp)
      $backupResource = Join-Path $backupDir 'resource'
      New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
      Copy-Item -LiteralPath $resolvedResource -Destination $backupResource -Recurse -Force
      [void](Assert-ExactTree $backupResource $before 'pre-patch full WAVE resource backup')
      $metadata = [pscustomobject]@{
        version = 'v20-test-ringtone-integration'
        createdAt = (Get-Date).ToString('o')
        resourcePath = $resolvedResource
        backupResource = $backupResource
        beforeManifest = 'v20-pre-ringtone-integration.json'
        targetManifest = 'v20-target.json'
        changedFiles = @($AllowedFile)
        databaseChanged = $false
        lbPhoneChanged = $false
      }
      $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDir 'backup-metadata.json') -Encoding UTF8
      try {
        Copy-Item -LiteralPath $PayloadFile -Destination (Join-Path $resolvedResource 'config\shared.lua') -Force
        [void](Assert-ExactTree $resolvedResource $target 'v20 ringtone-integration target after patch')
      } catch {
        $actual = Get-TreeHashes $resolvedResource
        $comparison = Compare-HashMaps $before $actual
        if ($comparison.Missing.Count -eq 0 -and $comparison.Extra.Count -eq 0 -and ($comparison.Changed.Count -eq 0 -or ($comparison.Changed.Count -eq 1 -and $comparison.Changed[0] -ceq $AllowedFile))) {
          Copy-Item -LiteralPath (Join-Path $backupResource 'config\shared.lua') -Destination (Join-Path $resolvedResource 'config\shared.lua') -Force
          [void](Assert-ExactTree $resolvedResource $before 'resource restored after failed patch verification')
          Write-Log 'Patch verification failed; the allowlisted file was restored from the verified backup.'
        } else { Write-Log 'CONFLICT_STOP: files outside the allowlist changed during patching; no automatic restore was attempted.' }
        throw
      }
      Write-Log ('PATCH PASS: only config/shared.lua changed. Full backup: ' + $backupDir)
      Write-Log 'No database, LB Phone file, or other WAVE file was changed. Restart only the wave resource after this script exits.'
    }
    'Rollback' {
      [void](Assert-ExactTree $resolvedResource $target 'v20 target before ringtone-patch rollback')
      $selected = Get-VerifiedBackup $before
      Copy-Item -LiteralPath (Join-Path $selected.backupResource 'config\shared.lua') -Destination (Join-Path $resolvedResource 'config\shared.lua') -Force
      [void](Assert-ExactTree $resolvedResource $before 'previous v20 resource after rollback')
      Write-Log ('ROLLBACK PASS: restored config/shared.lua from ' + $selected.backupResource)
      Write-Log 'The full backup is retained. No database or LB Phone file was changed. Restart only the wave resource after this script exits.'
    }
  }
  exit 0
} catch {
  Write-Log ('FAIL: ' + $_.Exception.Message)
  exit 2
}
