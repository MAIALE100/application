$ErrorActionPreference = "Stop"

$RepoRoot = $PSScriptRoot
$UiPath   = Join-Path $RepoRoot "puriphoto\ui"

Set-Location $RepoRoot

Write-Host ""
Write-Host "=== PuriPhoto Dev Save ==="
Write-Host ""

$branch = git branch --show-current
Write-Host "Branch: $branch"

if ($branch -eq "main") {
    throw "Safety stop: Do not save development work directly to main."
}

Write-Host "[1/4] Building PuriPhoto..."
Set-Location $UiPath
npm.cmd run build

if ($LASTEXITCODE -ne 0) {
    throw "PuriPhoto build failed."
}

Set-Location $RepoRoot

Write-Host "[2/4] Staging PuriPhoto files..."
git add --all -- puriphoto

if ($LASTEXITCODE -ne 0) {
    throw "git add failed."
}

git diff --cached --quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "No PuriPhoto changes to save."
    exit 0
}

Write-Host ""
git status --short
Write-Host ""

$message = Read-Host "Commit message"

if ([string]::IsNullOrWhiteSpace($message)) {
    throw "Commit message cannot be empty."
}

Write-Host "[3/4] Committing..."
git commit -m $message

if ($LASTEXITCODE -ne 0) {
    throw "git commit failed."
}

Write-Host "[4/4] Pushing to GitHub..."
git push

if ($LASTEXITCODE -ne 0) {
    throw "git push failed."
}

Write-Host ""
Write-Host "======================================"
Write-Host " PuriPhoto saved to GitHub!"
Write-Host "======================================"
Write-Host ""