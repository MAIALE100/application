param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [switch]$NoFetch
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'wave/dev'
$Resources = Join-Path $ServerBase 'resources'
$Destination = Join-Path $Resources '[lb-phone]\wave'
$ExpectedPackageSha256 = '34A84F4575F09CED45A58EF390272F9794F4D7CDCC548024A48FE5F899E16850'
$ExpectedAppSha256 = '1CE2C985AB072DB4F1C2B9C3D2194525EF619FF8456B154AE2DE18F513602262'
$PackageParts = @(
    'wave-package.part00','wave-package.part01','wave-package.part02','wave-package.part03',
    'wave-package.part04','wave-package.part05','wave-package.part06',
    'wave-package.part07a','wave-package.part07b','wave-package.part07c','wave-package.part07d',
    'wave-package.part07e','wave-package.part07f','wave-package.part07g','wave-package.part08'
)
$AppParts = @('wave-v022-app.part00','wave-v022-app.part01','wave-v022-app.part02')
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ('wave-update-' + [guid]::NewGuid().ToString('N'))
$ZipPath = Join-Path $TempRoot 'wave.zip'
$ExtractPath = Join-Path $TempRoot 'extract'
$StagePath = Join-Path $TempRoot 'stage'
$BackupRoot = Join-Path $RepoRoot '.wave-backups'

function Step([string]$Message) {
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Invoke-RepoGit {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArgs
    )

    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git -C $RepoRoot @GitArgs 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }

    if ($exitCode -ne 0) {
        $details = @($output | ForEach-Object { $_.ToString() })
        throw ('git ' + ($GitArgs -join ' ') + ' failed (exit ' + $exitCode + '): ' + ($details -join [Environment]::NewLine))
    }

    return @($output | ForEach-Object { $_.ToString() })
}

function Read-RemoteTextParts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteRef,
        [Parameter(Mandatory = $true)]
        [string[]]$Parts
    )

    $builder = New-Object System.Text.StringBuilder
    foreach ($part in $Parts) {
        $spec = $RemoteRef + ':' + $part
        $text = (Invoke-RepoGit -GitArgs @('show',$spec)) -join ''
        $text = $text.Trim()
        if ($text -notmatch '^[A-Za-z0-9+/=]+$') {
            throw ('Invalid encoded data in ' + $part)
        }
        [void]$builder.Append($text)
    }
    return $builder.ToString()
}

