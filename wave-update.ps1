param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [switch]$NoFetch
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'wave/dev'
$Resources = Join-Path $ServerBase 'resources'
$Destination = Join-Path $Resources '[lb-phone]\wave'
$ExpectedBaseSha256 = '34A84F4575F09CED45A58EF390272F9794F4D7CDCC548024A48FE5F899E16850'
$ExpectedAppSha256 = '1CE2C985AB072DB4F1C2B9C3D2194525EF619FF8456B154AE2DE18F513602262'
$ExpectedVersion = '0.3.0-test'
$BaseParts = @(
    'wave-package.part00','wave-package.part01','wave-package.part02','wave-package.part03',
    'wave-package.part04','wave-package.part05','wave-package.part06',
    'wave-package.part07a','wave-package.part07b','wave-package.part07c','wave-package.part07d',
    'wave-package.part07e','wave-package.part07f','wave-package.part07g','wave-package.part08'
)
$AppParts = @('wave-v022-app.part00','wave-v022-app.part01','wave-v022-app.part02')
$PatchParts = @(
    'wave-v030-patchb64.part00','wave-v030-patchb64.part01','wave-v030-patchb64.part02',
    'wave-v030-patchb64.part03','wave-v030-patchb64.part04','wave-v030-patchb64.part05'
)
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ('wave-update-' + [guid]::NewGuid().ToString('N'))
$ZipPath = Join-Path $TempRoot 'wave.zip'
$PatchPath = Join-Path $TempRoot 'wave-v030.patch'
$ExtractPath = Join-Path $TempRoot 'extract'
$StagePath = Join-Path $TempRoot 'stage\wave'
$BackupRoot = Join-Path $RepoRoot '.wave-backups'
$DeploymentStarted = $false
$DeploymentComplete = $false
$ActiveBackup = $null
$CriticalFiles = @('fxmanifest.lua','config\shared.lua','client\main.lua','server\main.lua','web\index.html','web\app.js','web\app.css','web\icon.svg')

function Step([string]$Message) { Write-Host ''; Write-Host ('==> ' + $Message) -ForegroundColor Cyan }
function Invoke-RepoGit([string[]]$GitArgs) {
    $old=$ErrorActionPreference
    try { $ErrorActionPreference='Continue'; $out=& git -C $RepoRoot @GitArgs 2>&1; $code=$LASTEXITCODE }
    finally { $ErrorActionPreference=$old }
    if ($code -ne 0) { throw ('git ' + ($GitArgs -join ' ') + ' failed: ' + (($out | ForEach-Object {$_.ToString()}) -join [Environment]::NewLine)) }
    return @($out | ForEach-Object {$_.ToString()})
}
function Read-RemoteParts([string]$RemoteRef,[string[]]$Parts) {
    $builder=New-Object Text.StringBuilder
    foreach($part in $Parts) {
        $text=(Invoke-RepoGit @('show',($RemoteRef + ':' + $part)) -join '').Trim()
        if ($text -notmatch '^[A-Za-z0-9+/=]+$') { throw ('Invalid encoded data in ' + $part) }
        [void]$builder.Append($text)
    }
    return $builder.ToString()
}

