param(
    [string]$ServerBase = "D:\FiveM_Test_Server\txData\Qbox_D233FD.base",
    [switch]$BoothOnly
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Resources = Join-Path $ServerBase "resources"
$PuriSource = Join-Path $Root "puriphoto"
$BoothSource = Join-Path $Root "puribooth"
$PuriTarget = Join-Path $Resources "[lb-phone]\puriphoto"
$BoothTarget = Join-Path $Resources "[lb-phone]\puribooth"
$ServerCfg = Join-Path $ServerBase "server.cfg"
$DuplicatePuriTarget = Join-Path $Resources "[weazel]\puriphoto"
$DisabledDuplicates = Join-Path $ServerBase "_disabled_duplicates"
$AdminCommandsSource = Join-Path $Root "FLECITY_ADMIN_COMMANDS.txt"
$AdminCommandsTarget = Join-Path (Split-Path $Root -Parent) "FLECITY_ADMIN_COMMANDS.txt"

function Invoke-Step([string]$Label, [scriptblock]$Action) {
    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan
    & $Action
}

if (-not (Test-Path -LiteralPath $PuriSource)) { throw "PuriPhoto source not found: $PuriSource" }
if (-not (Test-Path -LiteralPath $BoothSource)) { throw "PuriBooth source not found: $BoothSource" }
if (-not (Test-Path -LiteralPath $Resources)) { throw "Server resources folder not found: $Resources" }

Invoke-Step "Removing duplicate PuriPhoto resource" {
    if (Test-Path -LiteralPath $DuplicatePuriTarget) {
        [System.IO.Directory]::CreateDirectory($DisabledDuplicates) | Out-Null

        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupTarget = Join-Path $DisabledDuplicates ("puriphoto-weazel-" + $stamp)

        Move-Item -LiteralPath $DuplicatePuriTarget -Destination $backupTarget
        Write-Host "Moved duplicate PuriPhoto outside resources:" -ForegroundColor Green
        Write-Host "    $DuplicatePuriTarget"
        Write-Host " -> $backupTarget"
    }
    else {
        Write-Host "Duplicate [weazel] PuriPhoto: not present" -ForegroundColor Green
    }
}

if (-not $BoothOnly) {
    Invoke-Step "Checking Node.js" {
        $npm = Get-Command npm -ErrorAction SilentlyContinue
        if (-not $npm) { throw "npm was not found. Install Node.js or add npm to PATH." }
        node --version
        npm --version
    }
    
    Invoke-Step "Building PuriPhoto UI" {
        Push-Location (Join-Path $PuriSource "ui")
        try {
            # PuriPhoto inherited an older template lock file that can temporarily
            # drift from package.json. Prefer npm ci when possible, but repair the
            # local lock/dependencies automatically instead of stopping the deploy.
            npm ci --no-audit --no-fund
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "npm ci could not use the current lock file. Repairing dependencies with npm install."
                npm install --no-audit --no-fund
                if ($LASTEXITCODE -ne 0) { throw "npm dependency install failed" }
            }
    
            npm run build -- --emptyOutDir
            if ($LASTEXITCODE -ne 0) { throw "PuriPhoto UI build failed" }
        }
        finally {
            Pop-Location
        }
    }
    
}

Invoke-Step "Importing local purikura fonts" {
    $fontImporter = Join-Path $Root "puribooth-fonts.ps1"
    if (Test-Path -LiteralPath $fontImporter) {
        & $fontImporter
    }
    else {
        Write-Warning "Font importer not found. Custom fonts will use fallback fonts."
    }
}

Invoke-Step "Validating booth JavaScript" {
    node --check (Join-Path $BoothSource "ui\app.js")
    if ($LASTEXITCODE -ne 0) { throw "PuriBooth UI JavaScript syntax check failed" }
}

Invoke-Step "Checking screenshot-basic" {
    $screenshot = Get-ChildItem -LiteralPath $Resources -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq "screenshot-basic" } |
        Select-Object -First 1

    if ($screenshot) {
        Write-Host "screenshot-basic: FOUND ($($screenshot.FullName))" -ForegroundColor Green
    }
    else {
        Write-Warning "screenshot-basic was not found. The booth can start, but automatic fixed-camera capture will refund instead of taking photos."
    }
}

if (-not $BoothOnly) {
    Invoke-Step "Deploying PuriPhoto" {
        [System.IO.Directory]::CreateDirectory($PuriTarget) | Out-Null
        robocopy $PuriSource $PuriTarget /MIR /XD node_modules .git /NFL /NDL /NJH /NJS /NP
        if ($LASTEXITCODE -gt 7) { throw "PuriPhoto deploy failed (robocopy=$LASTEXITCODE)" }
    }
}

Invoke-Step "Deploying PuriBooth" {
    [System.IO.Directory]::CreateDirectory($BoothTarget) | Out-Null
    robocopy $BoothSource $BoothTarget /MIR /XD node_modules .git /NFL /NDL /NJH /NJS /NP
    if ($LASTEXITCODE -gt 7) { throw "PuriBooth deploy failed (robocopy=$LASTEXITCODE)" }
}

Invoke-Step "Checking server.cfg" {
    if (-not (Test-Path -LiteralPath $ServerCfg)) {
        Write-Warning "server.cfg was not found; add 'ensure puribooth' manually."
    }
    else {
        $cfg = Get-Content -LiteralPath $ServerCfg -Raw
        if ($cfg -notmatch '(?im)^\s*ensure\s+puribooth\s*$') {
            Add-Content -LiteralPath $ServerCfg -Value "`r`n# Flecity street purikura booth`r`nensure puribooth`r`n"
            Write-Host "Added: ensure puribooth" -ForegroundColor Green
        }
        else {
            Write-Host "ensure puribooth: already present" -ForegroundColor Green
        }
    }
}

Invoke-Step "Updating Flecity admin command cheat sheet" {
    if (Test-Path -LiteralPath $AdminCommandsSource) {
        Copy-Item -LiteralPath $AdminCommandsSource -Destination $AdminCommandsTarget -Force
        Write-Host "Updated: $AdminCommandsTarget" -ForegroundColor Green
    }
    else {
        Write-Warning "Admin command cheat sheet was not found: $AdminCommandsSource"
    }
}

Write-Host ""
Write-Host "PuriBooth development build deployed." -ForegroundColor Green
Write-Host "Run these in txAdmin:" -ForegroundColor Yellow
Write-Host "    refresh"
if (-not $BoothOnly) { Write-Host "    restart puriphoto" }
Write-Host "    restart puribooth"
Write-Host "    puribooth_selftest"
Write-Host ""
Write-Host "Admin placement commands:" -ForegroundColor Yellow
Write-Host "    /puribooth claimadmin # first player only; bootstrap PuriBooth admin"
Write-Host "    /puribooth place   # open translucent placement preview"
Write-Host "      Arrows=move  Q/E=rotate  PgUp/PgDn=height  C=camera preview  Shift=fast"
Write-Host "      Enter=place  Backspace=cancel"
Write-Host "    /puribooth remove  # remove the nearest booth"
Write-Host "    /puribooth list    # show booth count"
