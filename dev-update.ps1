$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$UiPath   = Join-Path $RepoRoot "puriphoto\ui"

Write-Host ""
Write-Host "=== PuriPhoto Dev Update ==="
Write-Host ""

# 1. applicationへ移動
Set-Location $RepoRoot

# 2. 現在のブランチを表示
$branch = git branch --show-current
Write-Host "[1/3] Branch: $branch"

# 3. GitHubから最新版を取得
Write-Host "[2/3] Pulling latest changes..."
git pull

if ($LASTEXITCODE -ne 0) {
    throw "git pull failed."
}

# 4. 依存関係を同期してからPuriPhotoをビルド
# package.json に新しい依存関係が追加された場合も dev-update.cmd だけで反映する
Write-Host "[3/3] Syncing dependencies + building PuriPhoto..."
Set-Location $UiPath

# package-lock.json が古い場合でも package.json の依存関係を確実に同期する
npm.cmd install --package-lock=false --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
    throw "PuriPhoto dependency install failed."
}

npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "PuriPhoto build failed."
}

Set-Location $RepoRoot

Write-Host ""
Write-Host "======================================"
Write-Host " PuriPhoto update + build completed!"
Write-Host "======================================"
Write-Host ""
Write-Host "Next: txAdmin -> restart puriphoto"
Write-Host ""