try {
    Step 'Checking repository and test server'
    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) {
        throw ('Git repository not found: ' + $RepoRoot)
    }
    if (-not (Test-Path $Resources)) {
        throw ('Test server resources folder not found: ' + $Resources)
    }

    if (-not $NoFetch) {
        Step 'Fetching latest WAVE build'
        Invoke-RepoGit -GitArgs @('fetch','origin',$Branch) | Out-Null
    }

    $remoteRef = 'origin/' + $Branch
    $head = (Invoke-RepoGit -GitArgs @('rev-parse',$remoteRef) | Select-Object -First 1).Trim()
    Write-Host ('WAVE source: ' + $head.Substring(0,12)) -ForegroundColor DarkGray

    Step 'Reconstructing validated WAVE base package'
    New-Item -ItemType Directory -Force -Path $TempRoot,$ExtractPath,$StagePath | Out-Null
    $packageBase64 = Read-RemoteTextParts -RemoteRef $remoteRef -Parts $PackageParts
    $packageBytes = [Convert]::FromBase64String($packageBase64)
    [IO.File]::WriteAllBytes($ZipPath,$packageBytes)

    $packageHash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($packageHash -ne $ExpectedPackageSha256) {
        throw ('WAVE base package hash mismatch. Expected ' + $ExpectedPackageSha256 + ', got ' + $packageHash)
    }
    Write-Host 'Base package SHA256: PASS' -ForegroundColor Green

    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractPath -Force
    $Source = Join-Path $ExtractPath 'wave'

    Step 'Applying WAVE v0.2.2 application build'
    $appJsPath = Join-Path $Source 'web\app.js'
    $appPayloadBase64 = Read-RemoteTextParts -RemoteRef $remoteRef -Parts $AppParts
    $compressedApp = [Convert]::FromBase64String($appPayloadBase64)

    $inputStream = New-Object IO.MemoryStream(,$compressedApp)
    $gzipStream = New-Object IO.Compression.GzipStream($inputStream,[IO.Compression.CompressionMode]::Decompress)
    $outputStream = New-Object IO.MemoryStream
    try {
        $gzipStream.CopyTo($outputStream)
        $appBytes = $outputStream.ToArray()
    }
    finally {
        $gzipStream.Dispose()
        $inputStream.Dispose()
        $outputStream.Dispose()
    }

    [IO.File]::WriteAllBytes($appJsPath,$appBytes)
    $appHash = (Get-FileHash $appJsPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($appHash -ne $ExpectedAppSha256) {
        throw ('WAVE v0.2.2 app.js hash mismatch. Expected ' + $ExpectedAppSha256 + ', got ' + $appHash)
    }
    Write-Host 'v0.2.2 app.js SHA256: PASS' -ForegroundColor Green

    $manifestPath = Join-Path $Source 'fxmanifest.lua'
    $manifestText = [IO.File]::ReadAllText($manifestPath)
    $manifestText = $manifestText.Replace("version '0.2.0-test'", "version '0.2.2-test'")
    [IO.File]::WriteAllText($manifestPath,$manifestText,(New-Object Text.UTF8Encoding($false)))

    Step 'Running WAVE safety checks'
    foreach ($required in @(
        'fxmanifest.lua','config\shared.lua','client\main.lua','server\main.lua',
        'web\index.html','web\app.js','web\app.css','web\icon.svg'
    )) {
        if (-not (Test-Path (Join-Path $Source $required))) {
            throw ('Missing required WAVE file: ' + $required)
        }
    }

    $manifest = Get-Content $manifestPath -Raw
    if ($manifest -notmatch "version\s+'0\.2\.2-test'") {
        throw 'Unexpected WAVE version in fxmanifest.lua'
    }

    $finalAppJs = Get-Content $appJsPath -Raw
    if ($finalAppJs -notmatch 'WAVE_SAFE_DIALOG_V022') {
        throw 'WAVE v0.2.2 marker missing from app.js'
    }
    if ($finalAppJs -match '\b(?:prompt|confirm)\s*\(') {
        throw 'Blocking browser prompt/confirm remains in WAVE app.js'
    }

    $css = Get-Content (Join-Path $Source 'web\app.css') -Raw
    if ($css -match '(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b') {
        throw 'CSS contains px units while LB Phone fixBlur is enabled'
    }

    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        & $node.Source --check $appJsPath
        if ($LASTEXITCODE -ne 0) {
            throw 'WAVE JavaScript syntax check failed'
        }
        Write-Host 'JavaScript syntax: PASS' -ForegroundColor Green
    }

    Step 'Checking duplicate WAVE resources'
    $duplicates = Get-ChildItem -LiteralPath $Resources -Recurse -Filter fxmanifest.lua -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Directory.Name -eq 'wave' -and $_.Directory.FullName -ne $Destination } |
        Select-Object -ExpandProperty DirectoryName -Unique

    if ($duplicates) {
        Write-Host 'WARNING: duplicate WAVE resource folders found:' -ForegroundColor Yellow
        $duplicates | ForEach-Object { Write-Host ('  ' + $_) -ForegroundColor Yellow }
        throw 'Remove or rename duplicate WAVE resources before installing'
    }

    Step 'Staging WAVE resource'
    $StageWave = Join-Path $StagePath 'wave'
    Copy-Item -LiteralPath $Source -Destination $StageWave -Recurse -Force

    if (Test-Path -LiteralPath $Destination) {
        Step 'Backing up current WAVE resource'
        New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = Join-Path $BackupRoot $stamp
        Copy-Item -LiteralPath $Destination -Destination $backup -Recurse -Force
        Write-Host ('Backup: ' + $backup) -ForegroundColor DarkGray
    }

    Step 'Deploying WAVE to the test server'
    $parent = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    Move-Item -LiteralPath $StageWave -Destination $Destination

    $status = @(
        'branch=' + $Branch,
        'commit=' + $head,
        'base_sha256=' + $packageHash,
        'app_sha256=' + $appHash,
        'installed=' + (Get-Date -Format o)
    ) -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $Destination '.wave-build.txt') -Value $status -Encoding UTF8

    Step 'WAVE deployment complete'
    Write-Host ('Installed: ' + $Destination) -ForegroundColor Green
    Write-Host ''
    Write-Host 'Run these in txAdmin:' -ForegroundColor Cyan
    Write-Host '  refresh'
    Write-Host '  restart wave'
    Write-Host '  wave_selftest'
    Write-Host ''
    Write-Host 'Expected: [WAVE] SELFTEST PASS' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('WAVE UPDATE FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
