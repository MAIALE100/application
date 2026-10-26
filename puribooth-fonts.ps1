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

Write-Host "Searching local downloads for the three PuriBooth fonts..." -ForegroundColor Cyan

$heiseiZip = Find-DownloadedFile -ExactName "HeiseijyojiFont__15_.zip"
$hitoriZip = Find-DownloadedFile -ExactName "HitoriGothic.zip"
$hachiZip = Find-DownloadedFile -ExactName "Hachi_Maru_Pop.zip"

$heiseiOk = Expand-FontZip -ZipFile $heiseiZip -FontPattern "*.otf" -DestinationName "HeiseijyojiFont.otf"
$hitoriOk = Expand-FontZip -ZipFile $hitoriZip -FontPattern "*.ttf" -DestinationName "HitoriGothic.ttf"
$hachiOk = Expand-FontZip -ZipFile $hachiZip -FontPattern "HachiMaruPop-Regular.ttf" -DestinationName "HachiMaruPop-Regular.ttf" -LicensePattern "OFL.txt" -LicenseName "HachiMaruPop-OFL.txt"

if ($heiseiOk) {
    Write-Host "平成女児★ふぉんと: imported for local testing" -ForegroundColor Green
    Write-Warning "平成女児★ふぉんとは、正式配布・アプリ埋め込み前に作者への連絡が必要です。GitHubにはフォント本体を保存しません。"
}
else {
    Write-Warning "平成女児★ふぉんと: HeiseijyojiFont__15_.zip was not found in the common folders."
}

if ($hitoriOk) {
    Write-Host "ひとりゴシック: imported" -ForegroundColor Green
}
else {
    Write-Warning "ひとりゴシック: HitoriGothic.zip was not found in the common folders."
}

if ($hachiOk) {
    Write-Host "Hachi Maru Pop: imported" -ForegroundColor Green
}
else {
    Write-Warning "Hachi Maru Pop: Hachi_Maru_Pop.zip was not found in the common folders."
}

$available = @(
    (Test-Path -LiteralPath (Join-Path $Target "HeiseijyojiFont.otf")),
    (Test-Path -LiteralPath (Join-Path $Target "HitoriGothic.ttf")),
    (Test-Path -LiteralPath (Join-Path $Target "HachiMaruPop-Regular.ttf"))
) | Where-Object { $_ }

Write-Host ("PuriBooth fonts ready: {0}/3" -f $available.Count) -ForegroundColor Cyan
