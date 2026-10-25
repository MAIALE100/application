$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = "base/workspace-dev"
$DefaultTarget = "D:\FiveM_Test_Server\txData\Qbox_D233FD.base\resources\[lb-phone]\flecity_base"
$Target = if ($env:FLECITY_BASE_TARGET) { $env:FLECITY_BASE_TARGET } else { $DefaultTarget }
$Temp = Join-Path $env:TEMP ("flecity_base_source_" + $PID)

function Run-Git {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args)
    & git -C $RepoRoot @Args
    if ($LASTEXITCODE -ne 0) { throw "git failed: $($Args -join ' ')" }
}

try {
    Write-Host ""
    Write-Host "==> Fetching latest BASE build"
    Run-Git fetch --prune origin $Branch

    if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force }
    Run-Git worktree add --detach $Temp "origin/$Branch"

    $Source = Join-Path $Temp "flecity_base"
    $Manifest = Join-Path $Source "fxmanifest.lua"
    if (-not (Test-Path -LiteralPath $Manifest)) {
        throw "BASE source validation failed."
    }

    $ManifestText = Get-Content -LiteralPath $Manifest -Raw
    if ($ManifestText -notmatch "(?m)^\s*fx_version\s+'cerulean'\s*$") {
        throw "Safety check failed: fx_version must remain 'cerulean'."
    }
    if ($ManifestText -notmatch "(?m)^\s*version\s+'[0-9]+\.[0-9]+\.[0-9]+-dev'\s*$") {
        throw "Safety check failed: BASE version metadata is missing or malformed."
    }

    $Framework = Join-Path $Source "server\framework.lua"
    if (-not (Test-Path -LiteralPath $Framework)) {
        throw "Safety check failed: server/framework.lua is missing."
    }
    $FrameworkText = Get-Content -LiteralPath $Framework -Raw
    if ($FrameworkText -notmatch "FlecityBaseFramework\s*=\s*FlecityBaseFramework\s+or\s+\{\}") {
        throw "Safety check failed: FlecityBaseFramework bootstrap is missing."
    }
    if ($FrameworkText -notmatch "function\s+FlecityBaseFramework\.GetIdentifier") {
        throw "Safety check failed: FlecityBaseFramework.GetIdentifier is missing."
    }
    if (($FrameworkText | Select-String -Pattern "function\s+FlecityBaseFramework\.GetJob" -AllMatches).Matches.Count -ne 1) {
        throw "Safety check failed: FlecityBaseFramework.GetJob must exist exactly once."
    }
    if ($FrameworkText -notmatch ":gsub\('%s\+\    $Css = Join-Path $Source "web\app.css"
    if (Test-Path $Css) {
        $CssText = Get-Content $Css -Raw
        if ($CssText -match '(?<![A-Za-z])\d+(?:\.\d+)?px') {
            throw "Safety check found px units while LB Phone fixBlur is enabled."
        }
    }

    Write-Host "==> Deploying BASE to test server"
    $Parent = Split-Path -Parent $Target
    New-Item -ItemType Directory -Path $Parent -Force | Out-Null

    if (Test-Path -LiteralPath $Target) {
        Remove-Item -LiteralPath $Target -Recurse -Force
    }
    Copy-Item -LiteralPath $Source -Destination $Target -Recurse -Force

    if (-not (Test-Path -LiteralPath (Join-Path $Target "fxmanifest.lua"))) {
        throw "Deployment validation failed."
    }

    Write-Host ""
    Write-Host "BASE update complete."
    Write-Host "txAdmin console:"
    Write-Host "    restart flecity_base"
    Write-Host ""
}
finally {
    if (Test-Path $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force }
    }
}
,\s*''\)") {
        throw "Safety check failed: character-name trim expression is malformed."
    }

    $Css = Join-Path $Source "web\app.css"
    if (Test-Path $Css) {
        $CssText = Get-Content $Css -Raw
        if ($CssText -match '(?<![A-Za-z])\d+(?:\.\d+)?px') {
            throw "Safety check found px units while LB Phone fixBlur is enabled."
        }
    }

    Write-Host "==> Deploying BASE to test server"
    $Parent = Split-Path -Parent $Target
    New-Item -ItemType Directory -Path $Parent -Force | Out-Null

    if (Test-Path -LiteralPath $Target) {
        Remove-Item -LiteralPath $Target -Recurse -Force
    }
    Copy-Item -LiteralPath $Source -Destination $Target -Recurse -Force

    if (-not (Test-Path -LiteralPath (Join-Path $Target "fxmanifest.lua"))) {
        throw "Deployment validation failed."
    }

    Write-Host ""
    Write-Host "BASE update complete."
    Write-Host "txAdmin console:"
    Write-Host "    restart flecity_base"
    Write-Host ""
}
finally {
    if (Test-Path $Temp) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
        if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force }
    }
}
