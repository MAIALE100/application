param(
    [string]$Branch = 'games/platform-core'
)

$ErrorActionPreference = 'Stop'
$MainRepo = Split-Path -Parent $MyInvocation.MyCommand.Path
$Worktree = Join-Path (Split-Path -Parent $MainRepo) '_flecity_games_release'
$OutputDir = Join-Path $MainRepo 'dist'

function Step([string]$Message) {
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Invoke-Git([string]$Repo, [string[]]$Args) {
    $old = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git -C $Repo @Args 2>&1
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $old
    }
    if ($code -ne 0) {
        throw ('git {0} failed: {1}' -f ($Args -join ' '), (($output | Out-String).Trim()))
    }
    return (($output | Out-String).Trim())
}

try {
    Step 'Fetching frozen LOOP source'
    if (-not (Test-Path (Join-Path $MainRepo '.git'))) {
        throw "Git repository was not found: $MainRepo"
    }

    Invoke-Git $MainRepo @('fetch','--prune','origin',$Branch) | Out-Null

    if (Test-Path -LiteralPath $Worktree) {
        if (-not (Test-Path -LiteralPath (Join-Path $Worktree '.git'))) {
            throw "Release worktree path exists but is not a Git worktree: $Worktree"
        }
    }
    else {
        Invoke-Git $MainRepo @('worktree','add','--detach',$Worktree,"origin/$Branch") | Out-Null
    }

    Invoke-Git $Worktree @('fetch','--prune','origin',$Branch) | Out-Null
    Invoke-Git $Worktree @('reset','--hard',"origin/$Branch") | Out-Null
    Invoke-Git $Worktree @('clean','-fd') | Out-Null

    $commit = (Invoke-Git $Worktree @('rev-parse','HEAD')).Trim()
    Write-Host ("Source commit: {0}" -f $commit) -ForegroundColor Green

    Step 'Locating Python'
    $pythonMode = $null
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        $pythonMode = 'py'
    }
    elseif (Get-Command python.exe -ErrorAction SilentlyContinue) {
        $pythonMode = 'python'
    }
    else {
        throw 'Python 3 was not found. Install Python 3 or run this build on a PC with Python available.'
    }

    $builder = Join-Path $Worktree 'flecity_games\tools\build_submission.py'
    if (-not (Test-Path -LiteralPath $builder)) {
        throw "Submission builder was not found: $builder"
    }

    Step 'Building LOOP v1.0.0 submission'
    $env:GITHUB_SHA = $commit
    if ($pythonMode -eq 'py') {
        & py.exe -3 $builder
    }
    else {
        & python.exe $builder
    }
    $buildCode = $LASTEXITCODE
    Remove-Item Env:GITHUB_SHA -ErrorAction SilentlyContinue
    if ($buildCode -ne 0) {
        throw "Submission builder failed with exit code $buildCode."
    }

    $sourceDist = Join-Path $Worktree 'dist'
    $zip = Get-ChildItem -LiteralPath $sourceDist -Filter 'flecity-games-loop-1.0.0.zip' | Select-Object -First 1
    if (-not $zip) {
        throw 'Submission ZIP was not generated.'
    }
    $checksum = Get-Item -LiteralPath ($zip.FullName + '.sha256') -ErrorAction Stop

    Step 'Copying verified release artifacts'
    New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
    $targetZip = Join-Path $OutputDir $zip.Name
    $targetChecksum = Join-Path $OutputDir $checksum.Name
    Copy-Item -LiteralPath $zip.FullName -Destination $targetZip -Force
    Copy-Item -LiteralPath $checksum.FullName -Destination $targetChecksum -Force

    $shaLine = (Get-Content -LiteralPath $targetChecksum -Raw).Trim()
    Write-Host ''
    Write-Host 'LOOP v1.0.0 submission package is ready.' -ForegroundColor Green
    Write-Host ("ZIP    : {0}" -f $targetZip)
    Write-Host ("SHA256 : {0}" -f $shaLine)
    Write-Host ("SOURCE : {0}" -f $commit)
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('RELEASE BUILD FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
