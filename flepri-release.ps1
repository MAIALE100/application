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
$patchStage = Join-Path $OutputDirectory "_patch_FLEPURI_v1.0.1"
$patchZip = Join-Path $stage "PuriPhoto_compat_patch.zip"
$patchRoot = Join-Path $patchStage "puriphoto"

Remove-Item -LiteralPath $patchStage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Path (Join-Path $patchRoot "client") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $patchRoot "ui\dist\assets") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $patchRoot "ui\src") -Force | Out-Null

Copy-Item -LiteralPath (Join-Path $puri "fxmanifest.lua") -Destination (Join-Path $patchRoot "fxmanifest.lua") -Force
Copy-Item -LiteralPath (Join-Path $puri "README.md") -Destination (Join-Path $patchRoot "README.md") -Force
Copy-Item -LiteralPath (Join-Path $puri "CHANGELOG.md") -Destination (Join-Path $patchRoot "CHANGELOG.md") -Force
Copy-Item -LiteralPath $puriBridge -Destination (Join-Path $patchRoot "client\v11.lua") -Force
Copy-Item -LiteralPath (Join-Path $puri "ui\index.html") -Destination (Join-Path $patchRoot "ui\index.html") -Force
Copy-Item -LiteralPath (Join-Path $puri "ui\package.json") -Destination (Join-Path $patchRoot "ui\package.json") -Force
Copy-Item -LiteralPath (Join-Path $puri "ui\package-lock.json") -Destination (Join-Path $patchRoot "ui\package-lock.json") -Force
Copy-Item -LiteralPath (Join-Path $puri "ui\src\App.tsx") -Destination (Join-Path $patchRoot "ui\src\App.tsx") -Force
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

The patch also contains the matching App.tsx and package/lock metadata so a later production rebuild keeps FLEPURI support.

If the existing PuriPhoto is newer or customized, merge/rebuild its current ui/src instead of blindly overwriting unrelated custom files.
The production build must contain:
- boothImportAvailable
- puriphotoGetBoothImport
- puriphotoConfirmBoothImport
'@
Set-Content -LiteralPath (Join-Path $patchStage "README.txt") -Value $patchReadme -Encoding UTF8

Compress-Archive -Path (Join-Path $patchStage "*") -DestinationPath $patchZip -CompressionLevel Optimal

$installFirst = @'
FLEPURI v1.0.1 - INSTALL FIRST
================================

1. Install/replace the puribooth resource from this package.
2. Start existing PuriPhoto and puribooth.
3. Run puribooth_selftest from the server console.

If selftest reports PuriPhoto UI/bridge PASS:
    PuriPhoto_compat_patch.zip is NOT needed.

If selftest reports stale-ui / client-flepri-bridge / PuriPhoto UI failure:
    Open PuriPhoto_compat_patch.zip and follow README.txt.

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
    "INSTALL_FIRST.txt",
    "PuriPhoto_compat_patch.zip"
)

foreach ($relative in $required) {
    Assert-File (Join-Path $verify $relative)
}

$patchVerify = Join-Path $OutputDirectory "_verify_patch_FLEPURI_v1.0.1"
Remove-Item -LiteralPath $patchVerify -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive -LiteralPath (Join-Path $verify "PuriPhoto_compat_patch.zip") -DestinationPath $patchVerify -Force

$patchRequired = @(
    "README.txt",
    "puriphoto\fxmanifest.lua",
    "puriphoto\client\v11.lua",
    "puriphoto\ui\package.json",
    "puriphoto\ui\package-lock.json",
    "puriphoto\ui\src\App.tsx",
    "puriphoto\ui\dist\index.html",
    "puriphoto\ui\dist\assets\puriphoto-v1.1.1-flepri.js",
    "puriphoto\ui\dist\assets\index-9487c400.css"
)

foreach ($relative in $patchRequired) {
    Assert-File (Join-Path $patchVerify $relative)
}

Assert-Contains (Join-Path $patchVerify "puriphoto\ui\dist\assets\puriphoto-v1.1.1-flepri.js") "boothImportAvailable"
Assert-Contains (Join-Path $patchVerify "puriphoto\ui\dist\assets\puriphoto-v1.1.1-flepri.js") "puriphotoGetBoothImport"
Assert-Contains (Join-Path $patchVerify "puriphoto\ui\dist\assets\puriphoto-v1.1.1-flepri.js") "puriphotoConfirmBoothImport"

$unexpectedFonts = @(
    Get-ChildItem -LiteralPath $verify -File -Recurse
    Get-ChildItem -LiteralPath $patchVerify -File -Recurse
) | Where-Object { $_.Extension -match '^\.(ttf|otf|woff|woff2|eot)
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

Remove-Item -LiteralPath $patchStage -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $patchVerify -Recurse -Force -ErrorAction SilentlyContinue
 }

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
