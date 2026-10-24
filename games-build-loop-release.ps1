param(
    [string]$Branch = 'release/loop-v1.0.0'
)

$ErrorActionPreference = 'Stop'
$MainRepo = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoParent = Split-Path -Parent $MainRepo
$Worktree = Join-Path $RepoParent '_flecity_games_release'
$OutputRepo = $MainRepo
$PrimaryRepo = Join-Path $RepoParent 'application'
if ((Split-Path -Leaf $MainRepo) -eq '_flecity_games_manual' -and (Test-Path (Join-Path $PrimaryRepo '.git'))) {
    $OutputRepo = $PrimaryRepo
}
$OutputDir = Join-Path $OutputRepo 'dist'
$ReleaseVersion = '1.0.0'
$ZipName = "flecity-games-loop-$ReleaseVersion.zip"

function Step([string]$Message) {
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Invoke-Git([string]$Repo, [string[]]$GitArgs) {
    $old = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git -C $Repo @GitArgs 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $old
    }
    if ($code -ne 0) {
        throw ('git {0} failed: {1}' -f ($GitArgs -join ' '), (($output | Out-String).Trim()))
    }
    return (($output | Out-String).Trim())
}

function Is-ExcludedReleasePath([string]$RelativePath) {
    $rel = $RelativePath.Replace('\','/')
    $excludedFiles = @(
        'README.md',
        'INSTALL.md',
        'TESTING.md',
        'server/core/dev_reload.lua',
        'web/play/icon.png',
        'dev-auto-reload.enabled',
        'dev-reload.token',
        'dev-reload-v2.active',
        'dev-runtime.txt',
        'runtime-active.txt',
        'dev-build.txt'
    )
    if ($excludedFiles -contains $rel) { return $true }
    foreach ($prefix in @('tools','release_docs','web/party')) {
        if ($rel -eq $prefix -or $rel.StartsWith($prefix + '/')) { return $true }
    }
    return $false
}

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path,$Text,$encoding)
}

function Require-File([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Release validation missing $Label : $Path"
    }
}

