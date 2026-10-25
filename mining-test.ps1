param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [string]$TxAdminUrl = 'http://127.0.0.1:40120',
    [switch]$NoGitSync,
    [switch]$NoOpenTxAdmin
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$UpdateScript = Join-Path $RepoRoot 'mining-update.ps1'

$BridgeDestination = Join-Path (Join-Path $ServerBase 'resources') 'flecity_mining_devbridge'
$RequestFile = Join-Path $BridgeDestination 'reload.request'
$ResultFile = Join-Path $BridgeDestination 'last-result.txt'

function Step([string]$message) {
    Write-Host ''
    Write-Host ('==> ' + $message) -ForegroundColor Cyan
}

try {
    if (-not (Test-Path $UpdateScript)) {
        throw "Update script was not found: $UpdateScript"
    }

    Step 'Updating and deploying mining build'

    $args = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $UpdateScript,
        '-ServerBase', $ServerBase
    )
    if ($NoGitSync) {
        $args += '-NoGitSync'
    }

    & powershell.exe @args
    if ($LASTEXITCODE -ne 0) {
        throw 'mining-update.ps1 failed.'
    }

    if (-not (Test-Path $BridgeDestination)) {
        throw "DEV bridge was not deployed: $BridgeDestination"
    }

    Step 'Requesting server-side reload'
    $token = ('{0}-{1}' -f [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds(), $PID)
    Set-Content -Path $RequestFile -Value $token -Encoding Ascii

    $deadline = [DateTime]::UtcNow.AddSeconds(8)
    $completed = $false
    $failed = $false
    $detail = $null

    while ([DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 250

        if (-not (Test-Path $ResultFile)) {
            continue
        }

        $line = (Get-Content $ResultFile -Raw).Trim()
        if (-not $line.StartsWith($token + '|')) {
            continue
        }

        $parts = $line.Split('|')
        $status = if ($parts.Length -ge 2) { $parts[1] } else { 'UNKNOWN' }
        $detail = if ($parts.Length -ge 3) { $parts[2] } else { '' }

        if ($status -eq 'PASS') {
            $completed = $true
        }
        else {
            $failed = $true
        }
        break
    }

    if ($completed) {
        Step 'One-click mining reload complete'
        Write-Host 'flecity_mining restarted successfully.' -ForegroundColor Green
        Write-Host 'Selftest / healthcheck / configcheck / economy were issued by the DEV bridge.' -ForegroundColor Green
        exit 0
    }

    if ($failed) {
        throw ("DEV bridge reported failure: " + $detail)
    }

    Step 'DEV bridge needs one-time bootstrap'

    $bootstrap = @(
        'refresh',
        'ensure flecity_mining_devbridge'
    )

    try {
        Set-Clipboard -Value ($bootstrap -join [Environment]::NewLine)
        Write-Host 'Bootstrap commands copied to clipboard.' -ForegroundColor Green
    }
    catch {
        Write-Host 'Could not copy commands to clipboard.' -ForegroundColor Yellow
    }

    if (-not $NoOpenTxAdmin) {
        try {
            Start-Process $TxAdminUrl
            Write-Host ("Opened txAdmin: " + $TxAdminUrl) -ForegroundColor Green
        }
        catch {
            Write-Host ("Could not open txAdmin automatically: " + $TxAdminUrl) -ForegroundColor Yellow
        }
    }

    Write-Host ''
    Write-Host 'This is required only once for the currently running test server:' -ForegroundColor Yellow
    Write-Host '    refresh' -ForegroundColor White
    Write-Host '    ensure flecity_mining_devbridge' -ForegroundColor White
    Write-Host ''
    Write-Host 'The reload request is already waiting. Once the bridge starts, it will automatically:' -ForegroundColor Cyan
    Write-Host '    restart flecity_mining' -ForegroundColor White
    Write-Host '    mining_selftest' -ForegroundColor White
    Write-Host '    mining_healthcheck' -ForegroundColor White
    Write-Host '    mining_configcheck' -ForegroundColor White
    Write-Host '    mining_economy' -ForegroundColor White
    Write-Host ''
    Write-Host 'Future runs of mining-test.cmd should require no txAdmin typing.' -ForegroundColor Green
}
catch {
    Write-Host ''
    Write-Host ('Mining one-click test failed: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
}
