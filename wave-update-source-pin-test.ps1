# Regression: bootstrap and all build artifacts must use the same immutable commit.
# Run: pwsh -NoProfile -File ./wave-update-source-pin-test.ps1
$ErrorActionPreference = 'Stop'
$updater = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.ps1'))
$cmd = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'wave-update.cmd'))

foreach ($needle in @('git rev-parse origin/wave/dev', 'git show %WAVE_HEAD%:wave-update.ps1',
                      '-SourceCommit "%WAVE_HEAD%"')) {
    if (-not $cmd.Contains($needle)) { throw ('Bootstrap commit pin missing: ' + $needle) }
}
if (-not $updater.Contains('[string]$SourceCommit') -or
    -not $updater.Contains('$head=$SourceCommit.Trim()') -or
    -not $updater.Contains("cat-file','-e',(")) {
    throw 'Updater does not validate and accept a pinned source commit'
}
foreach ($part in @('BaseParts', 'AppParts', 'PatchParts')) {
    if (-not $updater.Contains(('Read-RemoteParts $head $' + $part))) {
        throw ('Unpinned package read: ' + $part)
    }
}
foreach ($patch in @('wave-v030-atomic-status.patch', 'wave-v030-idempotent-saves.patch',
                     'wave-v030-rate-limit.patch')) {
    if (-not $updater.Contains(("(" + '$head' + " + ':" + $patch + "')"))) {
        throw ('Unpinned patch read: ' + $patch)
    }
}
if ($updater.Contains('Read-RemoteParts $remoteRef') -or
    $updater.Contains("(" + '$remoteRef' + " + ':wave-v030-")) {
    throw 'Moving remote-tracking ref is still used to read build artifacts'
}

# Exercise the part reader with a fake git command to verify the ref is passed through.
$start = $updater.IndexOf('function Read-RemoteParts(')
$end = $updater.IndexOf("`ntry {", $start)
if ($start -lt 0 -or $end -le $start) { throw 'Part reader function not found' }
. ([ScriptBlock]::Create($updater.Substring($start, $end - $start)))
$script:seenRef = ''
function Invoke-RepoGit([string[]]$GitArgs) {
    if ($GitArgs.Count -ne 2 -or $GitArgs[0] -ne 'show') { throw 'Unexpected git arguments' }
    $script:seenRef = $GitArgs[1]
    return 'YQ=='
}
$sha = '0123456789abcdef0123456789abcdef01234567'
$encoded = Read-RemoteParts $sha @('wave-package.part00')
if ($encoded -ne 'YQ==' -or $script:seenRef -ne ("${sha}:wave-package.part00")) {
    throw 'Part reader did not use the pinned commit'
}
Write-Host 'WAVE immutable source commit regression: PASS'
