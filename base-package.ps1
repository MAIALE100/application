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
    if ($DevVersion -notmatch '^\d+\.\d+\.\d+-dev

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

    $ProductionConfigCheck = Get-Content -LiteralPath (Join-Path $Source 'config.lua') -Raw -Encoding UTF8
    if ($ProductionConfigCheck -notmatch "identifier = 'flecity_base'" -or $ProductionConfigCheck -notmatch "name = 'BASE'" -or $ProductionConfigCheck -notmatch 'supportDefault = false' -or $ProductionConfigCheck -notmatch 'price = 0') {
        throw "Safety check failed: BASE identity, free app, or support defaults changed."
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

    # Release version and debug defaults are applied to the package only.
    $PackagedManifest = Join-Path $StageResource 'fxmanifest.lua'
    $ReleaseManifestText = Get-Content -LiteralPath $PackagedManifest -Raw -Encoding UTF8
    $ReleaseManifestText = $ReleaseManifestText.Replace("version '$DevVersion'","version '$Version'")
    if ($ReleaseManifestText -notmatch [regex]::Escape("version '$Version'") -or $ReleaseManifestText -match "version '.*-dev'") {
        throw 'Failed to update packaged manifest release version.'
    }
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PackagedManifest, $ReleaseManifestText, $Utf8NoBom)

    # Submission copies use production-safe debug defaults without changing the development branch.
    $PackagedConfig = Join-Path $StageResource "config.lua"
    $ConfigText = Get-Content -LiteralPath $PackagedConfig -Raw
    $ConfigText = $ConfigText -replace "(?m)^FlecityBaseConfig\.Debug\s*=\s*true\s*$", "FlecityBaseConfig.Debug = false"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PackagedConfig, $ConfigText, $Utf8NoBom)
    if ($ConfigText -notmatch '(?m)^FlecityBaseConfig\.Debug = false

    if (Test-Path -LiteralPath (Join-Path $StageResource "INSTALL.md")) {
        throw "Development INSTALL.md must not be included in submission package."
    }
    if (Test-Path -LiteralPath (Join-Path $StageResource "TESTING.md")) {
        throw "Development TESTING.md must not be included in submission package."
    }


    $IntroText = @'
BASE | Flecity LB Phone アプリ
運営様への初回提出（先行公開β版）

このZIPにはBASEアプリだけを収録しています。
LOOP・LINK等、他のアプリは含まれません。

【アプリの機能】
・個人用MY SPACE、企業・チーム等の共有スペース作成
・メモ、在庫の記録、タスク、会計の記録、計算ツール
・招待制のOWNER / MANAGER / MEMBER権限

【他のシステムへの影響】
・実際のお金や銀行残高、実アイテム在庫は変更しません。
・既存のQBox / LB Phone / 他アプリのファイルは変更しません。
・専用データベーステーブルを使用し、自動作成します。

先行公開後、実際に住民に使用していただき、
不具合・操作性などのご意見を集めて改善していく予定です。

運営様の導入作業は「運営向け導入手順.txt」をご参照ください。
'@
    $OperatorText = @'
BASE | 運営様向け導入手順

【対応環境】
FlecityのQBox 2.5.4 / oxmysql / LB Phone 2.9.0想定。
識別にはQBoxのcitizenidを使用します。

【導入方法】
1. ZIP内のflecity_baseフォルダをサーバーのresources配下に置いてください。
2. server.cfgでqbx_core / oxmysql / lb-phoneより後に下記を1行追加してください。

ensure flecity_base

3. 稼働中のサーバーに初めて導入する場合、txAdmin Live Consoleで実行します。

refresh
ensure flecity_base

4. 起動確認のため、Live Consoleで次を実行してください。

base_selftest

すべてPASSになり、LB PhoneのApp StoreにBASE（無料）が表示されれば、
基本導入の確認は完了です。サーバー全体の再起動は原則不要です。

【自動データベース】
専用テーブルを起動時に作成します。通常、手動SQLインポートは不要です。
DROP TABLE / TRUNCATE TABLE は行いません。
DBユーザーにCREATE/ALTER権限がない場合はご確認をお願いいたします。

【管理権限】
BASE内のOWNER・MANAGER・MEMBER権限はアプリ内で管理します。
WEAZELサポート機能は通常OFFで、対象者が明示的にONにした時だけ有効です。
必要な場合、サーバーadmin全体管理用ACEは次の1行を利用できます。

add_ace group.admin flecity.base.admin allow

このACEは任意です。詳しくはflecity_base/ACCESS.mdをご参照ください。

【重要】
会計と在庫はBASE内だけの記録です。
実際の銀行・会社口座・ox_inventoryの操作はしません。
運用開始後の不具合は開発側で確認・修正します。

【停止方法】
stop flecity_base
server.cfgのensure flecity_baseを取り除くと次回起動しません。
リソース停止・削除では、保存済みDBは消去しません。
'@
    [IO.File]::WriteAllText((Join-Path $Stage 'はじめにお読みください.txt'),$IntroText,$Utf8NoBom)
    [IO.File]::WriteAllText((Join-Path $Stage '運営向け導入手順.txt'),$OperatorText,$Utf8NoBom)
    $SourceCommit = (& git -C $Temp rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Could not read source revision.' }
    [IO.File]::WriteAllText((Join-Path $Stage 'ビルド情報.txt'),("BASE $Version" + [Environment]::NewLine + "Source commit: $SourceCommit" + [Environment]::NewLine + 'Debug: disabled; Release: beta'),$Utf8NoBom)

    $ZipName = "BASE-v$Version.zip"
    $ZipPath = Join-Path $Dist $ZipName
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $ZipPath -CompressionLevel Optimal

    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $Entries = @($Archive.Entries | ForEach-Object { $_.FullName.Replace('\','/') })
        foreach ($RequiredEntry in @('flecity_base/fxmanifest.lua','flecity_base/config.lua','flecity_base/client/main.lua','flecity_base/server/main.lua','はじめにお読みください.txt','運営向け導入手順.txt')) {
            if ($Entries -notcontains $RequiredEntry) { throw "Archive missing required entry: $RequiredEntry" }
        }
    } finally {
        $Archive.Dispose()
    }
    $Checksum = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash
    [IO.File]::WriteAllText(($ZipPath + '.sha256.txt'),("SHA256: $Checksum" + [Environment]::NewLine),$Utf8NoBom)

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
) { throw "Expected a development source version; got $DevVersion" }
    $Version = $DevVersion -replace '-dev

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

    # Submission copies use production-safe debug defaults without changing the development branch.
    $PackagedConfig = Join-Path $StageResource "config.lua"
    $ConfigText = Get-Content -LiteralPath $PackagedConfig -Raw
    $ConfigText = $ConfigText -replace "(?m)^FlecityBaseConfig\.Debug\s*=\s*true\s*$", "FlecityBaseConfig.Debug = false"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PackagedConfig, $ConfigText, $Utf8NoBom)

    if (Test-Path -LiteralPath (Join-Path $StageResource "INSTALL.md")) {
        throw "Development INSTALL.md must not be included in submission package."
    }
    if (Test-Path -LiteralPath (Join-Path $StageResource "TESTING.md")) {
        throw "Development TESTING.md must not be included in submission package."
    }

    $ZipName = "BASE-v$Version.zip"
    $ZipPath = Join-Path $Dist $ZipName
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    Compress-Archive -LiteralPath $StageResource -DestinationPath $ZipPath -CompressionLevel Optimal

    Write-Host ""
    Write-Host "BASE submission package created:"
    Write-Host "    $ZipPath"
    Write-Host ""
    Write-Host "Package version: $Version"
    Write-Host "Development updater scripts and machine-specific paths are not included."
}
finally {
    if (Test-Path -LiteralPath $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    }
}
, '-beta.1'

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

    # Submission copies use production-safe debug defaults without changing the development branch.
    $PackagedConfig = Join-Path $StageResource "config.lua"
    $ConfigText = Get-Content -LiteralPath $PackagedConfig -Raw
    $ConfigText = $ConfigText -replace "(?m)^FlecityBaseConfig\.Debug\s*=\s*true\s*$", "FlecityBaseConfig.Debug = false"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PackagedConfig, $ConfigText, $Utf8NoBom)

    if (Test-Path -LiteralPath (Join-Path $StageResource "INSTALL.md")) {
        throw "Development INSTALL.md must not be included in submission package."
    }
    if (Test-Path -LiteralPath (Join-Path $StageResource "TESTING.md")) {
        throw "Development TESTING.md must not be included in submission package."
    }

    $ZipName = "BASE-v$Version.zip"
    $ZipPath = Join-Path $Dist $ZipName
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    Compress-Archive -LiteralPath $StageResource -DestinationPath $ZipPath -CompressionLevel Optimal

    Write-Host ""
    Write-Host "BASE submission package created:"
    Write-Host "    $ZipPath"
    Write-Host ""
    Write-Host "Package version: $Version"
    Write-Host "Development updater scripts and machine-specific paths are not included."
}
finally {
    if (Test-Path -LiteralPath $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    }
}
) { throw 'Debug could not be disabled.' }

    if (Test-Path -LiteralPath (Join-Path $StageResource "INSTALL.md")) {
        throw "Development INSTALL.md must not be included in submission package."
    }
    if (Test-Path -LiteralPath (Join-Path $StageResource "TESTING.md")) {
        throw "Development TESTING.md must not be included in submission package."
    }

    $ZipName = "BASE-v$Version.zip"
    $ZipPath = Join-Path $Dist $ZipName
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    Compress-Archive -LiteralPath $StageResource -DestinationPath $ZipPath -CompressionLevel Optimal

    Write-Host ""
    Write-Host "BASE submission package created:"
    Write-Host "    $ZipPath"
    Write-Host ""
    Write-Host "Package version: $Version"
    Write-Host "Development updater scripts and machine-specific paths are not included."
}
finally {
    if (Test-Path -LiteralPath $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    }
}
) { throw "Expected a development source version; got $DevVersion" }
    $Version = $DevVersion -replace '-dev

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

    # Submission copies use production-safe debug defaults without changing the development branch.
    $PackagedConfig = Join-Path $StageResource "config.lua"
    $ConfigText = Get-Content -LiteralPath $PackagedConfig -Raw
    $ConfigText = $ConfigText -replace "(?m)^FlecityBaseConfig\.Debug\s*=\s*true\s*$", "FlecityBaseConfig.Debug = false"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PackagedConfig, $ConfigText, $Utf8NoBom)

    if (Test-Path -LiteralPath (Join-Path $StageResource "INSTALL.md")) {
        throw "Development INSTALL.md must not be included in submission package."
    }
    if (Test-Path -LiteralPath (Join-Path $StageResource "TESTING.md")) {
        throw "Development TESTING.md must not be included in submission package."
    }

    $ZipName = "BASE-v$Version.zip"
    $ZipPath = Join-Path $Dist $ZipName
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    Compress-Archive -LiteralPath $StageResource -DestinationPath $ZipPath -CompressionLevel Optimal

    Write-Host ""
    Write-Host "BASE submission package created:"
    Write-Host "    $ZipPath"
    Write-Host ""
    Write-Host "Package version: $Version"
    Write-Host "Development updater scripts and machine-specific paths are not included."
}
finally {
    if (Test-Path -LiteralPath $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    }
}
, '-beta.1'

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

    # Submission copies use production-safe debug defaults without changing the development branch.
    $PackagedConfig = Join-Path $StageResource "config.lua"
    $ConfigText = Get-Content -LiteralPath $PackagedConfig -Raw
    $ConfigText = $ConfigText -replace "(?m)^FlecityBaseConfig\.Debug\s*=\s*true\s*$", "FlecityBaseConfig.Debug = false"
    $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($PackagedConfig, $ConfigText, $Utf8NoBom)

    if (Test-Path -LiteralPath (Join-Path $StageResource "INSTALL.md")) {
        throw "Development INSTALL.md must not be included in submission package."
    }
    if (Test-Path -LiteralPath (Join-Path $StageResource "TESTING.md")) {
        throw "Development TESTING.md must not be included in submission package."
    }

    $ZipName = "BASE-v$Version.zip"
    $ZipPath = Join-Path $Dist $ZipName
    if (Test-Path -LiteralPath $ZipPath) { Remove-Item -LiteralPath $ZipPath -Force }

    Compress-Archive -LiteralPath $StageResource -DestinationPath $ZipPath -CompressionLevel Optimal

    Write-Host ""
    Write-Host "BASE submission package created:"
    Write-Host "    $ZipPath"
    Write-Host ""
    Write-Host "Package version: $Version"
    Write-Host "Development updater scripts and machine-specific paths are not included."
}
finally {
    if (Test-Path -LiteralPath $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path -LiteralPath $Temp) { Remove-Item -LiteralPath $Temp -Recurse -Force }
    }
}
