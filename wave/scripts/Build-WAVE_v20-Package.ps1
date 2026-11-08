$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
$SourceRoot = Join-Path $Root 'resource'
$PackageRoot = Join-Path $Root 'test-package'
$PayloadRoot = Join-Path $PackageRoot 'payload'
$BaselinePath = Join-Path $PackageRoot 'manifests\v19-baseline.json'
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

$baselineJsonObject = [ordered]@{}
foreach ($key in ($baseline.Keys | Sort-Object)) { $baselineJsonObject[$key] = $baseline[$key] }
$targetJsonObject = [ordered]@{}
foreach ($key in ($target.Keys | Sort-Object)) { $targetJsonObject[$key] = $target[$key] }
$baselineJson = $baselineJsonObject | ConvertTo-Json -Depth 3
$targetJson = $targetJsonObject | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($BaselinePath, $baselineJson, $Utf8NoBom)
[System.IO.File]::WriteAllText($TargetPath, $targetJson, $Utf8NoBom)
$changedDocument = @($ExpectedFiles | Sort-Object | ForEach-Object { [pscustomobject]@{ path = $_; sha256 = $target[$_] } })
$changedJson = ConvertTo-Json -InputObject $changedDocument -Depth 3
[System.IO.File]::WriteAllText($ChangedPath, $changedJson, $Utf8NoBom)

$verifiedPayload = Get-TreeHashes $PayloadRoot
foreach ($relative in $ExpectedFiles) {
  $normalized = $relative.Replace('\', '/')
  if ($verifiedPayload[$normalized] -cne $target[$normalized]) { throw "Payload verification failed: $relative" }
}
Write-Output ('PACKAGE PASS: v19={0} files, v20={1} files, payload={2} approved files.' -f $baseline.Count, $target.Count, $verifiedPayload.Count)
