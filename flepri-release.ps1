param(
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "release")
)

$ErrorActionPreference = "Stop"

$repo = $PSScriptRoot
$booth = Join-Path $repo "puribooth"
$puri = Join-Path $repo "puriphoto"
$stage = Join-Path $OutputDirectory "FLEPURI_v1.0.1"
$zip = Join-Path $OutputDirectory "FLEPURI_v1.0.1_submission.zip"
$verify = Join-Path $OutputDirectory "_verify_FLEPURI_v1.0.1"

function Assert-File([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Missing required file: $Path"
    }
}

function Assert-Contains([string]$Path, [string]$Needle) {
    Assert-File $Path
    $content = Get-Content -LiteralPath $Path -Raw
    if (-not $content.Contains($Needle)) {
        throw "Required marker '$Needle' not found in $Path"
    }
}

Write-Host "==> Validating FLEPURI v1.0.1 release" -ForegroundColor Cyan

Assert-Contains (Join-Path $booth "fxmanifest.lua") 'version "1.0.1"'
Assert-Contains (Join-Path $puri "fxmanifest.lua") 'version "1.1.1"'

$boothJs = Join-Path $booth "ui\app.js"
$puriJs = Join-Path $puri "ui\dist\assets\puriphoto-v1.1.1-flepri.js"
Assert-File $boothJs
Assert-File $puriJs

node --check $boothJs
if ($LASTEXITCODE -ne 0) { throw "FLEPURI editor JavaScript syntax check failed" }

node --check $puriJs
if ($LASTEXITCODE -ne 0) { throw "PuriPhoto compatibility bundle JavaScript syntax check failed" }

Assert-Contains $puriJs "boothImportAvailable"
Assert-Contains $puriJs "puriphotoGetBoothImport"
Assert-Contains $puriJs "puriphotoConfirmBoothImport"

$puriBridge = Join-Path $puri "client\v11.lua"
Assert-Contains $puriBridge 'exports("OpenBoothImport"'
Assert-Contains $puriBridge 'exports("CancelBoothImport"'
Assert-Contains $puriBridge "boothImportConsumed"

$fontBinaries = Get-ChildItem -LiteralPath $booth -File -Recurse |
    Where-Object { $_.Extension -match '^\.(ttf|otf|woff|woff2|eot)$' }

if ($fontBinaries) {
    throw "Font binaries must not be included in the operator package."
}

New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $verify -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $zip -Force -ErrorAction SilentlyContinue

Write-Host "==> Staging puribooth" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $stage -Force | Out-Null
$stageBooth = Join-Path $stage "puribooth"
New-Item -ItemType Directory -Path $stageBooth -Force | Out-Null
Copy-Item -Path (Join-Path $booth "*") -Destination $stageBooth -Recurse -Force
Remove-Item -LiteralPath (Join-Path $stageBooth "RELEASE_CHECKLIST.md") -Force -ErrorAction SilentlyContinue

Write-Host "==> Staging optional PuriPhoto compatibility patch" -ForegroundColor Cyan
$patchRoot = Join-Path $stage "PuriPhoto_compat_patch\puriphoto"
New-Item -ItemType Directory -Path (Join-Path $patchRoot "client") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $patchRoot "ui\dist\assets") -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $puri "fxmanifest.lua") -Destination (Join-Path $patchRoot "fxmanifest.lua") -Force
Copy-Item -LiteralPath $puriBridge -Destination (Join-Path $patchRoot "client\v11.lua") -Force
Copy-Item -LiteralPath (Join-Path $puri "ui\dist\index.html") -Destination (Join-Path $patchRoot "ui\dist\index.html") -Force
Copy-Item -LiteralPath $puriJs -Destination (Join-Path $patchRoot "ui\dist\assets\puriphoto-v1.1.1-flepri.js") -Force
Copy-Item -LiteralPath (Join-Path $puri "ui\dist\assets\index-9487c400.css") -Destination (Join-Path $patchRoot "ui\dist\assets\index-9487c400.css") -Force

$patchReadme = @'
PuriPhoto compatibility patch for FLEPURI v1.0.1
=================================================

This is NOT a standalone PuriPhoto installation.

Use this only when an existing PuriPhoto installation fails:
    puribooth_selftest
with a PuriPhoto UI / bridge compatibility error.

Recommended:
1. Back up the existing puriphoto resource.
2. Merge the puriphoto folder from this patch over the existing puriphoto resource.
3. Do not delete existing PuriPhoto images, frames, fonts or other dist assets.
4. restart puriphoto
5. restart puribooth
6. run puribooth_selftest

If the existing PuriPhoto is newer or customized, rebuild its current ui/src instead of blindly overwriting it.
The production build must contain:
- boothImportAvailable
- puriphotoGetBoothImport
- puriphotoConfirmBoothImport
'@
Set-Content -LiteralPath (Join-Path $stage "PuriPhoto_compat_patch\README.txt") -Value $patchReadme -Encoding UTF8

$installFirst = @'
FLEPURI v1.0.1 - INSTALL FIRST
================================

1. Install/replace the puribooth resource from this package.
2. Start existing PuriPhoto and puribooth.
3. Run puribooth_selftest from the server console.

If selftest reports PuriPhoto UI/bridge PASS:
    The optional PuriPhoto_compat_patch is NOT needed.

If selftest reports stale-ui / client-flepri-bridge / PuriPhoto UI failure:
    Read PuriPhoto_compat_patch/README.txt and merge that patch into the existing PuriPhoto resource.

After installation:
    restart puriphoto
    restart puribooth
    puribooth_selftest

Then run puribooth/ACCEPTANCE_TEST.md.
'@
Set-Content -LiteralPath (Join-Path $stage "INSTALL_FIRST.txt") -Value $installFirst -Encoding UTF8

Write-Host "==> Creating ZIP" -ForegroundColor Cyan
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal

Write-Host "==> Re-extracting ZIP for verification" -ForegroundColor Cyan
Expand-Archive -LiteralPath $zip -DestinationPath $verify -Force

$required = @(
    "puribooth\fxmanifest.lua",
    "puribooth\client\main.lua",
    "puribooth\server\main.lua",
    "puribooth\ui\app.js",
    "puribooth\INSTALL.md",
    "puribooth\PURIPHOTO_COMPAT.md",
    "PuriPhoto_compat_patch\README.txt",
    "PuriPhoto_compat_patch\puriphoto\client\v11.lua",
    "PuriPhoto_compat_patch\puriphoto\ui\dist\index.html",
    "PuriPhoto_compat_patch\puriphoto\ui\dist\assets\puriphoto-v1.1.1-flepri.js"
)

foreach ($relative in $required) {
    Assert-File (Join-Path $verify $relative)
}

$unexpectedFonts = Get-ChildItem -LiteralPath $verify -File -Recurse |
    Where-Object { $_.Extension -match '^\.(ttf|otf|woff|woff2|eot)$' }

if ($unexpectedFonts) {
    throw "Verified ZIP unexpectedly contains font binaries."
}

if (Test-Path -LiteralPath (Join-Path $verify "puribooth\RELEASE_CHECKLIST.md")) {
    throw "Internal RELEASE_CHECKLIST.md leaked into operator ZIP."
}

$hash = Get-FileHash -LiteralPath $zip -Algorithm SHA256
$size = (Get-Item -LiteralPath $zip).Length

Write-Host ""
Write-Host "FLEPURI v1.0.1 submission package PASS" -ForegroundColor Green
Write-Host ("ZIP:    {0}" -f $zip)
Write-Host ("Bytes:  {0:N0}" -f $size)
Write-Host ("SHA256: {0}" -f $hash.Hash)
