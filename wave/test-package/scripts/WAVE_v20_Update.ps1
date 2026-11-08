param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Plan', 'Apply', 'Verify', 'Rollback')]
  [string]$Mode,
  [Parameter(Mandatory = $true)]
  [string]$ResourcePath,
  [Parameter(Mandatory = $true)]
  [string]$BackupRoot
)

$ErrorActionPreference = 'Stop'
$PackageRoot = Split-Path -Parent $PSScriptRoot
$PayloadRoot = Join-Path $PackageRoot 'payload'
$BaselinePath = Join-Path $PackageRoot 'manifests\v19-baseline.json'
$TargetPath = Join-Path $PackageRoot 'manifests\v20-target.json'
$ChangedPath = Join-Path $PackageRoot 'manifests\changed-files.json'

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
  if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw "Directory missing: $Root" }
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

function Assert-Package([hashtable]$Baseline, [hashtable]$Target, [string[]]$AllowedFiles) {
  $baselineKeys = @($Baseline.Keys | Sort-Object)
  $targetKeys = @($Target.Keys | Sort-Object)
  if ((Compare-Object $baselineKeys $targetKeys).Count -gt 1) { throw 'CONFLICT_STOP: target inventory is not the v19 baseline plus approved additions.' }
  $actualChanged = @($Baseline.Keys | Where-Object { $Baseline[$_] -cne $Target[$_] })
  $actualChanged += @($Target.Keys | Where-Object { -not $Baseline.ContainsKey($_) })
  $actualChanged = @($actualChanged | Sort-Object)
  if ((Compare-Object $actualChanged ($AllowedFiles | Sort-Object)).Count -gt 0) {
    throw ('CONFLICT_STOP: manifest differences exceed allowlist: ' + ($actualChanged -join ','))
  }
  $payloadFiles = @(Get-ChildItem -LiteralPath $PayloadRoot -File -Recurse -Force | ForEach-Object { $_.FullName.Substring($PayloadRoot.TrimEnd('\').Length + 1).Replace('\', '/') } | Sort-Object)
  if ((Compare-Object $payloadFiles ($AllowedFiles | Sort-Object)).Count -gt 0) { throw 'CONFLICT_STOP: payload contains missing or unexpected files.' }
  foreach ($relative in $AllowedFiles) {
    $payloadFile = Join-Path $PayloadRoot ($relative.Replace('/', '\'))
    if (-not (Test-Path -LiteralPath $payloadFile -PathType Leaf)) { throw "Payload missing: $relative" }
    $hash = (Get-FileHash -LiteralPath $payloadFile -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($hash -cne $Target[$relative]) { throw "CONFLICT_STOP: payload hash mismatch for $relative" }
  }
  Write-Log ('Package PASS: exactly {0} approved files are included.' -f $AllowedFiles.Count)
}

function Get-Backup([string]$Prefix, $Baseline) {
  if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) { throw 'No WAVE backup directory exists.' }
  $candidates = @(Get-ChildItem -LiteralPath $BackupRoot -Directory -Filter ($Prefix + '*') | Sort-Object Name -Descending)
  foreach ($candidate in $candidates) {
    $metadataPath = Join-Path $candidate.FullName 'backup-metadata.json'
    if (-not (Test-Path -LiteralPath $metadataPath -PathType Leaf)) { continue }
    $metadata = Get-Content -LiteralPath $metadataPath -Raw | ConvertFrom-Json
    if ($metadata.resourcePath -cne $ResourcePath -or $metadata.baselineManifest -cne 'v19-baseline.json') { continue }
    if (-not (Test-Path -LiteralPath $metadata.backupResource -PathType Container)) { continue }
    try { [void](Assert-ExactTree $metadata.backupResource $Baseline 'verified v19 rollback backup'); return $metadata }
    catch { Write-Log ('Ignoring unverified backup: ' + $candidate.Name) }
  }
  throw 'No verified full WAVE v19 backup is available.'
}

try {
  if (-not (Test-Path -LiteralPath $ResourcePath -PathType Container)) { throw "Test resource not found: $ResourcePath" }
  $baseline = Read-HashManifest $BaselinePath
  $target = Read-HashManifest $TargetPath
  $changedDoc = Get-Content -LiteralPath $ChangedPath -Raw | ConvertFrom-Json
  $allowedFiles = @($changedDoc | ForEach-Object { [string]$_.path })
  if ($allowedFiles.Count -eq 0) { throw 'Changed-file allowlist is empty.' }
  Assert-Package $baseline $target $allowedFiles

  switch ($Mode) {
    'Plan' {
      [void](Assert-ExactTree $ResourcePath $baseline 'v19 installed test baseline')
      Write-Log ('PLAN PASS: only these files will change: ' + ($allowedFiles -join ', '))
      Write-Log 'No files, database rows, phone configuration, or resources were changed.'
    }
    'Verify' {
      [void](Assert-ExactTree $ResourcePath $target 'complete v20 installed target')
      Write-Log 'VERIFY PASS: installed test resource matches the complete v20 manifest.'
    }
    'Apply' {
      [void](Assert-ExactTree $ResourcePath $baseline 'v19 installed test baseline')
      if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) { New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null }
      $stamp = Get-Date -Format 'yyyyMMdd_HHmmss_fff'
      $backupDir = Join-Path $BackupRoot ('WAVE_v20_' + $stamp)
      $backupResource = Join-Path $backupDir 'resource'
      New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
      Copy-Item -LiteralPath $ResourcePath -Destination $backupResource -Recurse -Force
      [void](Assert-ExactTree $backupResource $baseline 'pre-update full WAVE resource backup')
      $metadata = [pscustomobject]@{
        version = 'v20-test'
        createdAt = (Get-Date).ToString('o')
        resourcePath = $ResourcePath
        backupResource = $backupResource
        baselineManifest = 'v19-baseline.json'
        rollbackScope = $allowedFiles
        databaseChangedByUpdater = $false
        databaseChangeOnResourceStart = 'Additive wave_ringtones table and schema version 4 only; no existing WAVE rows are deleted or rewritten.'
      }
      $metadata | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backupDir 'backup-metadata.json') -Encoding UTF8
      foreach ($relative in $allowedFiles) {
        $sourceFile = Join-Path $PayloadRoot ($relative.Replace('/', '\'))
        $targetFile = Join-Path $ResourcePath ($relative.Replace('/', '\'))
        $parent = Split-Path -Parent $targetFile
        if (-not (Test-Path -LiteralPath $parent -PathType Container)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        Copy-Item -LiteralPath $sourceFile -Destination $targetFile -Force
      }
      $actual = Get-TreeHashes $ResourcePath
      $comparison = Compare-HashMaps $target $actual
      if (-not $comparison.Pass) {
        $safe = $comparison.Missing.Count -eq 0 -and $comparison.Extra.Count -eq 0
        foreach ($relative in $allowedFiles) {
          if ($target.ContainsKey($relative)) {
            if (-not $actual.ContainsKey($relative) -or ($actual[$relative] -cne $baseline[$relative] -and $actual[$relative] -cne $target[$relative])) { $safe = $false }
          } elseif ($actual.ContainsKey($relative) -and $actual[$relative] -cne $target[$relative]) { $safe = $false }
        }
        foreach ($relative in $baseline.Keys) {
          if ($allowedFiles -notcontains $relative -and (-not $actual.ContainsKey($relative) -or $actual[$relative] -cne $baseline[$relative])) { $safe = $false }
        }
        if ($safe) {
          foreach ($relative in $allowedFiles) {
            if ($baseline.ContainsKey($relative)) { Copy-Item -LiteralPath (Join-Path $backupResource ($relative.Replace('/', '\'))) -Destination (Join-Path $ResourcePath ($relative.Replace('/', '\'))) -Force }
            elseif (Test-Path -LiteralPath (Join-Path $ResourcePath ($relative.Replace('/', '\'))) -PathType Leaf) { Remove-Item -LiteralPath (Join-Path $ResourcePath ($relative.Replace('/', '\'))) -Force }
          }
          Write-Log 'Post-update verification failed; only allowlisted files were restored from the verified full backup.'
        } else { Write-Log 'CONFLICT_STOP: automatic restore is unsafe because files changed outside the approved update scope.' }
        throw ('CONFLICT_STOP: v20 verification failed. Changed=' + ($comparison.Changed -join ',') + '; missing=' + ($comparison.Missing -join ',') + '; extra=' + ($comparison.Extra -join ','))
      }
      Write-Log ('APPLY PASS: all v20 hashes verified. Full backup: ' + $backupDir)
      Write-Log 'Only WAVE resource files were replaced. No phone resource or server-wide restart was performed.'
      Write-Log 'After this script exits, restart only the wave resource and run wave_selftest and wave_diag.'
    }
    'Rollback' {
      [void](Assert-ExactTree $ResourcePath $target 'v20 target before rollback')
      $selected = Get-Backup 'WAVE_v20_' $baseline
      foreach ($relative in $allowedFiles) {
        $targetFile = Join-Path $ResourcePath ($relative.Replace('/', '\'))
        if ($baseline.ContainsKey($relative)) {
          Copy-Item -LiteralPath (Join-Path $selected.backupResource ($relative.Replace('/', '\'))) -Destination $targetFile -Force
        } elseif (Test-Path -LiteralPath $targetFile -PathType Leaf) { Remove-Item -LiteralPath $targetFile -Force }
      }
      [void](Assert-ExactTree $ResourcePath $baseline 'v19 resource after rollback')
      Write-Log ('ROLLBACK PASS: restored only the allowlisted files from ' + $selected.backupResource)
      Write-Log 'The additive wave_ringtones table and user choices are preserved; do not drop them during rollback.'
      Write-Log 'After this script exits, restart only the wave resource.'
    }
  }
  exit 0
} catch {
  Write-Log ('FAIL: ' + $_.Exception.Message)
  exit 2
}
