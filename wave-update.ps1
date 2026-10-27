param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [switch]$NoFetch
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'wave/dev'
$Resources = Join-Path $ServerBase 'resources'
$Destination = Join-Path $Resources '[lb-phone]\wave'
$ExpectedSha256 = '34A84F4575F09CED45A58EF390272F9794F4D7CDCC548024A48FE5F899E16850'
$PackageParts = @(
    'wave-package.part00','wave-package.part01','wave-package.part02','wave-package.part03',
    'wave-package.part04','wave-package.part05','wave-package.part06',
    'wave-package.part07a','wave-package.part07b','wave-package.part07c','wave-package.part07d',
    'wave-package.part07e','wave-package.part07f','wave-package.part07g','wave-package.part08'
)
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

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git -C $RepoRoot @GitArgs 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        $details = @($output | ForEach-Object { $_.ToString() })
        throw "git $($GitArgs -join ' ') failed (exit $exitCode):`n$($details -join [Environment]::NewLine)"
    }

    return @($output | ForEach-Object { $_.ToString() })
}

try {
    Step 'Checking repository and test server'
    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) { throw "Git repository not found: $RepoRoot" }
    if (-not (Test-Path $Resources)) { throw "Test server resources folder not found: $Resources" }

    if (-not $NoFetch) {
        Step 'Fetching latest WAVE build'
        Invoke-RepoGit -GitArgs @('fetch','origin',$Branch) | Out-Null
    }

    $remoteRef = "origin/$Branch"
    $head = (Invoke-RepoGit -GitArgs @('rev-parse',$remoteRef) | Select-Object -First 1).Trim()
    Write-Host ("WAVE source: {0}" -f $head.Substring(0,12)) -ForegroundColor DarkGray

    Step 'Reconstructing validated package'
    New-Item -ItemType Directory -Force -Path $TempRoot,$ExtractPath,$StagePath | Out-Null
    $builder = New-Object System.Text.StringBuilder
    foreach ($path in $PackageParts) {
        $text = (Invoke-RepoGit -GitArgs @('show',"${remoteRef}:$path")) -join ''
        $text = $text.Trim()
        if ($text -notmatch '^[A-Za-z0-9+/=]+$') { throw "Invalid package data in $path" }
        [void]$builder.Append($text)
    }
    $bytes = [Convert]::FromBase64String($builder.ToString())
    [IO.File]::WriteAllBytes($ZipPath,$bytes)

    $actualHash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actualHash -ne $ExpectedSha256) {
        throw "WAVE package hash mismatch. Expected $ExpectedSha256, got $actualHash"
    }
    Write-Host 'Package SHA256: PASS' -ForegroundColor Green

    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractPath -Force
    $Source = Join-Path $ExtractPath 'wave'

    Step 'Applying WAVE v0.2.1 LB Phone bridge hotfix'
    $appJsPath = Join-Path $Source 'web\app.js'
    $appJs = [IO.File]::ReadAllText($appJsPath)
    if ($appJs -notmatch 'WAVE_BRIDGE_WAIT_V021') {
        $bridgeNeedle = "async function bridge(action, payload = {}) {`n  try {"
        $bridgeReplacement = @"
async function bridge(action, payload = {}) {
  // WAVE_BRIDGE_WAIT_V021: LB Phone injects fetchNui after the custom-app iframe starts.
  if (!hasFetchNui() && typeof GetParentResourceName !== 'function') {
    const started = performance.now();
    while (!hasFetchNui() && typeof GetParentResourceName !== 'function' && performance.now() - started < 5000) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  try {
"@
        if (-not $appJs.Contains($bridgeNeedle)) {
            throw 'Could not locate WAVE bridge insertion point.'
        }
        $appJs = $appJs.Replace($bridgeNeedle, $bridgeReplacement.TrimEnd("`r","`n"))
        [IO.File]::WriteAllText($appJsPath, $appJs, (New-Object Text.UTF8Encoding($false)))
    }

    Step 'Applying WAVE v0.2.2 save/dialog hotfix'
    $payloadParts = @('wave-v022-app.part00','wave-v022-app.part01','wave-v022-app.part02')
    $payloadBuilder = New-Object System.Text.StringBuilder
    foreach ($payloadPart in $payloadParts) {
        $payloadText = (Invoke-RepoGit -GitArgs @('show',"${remoteRef}:$payloadPart")) -join ''
        $payloadText = $payloadText.Trim()
        if ($payloadText -notmatch '^[A-Za-z0-9+/=]+    $manifestText = [IO.File]::ReadAllText($manifestPath)
    $manifestText = $manifestText.Replace("version '0.2.0-test'", "version '0.2.1-test'").Replace("version '0.2.1-test'", "version '0.2.2-test'")
    [IO.File]::WriteAllText($manifestPath, $manifestText, (New-Object Text.UTF8Encoding($false)))
    foreach ($required in @(
        'fxmanifest.lua','config\shared.lua','client\main.lua','server\main.lua',
        'web\index.html','web\app.js','web\app.css','web\icon.svg'
    )) {
        if (-not (Test-Path (Join-Path $Source $required))) { throw "Missing required WAVE file: $required" }
    }

    $manifest = Get-Content (Join-Path $Source 'fxmanifest.lua') -Raw
    if ($manifest -notmatch "version\s+'0\.2\.2-test'") { throw 'Unexpected WAVE version in fxmanifest.lua' }
    $finalAppJs = Get-Content (Join-Path $Source 'web\app.js') -Raw
    if ($finalAppJs -notmatch 'WAVE_SAFE_DIALOG_V022') { throw 'WAVE v0.2.2 app hotfix was not applied.' }
    if ($finalAppJs -match '\b(?:prompt|confirm)\s*\(') { throw 'Blocking browser prompt/confirm remains in WAVE.' }
    $css = Get-Content (Join-Path $Source 'web\app.css') -Raw
    if ($css -match '(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b') { throw 'CSS contains px units while LB Phone fixBlur is enabled.' }

    Step 'Checking duplicate WAVE resources'
    $duplicates = Get-ChildItem -LiteralPath $Resources -Recurse -Filter fxmanifest.lua -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Directory.Name -eq 'wave' -and $_.Directory.FullName -ne $Destination } |
        Select-Object -ExpandProperty DirectoryName -Unique
    if ($duplicates) {
        Write-Host 'WARNING: duplicate WAVE resource folders found:' -ForegroundColor Yellow
        $duplicates | ForEach-Object { Write-Host ('  ' + $_) -ForegroundColor Yellow }
        throw 'Remove or rename duplicate WAVE resources before installing.'
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
        Write-Host ("Backup: {0}" -f $backup) -ForegroundColor DarkGray
    }

    Step 'Deploying WAVE to the test server'
    $parent = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
    Move-Item -LiteralPath $StageWave -Destination $Destination

    $status = @(
        "branch=$Branch",
        "commit=$head",
        "sha256=$actualHash",
        "installed=$(Get-Date -Format o)"
    ) -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $Destination '.wave-build.txt') -Value $status -Encoding UTF8

    Step 'WAVE deployment complete'
    Write-Host ("Installed: {0}" -f $Destination) -ForegroundColor Green
    Write-Host ''
    Write-Host 'Run these in txAdmin:' -ForegroundColor Cyan
    Write-Host '  refresh'
    Write-Host '  ensure wave'
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
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
) { throw "Invalid WAVE v0.2.2 payload data in $payloadPart" }
        [void]$payloadBuilder.Append($payloadText)
    }
    $compressedApp = [Convert]::FromBase64String($payloadBuilder.ToString())
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
    if ($appHash -ne '1CE2C985AB072DB4F1C2B9C3D2194525EF619FF8456B154AE2DE18F513602262') {
        throw "WAVE v0.2.2 app.js hash mismatch: $appHash"
    }
    $patchedAppJs = [IO.File]::ReadAllText($appJsPath)
    if ($patchedAppJs -notmatch 'WAVE_SAFE_DIALOG_V022') { throw 'WAVE v0.2.2 marker missing.' }
    if ($patchedAppJs -match '\b(?:prompt|confirm)\s*\(') { throw 'Blocking browser prompt/confirm remains in WAVE v0.2.2.' }
    $node = Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        & $node.Source --check $appJsPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE v0.2.2 JavaScript syntax check failed.' }
    }
    $manifestPath = Join-Path $Source 'fxmanifest.lua'
    $manifestText = [IO.File]::ReadAllText($manifestPath)
    $manifestText = $manifestText.Replace("version '0.2.0-test'", "version '0.2.1-test'")
    [IO.File]::WriteAllText($manifestPath, $manifestText, (New-Object Text.UTF8Encoding($false)))
    foreach ($required in @(
        'fxmanifest.lua','config\shared.lua','client\main.lua','server\main.lua',
        'web\index.html','web\app.js','web\app.css','web\icon.svg'
    )) {
        if (-not (Test-Path (Join-Path $Source $required))) { throw "Missing required WAVE file: $required" }
    }

    $manifest = Get-Content (Join-Path $Source 'fxmanifest.lua') -Raw
    if ($manifest -notmatch "version\s+'0\.2\.1-test'") { throw 'Unexpected WAVE version in fxmanifest.lua' }
    if ((Get-Content (Join-Path $Source 'web\app.js') -Raw) -notmatch 'WAVE_BRIDGE_WAIT_V021') { throw 'WAVE LB Phone bridge hotfix was not applied.' }
    $css = Get-Content (Join-Path $Source 'web\app.css') -Raw
    if ($css -match '(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b') { throw 'CSS contains px units while LB Phone fixBlur is enabled.' }

    Step 'Checking duplicate WAVE resources'
    $duplicates = Get-ChildItem -LiteralPath $Resources -Recurse -Filter fxmanifest.lua -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Directory.Name -eq 'wave' -and $_.Directory.FullName -ne $Destination } |
        Select-Object -ExpandProperty DirectoryName -Unique
    if ($duplicates) {
        Write-Host 'WARNING: duplicate WAVE resource folders found:' -ForegroundColor Yellow
        $duplicates | ForEach-Object { Write-Host ('  ' + $_) -ForegroundColor Yellow }
        throw 'Remove or rename duplicate WAVE resources before installing.'
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
        Write-Host ("Backup: {0}" -f $backup) -ForegroundColor DarkGray
    }

    Step 'Deploying WAVE to the test server'
    $parent = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
    Move-Item -LiteralPath $StageWave -Destination $Destination

    $status = @(
        "branch=$Branch",
        "commit=$head",
        "sha256=$actualHash",
        "installed=$(Get-Date -Format o)"
    ) -join [Environment]::NewLine
    Set-Content -LiteralPath (Join-Path $Destination '.wave-build.txt') -Value $status -Encoding UTF8

    Step 'WAVE deployment complete'
    Write-Host ("Installed: {0}" -f $Destination) -ForegroundColor Green
    Write-Host ''
    Write-Host 'Run these in txAdmin:' -ForegroundColor Cyan
    Write-Host '  refresh'
    Write-Host '  ensure wave'
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
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
