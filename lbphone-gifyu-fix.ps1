param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base'
)

$ErrorActionPreference = 'Stop'

function Step([string]$Message){
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Find-LBPhoneConfig([string]$Base){
    $resources = Join-Path $Base 'resources'
    if(-not (Test-Path -LiteralPath $resources)){
        throw "FiveM resources folder not found: $resources"
    }

    $candidates = @(
        (Join-Path $resources '[lb-phone]\lb-phone\config\config.lua'),
        (Join-Path $resources 'lb-phone\config\config.lua')
    )

    foreach($candidate in $candidates){
        if(Test-Path -LiteralPath $candidate){ return $candidate }
    }

    $resourceDirs = Get-ChildItem -LiteralPath $resources -Directory -Recurse -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq 'lb-phone' }

    foreach($dir in $resourceDirs){
        $candidate = Join-Path $dir.FullName 'config\config.lua'
        if(Test-Path -LiteralPath $candidate){ return $candidate }
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

    $allowPattern = '(?s)(Config\.AllowExternal\s*=\s*\{)(.*?)(\r?\n\})'
    $allowMatch = [regex]::Match($updated,$allowPattern)
    if(-not $allowMatch.Success){
        throw 'Config.AllowExternal block was not found. No changes were written.'
    }

    $allowBody = $allowMatch.Groups[2].Value
    if($allowBody -match '(?m)^\s*Gallery\s*=\s*false\s*,?'){
        $newBody = [regex]::Replace(
            $allowBody,
            '(?m)^(\s*Gallery\s*=\s*)false(\s*,?)',
            '$1true$2',
            1
        )
        $updated = $updated.Substring(0,$allowMatch.Groups[2].Index) + $newBody + $updated.Substring($allowMatch.Groups[2].Index + $allowMatch.Groups[2].Length)
        $changed = $true
        Write-Host 'External Gallery imports: ENABLED' -ForegroundColor Green
    } elseif($allowBody -match '(?m)^\s*Gallery\s*=\s*true\s*,?'){
        Write-Host 'External Gallery imports: already enabled' -ForegroundColor Green
    } else {
        throw 'Config.AllowExternal.Gallery was not found. No changes were written.'
    }

    $domainPattern = '(?s)(Config\.ExternalWhitelistedDomains\s*=\s*\{)(.*?)(\r?\n\})'
    $domainMatch = [regex]::Match($updated,$domainPattern)
    if(-not $domainMatch.Success){
        throw 'Config.ExternalWhitelistedDomains block was not found. No changes were written.'
    }

    $domainBody = $domainMatch.Groups[2].Value
    if($domainBody -notmatch '["'']gifyu\.com["'']'){
        $insertion = [Environment]::NewLine + '    "gifyu.com",'
        $newBody = $domainBody + $insertion
        $updated = $updated.Substring(0,$domainMatch.Groups[2].Index) + $newBody + $updated.Substring($domainMatch.Groups[2].Index + $domainMatch.Groups[2].Length)
        $changed = $true
        Write-Host 'External image domain: added gifyu.com (includes subdomains)' -ForegroundColor Green
    } else {
        Write-Host 'External image domain: gifyu.com already allowed' -ForegroundColor Green
    }

    if($updated -match '(?s)Config\.ExternalBlacklistedDomains\s*=\s*\{.*?["'']gifyu\.com["''].*?\}'){
        throw 'gifyu.com is also blacklisted in ExternalBlacklistedDomains. Remove that blacklist entry before using Gifyu.'
    }

    if($changed){
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = "$configPath.gifyu-backup-$stamp"
        Copy-Item -LiteralPath $configPath -Destination $backup -Force

        [IO.File]::WriteAllText($configPath,$updated,[Text.UTF8Encoding]::new($false))

        $verify = [IO.File]::ReadAllText($configPath)
        $galleryOk = $verify -match '(?s)Config\.AllowExternal\s*=\s*\{.*?Gallery\s*=\s*true'
        $domainOk = $verify -match '(?s)Config\.ExternalWhitelistedDomains\s*=\s*\{.*?["'']gifyu\.com["'']'

        if(-not ($galleryOk -and $domainOk)){
            Copy-Item -LiteralPath $backup -Destination $configPath -Force
            throw "Verification failed. Original config restored from: $backup"
        }

        Write-Host ''
        Write-Host 'LB Phone Gifyu support updated successfully.' -ForegroundColor Green
        Write-Host ("Backup: {0}" -f $backup) -ForegroundColor DarkGray
        Write-Host 'Run this once in txAdmin:' -ForegroundColor Yellow
        Write-Host '    restart lb-phone' -ForegroundColor White
    } else {
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
