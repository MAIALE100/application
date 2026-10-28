$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$OutputDirectory = Join-Path $RepoRoot 'dist'
$Temp = Join-Path $env:TEMP ('flecity_base_release_checkout_' + [guid]::NewGuid().ToString('N'))
$worktreeAdded = $false

function Run-Git {
    param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Arguments)
    & git -C $RepoRoot @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw ('git failed: ' + ($Arguments -join ' '))
    }
}

try {
    Write-Host ''
    Write-Host '==> Preparing independent BASE beta submission' -ForegroundColor Cyan
    Run-Git fetch --prune origin base/workspace-dev
    Run-Git worktree add --detach $Temp FETCH_HEAD
    $worktreeAdded = $true

    $script = Join-Path $Temp 'base-package.ps1'
    if (-not (Test-Path -LiteralPath $script)) {
        throw 'BASE packaging script was not found on base/workspace-dev.'
    }

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -OutputDirectory $OutputDirectory
    if ($LASTEXITCODE -ne 0) {
        throw 'BASE submission build failed. No ZIP should be submitted.'
    }

    Write-Host ''
    Write-Host 'BASE operator ZIP is in:' -ForegroundColor Green
    Write-Host ('    ' + $OutputDirectory) -ForegroundColor White
}
catch {
    Write-Host ('BASE SUBMISSION FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
finally {
    if ($worktreeAdded -and (Test-Path -LiteralPath $Temp)) {
        & git -C $RepoRoot worktree remove --force $Temp 2>$null
    }
    if (Test-Path -LiteralPath $Temp) {
        Remove-Item -LiteralPath $Temp -Recurse -Force -ErrorAction SilentlyContinue
    }
}
