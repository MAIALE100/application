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

# 4. PuriPhotoをビルド
Write-Host "[3/3] Building PuriPhoto..."
Set-Location $UiPath

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