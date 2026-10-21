param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base'
)

$ErrorActionPreference='Stop'
$RepoRoot=Split-Path -Parent $MyInvocation.MyCommand.Path
$Source=Join-Path $RepoRoot 'flecity_dev_safety'
$Resources=Join-Path $ServerBase 'resources'
$Destination=Join-Path $Resources 'flecity_dev_safety'
$Cfg=Join-Path $ServerBase 'server.cfg'

if(-not (Test-Path -LiteralPath $Source)){throw "Missing source: $Source"}
if(-not (Test-Path -LiteralPath $Cfg)){throw "Missing server.cfg: $Cfg"}

if(Test-Path -LiteralPath $Destination){Remove-Item -LiteralPath $Destination -Recurse -Force}
Copy-Item -LiteralPath $Source -Destination $Destination -Recurse -Force

$cfgText=[System.IO.File]::ReadAllText($Cfg)
if($cfgText -notmatch '(?im)^\s*ensure\s+flecity_dev_safety\s*$'){
    Add-Content -LiteralPath $Cfg -Value ([Environment]::NewLine+'# Flecity development-only player safety'+[Environment]::NewLine+'ensure flecity_dev_safety'+[Environment]::NewLine) -Encoding UTF8
}

Write-Host ''
Write-Host 'Flecity DEV Safety installed.' -ForegroundColor Green
Write-Host 'Future server starts will enable it automatically.' -ForegroundColor Green
Write-Host ''
Write-Host 'For the currently running server, run this once in txAdmin:' -ForegroundColor Yellow
Write-Host '    ensure flecity_dev_safety' -ForegroundColor White