try {
    Step 'Checking repository and test server'
    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) { throw 'Git repository not found' }
    if (-not (Test-Path $Resources)) { throw ('Test server resources folder not found: ' + $Resources) }
    if (-not $NoFetch) { Step 'Fetching latest WAVE build'; Invoke-RepoGit @('fetch','origin',$Branch) | Out-Null }
    $remoteRef='origin/' + $Branch
    $head=(Invoke-RepoGit @('rev-parse',$remoteRef) | Select-Object -First 1).Trim()
    Write-Host ('WAVE source: ' + $head.Substring(0,12)) -ForegroundColor DarkGray

    Step 'Reconstructing validated WAVE base'
    New-Item -ItemType Directory -Force -Path $TempRoot,$ExtractPath | Out-Null
    [IO.File]::WriteAllBytes($ZipPath,[Convert]::FromBase64String((Read-RemoteParts $remoteRef $BaseParts)))
    $baseHash=(Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($baseHash -ne $ExpectedBaseSha256) { throw ('WAVE base package hash mismatch: ' + $baseHash) }
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractPath -Force
    $Source=Join-Path $ExtractPath 'wave'

    Step 'Applying validated WAVE v0.2.2 app'
    $appPath=Join-Path $Source 'web\app.js'
    $compressed=[Convert]::FromBase64String((Read-RemoteParts $remoteRef $AppParts))
    $input=New-Object IO.MemoryStream(,$compressed)
    $gzip=New-Object IO.Compression.GzipStream($input,[IO.Compression.CompressionMode]::Decompress)
    $output=New-Object IO.MemoryStream
    try { $gzip.CopyTo($output); [IO.File]::WriteAllBytes($appPath,$output.ToArray()) }
    finally { $gzip.Dispose(); $input.Dispose(); $output.Dispose() }
    $appHash=(Get-FileHash $appPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($appHash -ne $ExpectedAppSha256) { throw ('WAVE v0.2.2 app hash mismatch: ' + $appHash) }
    $manifestPath=Join-Path $Source 'fxmanifest.lua'
    $manifestText=[IO.File]::ReadAllText($manifestPath)
    $manifestText=$manifestText.Replace("version '0.2.0-test'","version '0.2.2-test'")
    [IO.File]::WriteAllText($manifestPath,$manifestText,(New-Object Text.UTF8Encoding($false)))

    Step 'Applying WAVE v0.3.0 patch'
    [IO.File]::WriteAllBytes($PatchPath,[Convert]::FromBase64String((Read-RemoteParts $remoteRef $PatchParts)))
    $oldLocation=Get-Location
    try {
        Set-Location $Source
        & git apply --check --whitespace=nowarn $PatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE v0.3.0 patch preflight failed' }
        & git apply --whitespace=nowarn $PatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE v0.3.0 patch failed' }
    } finally { Set-Location $oldLocation }

    Step 'Running WAVE safety checks'
    foreach($required in $CriticalFiles) {
        if (-not (Test-Path (Join-Path $Source $required))) { throw ('Missing required WAVE file: ' + $required) }
    }
    $manifest=[IO.File]::ReadAllText((Join-Path $Source 'fxmanifest.lua'))
    if ($manifest -notmatch ("version\s+'" + [regex]::Escape($ExpectedVersion) + "'")) { throw 'Unexpected WAVE version after patch' }
    $app=[IO.File]::ReadAllText($appPath)
    if ($app -match '\b(?:prompt|confirm)\s*\(') { throw 'Blocking browser prompt/confirm found in WAVE app.js' }
    if ($app -notmatch 'WAVE_PUBLISH_DIAGNOSTICS_V023' -or $app -notmatch 'requestId') { throw 'Publish diagnostics wiring missing' }
    $server=[IO.File]::ReadAllText((Join-Path $Source 'server\main.lua'))
    if ($server -notmatch 'wave_schema_meta' -or $server -notmatch 'wave:listOwnTracks' -or $server -notmatch 'wave:updateOwnTrack') { throw 'WAVE v0.3.0 server wiring missing' }
    $config=[IO.File]::ReadAllText((Join-Path $Source 'config\shared.lua'))
    if ($config -notmatch 'SchemaVersion\s*=\s*3') { throw 'WAVE schema version mismatch' }
    $css=[IO.File]::ReadAllText((Join-Path $Source 'web\app.css'))
    if ($css -match '(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b') { throw 'CSS contains px units while LB Phone fixBlur is enabled' }
    $node=Get-Command node -ErrorAction SilentlyContinue
    if ($node) { & $node.Source --check $appPath; if ($LASTEXITCODE -ne 0) { throw 'WAVE JavaScript syntax check failed' }; Write-Host 'JavaScript syntax: PASS' -ForegroundColor Green }
    else { Write-Host 'JavaScript syntax: SKIPPED (node not found)' -ForegroundColor Yellow }

    $lua=Get-Command luac54 -ErrorAction SilentlyContinue
    if (-not $lua) { $lua=Get-Command luac5.4 -ErrorAction SilentlyContinue }
    if (-not $lua) { $lua=Get-Command luac -ErrorAction SilentlyContinue }
    if ($lua) {
        Get-ChildItem -LiteralPath $Source -Recurse -Filter '*.lua' -File | ForEach-Object {
            & $lua.Source -p $_.FullName
            if ($LASTEXITCODE -ne 0) { throw ('WAVE Lua syntax check failed: ' + $_.FullName) }
        }
        Write-Host 'Lua syntax: PASS' -ForegroundColor Green
    } else { Write-Host 'Lua syntax: SKIPPED (luac not found; CI validates Lua)' -ForegroundColor Yellow }

    Step 'Checking duplicate WAVE resources'
    $duplicates=Get-ChildItem -LiteralPath $Resources -Recurse -Filter fxmanifest.lua -File -ErrorAction SilentlyContinue | Where-Object {$_.Directory.Name -eq 'wave' -and $_.Directory.FullName -ne $Destination} | Select-Object -ExpandProperty DirectoryName -Unique
    if ($duplicates) { $duplicates | ForEach-Object {Write-Host ('  ' + $_) -ForegroundColor Yellow}; throw 'Duplicate WAVE resource found' }

    Step 'Staging WAVE resource'
    Copy-Item -LiteralPath $Source -Destination $StagePath -Recurse -Force
    if (Test-Path -LiteralPath $Destination) {
        Step 'Backing up current WAVE resource'
        New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
        $backup=Join-Path $BackupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
        Copy-Item -LiteralPath $Destination -Destination $backup -Recurse -Force
        $ActiveBackup=$backup
        Get-ChildItem -LiteralPath $BackupRoot -Directory | Sort-Object Name -Descending | Select-Object -Skip 5 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    }

    Step 'Deploying WAVE to the test server'
    $DeploymentStarted=$true
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
    if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
    Move-Item -LiteralPath $StagePath -Destination $Destination

    Step 'Verifying deployed WAVE resource'
    foreach($relative in $CriticalFiles) {
        $sourceFile=Join-Path $Source $relative
        $deployedFile=Join-Path $Destination $relative
        if (-not (Test-Path -LiteralPath $deployedFile)) { throw ('Deployed WAVE file missing: ' + $relative) }
        $sourceHash=(Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash
        $deployedHash=(Get-FileHash -LiteralPath $deployedFile -Algorithm SHA256).Hash
        if ($sourceHash -ne $deployedHash) { throw ('Deployed WAVE file verification failed: ' + $relative) }
    }
    @('branch=' + $Branch,'commit=' + $head,'base_sha256=' + $baseHash,'version=' + $ExpectedVersion,'installed=' + (Get-Date -Format o)) | Set-Content -LiteralPath (Join-Path $Destination '.wave-build.txt') -Encoding UTF8
    $DeploymentComplete=$true
    Write-Host 'Deployment verification: PASS' -ForegroundColor Green

    Step 'WAVE deployment complete'
    Write-Host ('Installed: ' + $Destination) -ForegroundColor Green
    Write-Host 'txAdmin: refresh ; restart wave ; wave_selftest' -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host ''
    Write-Host ('WAVE UPDATE FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    if ($DeploymentStarted -and -not $DeploymentComplete -and $ActiveBackup -and (Test-Path -LiteralPath $ActiveBackup)) {
        Write-Host 'Restoring previous WAVE resource...' -ForegroundColor Yellow
        try {
            if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination -Recurse -Force }
            Copy-Item -LiteralPath $ActiveBackup -Destination $Destination -Recurse -Force
            Write-Host 'Previous WAVE resource restored.' -ForegroundColor Green
        } catch {
            Write-Host ('ROLLBACK FAILED: ' + $_.Exception.Message) -ForegroundColor Red
        }
    }
    exit 1
}
finally { if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue } }
