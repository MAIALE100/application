param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [string]$AutoRoot = '',
    [int]$PollSeconds = 30,
    [int]$StableSeconds = 45,
    [switch]$SkipInitialDeploy
)

$ErrorActionPreference = 'Stop'
$SourceRepo = Split-Path -Parent $MyInvocation.MyCommand.Path
$Branch = 'games/party-dev'
$TaskName = 'Flecity Games Auto Update'
$StateDir = Join-Path $env:LOCALAPPDATA 'FlecityGamesAutoUpdate'
$InstalledMarker = Join-Path $StateDir 'installed.flag'
$DisabledMarker = Join-Path $StateDir 'disabled.flag'

if ([string]::IsNullOrWhiteSpace($AutoRoot)) {
    $AutoRoot = Join-Path (Split-Path -Parent $SourceRepo) '_flecity_games_auto'
}

function Step([string]$Message) {
    Write-Host ''
    Write-Host ('==> ' + $Message) -ForegroundColor Cyan
}

function Run-Git([string]$WorkingTree,[string[]]$Arguments) {
    $previousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $output = & git -C $WorkingTree @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0) {
        throw ('git {0} failed with exit code {1}: {2}' -f ($Arguments -join ' '),$exitCode,(($output | Out-String).Trim()))
    }
    return (($output | Out-String).Trim())
}

try {
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

    Step 'Preparing isolated Flecity Games auto-update worktree'
    if (-not (Test-Path (Join-Path $SourceRepo '.git'))) {
        throw "Git repository was not found: $SourceRepo"
    }

    Run-Git $SourceRepo @('fetch','--prune','origin',$Branch) | Out-Null

    if (Test-Path $AutoRoot) {
        if (-not (Test-Path (Join-Path $AutoRoot '.git'))) {
            throw "Auto-update path already exists but is not a Git worktree: $AutoRoot"
        }
    }
    else {
        $previousPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            $output = & git -C $SourceRepo worktree add --detach $AutoRoot "origin/$Branch" 2>&1
            $exitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousPreference
        }
        if ($exitCode -ne 0) {
            throw ('git worktree add failed with exit code {0}: {1}' -f $exitCode,(($output | Out-String).Trim()))
        }
    }

    Run-Git $AutoRoot @('fetch','--prune','origin',$Branch) | Out-Null
    Run-Git $AutoRoot @('reset','--hard',"origin/$Branch") | Out-Null
    Run-Git $AutoRoot @('clean','-fd') | Out-Null

    $Watcher = Join-Path $AutoRoot 'games-auto-update.ps1'
    $OneShot = Join-Path $AutoRoot 'games-auto-update-once.ps1'
    $Updater = Join-Path $AutoRoot 'games-update.ps1'
    if (-not (Test-Path $Watcher)) { throw "Watcher is missing: $Watcher" }
    if (-not (Test-Path $OneShot)) { throw "One-shot updater is missing: $OneShot" }
    if (-not (Test-Path $Updater)) { throw "Updater is missing: $Updater" }

    if (-not $SkipInitialDeploy) {
        Step 'Deploying current Flecity Games build once'
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Updater -ServerBase $ServerBase -NoGitSync
        if ($LASTEXITCODE -ne 0) {
            Write-Host 'Initial deployment failed. The background watcher will keep retrying after setup.' -ForegroundColor Yellow
        }
    }

    Step 'Registering resilient Windows automatic update task'
    $q = [char]34
    $argument = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $q$OneShot$q -ServerBase $q$ServerBase$q -StableSeconds $StableSeconds"
    $registered = $false

    try {
        Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
            Where-Object {
                $_.CommandLine -and (
                    $_.CommandLine -match 'games-auto-update\.ps1' -or
                    $_.CommandLine -match 'games-auto-update-once\.ps1'
                )
            } |
            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    } catch {}

    try {
        Import-Module ScheduledTasks -ErrorAction Stop
        $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($existingTask) {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
            Start-Sleep -Milliseconds 500
        }
        $user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $argument
        $loginTrigger = New-ScheduledTaskTrigger -AtLogOn -User $user
        $repeatTrigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Days 3650)
        $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
        $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger @($loginTrigger,$repeatTrigger) -Principal $principal -Settings $settings -Description 'Checks games/party-dev every minute and deploys verified Flecity Games updates.' -Force | Out-Null
        Start-ScheduledTask -TaskName $TaskName
        $registered = $true
        Write-Host 'Windows Scheduled Task registered: one-shot check every minute.' -ForegroundColor Green
    }
    catch {
        Write-Host ("Scheduled Task registration failed: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    }

    if (-not $registered) {
        Step 'Using Startup-folder fallback'
        $startup = [Environment]::GetFolderPath('Startup')
        if ([string]::IsNullOrWhiteSpace($startup)) { throw 'Could not resolve the Windows Startup folder.' }
        $startupCmd = Join-Path $startup 'Flecity Games Auto Update.cmd'
        $line1 = '@echo off'
        $line2 = 'start "" powershell.exe ' + $argument
        Set-Content -Path $startupCmd -Value @($line1,$line2) -Encoding ASCII
        Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $argument | Out-Null
        Write-Host "Startup fallback installed. Task Scheduler repeating checks are preferred." -ForegroundColor Yellow
    }

    Remove-Item $DisabledMarker -Force -ErrorAction SilentlyContinue
    Set-Content -Path $InstalledMarker -Value @(
        ('installed=' + (Get-Date -Format o)),
        ('worktree=' + $AutoRoot),
        ('server=' + $ServerBase)
    ) -Encoding UTF8

    Step 'Automatic updates enabled'
    Write-Host "Watch branch : $Branch"
    Write-Host "Auto worktree: $AutoRoot"
    Write-Host "Test server  : $ServerBase"
    Write-Host "Check        : every 1 minute (one-shot task)"
    Write-Host "Stabilize    : $StableSeconds seconds before deploy"
    Write-Host "Log          : $(Join-Path $StateDir 'auto-update.log')"
    Write-Host ''
    Write-Host 'From now on, verified Flecity Games updates deploy automatically.' -ForegroundColor Green
    Write-Host 'No full FiveM server restart is required; flecity_games reloads itself.' -ForegroundColor Green
    exit 0
}
catch {
    Write-Host ''
    Write-Host ('AUTO UPDATE SETUP FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ''
    exit 1
}
