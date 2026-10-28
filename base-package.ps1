param([string]$OutputDirectory = '')

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = "base/workspace-dev"
$Dist = if ($OutputDirectory -ne '') { [IO.Path]::GetFullPath($OutputDirectory) } else { Join-Path $RepoRoot "dist" }
$Temp = Join-Path $env:TEMP ("flecity_base_package_" + $PID)

function Run-Git {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
    & git -C $RepoRoot @Args
    if ($LASTEXITCODE -ne 0) { throw "git failed: $($Args -join ' ')" }
}

try {
    Write-Host ""
    Write-Host "==> Fetching BASE submission candidate"
    Run-Git fetch --prune origin $Branch

    if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    Run-Git worktree add --detach $Temp "origin/$Branch"

    $Source = Join-Path $Temp "flecity_base"
    $Manifest = Join-Path $Source "fxmanifest.lua"
    if (-not (Test-Path -LiteralPath $Manifest)) { throw "fxmanifest.lua is missing." }

    $ManifestText = Get-Content -LiteralPath $Manifest -Raw
    if ($ManifestText -notmatch "(?m)^\s*fx_version\s+'cerulean'\s*$") {
        throw "Safety check failed: fx_version must remain 'cerulean'."
    }
    $VersionMatch = [regex]::Match($ManifestText, "(?m)^\s*version\s+'([^']+)'\s*$")
    if (-not $VersionMatch.Success) { throw "BASE version metadata is missing." }
    $DevVersion = $VersionMatch.Groups[1].Value
    if ($DevVersion -notmatch '^[0-9]+\.[0-9]+\.[0-9]+-dev$') {
        throw "BASE submission requires a -dev source version: $DevVersion"
    }
    $Version = $DevVersion -replace '-dev$', '-beta.1'

    $ServerMain = Join-Path $Source "server\main.lua"
    $ServerMainText = Get-Content -LiteralPath $ServerMain -Raw
    if ([regex]::Matches($ServerMainText, [regex]::Escape("local supportSessions = {}")).Count -ne 1) {
        throw "Safety check failed: duplicated server bootstrap."
    }
    if ([regex]::Matches($ServerMainText, [regex]::Escape("RegisterCommand('base_selftest'")).Count -ne 1) {
        throw "Safety check failed: duplicated selftest registration."
    }

    $LuaCompiler = Get-Command luac5.4 -ErrorAction SilentlyContinue
    if (-not $LuaCompiler) { $LuaCompiler = Get-Command luac -ErrorAction SilentlyContinue }
    if ($LuaCompiler) {
        Write-Host "==> Checking Lua syntax"
        Get-ChildItem -LiteralPath $Source -Recurse -Filter *.lua | ForEach-Object {
            & $LuaCompiler.Source -p $_.FullName
            if ($LASTEXITCODE -ne 0) { throw "Lua syntax check failed: $($_.FullName)" }
        }
    }

    $Node = Get-Command node -ErrorAction SilentlyContinue
    $WebJs = Join-Path $Source "web\app.js"
    if ($Node -and (Test-Path -LiteralPath $WebJs)) {
        Write-Host "==> Checking JavaScript syntax"
        & $Node.Source --check $WebJs
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax check failed." }
    }

    $ConfigSource = Get-Content -LiteralPath (Join-Path $Source 'config.lua') -Raw -Encoding UTF8
    if ($ConfigSource -notmatch "identifier = 'flecity_base'" -or
        $ConfigSource -notmatch "name = 'BASE'" -or
        $ConfigSource -notmatch "price = 0" -or
        $ConfigSource -notmatch 'supportDefault = false') {
        throw "BASE application identity and support safety settings must be verified."
    }

    $Css = Join-Path $Source "web\app.css"
    if ((Get-Content -LiteralPath $Css -Raw) -match '(?<![A-Za-z])\d+(?:\.\d+)?px') {
        throw "Safety check found px units while LB Phone fixBlur is enabled."
    }

    New-Item -ItemType Directory -Path $Dist -Force | Out-Null

    $Stage = Join-Path $Temp "submission"
    $StageResource = Join-Path $Stage "flecity_base"
    New-Item -ItemType Directory -Path $StageResource -Force | Out-Null

    Write-Host "==> Building clean resource package"
    foreach ($name in @("fxmanifest.lua","config.lua","client","server","web","sql","README.md","ACCESS.md","OPERATOR_GUIDE.md")) {
        $item = Join-Path $Source $name
        if (-not (Test-Path -LiteralPath $item)) { throw "Submission file missing: $name" }
        Copy-Item -LiteralPath $item -Destination $StageResource -Recurse -Force
    }

    # Release-only changes never modify the development checkout.
    $PackagedManifest = Join-Path $StageResource 'fxmanifest.lua'
    $ManifestContents = Get-Content -LiteralPath $PackagedManifest -Raw -Encoding UTF8
    $PatchedManifest = $ManifestContents.Replace("version '$DevVersion'", "version '$Version'")
    if ($PatchedManifest -eq $ManifestContents -or
        $PatchedManifest -notmatch [regex]::Escape("version '$Version'") -or
        $PatchedManifest -match "(?m)^version '.*-dev'") {
        throw "Could not produce beta release manifest."
    }
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($PackagedManifest, $PatchedManifest, $Utf8NoBom)

    # Submission copies use production-safe debug defaults without changing the development branch.
    $PackagedConfig = Join-Path $StageResource "config.lua"
    $ConfigText = Get-Content -LiteralPath $PackagedConfig -Raw
    $ConfigText = $ConfigText -replace "(?m)^FlecityBaseConfig\.Debug\s*=\s*true\s*$", "FlecityBaseConfig.Debug = false"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PackagedConfig, $ConfigText, $Utf8NoBom)
    if ($ConfigText -notmatch '(?m)^FlecityBaseConfig\.Debug = false$') {
        throw "Production package debug mode could not be disabled."
    }

    if (Test-Path -LiteralPath (Join-Path $StageResource "INSTALL.md")) {
        throw "Development INSTALL.md must not be included in submission package."
    }
    if (Test-Path -LiteralPath (Join-Path $StageResource "TESTING.md")) {
        throw "Development TESTING.md must not be included in submission package."
    }


    # Japanese operator documents sit beside, not inside, the resource.
    $Intro = @'
