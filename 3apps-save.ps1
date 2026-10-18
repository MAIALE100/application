$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
Set-Location $RepoRoot
$branch = (git branch --show-current).Trim()
if ($branch -eq "main") { throw "Safety stop: do not save development work directly to main." }
if ($branch -ne "frame-integration-test") { throw "Safety stop: expected frame-integration-test, current: $branch" }

$PuriUi = Join-Path $RepoRoot "puriphoto\ui"
if (Test-Path (Join-Path $PuriUi "package.json")) {
    Push-Location $PuriUi
    try {
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "PuriPhoto build failed." }
    } finally { Pop-Location }
}

git add --all -- puriphoto photo_diary frame three_apps_bootstrap 3apps-setup.cmd 3apps-setup.ps1 3apps-update.cmd 3apps-update.ps1 3apps-save.cmd 3apps-save.ps1
if ($LASTEXITCODE -ne 0) { throw "git add failed." }
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) { Write-Host "No 3-app changes to save."; exit 0 }
git status --short
$message = Read-Host "Commit message"
if ([string]::IsNullOrWhiteSpace($message)) { throw "Commit message cannot be empty." }
git commit -m $message
if ($LASTEXITCODE -ne 0) { throw "git commit failed." }
git push -u origin frame-integration-test
if ($LASTEXITCODE -ne 0) { throw "git push failed." }
Write-Host "3-app development changes saved to GitHub."
