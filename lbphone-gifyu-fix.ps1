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
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    $resourceDirs = Get-ChildItem -LiteralPath $resources -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'lb-phone' }

    foreach ($dir in $resourceDirs) {
        $candidate = Join-Path $dir.FullName 'config\config.lua'
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }

    throw "lb-phone config.lua was not found under: $resources"
}

function Replace-BlockBody(
    [string]$Text,
    [string]$Pattern,
    [scriptblock]$Transform
) {
    $match = [regex]::Match($Text, $Pattern)
    if (-not $match.Success) {
        throw "Required config block was not found: $Pattern"
    }

    $body = $match.Groups[2].Value
    $newBody = & $Transform $body

    return (
        $Text.Substring(0, $match.Groups[2].Index) +
        $newBody +
        $Text.Substring($match.Groups[2].Index + $match.Groups[2].Length)
    )
}

try {
    Step 'Checking LB Phone external gallery settings'

    $configPath = Find-LBPhoneConfig $ServerBase
    Write-Host ("LB Phone config: {0}" -f $configPath) -ForegroundColor DarkGray

    $original = [IO.File]::ReadAllText($configPath)
    $updated = $original
    $changed = $false

    $allowPattern = '(?s)(Config\.AllowExternal\s*=\s*\{)(.*?)(\r?\n\})'
    $whitelistPattern = '(?s)(Config\.ExternalWhitelistedDomains\s*=\s*\{)(.*?)(\r?\n\})'
    $blacklistPattern = '(?s)(Config\.ExternalBlacklistedDomains\s*=\s*\{)(.*?)(\r?\n\})'

    # Repair the exact malformed form produced by the earlier helper:
    # "fivemanage.com"
    # "gifyu.com",
    $brokenWhitelistPattern = '(?m)^(\s*"[^"]+"\s*)(\r?\n)(\s*"gifyu\.com"\s*,?\s*)$'
    if ($updated -match $brokenWhitelistPattern) {
        $updated = [regex]::Replace(
            $updated,
            $brokenWhitelistPattern,
            '$1,$2$3'
        )
        $changed = $true
        Write-Host 'Repaired missing comma in external whitelist.' -ForegroundColor Green
    }

    # Enable Gallery.
    $updated = Replace-BlockBody $updated $allowPattern {
        param($body)

        if ($body -match '(?m)^\s*Gallery\s*=\s*false\s*,?') {
            $script:changed = $true
            Write-Host 'External Gallery imports: ENABLED' -ForegroundColor Green
            return [regex]::Replace(
                $body,
                '(?m)^(\s*Gallery\s*=\s*)false(\s*,?)',
                '$1true$2',
                1
            )
        }

        if ($body -match '(?m)^\s*Gallery\s*=\s*true\s*,?') {
            Write-Host 'External Gallery imports: already enabled' -ForegroundColor Green
            return $body
        }

        throw 'Config.AllowExternal.Gallery was not found.'
    }

    # Remove gifyu.com from blacklist if present.
    $updated = Replace-BlockBody $updated $blacklistPattern {
        param($body)

        if ($body -match '(?m)^\s*"gifyu\.com"\s*,?\s*$') {
            $script:changed = $true
            Write-Host 'External image blacklist: removed gifyu.com' -ForegroundColor Green
            return [regex]::Replace(
                $body,
                '(?m)^\s*"gifyu\.com"\s*,?\s*\r?\n?',
                ''
            )
        }

        Write-Host 'External image blacklist: gifyu.com is not blocked' -ForegroundColor Green
        return $body
    }

    # Ensure gifyu.com exists in whitelist, preserving valid Lua commas.
    $updated = Replace-BlockBody $updated $whitelistPattern {
        param($body)

        if ($body -match '(?m)^\s*"gifyu\.com"\s*,?\s*$') {
            Write-Host 'External image whitelist: gifyu.com already allowed' -ForegroundColor Green
            return $body
        }

        $lines = [System.Collections.Generic.List[string]]::new()
        foreach ($line in ($body -split '\r?\n')) {
            [void]$lines.Add($line)
        }

        $lastValueIndex = -1
        for ($i = $lines.Count - 1; $i -ge 0; $i--) {
            if ($lines[$i] -match '^\s*"[^"]+"\s*,?\s*(?:--.*)?$') {
                $lastValueIndex = $i
                break
            }
        }

        if ($lastValueIndex -ge 0 -and $lines[$lastValueIndex] -notmatch ',\s*(?:--.*)?$') {
            if ($lines[$lastValueIndex] -match '^(.*?)(\s*(?:--.*)?)$') {
                $lines[$lastValueIndex] = $Matches[1].TrimEnd() + ',' + $Matches[2]
            }
        }

        [void]$lines.Add('    "gifyu.com",')
        $script:changed = $true
        Write-Host 'External image whitelist: added gifyu.com' -ForegroundColor Green

        return ($lines -join [Environment]::NewLine)
    }

    # Verify each block separately.
    $allowMatch = [regex]::Match($updated, $allowPattern)
    $whitelistMatch = [regex]::Match($updated, $whitelistPattern)
    $blacklistMatch = [regex]::Match($updated, $blacklistPattern)

    $galleryOk =
        $allowMatch.Success -and
        ($allowMatch.Groups[2].Value -match '(?m)^\s*Gallery\s*=\s*true\s*,?')

    $whitelistOk =
        $whitelistMatch.Success -and
        ($whitelistMatch.Groups[2].Value -match '(?m)^\s*"gifyu\.com"\s*,?\s*$')

    $blacklistBad =
        $blacklistMatch.Success -and
        ($blacklistMatch.Groups[2].Value -match '(?m)^\s*"gifyu\.com"\s*,?\s*$')

    $missingCommaBad =
        $whitelistMatch.Success -and
        ($whitelistMatch.Groups[2].Value -match '(?m)^\s*"[^"]+"\s*$\r?\n\s*"[^"]+"')

    if (-not $galleryOk) { throw 'Verification failed: Gallery external imports are not enabled.' }
    if (-not $whitelistOk) { throw 'Verification failed: gifyu.com is not present in the whitelist.' }
    if ($blacklistBad) { throw 'Verification failed: gifyu.com is still present in the blacklist.' }
    if ($missingCommaBad) { throw 'Verification failed: whitelist contains adjacent strings without a comma.' }

    if ($changed) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = "$configPath.gifyu-backup-$stamp"
        Copy-Item -LiteralPath $configPath -Destination $backup -Force

        [IO.File]::WriteAllText($configPath, $updated, [Text.UTF8Encoding]::new($false))

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
