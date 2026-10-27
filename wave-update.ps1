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

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = 'git'
    $psi.WorkingDirectory = $RepoRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    [void]$psi.ArgumentList.Add('-C')
    [void]$psi.ArgumentList.Add($RepoRoot)
    foreach ($arg in $GitArgs) {
        [void]$psi.ArgumentList.Add([string]$arg)
    }

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()

    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    if ($process.ExitCode -ne 0) {
        $details = @($stdout.Trim(), $stderr.Trim()) | Where-Object { $_ }
        throw "git $($GitArgs -join ' ') failed (exit $($process.ExitCode)):`n$($details -join [Environment]::NewLine)"
    }

    if ($stdout) {
        return @($stdout -split "\r?\n" | Where-Object { $_ -ne '' })
    }

    return @()
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
    foreach ($required in @(
        'fxmanifest.lua','config\shared.lua','client\main.lua','server\main.lua',
        'web\index.html','web\app.js','web\app.css','web\icon.svg'
    )) {
        if (-not (Test-Path (Join-Path $Source $required))) { throw "Missing required WAVE file: $required" }
    }

    $manifest = Get-Content (Join-Path $Source 'fxmanifest.lua') -Raw
    if ($manifest -notmatch "version\s+'0\.2\.0-test'") { throw 'Unexpected WAVE version in fxmanifest.lua' }
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
