param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base'
)

$ErrorActionPreference='Stop'
$RepoRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$Source=Join-Path $RepoRoot 'flecity_dev_safety'
$Resources=Join-Path $ServerBase 'resources'
$Destination=Join-Path $Resources 'flecity_dev_safety'
$Cfg=Join-Path $ServerBase 'server.cfg'

# Development-only AFK protection. Detect the installed AFK config instead of
# assuming a specific [qb]/[qbx] folder layout.
$AfkPatched=$false
$AfkConfigPath=$null
try {
    $candidateFiles=Get-ChildItem -LiteralPath $Resources -Recurse -File -Filter '*.lua' -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match 'config' }
    foreach($candidate in $candidateFiles){
        $text=[System.IO.File]::ReadAllText($candidate.FullName)
        if($text -notmatch 'Config\.AFK' -or $text -notmatch 'secondsUntilKick') { continue }

        $updated=$text
        $updated=[regex]::Replace($updated,'(?im)(secondsUntilKick\s*=\s*)\d+','$12147483647')
        $updated=[regex]::Replace($updated,'(?im)(kickInCharMenu\s*=\s*)(true|false)','$1false')

        if($updated -ne $text){
            $backup=$candidate.FullName+'.flecity-dev-afk.bak'
            if(-not (Test-Path -LiteralPath $backup)){
                [System.IO.File]::WriteAllText($backup,$text,[System.Text.UTF8Encoding]::new($false))
            }
            [System.IO.File]::WriteAllText($candidate.FullName,$updated,[System.Text.UTF8Encoding]::new($false))
        }
        $AfkPatched=$true
        $AfkConfigPath=$candidate.FullName
        break
    }
}catch{
    Write-Warning ('AFK protection scan failed: '+$_.Exception.Message)
}

if(-not (Test-Path -LiteralPath $Source)){throw "Missing source: $Source"}
if(-not (Test-Path -LiteralPath $Cfg)){throw "Missing server.cfg: $Cfg"}

New-Item -ItemType Directory -Force -Path $Destination | Out-Null
& robocopy $Source $Destination /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS /NP /XF games-reload.request games-reload.ack games-reloader-v1.active
if($LASTEXITCODE -gt 7){throw "DEV Safety copy failed with exit code $LASTEXITCODE"}

$cfgText=[System.IO.File]::ReadAllText($Cfg)
if($cfgText -notmatch '(?im)^\s*ensure\s+flecity_dev_safety\s*$'){
    Add-Content -LiteralPath $Cfg -Value ([Environment]::NewLine+'# Flecity development-only player safety'+[Environment]::NewLine+'ensure flecity_dev_safety'+[Environment]::NewLine) -Encoding UTF8
}

Write-Host ''
Write-Host 'Flecity DEV Safety installed.' -ForegroundColor Green
Write-Host 'Future server starts will enable it automatically.' -ForegroundColor Green
Write-Host ''
if($AfkPatched){
    Write-Host ('AFK kick disabled for DEV config: '+$AfkConfigPath) -ForegroundColor Green
}else{
    Write-Host 'AFK config was not found automatically. DEV Safety itself was still installed.' -ForegroundColor Yellow
}
Write-Host ''
Write-Host 'For the currently running server, run these once in txAdmin:' -ForegroundColor Yellow
Write-Host '    restart flecity_dev_safety' -ForegroundColor White
if($AfkPatched){
    $resourceName=Split-Path -Leaf (Split-Path -Parent $AfkConfigPath)
    Write-Host ('    restart '+$resourceName) -ForegroundColor White
}
