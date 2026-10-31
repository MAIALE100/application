param(
    [ValidateRange(0,10000)][int]$GuardProbeMilliseconds = 0,
    [ValidatePattern('^$|^[a-f0-9]{32}$')][string]$GuardProbeId = ''
)
$ErrorActionPreference = 'Stop'
$workspaceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$stateRoot = Join-Path $workspaceRoot '.flecity-dev\automation'
if ($GuardProbeMilliseconds -gt 0) {
    if (-not $GuardProbeId) { throw 'Guard probes require a unique fixture ID' }
    $stateRoot = Join-Path $stateRoot "probes\$GuardProbeId"
} elseif ($GuardProbeId) { throw 'Fixture ID is only allowed for guard probes' }
[IO.Directory]::CreateDirectory($stateRoot) | Out-Null
$sha = [Security.Cryptography.SHA256]::Create()
$key = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($workspaceRoot.ToLowerInvariant() + $GuardProbeId)))).Replace('-', '')
$sha.Dispose()
# The OS owns this mutex: an abandoned owner can be recovered without deleting a live lock.
$mutex = New-Object Threading.Mutex($false, "Global\FlecityAutoDev_$key")
$held = $false
$leasePath = Join-Path $stateRoot 'lease.json'
$nonce = [guid]::NewGuid().ToString()
$exitCode = 1
try {
    try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { Write-Output 'BLOCKED: another Flecity automation owns the workspace mutex'; exit 75 }
    if (Test-Path -LiteralPath $leasePath) {
        # Preserve stale evidence; no source, backup, or existing live process is touched.
        Move-Item -LiteralPath $leasePath -Destination (Join-Path $stateRoot "abandoned-$nonce.json")
    }
    @{ nonce=$nonce; pid=$PID; workspace=$workspaceRoot; acquiredUtc=[DateTime]::UtcNow.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath $leasePath -Encoding UTF8
    $env:FLECITY_AUTODEV_LEASE = $nonce
    if ($GuardProbeMilliseconds -gt 0) {
        [Threading.Thread]::Sleep($GuardProbeMilliseconds)
        $exitCode = 0
    } else {
        Push-Location -LiteralPath $workspaceRoot
        try { & (Get-Command node -ErrorAction Stop).Source (Join-Path $PSScriptRoot 'automation-run.mjs'); $exitCode = $LASTEXITCODE }
        finally { Pop-Location }
    }
} finally {
    if ($held) {
        if (Test-Path -LiteralPath $leasePath) {
            $lease = Get-Content -LiteralPath $leasePath -Raw | ConvertFrom-Json
            if ($lease.nonce -eq $nonce) { Remove-Item -LiteralPath $leasePath }
        }
        Remove-Item Env:FLECITY_AUTODEV_LEASE -ErrorAction SilentlyContinue
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
exit $exitCode
