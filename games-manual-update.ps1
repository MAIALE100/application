param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base'
)

$ErrorActionPreference = 'Stop'
$MainRepo = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'games/party-dev'
$Worktree = Join-Path (Split-Path -Parent $MainRepo) '_flecity_games_manual'
$DisableScript = Join-Path $MainRepo 'games-auto-update-disable.ps1'

function Step([string]$Message){
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

try {
    Step 'Disabling background auto update'
    if(Test-Path -LiteralPath $DisableScript){
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $DisableScript | Out-Null
    }

    Step 'Fetching latest PARTY development build'
    $old=$ErrorActionPreference
    try {
        $ErrorActionPreference='Continue'
        $fetch=& git -C $MainRepo fetch --prune origin $Branch 2>&1
        $fetchCode=$LASTEXITCODE
    } finally {
        $ErrorActionPreference=$old
    }
    if($fetchCode -ne 0){
        throw ('git fetch failed: ' + (($fetch|Out-String).Trim()))
    }

    if(Test-Path -LiteralPath $Worktree){
        if(-not (Test-Path -LiteralPath (Join-Path $Worktree '.git'))){
            throw "Manual update folder exists but is not a Git worktree: $Worktree"
        }
    } else {
        $old=$ErrorActionPreference
        try {
            $ErrorActionPreference='Continue'
            $out=& git -C $MainRepo worktree add --detach $Worktree "origin/$Branch" 2>&1
            $code=$LASTEXITCODE
        } finally {
            $ErrorActionPreference=$old
        }
        if($code -ne 0){
            throw ('git worktree add failed: ' + (($out|Out-String).Trim()))
        }
    }

    $commands=@(
        @('fetch','--prune','origin',$Branch),
        @('reset','--hard',"origin/$Branch"),
        @('clean','-fd')
    )

    foreach($args in $commands){
        $old=$ErrorActionPreference
        try {
            $ErrorActionPreference='Continue'
            $out=& git -C $Worktree @args 2>&1
            $code=$LASTEXITCODE
        } finally {
            $ErrorActionPreference=$old
        }
        if($code -ne 0){
            throw ('git {0} failed: {1}' -f ($args -join ' '),(($out|Out-String).Trim()))
        }
    }

    $Updater=Join-Path $Worktree 'games-update.ps1'
    if(-not (Test-Path -LiteralPath $Updater)){
        throw "Updater missing from manual worktree: $Updater"
    }

    Step 'Validating updater syntax'
    $tokens=$null
    $parseErrors=$null
    [void][System.Management.Automation.Language.Parser]::ParseFile($Updater,[ref]$tokens,[ref]$parseErrors)
    if($parseErrors -and $parseErrors.Count -gt 0){
        $summary=($parseErrors | ForEach-Object { $_.Message }) -join '; '
        throw ('Updater syntax validation failed before deployment: ' + $summary)
    }

    Step 'Deploying Flecity Games to the test server'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Updater -ServerBase $ServerBase -NoGitSync
    $deployCode=$LASTEXITCODE
    if($deployCode -ne 0){
        throw "Flecity Games deployment failed with exit code $deployCode."
    }

    Step 'Manual update complete'
    Write-Host 'PARTY development files are updated.' -ForegroundColor Green
    Write-Host 'If the updater requested ONE-TIME HELPER ACTIVATION, run only:' -ForegroundColor Yellow
    Write-Host '    restart flecity_dev_safety' -ForegroundColor White
    Write-Host 'The helper will refresh metadata and restart flecity_games automatically.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('MANUAL UPDATE FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