try {
    Step 'Fetching frozen LOOP source'
    if (-not (Test-Path (Join-Path $MainRepo '.git'))) {
        throw "Git repository was not found: $MainRepo"
    }

    Invoke-Git -Repo $MainRepo -GitArgs @('fetch','--prune','origin',$Branch) | Out-Null

    if (Test-Path -LiteralPath $Worktree) {
        if (-not (Test-Path -LiteralPath (Join-Path $Worktree '.git'))) {
            throw "Release worktree path exists but is not a Git worktree: $Worktree"
        }
    }
    else {
        Invoke-Git -Repo $MainRepo -GitArgs @('worktree','add','--detach',$Worktree,"origin/$Branch") | Out-Null
    }

    Invoke-Git -Repo $Worktree -GitArgs @('fetch','--prune','origin',$Branch) | Out-Null
    Invoke-Git -Repo $Worktree -GitArgs @('reset','--hard',"origin/$Branch") | Out-Null
    Invoke-Git -Repo $Worktree -GitArgs @('clean','-fd') | Out-Null

    $commit = (Invoke-Git -Repo $Worktree -GitArgs @('rev-parse','HEAD')).Trim()
    Write-Host ("Source commit: {0}" -f $commit) -ForegroundColor Green

    Step 'Staging production-only LOOP resource'
    $sourceResource = Join-Path $Worktree 'flecity_games'
    if (-not (Test-Path -LiteralPath $sourceResource)) {
        throw "Frozen resource was not found: $sourceResource"
    }

    $stageRoot = Join-Path $Worktree '.loop_release_stage'
    $stageResource = Join-Path $stageRoot 'flecity_games'
    if (Test-Path -LiteralPath $stageRoot) { Remove-Item -LiteralPath $stageRoot -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $stageResource | Out-Null

    foreach ($file in Get-ChildItem -LiteralPath $sourceResource -Recurse -File) {
        $relative = $file.FullName.Substring($sourceResource.Length).TrimStart('\')
        if (Is-ExcludedReleasePath $relative) { continue }
        $target = Join-Path $stageResource $relative
        $targetDir = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $targetDir)) {
            New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
        }
        Copy-Item -LiteralPath $file.FullName -Destination $target -Force
    }

    Step 'Patching LOOP v1.0.0 production configuration'
    $manifestPath = Join-Path $stageResource 'fxmanifest.lua'
    Require-File $manifestPath 'fxmanifest.lua'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw
    $manifest = [regex]::Replace($manifest,"(?m)^description '.+'\r?$","description 'Flecity Games LOOP - LB Phone mini-game app'")
    $manifest = [regex]::Replace($manifest,"(?m)^version '.+'\r?$","version '$ReleaseVersion'")
    $manifest = [regex]::Replace($manifest,"(?m)^\s*'server/core/dev_reload\.lua',\r?\n",'')
    Write-Utf8NoBom -Path $manifestPath -Text $manifest

    $configPath = Join-Path $stageResource 'config\shared.lua'
    Require-File $configPath 'config/shared.lua'
    $config = Get-Content -LiteralPath $configPath -Raw
    $partyStart = $config.IndexOf('        Party = {')
    if ($partyStart -lt 0) { throw 'Party app config block start not found.' }

    $nextSection = $config.IndexOf('    Play = {',$partyStart)
    if ($nextSection -lt 0) { throw 'Play config section after Party app block not found.' }

    $partyRegion = $config.Substring($partyStart,$nextSection-$partyStart)
    $partyClose = $partyRegion.LastIndexOf('        }')
    if ($partyClose -lt 0) { throw 'Party app config block end not found.' }

    $partyBlockLength = $partyClose + ('        }').Length
    $partyBlock = $partyRegion.Substring(0,$partyBlockLength)
    if ($partyBlock -notmatch 'enabled\s*=\s*true' -or $partyBlock -notmatch 'defaultApp\s*=\s*true') {
        throw 'Party app config flags were not found.'
    }

    $partyBlock = [regex]::Replace($partyBlock,'enabled\s*=\s*true','enabled = false',1)
    $partyBlock = [regex]::Replace($partyBlock,'defaultApp\s*=\s*true','defaultApp = false',1)
    $config = $config.Substring(0,$partyStart) + $partyBlock + $config.Substring($partyStart+$partyBlockLength)
    Write-Utf8NoBom -Path $configPath -Text $config

    $serverMainPath = Join-Path $stageResource 'server\main.lua'
    Require-File $serverMainPath 'server/main.lua'
    $serverMain = Get-Content -LiteralPath $serverMainPath -Raw
    $startupMarker = 'math.randomseed(os.time()+GetGameTimer())'
    $markerIndex = $serverMain.IndexOf($startupMarker)
    if ($markerIndex -lt 0) { throw 'server/main.lua startup marker was not found.' }
    $prefix = $serverMain.Substring(0,$markerIndex)
    if ($prefix -notmatch 'runtime-active\.txt') { throw 'Development runtime stamp block was not found.' }
    $serverMain = $serverMain.Substring($markerIndex)
    Write-Utf8NoBom -Path $serverMainPath -Text $serverMain

    Step 'Adding operator documents'
    $docsSource = Join-Path $sourceResource 'release_docs'
    $docs = @(
        @('INSTALL_JA.txt','導入方法_運営様向け.txt'),
        @('OPERATOR_CHECKLIST_JA.txt','運営確認用メモ.txt'),
        @('QA_RESULT_JA.txt','提出前確認結果.txt')
    )
    foreach ($pair in $docs) {
        $src = Join-Path $docsSource $pair[0]
        Require-File $src $pair[0]
        Copy-Item -LiteralPath $src -Destination (Join-Path $stageResource $pair[1]) -Force
    }

    $buildInfo = @(
        "Flecity Games LOOP $ReleaseVersion",
        "Source commit: $commit",
        'Build type: production submission',
        'PARTY custom app: disabled in this submission build',
        'Development auto-reload/tools: excluded'
    ) -join [Environment]::NewLine
    Write-Utf8NoBom -Path (Join-Path $stageResource 'BUILD_INFO.txt') -Text ($buildInfo + [Environment]::NewLine)

    Step 'Validating submission contents'
    foreach ($relative in @(
        'fxmanifest.lua',
        'client\main.lua',
        'server\main.lua',
        'server\core\play.lua',
        'web\play\index.html',
        'web\play\app.js',
        'web\play\icon.svg',
        'sql\001_initial.sql',
        '導入方法_運営様向け.txt',
        '運営確認用メモ.txt',
        '提出前確認結果.txt'
    )) {
        Require-File (Join-Path $stageResource $relative) $relative
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw
    $config = Get-Content -LiteralPath $configPath -Raw
    $serverMain = Get-Content -LiteralPath $serverMainPath -Raw

    if ($manifest -notmatch "version '1\.0\.0'" -or $manifest -match '-test') {
        throw 'Release manifest version is not production-safe.'
    }
    if ($manifest -match 'server/core/dev_reload\.lua') {
        throw 'Development reload script remains in release manifest.'
    }
    if (Test-Path -LiteralPath (Join-Path $stageResource 'server\core\dev_reload.lua')) {
        throw 'Development reload script remains in release tree.'
    }
    if (Test-Path -LiteralPath (Join-Path $stageResource 'tools')) {
        throw 'Development tools remain in release tree.'
    }
    if (Test-Path -LiteralPath (Join-Path $stageResource 'web\party')) {
        throw 'PARTY web UI remains in LOOP release.'
    }
    if ($serverMain -match 'runtime-active\.txt|dev-build\.txt') {
        throw 'Development runtime marker logic remains in release server/main.lua.'
    }
    if ($config -notmatch '(?s)Party\s*=\s*\{.*?enabled\s*=\s*false.*?defaultApp\s*=\s*false') {
        throw 'PARTY app is not disabled in release config.'
    }
    if ($config -notmatch "(?s)Play\s*=\s*\{.*?enabled\s*=\s*true.*?name\s*=\s*'LOOP'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0") {
        throw 'LOOP App Store configuration is not production-safe.'
    }

    Step 'Creating ZIP and SHA256'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $targetZip = Join-Path $OutputDir $ZipName
    $targetChecksum = $targetZip + '.sha256'
    if (Test-Path -LiteralPath $targetZip) { Remove-Item -LiteralPath $targetZip -Force }
    if (Test-Path -LiteralPath $targetChecksum) { Remove-Item -LiteralPath $targetChecksum -Force }

    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stageRoot,
        $targetZip,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    $hash = (Get-FileHash -LiteralPath $targetZip -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath $targetChecksum -Value ("{0}  {1}" -f $hash,$ZipName) -Encoding ASCII

    Write-Host ''
    Write-Host 'LOOP v1.0.0 submission package is ready.' -ForegroundColor Green
    Write-Host ("ZIP    : {0}" -f $targetZip)
    Write-Host ("SHA256 : {0}  {1}" -f $hash,$ZipName)
    Write-Host ("SOURCE : {0}" -f $commit)
    Write-Host ''
    Write-Host 'Production validation: PASS' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('RELEASE BUILD FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
