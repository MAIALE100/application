$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = "base/workspace-dev"
$Dist = Join-Path $RepoRoot "dist"
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
    $Version = $VersionMatch.Groups[1].Value

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
    Set-Content -LiteralPath $PackagedConfig -Value $ConfigText -Encoding UTF8

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
