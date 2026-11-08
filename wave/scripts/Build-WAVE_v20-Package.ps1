$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$SourceRoot = Join-Path $Root 'resource'
$PackageRoot = Join-Path $Root 'test-package'
$PayloadRoot = Join-Path $PackageRoot 'payload'
$BaselinePath = Join-Path $PackageRoot 'manifests\v19-baseline.json'
$PrePatchPath = Join-Path $PackageRoot 'manifests\v20-pre-ringtone-integration.json'
$TargetPath = Join-Path $PackageRoot 'manifests\v20-target.json'
$ChangedPath = Join-Path $PackageRoot 'manifests\changed-files.json'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$ExpectedFiles = @(
  'client/main.lua',
  'config/shared.lua',
  'fxmanifest.lua',
  'server/main.lua',
  'web/app.css',
  'web/app.js',
  'web/background-player.js',
  'web/index.html',
  'web/ringtone-core.js',
  'web/screen/index.html'
)

function Get-TreeHashes([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Container)) { throw "Directory missing: $Path" }
  $base = (Resolve-Path -LiteralPath $Path).Path.TrimEnd('\')
  $map = @{}
  foreach ($file in Get-ChildItem -LiteralPath $Path -File -Recurse -Force) {
    $relative = $file.FullName.Substring($base.Length + 1).Replace('\', '/')
    $map[$relative] = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToUpperInvariant()
  }
  return ,$map
}

$baselineDocument = Get-Content -LiteralPath $BaselinePath -Raw | ConvertFrom-Json
$baseline = @{}
foreach ($property in $baselineDocument.PSObject.Properties) { $baseline[$property.Name] = ([string]$property.Value).ToUpperInvariant() }
$target = Get-TreeHashes $SourceRoot
if ($baseline.Count -ne 273 -or $target.Count -ne 274) { throw 'CONFLICT_STOP: expected the reviewed 273-file v19 baseline and 274-file v20 source.' }

$actualChanged = @($baseline.Keys | Where-Object { -not $target.ContainsKey($_) -or $baseline[$_] -cne $target[$_] })
$actualChanged += @($target.Keys | Where-Object { -not $baseline.ContainsKey($_) })
$actualChanged = @($actualChanged | Sort-Object)
if ((Compare-Object $actualChanged ($ExpectedFiles | Sort-Object)).Count -gt 0) {
  throw ('CONFLICT_STOP: source changes do not match the approved allowlist: ' + ($actualChanged -join ', '))
}

$preDocument = Get-Content -LiteralPath $PrePatchPath -Raw | ConvertFrom-Json
$prePatch = @{}
foreach ($property in $preDocument.PSObject.Properties) { $prePatch[$property.Name] = ([string]$property.Value).ToUpperInvariant() }
if ($prePatch.Count -ne $target.Count) { throw 'CONFLICT_STOP: the frozen previous-v20 manifest has an unexpected file count.' }
foreach ($relative in $prePatch.Keys) { if (-not $target.ContainsKey($relative)) { throw "CONFLICT_STOP: previous-v20 file is missing from the target: $relative" } }
$incrementalChanges = @($prePatch.Keys | Where-Object { $prePatch[$_] -cne $target[$_] })
if ($incrementalChanges.Count -ne 1 -or $incrementalChanges[0] -cne 'config/shared.lua') {
  throw ('CONFLICT_STOP: the previous-v20 incremental patch must change only config/shared.lua: ' + ($incrementalChanges -join ', '))
}
$currentTargetDocument = Get-Content -LiteralPath $TargetPath -Raw | ConvertFrom-Json
$currentTarget = @{}
foreach ($property in $currentTargetDocument.PSObject.Properties) { $currentTarget[$property.Name] = ([string]$property.Value).ToUpperInvariant() }
if ($currentTarget.Count -ne $prePatch.Count) { throw 'CONFLICT_STOP: existing v20 target manifest has an unexpected file count.' }
$currentMatchesPre = $true
$currentMatchesSource = $true
foreach ($relative in $prePatch.Keys) {
  if (-not $currentTarget.ContainsKey($relative)) { throw "CONFLICT_STOP: existing v20 target is missing $relative." }
  if ($currentTarget[$relative] -cne $prePatch[$relative]) { $currentMatchesPre = $false }
  if ($currentTarget[$relative] -cne $target[$relative]) { $currentMatchesSource = $false }
}
if (-not $currentMatchesPre -and -not $currentMatchesSource) {
  throw 'CONFLICT_STOP: existing v20 target matches neither the frozen pre-integration target nor the reviewed source.'
}

$payload = Get-TreeHashes $PayloadRoot
$payloadPaths = @($payload.Keys | Sort-Object)
if ((Compare-Object $payloadPaths ($ExpectedFiles | Sort-Object)).Count -gt 0) {
  throw 'CONFLICT_STOP: payload contains missing or unexpected files; nothing was removed.'
}

foreach ($relative in $ExpectedFiles) {
  $sourceFile = Join-Path $SourceRoot ($relative.Replace('/', '\'))
  $payloadFile = Join-Path $PayloadRoot ($relative.Replace('/', '\'))
  Copy-Item -LiteralPath $sourceFile -Destination $payloadFile -Force
}

$targetText = [System.IO.File]::ReadAllText($TargetPath)
$targetPattern = '("config/shared\.lua"\s*:\s*")([A-Fa-f0-9]{64})(")'
$targetMatches = [System.Text.RegularExpressions.Regex]::Matches($targetText, $targetPattern)
if ($targetMatches.Count -ne 1 -or @($prePatch['config/shared.lua'], $target['config/shared.lua']) -cnotcontains $targetMatches[0].Groups[2].Value.ToUpperInvariant()) {
  throw 'CONFLICT_STOP: existing v20 target config hash cannot be updated safely.'
}
if ($targetMatches[0].Groups[2].Value.ToUpperInvariant() -cne $target['config/shared.lua']) {
  $targetText = [System.Text.RegularExpressions.Regex]::Replace($targetText, $targetPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $match.Groups[1].Value + $target['config/shared.lua'] + $match.Groups[3].Value }, 1)
  [System.IO.File]::WriteAllText($TargetPath, $targetText, $Utf8NoBom)
}

$changedText = [System.IO.File]::ReadAllText($ChangedPath)
$changedPattern = '("path"\s*:\s*"config/shared\.lua"\s*,\s*"sha256"\s*:\s*")([A-Fa-f0-9]{64})(")'
$changedMatches = [System.Text.RegularExpressions.Regex]::Matches($changedText, $changedPattern)
if ($changedMatches.Count -ne 1 -or @($prePatch['config/shared.lua'], $target['config/shared.lua']) -cnotcontains $changedMatches[0].Groups[2].Value.ToUpperInvariant()) {
  throw 'CONFLICT_STOP: changed-files config hash cannot be updated safely.'
}
if ($changedMatches[0].Groups[2].Value.ToUpperInvariant() -cne $target['config/shared.lua']) {
  $changedText = [System.Text.RegularExpressions.Regex]::Replace($changedText, $changedPattern, [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $match.Groups[1].Value + $target['config/shared.lua'] + $match.Groups[3].Value }, 1)
  [System.IO.File]::WriteAllText($ChangedPath, $changedText, $Utf8NoBom)
}

$verifiedPayload = Get-TreeHashes $PayloadRoot
foreach ($relative in $ExpectedFiles) {
  $normalized = $relative.Replace('\', '/')
  if ($verifiedPayload[$normalized] -cne $target[$normalized]) { throw "Payload verification failed: $relative" }
}
Write-Output ('PACKAGE PASS: v19={0} files, v20={1} files, payload={2} approved files.' -f $baseline.Count, $target.Count, $verifiedPayload.Count)
