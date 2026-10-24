param(
    [string]$Branch = 'release/party-v1.0.0-candidate'
)

$ErrorActionPreference = 'Stop'
$MainRepo = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoParent = Split-Path -Parent $MainRepo
$Worktree = Join-Path $RepoParent '_flecity_games_party_release'
$OutputRepo = $MainRepo
$PrimaryRepo = Join-Path $RepoParent 'application'
if ((Split-Path -Leaf $MainRepo) -eq '_flecity_games_manual' -and (Test-Path (Join-Path $PrimaryRepo '.git'))) {
    $OutputRepo = $PrimaryRepo
}
$OutputDir = Join-Path $OutputRepo 'dist'
$PartyVersion = '1.0.0'
$ResourceVersion = '1.1.0'
$ZipName = "flecity-games-party-$PartyVersion.zip"
$SubmissionMessageName = 'PARTY_運営提出文.txt'

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
    foreach ($prefix in @('tools','release_docs')) {
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
    Step 'Fetching frozen PARTY release candidate'
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

    Step 'Staging production LOOP + PARTY resource'
    $sourceResource = Join-Path $Worktree 'flecity_games'
    if (-not (Test-Path -LiteralPath $sourceResource)) {
        throw "Frozen resource was not found: $sourceResource"
    }

    $stageRoot = Join-Path $Worktree '.party_release_stage'
    $stageResource = Join-Path $stageRoot 'flecity_games'
    if (Test-Path -LiteralPath $stageRoot) {
        Remove-Item -LiteralPath $stageRoot -Recurse -Force
    }
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

    Step 'Patching production manifest and diagnostics'
    $manifestPath = Join-Path $stageResource 'fxmanifest.lua'
    Require-File $manifestPath 'fxmanifest.lua'
    $manifest = Get-Content -LiteralPath $manifestPath -Raw
    $manifest = [regex]::Replace(
        $manifest,
        "(?m)^description '.+'\r?$",
        "description 'Flecity Games LOOP + PARTY - LB Phone game apps'"
    )
    $manifest = [regex]::Replace(
        $manifest,
        "(?m)^version '.+'\r?$",
        "version '$ResourceVersion'"
    )
    $manifest = [regex]::Replace(
        $manifest,
        "(?m)^\s*'server/core/dev_reload\.lua',\r?\n",
        ''
    )
    Write-Utf8NoBom -Path $manifestPath -Text $manifest

    $serverMainPath = Join-Path $stageResource 'server\main.lua'
    Require-File $serverMainPath 'server/main.lua'
    $serverMain = Get-Content -LiteralPath $serverMainPath -Raw
    $serverMain = [regex]::Replace(
        $serverMain,
        "local buildCommit=FlecityGamesText\.Normalize\(LoadResourceFile\(GetCurrentResourceName\(\),'dev-build\.txt'\) or ''\)\r?\n\s*if buildCommit=='' then buildCommit='packaged' end",
        "local buildCommit='packaged'"
    )
    $serverMain = [regex]::Replace(
        $serverMain,
        "local build=FlecityGamesText\.Normalize\(LoadResourceFile\(GetCurrentResourceName\(\),'dev-build\.txt'\) or ''\)\r?\n\s*if build=='' then build='packaged' end",
        "local build='packaged'"
    )
    Write-Utf8NoBom -Path $serverMainPath -Text $serverMain

    Step 'Adding operator submission documents'
    $docsSource = Join-Path $sourceResource 'release_docs'
    $docs = @(
        @('PARTY_INSTALL_JA.txt','PARTY_導入方法_運営様向け.txt'),
        @('PARTY_OPERATOR_CHECKLIST_JA.txt','PARTY_運営確認用メモ.txt'),
        @('PARTY_QA_RESULT_JA.txt','PARTY_提出前確認結果.txt')
    )
    foreach ($pair in $docs) {
        $src = Join-Path $docsSource $pair[0]
        Require-File $src $pair[0]
        Copy-Item -LiteralPath $src -Destination (Join-Path $stageResource $pair[1]) -Force
    }

    $buildInfo = @(
        "Flecity Games PARTY $PartyVersion",
        "Resource version: $ResourceVersion",
        "Source commit: $commit",
        'Build type: production submission candidate',
        'LOOP: enabled, v1.0.0 compatibility retained',
        'PARTY: enabled, free App Store download',
        'PARTY+: 7 days / 50,000 / WEAZEL revenue account',
        'Development auto-reload/tools: excluded'
    ) -join [Environment]::NewLine
    Write-Utf8NoBom -Path (Join-Path $stageResource 'BUILD_INFO.txt') -Text ($buildInfo + [Environment]::NewLine)

    Step 'Validating submission contents'
    foreach ($relative in @(
        'fxmanifest.lua',
        'config\shared.lua',
        'client\main.lua',
        'server\main.lua',
        'server\bridge\framework.lua',
        'server\core\play.lua',
        'server\core\party.lua',
        'server\core\party_plus.lua',
        'server\core\party_fall.lua',
        'server\data\party_plus_prompts.lua',
        'web\play\index.html',
        'web\play\app.js',
        'web\play\icon.svg',
        'web\party\index.html',
        'web\party\app.js',
        'web\party\icon.svg',
        'sql\001_initial.sql',
        'PARTY_導入方法_運営様向け.txt',
        'PARTY_運営確認用メモ.txt',
        'PARTY_提出前確認結果.txt',
        'BUILD_INFO.txt'
    )) {
        Require-File (Join-Path $stageResource $relative) $relative
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw
    $configPath = Join-Path $stageResource 'config\shared.lua'
    $config = Get-Content -LiteralPath $configPath -Raw
    $serverMain = Get-Content -LiteralPath $serverMainPath -Raw
    $framework = Get-Content -LiteralPath (Join-Path $stageResource 'server\bridge\framework.lua') -Raw
    $partyPlus = Get-Content -LiteralPath (Join-Path $stageResource 'server\core\party_plus.lua') -Raw

    if ($manifest -notmatch "version '1\.1\.0'" -or $manifest -match '-test') {
        throw 'Release manifest version is not production-safe.'
    }
    if ($manifest -match 'server/core/dev_reload\.lua') {
        throw 'Development reload script remains in release manifest.'
    }
    foreach ($devPath in @(
        'server\core\dev_reload.lua',
        'tools',
        'release_docs',
        'TESTING.md',
        'dev-build.txt',
        'runtime-active.txt',
        'dev-runtime.txt'
    )) {
        if (Test-Path -LiteralPath (Join-Path $stageResource $devPath)) {
            throw "Development-only content remains in release: $devPath"
        }
    }
    if ($serverMain -match 'dev-build\.txt|runtime-active\.txt') {
        throw 'Development build marker logic remains in release server/main.lua.'
    }

    if ($config -notmatch "(?s)Play\s*=\s*\{.*?enabled\s*=\s*true.*?identifier\s*=\s*'flecity_play'.*?name\s*=\s*'LOOP'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0") {
        throw 'LOOP App Store configuration changed unexpectedly.'
    }
    if ($config -notmatch "(?s)Party\s*=\s*\{.*?enabled\s*=\s*true.*?identifier\s*=\s*'flecity_party'.*?name\s*=\s*'PARTY'.*?defaultApp\s*=\s*false.*?game\s*=\s*true.*?price\s*=\s*0") {
        throw 'PARTY App Store configuration is not production-safe.'
    }
    if ($config -notmatch "(?s)PartyPlus\s*=\s*\{.*?Enabled\s*=\s*true.*?Price\s*=\s*50000.*?DurationSeconds\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60.*?MoneyType\s*=\s*'bank'.*?RevenueAccount\s*=\s*'weazel'.*?RevenueProvider\s*=\s*'auto'") {
        throw 'PARTY+ release configuration is not the approved 7-day / 50,000 / WEAZEL setup.'
    }

    foreach ($requiredText in @(
        "exports['Renewed-Banking']:addAccountMoney",
        "exports['Renewed-Banking']:removeAccountMoney",
        "exports['qb-banking']:AddMoney",
        "exports['qb-banking']:RemoveMoney"
    )) {
        if (-not $framework.Contains($requiredText)) {
            throw "Society banking adapter missing: $requiredText"
        }
    }
    if ($partyPlus -notmatch 'depositRevenue' -or
        $partyPlus -notmatch 'REVENUE_DEPOSIT_FAILED' -or
        $partyPlus -notmatch 'reverseRevenue' -or
        $partyPlus -notmatch 'refund') {
        throw 'PARTY+ revenue safety/rollback logic is incomplete.'
    }

    $installDoc = Get-Content -LiteralPath (Join-Path $stageResource 'PARTY_導入方法_運営様向け.txt') -Raw
    $checkDoc = Get-Content -LiteralPath (Join-Path $stageResource 'PARTY_運営確認用メモ.txt') -Raw
    if ($installDoc -match '経済sink' -or $checkDoc -match '経済sink') {
        throw 'Outdated economy-sink wording remains in operator documents.'
    }

    Step 'Creating ZIP, SHA256 and operator message'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

    $targetZip = Join-Path $OutputDir $ZipName
    $targetChecksum = $targetZip + '.sha256'
    $targetMessage = Join-Path $OutputDir $SubmissionMessageName

    foreach ($path in @($targetZip,$targetChecksum,$targetMessage)) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }

    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $stageRoot,
        $targetZip,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    $hash = (Get-FileHash -LiteralPath $targetZip -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath $targetChecksum -Value ("{0}  {1}" -f $hash,$ZipName) -Encoding ASCII

    $submissionSource = Join-Path $docsSource 'PARTY_SUBMISSION_MESSAGE_JA.txt'
    Require-File $submissionSource 'PARTY_SUBMISSION_MESSAGE_JA.txt'
    Copy-Item -LiteralPath $submissionSource -Destination $targetMessage -Force

    Write-Host ''
    Write-Host 'PARTY v1.0.0 submission candidate is ready.' -ForegroundColor Green
    Write-Host ("ZIP     : {0}" -f $targetZip)
    Write-Host ("SHA256  : {0}  {1}" -f $hash,$ZipName)
    Write-Host ("MESSAGE : {0}" -f $targetMessage)
    Write-Host ("SOURCE  : {0}" -f $commit)
    Write-Host ''
    Write-Host 'Submission package validation: PASS' -ForegroundColor Green
    Write-Host 'Live multiplayer QA is still required before final submission.' -ForegroundColor Yellow
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('RELEASE BUILD FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