BASE | Flecity LB Phone アプリ
運営様への初回提出（先行公開β版）

このZIPには「BASE」の独立リソースだけが入っています。
LOOP・LINKなど、他のアプリは含まれません。

BASEは、個人・企業・チーム等が使う共有管理アプリです。
・個人用スペース（MY SPACE）と招待制グループ
・共有メモ、在庫の記録、タスク、会計の記録、計算ツール
・OWNER / MANAGER / MEMBER の役割分担

銀行残高・会社口座・実アイテムは操作しません。
QBox・LB Phone本体や他アプリのファイルも編集しません。
データは専用のflecity_base_テーブルへ保存されます。

先行公開後、利用者の報告・改善意見をもとに調整する予定です。
運営様の作業は「運営向け導入手順.txt」をご覧ください。
'@
    $Operator = @'
BASE | 運営様向け導入手順

【動作前提】
FlecityのQBox 2.5.4、oxmysql、LB Phone 2.9.0を前提にしています。
識別にはQBoxのcitizenidを使用します。

【初回導入手順】
1. flecity_baseフォルダをサーバーのresources配下に配置します。
2. server.cfgでqbx_core / oxmysql / lb-phoneの後に次の1行を追加します。

ensure flecity_base

3. 稼働中のサーバーへ導入する場合、txAdminのLive Consoleで実行します。

refresh
ensure flecity_base

4. 確認用コマンドを実行します。

base_selftest

セルフテストがPASSになり、LB PhoneのApp StoreにBASEが無料で表示され、
起動できれば基本導入は完了です。全サーバー再起動は通常不要です。

【DB】
専用テーブルを起動時に自動作成・必要な移行を行います。
CREATE / ALTER権限が利用できれば、通常の手動SQLインポートは不要です。
停止・撤去によって自動でユーザーデータを削除しません。

【管理権限】
作成者がOWNERとなり、招待制で利用できます。
WEAZELサポート用の全体権限は通常OFFで、明示的にONにした場合のみ有効です。
admin用ACEを設定する場合は次の1行を使用できます（任意）。

add_ace group.admin flecity.base.admin allow

細部はflecity_base/ACCESS.mdをご覧ください。

【注意事項】
会計・在庫はアプリ内の記録で、実際の銀行・インベントリとは連動しません。
今回は先行公開β版です。導入後のご意見をもとに修正を進めます。

【停止・撤去】
stop flecity_base
server.cfgからensure flecity_baseを外すと次回から読み込まれません。
専用テーブルに残る記録は、安全のため自動削除しません。
'@
    [IO.File]::WriteAllText((Join-Path $Stage 'はじめにお読みください.txt'), $Intro, $Utf8NoBom)
    [IO.File]::WriteAllText((Join-Path $Stage '運営向け導入手順.txt'), $Operator, $Utf8NoBom)
    $SourceCommit = (& git -C $Temp rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot get source commit.' }
    $BuildInfo = 'BASE ' + $Version + [Environment]::NewLine + 'Source: ' + $SourceCommit + [Environment]::NewLine + 'Release channel: beta; Debug: false'
    [IO.File]::WriteAllText((Join-Path $Stage 'ビルド情報.txt'), $BuildInfo, $Utf8NoBom)

    $ZipName = "BASE-v$Version-運営提出用.zip"
    $ZipPath = Join-Path $Dist $ZipName
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $ZipPath -CompressionLevel Optimal

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $Names = @($Archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
        foreach ($Expected in @('flecity_base/fxmanifest.lua','flecity_base/config.lua',
            'flecity_base/client/main.lua','flecity_base/server/main.lua',
            'はじめにお読みください.txt','運営向け導入手順.txt')) {
            if ($Names -notcontains $Expected) { throw "Archive missing $Expected" }
        }
    }
    finally { $Archive.Dispose() }
    $Checksum = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash
    [IO.File]::WriteAllText(($ZipPath + '.sha256.txt'), ('SHA256: ' + $Checksum), $Utf8NoBom)

    Write-Host ""
    Write-Host "BASE submission package created:"
    Write-Host "    $ZipPath"
    Write-Host ""
    Write-Host "Package version: $Version"
    Write-Host "SHA256: $Checksum"
    Write-Host "Development updater scripts and machine-specific paths are not included."
}
finally {
    if (Test-Path -LiteralPath $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    }
}
