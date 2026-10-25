param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base'
)

$ErrorActionPreference = 'Stop'

function Step([string]$Message) {
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Find-LBPhoneConfig([string]$Base) {
    $resources = Join-Path $Base 'resources'
    if (-not (Test-Path -LiteralPath $resources)) {
        throw "FiveM resources folder not found: $resources"
    }

    $candidates = @(
        (Join-Path $resources '[lb-phone]\lb-phone\config\config.lua'),
        (Join-Path $resources 'lb-phone\config\config.lua')
    )

    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    $resourceDirs = Get-ChildItem -LiteralPath $resources -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'lb-phone' }

    foreach ($dir in $resourceDirs) {
        $candidate = Join-Path $dir.FullName 'config\config.lua'
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }

    throw "lb-phone config.lua was not found under: $resources"
}

try {
    Step 'Checking LB Phone external gallery settings'

    $configPath = Find-LBPhoneConfig $ServerBase
    Write-Host ("LB Phone config: {0}" -f $configPath) -ForegroundColor DarkGray

    $original = [IO.File]::ReadAllText($configPath)
    $updated = $original
    $changed = $false

    # 1) Enable external gallery imports.
    $allowPattern = '(?s)(Config\.AllowExternal\s*=\s*\{)(.*?)(\r?\n\})'
    $allowMatch = [regex]::Match($updated, $allowPattern)
    if (-not $allowMatch.Success) {
        throw 'Config.AllowExternal block was not found. No changes were written.'
    }

    $allowBody = $allowMatch.Groups[2].Value
    if ($allowBody -match '(?m)^\s*Gallery\s*=\s*false\s*,?') {
        $newAllowBody = [regex]::Replace(
            $allowBody,
            '(?m)^(\s*Gallery\s*=\s*)false(\s*,?)',
            '$1true$2',
            1
        )

        $updated =
            $updated.Substring(0, $allowMatch.Groups[2].Index) +
            $newAllowBody +
            $updated.Substring($allowMatch.Groups[2].Index + $allowMatch.Groups[2].Length)

        $changed = $true
        Write-Host 'External Gallery imports: ENABLED' -ForegroundColor Green
    }
    elseif ($allowBody -match '(?m)^\s*Gallery\s*=\s*true\s*,?') {
        Write-Host 'External Gallery imports: already enabled' -ForegroundColor Green
    }
    else {
        throw 'Config.AllowExternal.Gallery was not found. No changes were written.'
    }

    # 2) Add gifyu.com to the whitelist.
    $whitelistPattern = '(?s)(Config\.ExternalWhitelistedDomains\s*=\s*\{)(.*?)(\r?\n\})'
    $whitelistMatch = [regex]::Match($updated, $whitelistPattern)
    if (-not $whitelistMatch.Success) {
        throw 'Config.ExternalWhitelistedDomains block was not found. No changes were written.'
    }

    $whitelistBody = $whitelistMatch.Groups[2].Value
    if ($whitelistBody -notmatch '"gifyu\.com"') {
        $newWhitelistBody = $whitelistBody + [Environment]::NewLine + '    "gifyu.com",'

        $updated =
            $updated.Substring(0, $whitelistMatch.Groups[2].Index) +
            $newWhitelistBody +
            $updated.Substring($whitelistMatch.Groups[2].Index + $whitelistMatch.Groups[2].Length)

        $changed = $true
        Write-Host 'External image whitelist: added gifyu.com' -ForegroundColor Green
    }
    else {
        Write-Host 'External image whitelist: gifyu.com already allowed' -ForegroundColor Green
    }

    # 3) Remove gifyu.com from the blacklist if present.
    $blacklistPattern = '(?s)(Config\.ExternalBlacklistedDomains\s*=\s*\{)(.*?)(\r?\n\})'
    $blacklistMatch = [regex]::Match($updated, $blacklistPattern)

    if ($blacklistMatch.Success) {
        $blacklistBody = $blacklistMatch.Groups[2].Value

        if ($blacklistBody -match '"gifyu\.com"') {
            $newBlacklistBody = [regex]::Replace(
                $blacklistBody,
                '(?m)^\s*"gifyu\.com"\s*,?\s*\r?\n?',
                ''
            )

            $updated =
                $updated.Substring(0, $blacklistMatch.Groups[2].Index) +
                $newBlacklistBody +
                $updated.Substring($blacklistMatch.Groups[2].Index + $blacklistMatch.Groups[2].Length)

            $changed = $true
            Write-Host 'External image blacklist: removed gifyu.com' -ForegroundColor Green
        }
        else {
            Write-Host 'External image blacklist: gifyu.com is not blocked' -ForegroundColor Green
        }
    }
    else {
        Write-Host 'External image blacklist: block not present; nothing to remove' -ForegroundColor DarkGray
    }

    # 4) Verify only inside each individual config block.
    $verifyAllowMatch = [regex]::Match($updated, $allowPattern)
    $verifyWhitelistMatch = [regex]::Match($updated, $whitelistPattern)
    $verifyBlacklistMatch = [regex]::Match($updated, $blacklistPattern)

    $galleryOk =
        $verifyAllowMatch.Success -and
        ($verifyAllowMatch.Groups[2].Value -match '(?m)^\s*Gallery\s*=\s*true\s*,?')

    $whitelistOk =
        $verifyWhitelistMatch.Success -and
        ($verifyWhitelistMatch.Groups[2].Value -match '"gifyu\.com"')

    $blacklistStillContainsGifyu =
        $verifyBlacklistMatch.Success -and
        ($verifyBlacklistMatch.Groups[2].Value -match '"gifyu\.com"')

    if (-not $galleryOk) {
        throw 'Verification failed: Gallery external imports are not enabled.'
    }
    if (-not $whitelistOk) {
        throw 'Verification failed: gifyu.com is not present in the whitelist.'
    }
    if ($blacklistStillContainsGifyu) {
        throw 'Verification failed: gifyu.com is still present in the blacklist.'
    }

    if ($changed) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = "$configPath.gifyu-backup-$stamp"

        Copy-Item -LiteralPath $configPath -Destination $backup -Force
        [IO.File]::WriteAllText($configPath, $updated, [Text.UTF8Encoding]::new($false))

        $written = [IO.File]::ReadAllText($configPath)
        $writtenAllowMatch = [regex]::Match($written, $allowPattern)
        $writtenWhitelistMatch = [regex]::Match($written, $whitelistPattern)
        $writtenBlacklistMatch = [regex]::Match($written, $blacklistPattern)

        $writtenGalleryOk =
            $writtenAllowMatch.Success -and
            ($writtenAllowMatch.Groups[2].Value -match '(?m)^\s*Gallery\s*=\s*true\s*,?')
        $writtenWhitelistOk =
            $writtenWhitelistMatch.Success -and
            ($writtenWhitelistMatch.Groups[2].Value -match '"gifyu\.com"')
        $writtenBlacklistBad =
            $writtenBlacklistMatch.Success -and
            ($writtenBlacklistMatch.Groups[2].Value -match '"gifyu\.com"')

        if (-not $writtenGalleryOk -or -not $writtenWhitelistOk -or $writtenBlacklistBad) {
            Copy-Item -LiteralPath $backup -Destination $configPath -Force
            throw "Written config verification failed. Original config restored from: $backup"
        }

        Write-Host ''
        Write-Host 'LB Phone Gifyu support updated successfully.' -ForegroundColor Green
        Write-Host ("Backup: {0}" -f $backup) -ForegroundColor DarkGray
        Write-Host 'Run this once in txAdmin:' -ForegroundColor Yellow
        Write-Host '    restart lb-phone' -ForegroundColor White
    }
    else {
        Write-Host ''
        Write-Host 'LB Phone Gifyu support is already configured.' -ForegroundColor Green
    }

    exit 0
}
catch {
    Write-Host ''
    Write-Host ('LB PHONE GIFYU FIX FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No automatic restart was attempted.' -ForegroundColor Yellow
    exit 1
}
