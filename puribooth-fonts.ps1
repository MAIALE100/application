param(
    [string]$SearchRoot = ""
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Target = Join-Path $Root "puribooth\ui\fonts"
$LicenseTarget = Join-Path $Target "licenses"

[System.IO.Directory]::CreateDirectory($Target) | Out-Null
[System.IO.Directory]::CreateDirectory($LicenseTarget) | Out-Null

$searchRoots = @(
    $SearchRoot,
    $Root,
    (Join-Path $env:USERPROFILE "Downloads"),
    (Join-Path $env:USERPROFILE "Desktop"),
    (Join-Path $env:USERPROFILE "Documents"),
    (Join-Path $env:USERPROFILE "OneDrive\Downloads"),
    (Join-Path $env:USERPROFILE "OneDrive\Desktop")
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

function Find-DownloadedFile {
    param(
        [string]$ExactName,
        [string]$Pattern = ""
    )

    foreach ($root in $searchRoots) {
        if ($ExactName) {
            $direct = Join-Path $root $ExactName
            if (Test-Path -LiteralPath $direct) {
                return Get-Item -LiteralPath $direct
            }
        }

        $filter = if ($Pattern) { $Pattern } else { $ExactName }
        $found = Get-ChildItem -LiteralPath $root -File -Filter $filter -Recurse -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($found) { return $found }
    }

    return $null
}

function Expand-FontZip {
    param(
        [System.IO.FileInfo]$ZipFile,
        [string]$FontPattern,
        [string]$DestinationName,
        [string]$LicensePattern = "",
        [string]$LicenseName = ""
    )

    if (-not $ZipFile) { return $false }

    $temp = Join-Path $env:TEMP ("puribooth-font-" + [guid]::NewGuid().ToString("N"))
    [System.IO.Directory]::CreateDirectory($temp) | Out-Null

    try {
        Expand-Archive -LiteralPath $ZipFile.FullName -DestinationPath $temp -Force

        $font = Get-ChildItem -LiteralPath $temp -File -Filter $FontPattern -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch "\\__MACOSX\\" } |
            Select-Object -First 1

        if (-not $font) {
            Write-Warning "Font file was not found inside $($ZipFile.Name)"
            return $false
        }

        Copy-Item -LiteralPath $font.FullName -Destination (Join-Path $Target $DestinationName) -Force

        if ($LicensePattern) {
            $license = Get-ChildItem -LiteralPath $temp -File -Filter $LicensePattern -Recurse -ErrorAction SilentlyContinue |
                Select-Object -First 1
            if ($license) {
                $targetName = if ($LicenseName) { $LicenseName } else { $license.Name }
                Copy-Item -LiteralPath $license.FullName -Destination (Join-Path $LicenseTarget $targetName) -Force
            }
        }

        return $true
    }
    finally {
        Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Searching local downloads for the four FLEPURI fonts..." -ForegroundColor Cyan

$poprumZip = Find-DownloadedFile -ExactName "poprumkiwi.zip"
$galZip = Find-DownloadedFile -ExactName "galmojigothicfree.zip"
$hitoriZip = Find-DownloadedFile -ExactName "HitoriGothic.zip"
$hachiZip = Find-DownloadedFile -ExactName "Hachi_Maru_Pop.zip"

$poprumOk = Expand-FontZip -ZipFile $poprumZip -FontPattern "PopRumKiwi-Telop.ttf" -DestinationName "PopRumKiwi-Telop.ttf" -LicensePattern "*.txt" -LicenseName "PopRumKiwi-LICENSE.txt"
$galOk = Expand-FontZip -ZipFile $galZip -FontPattern "galmojigothicfree.ttf" -DestinationName "galmojigothicfree.ttf" -LicensePattern "read me SIL.txt" -LicenseName "GalMojiGothic-LICENSE.txt"
$hitoriOk = Expand-FontZip -ZipFile $hitoriZip -FontPattern "*.ttf" -DestinationName "HitoriGothic.ttf"
$hachiOk = Expand-FontZip -ZipFile $hachiZip -FontPattern "HachiMaruPop-Regular.ttf" -DestinationName "HachiMaruPop-Regular.ttf" -LicensePattern "OFL.txt" -LicenseName "HachiMaruPop-OFL.txt"

if ($poprumOk) {
    Write-Host "PopRum Kiwi Telop: imported (SIL OFL 1.1)" -ForegroundColor Green
}
else {
    Write-Warning "PopRum Kiwi Telop: poprumkiwi.zip was not found in the common folders."
}

if ($galOk) {
    Write-Host "Gal Moji Gothic Free: imported (SIL OFL 1.1)" -ForegroundColor Green
}
else {
    Write-Warning "Gal Moji Gothic Free: galmojigothicfree.zip was not found in the common folders."
}

if ($hitoriOk) {
    Write-Host "Hitori Gothic: imported" -ForegroundColor Green
}
else {
    Write-Warning "Hitori Gothic: HitoriGothic.zip was not found in the common folders."
}

if ($hachiOk) {
    Write-Host "Hachi Maru Pop: imported" -ForegroundColor Green
}
else {
    Write-Warning "Hachi Maru Pop: Hachi_Maru_Pop.zip was not found in the common folders."
}

$available = @(
    (Test-Path -LiteralPath (Join-Path $Target "PopRumKiwi-Telop.ttf")),
    (Test-Path -LiteralPath (Join-Path $Target "galmojigothicfree.ttf")),
    (Test-Path -LiteralPath (Join-Path $Target "HitoriGothic.ttf")),
    (Test-Path -LiteralPath (Join-Path $Target "HachiMaruPop-Regular.ttf"))
) | Where-Object { $_ }

Write-Host ("FLEPURI fonts ready: {0}/4" -f $available.Count) -ForegroundColor Cyan
