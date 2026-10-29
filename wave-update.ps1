param(
    [string]$ServerBase = 'D:\FiveM_Test_Server\txData\Qbox_D233FD.base',
    [string]$RepoRoot = '',
    [string]$SourceCommit = '',
    [switch]$NoFetch
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$RepoRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
$Branch = 'wave/dev'
$Resources = Join-Path $ServerBase 'resources'
$Destination = Join-Path $Resources '[lb-phone]\wave'
$ExpectedBaseSha256 = '34A84F4575F09CED45A58EF390272F9794F4D7CDCC548024A48FE5F899E16850'
$ExpectedAppSha256 = '1CE2C985AB072DB4F1C2B9C3D2194525EF619FF8456B154AE2DE18F513602262'
$ExpectedPatchSha256 = '6A91D4CDEFA0332119D00A1F72B6E3FDA0E54EDBF4564A716DDF0DC9AC65FAFE'
$ExpectedAtomicPatchSha256 = 'C722057B935C55593F29EE574FF2BF68AC2B02EA4E8895230C8F0DD6C5F66609'
$ExpectedSavePatchSha256 = '86F20CE3F4C47954930EDBB1EF6F6C207D4B855692B542DBF4C26EDC0A7189E9'
$ExpectedRatePatchSha256 = '1AEA1CB697E45917DBB001EEAF6A48EB40288A28CDC6233524FCD506B730340A'
$ExpectedReleaseFeedbackPatchSha256 = '2C9F73D757B0C04D7698CF48396EECCF4CAD54A2EE38247FDB917EF0E6DD0C6C'
$ExpectedPublishGuardPatchSha256 = '1E1D038401DE09EFAEB3FE73D3C88BF719572AE687BE63A992223B7723487F4B'
$ExpectedVersion = '0.3.6-test'
$BaseParts = @(
    'wave-package.part00','wave-package.part01','wave-package.part02','wave-package.part03',
    'wave-package.part04','wave-package.part05','wave-package.part06',
    'wave-package.part07a','wave-package.part07b','wave-package.part07c','wave-package.part07d',
    'wave-package.part07e','wave-package.part07f','wave-package.part07g','wave-package.part08'
)
$AppParts = @('wave-v022-app.part00','wave-v022-app.part01','wave-v022-app.part02')
$PatchParts = @(
    'wave-v030-patchb64.part00','wave-v030-patchb64.part01','wave-v030-patchb64.part02',
    'wave-v030-patchb64.part03','wave-v030-patchb64.part04','wave-v030-patchb64.part05'
)
$TempRoot = Join-Path ([IO.Path]::GetTempPath()) ('wave-update-' + [guid]::NewGuid().ToString('N'))
$ZipPath = Join-Path $TempRoot 'wave.zip'
$PatchPath = Join-Path $TempRoot 'wave-v030.patch'
$AtomicPatchPath = Join-Path $TempRoot 'wave-v030-atomic-status.patch'
$SavePatchPath = Join-Path $TempRoot 'wave-v030-idempotent-saves.patch'
$RatePatchPath = Join-Path $TempRoot 'wave-v030-rate-limit.patch'
$ReleaseFeedbackPatchPath = Join-Path $TempRoot 'wave-v031-release-feedback.patch'
$PublishGuardPatchPath = Join-Path $TempRoot 'wave-v032-publish-guard.patch'
$ExtractPath = Join-Path $TempRoot 'extract'
$StagePath = Join-Path $TempRoot 'stage\wave'
$BackupRoot = Join-Path $RepoRoot '.wave-backups'
$DeploymentStarted = $false
$DeploymentComplete = $false
$FirstInstallMoved = $false
$ActiveBackup = $null
$UpdateLock = $null
$UpdateLockPath = Join-Path ([IO.Path]::GetTempPath()) 'flecity-wave-update.lock'
$CriticalFiles = @('fxmanifest.lua','config\shared.lua','client\main.lua','server\main.lua','web\index.html','web\app.js','web\app.css','web\icon.svg')

function Step([string]$Message) { Write-Host ''; Write-Host ('==> ' + $Message) -ForegroundColor Cyan }
function Invoke-RepoGit([string[]]$GitArgs) {
    $old=$ErrorActionPreference
    try { $ErrorActionPreference='Continue'; $out=& git -C $RepoRoot @GitArgs 2>&1; $code=$LASTEXITCODE }
    finally { $ErrorActionPreference=$old }
    if ($code -ne 0) { throw ('git ' + ($GitArgs -join ' ') + ' failed: ' + (($out | ForEach-Object {$_.ToString()}) -join [Environment]::NewLine)) }
    return @($out | ForEach-Object {$_.ToString()})
}
function Enter-UpdateLock([string]$LockPath) {
    # FileShare.None excludes concurrent updater processes; a crashed process releases its handle.
    try {
        return [IO.File]::Open($LockPath, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch [IO.IOException] {
        throw 'Another WAVE update is running, or the update lock is unavailable. Retry after it finishes.'
    }
}
function Assert-SafeResourceTree([string]$Path,[bool]$InspectChildren = $true) {
    # A safe resource leaf is not enough: a parent (for example [lb-phone])
    # may itself be a junction pointing outside the server directory.
    # Inspect each path component via its parent's directory listing so that
    # dangling ancestor links are detected even when Test-Path returns false.
    $ancestor = $Path
    while ($true) {
        $ancestorParent = Split-Path -Parent $ancestor
        if ([string]::IsNullOrWhiteSpace($ancestorParent) -or $ancestorParent -eq $ancestor) { break }
        if (Test-Path -LiteralPath $ancestorParent -PathType Container) {
            $ancestorLeaf = Split-Path -Leaf $ancestor
            $ancestorItem = Get-ChildItem -LiteralPath $ancestorParent -Force |
                Where-Object { $_.Name -eq $ancestorLeaf } | Select-Object -First 1
            if ($ancestorItem -and ($ancestorItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw ('Unsafe WAVE path (reparse point): ' + $ancestorItem.FullName)
            }
        }
        $ancestor = $ancestorParent
    }
    # Enumerate direct children instead of following directory links recursively.
    # This also detects broken links whose targets do not pass Test-Path.
    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent -PathType Container)) { return }
    $leaf = Split-Path -Leaf $Path
    $rootItem = Get-ChildItem -LiteralPath $parent -Force |
        Where-Object { $_.Name -eq $leaf } | Select-Object -First 1
    if (-not $rootItem) { return }
    $pending = New-Object System.Collections.Stack
    $pending.Push($rootItem)
    while ($pending.Count -gt 0) {
        $item = $pending.Pop()
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw ('Unsafe WAVE path (reparse point): ' + $item.FullName)
        }
        if ($InspectChildren -and $item.PSIsContainer) {
            foreach ($child in @(Get-ChildItem -LiteralPath $item.FullName -Force)) {
                $pending.Push($child)
            }
        }
    }
}
function Test-DeploymentMatches([string]$BuiltSource,[string]$InstalledDestination,[bool]$IgnoreBuildMetadata = $true) {
    if (-not (Test-Path -LiteralPath $InstalledDestination -PathType Container)) { return $false }
    $builtFiles=@(Get-ChildItem -LiteralPath $BuiltSource -Recurse -File -Force)
    $installedFiles=@(Get-ChildItem -LiteralPath $InstalledDestination -Recurse -File -Force)
    if ($IgnoreBuildMetadata) {
        $installedFiles=@($installedFiles | Where-Object {
            $_.FullName -ne (Join-Path $InstalledDestination '.wave-build.txt')
        })
    }
    if ($builtFiles.Count -ne $installedFiles.Count) { return $false }
    foreach($file in $builtFiles) {
        $relative=$file.FullName.Substring($BuiltSource.Length + 1)
        $installed=Join-Path $InstalledDestination $relative
        if (-not (Test-Path -LiteralPath $installed -PathType Leaf)) { return $false }
        $builtHash=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        $installedHash=(Get-FileHash -LiteralPath $installed -Algorithm SHA256).Hash
        if ($builtHash -ne $installedHash) { return $false }
    }
    return $true
}
function Assert-DeploymentPreconditions([string]$InstalledDestination,[string]$VerifiedBackup) {
    # Refuse to overwrite changes made after the backup was verified.
    # Check before setting DeploymentStarted so a failed preflight cannot
    # trigger rollback and overwrite those newer files.
    Assert-SafeResourceTree $InstalledDestination
    if ($VerifiedBackup) {
        Assert-SafeResourceTree $VerifiedBackup
        if (-not (Test-DeploymentMatches $VerifiedBackup $InstalledDestination $false)) {
            throw 'Installed WAVE changed since backup; deployment aborted'
        }
    } elseif (Test-Path -LiteralPath $InstalledDestination) {
        throw 'WAVE destination appeared after preflight; deployment aborted'
    }
}
function Get-ExistingInstallRollbackAction([string]$BuiltSource,[string]$InstalledDestination,[string]$VerifiedBackup) {
    # An existing-install rollback must not delete changes made by another
    # process after deployment began. A missing destination is safe to restore.
    Assert-SafeResourceTree $InstalledDestination
    if (-not (Test-Path -LiteralPath $InstalledDestination)) { return 'restore' }
    if (Test-DeploymentMatches $VerifiedBackup $InstalledDestination $false) {
        return 'unchanged'
    }
    # The updater owns a complete copy of its staged build. Build metadata
    # may have been written just before an error, so ignore only that file.
    if (Test-DeploymentMatches $BuiltSource $InstalledDestination) {
        return 'restore'
    }
    return 'preserve'
}
function Test-FirstInstallRollbackSafe([string]$BuiltSource,[string]$InstalledDestination,[bool]$MoveCompleted) {
    # A failed Move-Item can leave a destination created by another process.
    # Delete only if our move completed and the files still match our build.
    if (-not $MoveCompleted) { return $false }
    Assert-SafeResourceTree $InstalledDestination
    return (Test-DeploymentMatches $BuiltSource $InstalledDestination $false)
}
function Invoke-BackupRetention([string]$Root,[string]$ProtectedBackup,[int]$Keep = 5) {
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return }
    # Recheck the backup root at cleanup time, not only at deployment preflight.
    # A linked root could otherwise redirect retention into an unrelated tree.
    Assert-SafeResourceTree $Root $false
    # Only remove updater-created backups. Never prune unrelated folders or junctions.
    $candidates = @(Get-ChildItem -LiteralPath $Root -Directory -Force | Where-Object {
        $_.Name -match '^\d{8}-\d{6}-[0-9a-fA-F]{8}$' -and
        -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)
    } | Sort-Object Name -Descending)
    $recent = @($candidates | Select-Object -First $Keep | ForEach-Object { $_.FullName })
    foreach ($candidate in $candidates) {
        if ($recent -contains $candidate.FullName -or
            ($ProtectedBackup -and $candidate.FullName -eq $ProtectedBackup)) { continue }
        # A backup can acquire a nested junction/link after creation. Never
        # recurse into a candidate until its entire tree has been inspected.
        try {
            # Check again immediately before deletion in case the root changed.
            Assert-SafeResourceTree $Root $false
            Assert-SafeResourceTree $candidate.FullName
        } catch {
            Write-Host ('Skipping unsafe WAVE backup: ' + $candidate.FullName + ' (' + $_.Exception.Message + ')') -ForegroundColor Yellow
            continue
        }
        Remove-Item -LiteralPath $candidate.FullName -Recurse -Force -ErrorAction Stop
    }
}
function Read-RemoteParts([string]$RemoteRef,[string[]]$Parts) {
    $builder=New-Object Text.StringBuilder
    foreach($part in $Parts) {
        $text=(Invoke-RepoGit @('show',($RemoteRef + ':' + $part)) -join '').Trim()
        if ($text -notmatch '^[A-Za-z0-9+/=]+$') { throw ('Invalid encoded data in ' + $part) }
        [void]$builder.Append($text)
    }
    return $builder.ToString()
}

try {
    $UpdateLock = Enter-UpdateLock $UpdateLockPath
    Step 'Checking repository and test server'
    if (-not (Test-Path (Join-Path $RepoRoot '.git'))) { throw 'Git repository not found' }
    if (-not (Test-Path $Resources)) { throw ('Test server resources folder not found: ' + $Resources) }
    if (-not $NoFetch) { Step 'Fetching latest WAVE build'; Invoke-RepoGit @('fetch','origin',$Branch) | Out-Null }
    $remoteRef='origin/' + $Branch
    # Pin every package and patch read to one immutable commit. A concurrent fetch
    # must not mix artifacts from different versions of origin/wave/dev.
    if ([string]::IsNullOrWhiteSpace($SourceCommit)) {
        $head=(Invoke-RepoGit @('rev-parse',$remoteRef) | Select-Object -First 1).Trim()
    } else {
        $head=$SourceCommit.Trim()
    }
    if ($head -notmatch '^[0-9a-fA-F]{40}$') { throw 'Invalid WAVE source commit SHA' }
    Invoke-RepoGit @('cat-file','-e',($head + '^{commit}')) | Out-Null
    Write-Host ('WAVE source: ' + $head.Substring(0,12)) -ForegroundColor DarkGray

    Step 'Reconstructing validated WAVE base'
    New-Item -ItemType Directory -Force -Path $TempRoot,$ExtractPath | Out-Null
    [IO.File]::WriteAllBytes($ZipPath,[Convert]::FromBase64String((Read-RemoteParts $head $BaseParts)))
    $baseHash=(Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($baseHash -ne $ExpectedBaseSha256) { throw ('WAVE base package hash mismatch: ' + $baseHash) }
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractPath -Force
    $Source=Join-Path $ExtractPath 'wave'

    Step 'Applying validated WAVE v0.2.2 app'
    $appPath=Join-Path $Source 'web\app.js'
    $compressed=[Convert]::FromBase64String((Read-RemoteParts $head $AppParts))
    $input=New-Object IO.MemoryStream(,$compressed)
    $gzip=New-Object IO.Compression.GzipStream($input,[IO.Compression.CompressionMode]::Decompress)
    $output=New-Object IO.MemoryStream
    try { $gzip.CopyTo($output); [IO.File]::WriteAllBytes($appPath,$output.ToArray()) }
    finally { $gzip.Dispose(); $input.Dispose(); $output.Dispose() }
    $appHash=(Get-FileHash $appPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($appHash -ne $ExpectedAppSha256) { throw ('WAVE v0.2.2 app hash mismatch: ' + $appHash) }
    $manifestPath=Join-Path $Source 'fxmanifest.lua'
    $manifestText=[IO.File]::ReadAllText($manifestPath)
    $manifestText=$manifestText.Replace("version '0.2.0-test'","version '0.2.2-test'")
    [IO.File]::WriteAllText($manifestPath,$manifestText,(New-Object Text.UTF8Encoding($false)))

    Step 'Applying WAVE v0.3.0 patch'
    [IO.File]::WriteAllBytes($PatchPath,[Convert]::FromBase64String((Read-RemoteParts $head $PatchParts)))
    $patchHash=(Get-FileHash -LiteralPath $PatchPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($patchHash -ne $ExpectedPatchSha256) { throw ('WAVE v0.3.0 patch hash mismatch: ' + $patchHash) }
    Write-Host 'v0.3.0 patch SHA256: PASS' -ForegroundColor Green
    # The historical v0.3.0 patch contains two incorrect CSS context selectors
    # (.album-public-chip spanp{). The validated v0.2.0 archive uses span{.
    # Correct only these two known context tokens after verifying the ORIGINAL SHA.
    # Do not modify the packaged source CSS or accept any unrecognized patch.
    $patchText=[IO.File]::ReadAllText($PatchPath)
    $badCssContext='.album-public-chip spanp{'
    $goodCssContext='.album-public-chip span{'
    $contextCount=([regex]::Matches($patchText,[regex]::Escape($badCssContext))).Count
    if ($contextCount -ne 2) {
        throw ('Unexpected WAVE CSS patch context; expected 2 known corrections, got ' + $contextCount)
    }
    $patchText=$patchText.Replace($badCssContext,$goodCssContext)
    [IO.File]::WriteAllText($PatchPath,$patchText,(New-Object Text.UTF8Encoding($false)))
    Write-Host 'v0.3.0 CSS context correction: PASS' -ForegroundColor Green
    $oldLocation=Get-Location
    try {
        Set-Location $Source
        & git apply --check --whitespace=nowarn $PatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE v0.3.0 patch preflight failed' }
        & git apply --whitespace=nowarn $PatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE v0.3.0 patch failed' }
    } finally { Set-Location $oldLocation }

    Step 'Applying WAVE atomic release-state patch'
    $atomicPatchText=((Invoke-RepoGit @('show',($head + ':wave-v030-atomic-status.patch'))) -join "`n").TrimEnd("`r","`n") + "`n"
    [IO.File]::WriteAllText($AtomicPatchPath,$atomicPatchText,(New-Object Text.UTF8Encoding($false)))
    $atomicPatchHash=(Get-FileHash -LiteralPath $AtomicPatchPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($atomicPatchHash -ne $ExpectedAtomicPatchSha256) { throw ('WAVE atomic patch hash mismatch: ' + $atomicPatchHash) }
    $oldLocation=Get-Location
    try {
        Set-Location $Source
        & git apply --check --whitespace=nowarn $AtomicPatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE atomic patch preflight failed' }
        & git apply --whitespace=nowarn $AtomicPatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE atomic patch failed' }
    } finally { Set-Location $oldLocation }
    Write-Host 'Atomic release-state patch: PASS' -ForegroundColor Green

    Step 'Applying WAVE idempotent-save patch'
    $savePatchText=((Invoke-RepoGit @('show',($head + ':wave-v030-idempotent-saves.patch'))) -join "`n").TrimEnd("`r","`n") + "`n"
    [IO.File]::WriteAllText($SavePatchPath,$savePatchText,(New-Object Text.UTF8Encoding($false)))
    $savePatchHash=(Get-FileHash -LiteralPath $SavePatchPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($savePatchHash -ne $ExpectedSavePatchSha256) { throw ('WAVE save patch hash mismatch: ' + $savePatchHash) }
    $oldLocation=Get-Location
    try {
        Set-Location $Source
        & git apply --check --whitespace=nowarn $SavePatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE save patch preflight failed' }
        & git apply --whitespace=nowarn $SavePatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE save patch failed' }
    } finally { Set-Location $oldLocation }
    Write-Host 'Idempotent-save patch: PASS' -ForegroundColor Green

    Step 'Applying WAVE rate-limit rollover patch'
    $ratePatchText=((Invoke-RepoGit @('show',($head + ':wave-v030-rate-limit.patch'))) -join "`n").TrimEnd("`r","`n") + "`n"
    [IO.File]::WriteAllText($RatePatchPath,$ratePatchText,(New-Object Text.UTF8Encoding($false)))
    $ratePatchHash=(Get-FileHash -LiteralPath $RatePatchPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($ratePatchHash -ne $ExpectedRatePatchSha256) { throw ('WAVE rate-limit patch hash mismatch: ' + $ratePatchHash) }
    $oldLocation=Get-Location
    try {
        Set-Location $Source
        & git apply --check --whitespace=nowarn $RatePatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE rate-limit patch preflight failed' }
        & git apply --whitespace=nowarn $RatePatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE rate-limit patch failed' }
    } finally { Set-Location $oldLocation }
    Write-Host 'Rate-limit rollover patch: PASS' -ForegroundColor Green

    Step 'Applying WAVE release-action feedback fix'
    [IO.File]::WriteAllBytes($ReleaseFeedbackPatchPath,[Convert]::FromBase64String((Read-RemoteParts $head @('wave-v031-release-feedback.patch.b64'))))
    $feedbackHash=(Get-FileHash -LiteralPath $ReleaseFeedbackPatchPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($feedbackHash -ne $ExpectedReleaseFeedbackPatchSha256) { throw ('WAVE release feedback patch hash mismatch: ' + $feedbackHash) }
    $oldLocation=Get-Location
    try {
        Set-Location $Source
        & git apply --check --whitespace=nowarn $ReleaseFeedbackPatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE release feedback patch preflight failed' }
        & git apply --whitespace=nowarn $ReleaseFeedbackPatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE release feedback patch failed' }
    } finally { Set-Location $oldLocation }
    $manifestText=[IO.File]::ReadAllText($manifestPath)
    if (-not $manifestText.Contains("version '0.3.0-test'")) { throw 'Unexpected WAVE version before release feedback update' }
    $manifestText=$manifestText.Replace("version '0.3.0-test'", "version '0.3.1-test'")
    [IO.File]::WriteAllText($manifestPath,$manifestText,(New-Object Text.UTF8Encoding($false)))
    Write-Host 'Release-action feedback patch: PASS' -ForegroundColor Green
    Step 'Applying WAVE duplicate-release prevention'
    $guardText=((Invoke-RepoGit @('show',($head + ':wave-v032-publish-guard.patch'))) -join "`n").TrimEnd("`r","`n") + "`n"
    [IO.File]::WriteAllText($PublishGuardPatchPath,$guardText,(New-Object Text.UTF8Encoding($false)))
    $guardHash=(Get-FileHash -LiteralPath $PublishGuardPatchPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($guardHash -ne $ExpectedPublishGuardPatchSha256) { throw ('WAVE publish guard patch hash mismatch: ' + $guardHash) }
    $oldLocation=Get-Location
    try {
        Set-Location $Source
        & git apply --check --whitespace=nowarn $PublishGuardPatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE duplicate-release patch preflight failed' }
        & git apply --whitespace=nowarn $PublishGuardPatchPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE duplicate-release patch failed' }
    } finally { Set-Location $oldLocation }
    $manifestText=[IO.File]::ReadAllText($manifestPath)
    if (-not $manifestText.Contains("version '0.3.1-test'")) { throw 'Unexpected WAVE version before duplicate-release fix' }
    $manifestText=$manifestText.Replace("version '0.3.1-test'", "version '0.3.2-test'")
    [IO.File]::WriteAllText($manifestPath,$manifestText,(New-Object Text.UTF8Encoding($false)))
    Write-Host 'Duplicate-release prevention patch: PASS' -ForegroundColor Green

    Step 'Applying WAVE v0.3.3 studio and library improvements'
    $extrasText=((Invoke-RepoGit @('show',($head + ':wave-v033-studio-extras.js'))) -join ([string][char]10)).TrimEnd([char]13,[char]10) + ([string][char]10)
    $extrasPath=Join-Path $Source 'web\studio-extras.js'
    [IO.File]::WriteAllText($extrasPath,$extrasText,(New-Object Text.UTF8Encoding($false)))
    $scoreToolsText=((Invoke-RepoGit @('show',($head + ':wave-v035-score-tools.js'))) -join ([string][char]10)).TrimEnd([char]13,[char]10) + ([string][char]10)
    $scoreToolsPath=Join-Path $Source 'web\score-tools.js'
    [IO.File]::WriteAllText($scoreToolsPath,$scoreToolsText,(New-Object Text.UTF8Encoding($false)))
    $scoreToolsHash=(Get-FileHash -LiteralPath $scoreToolsPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($scoreToolsHash -ne '06C4E1E89AC24506FA08420D9139EA4C825EB93FEBE5980742B50AF62E4D545B') {
        throw ('WAVE long score tools SHA mismatch: ' + $scoreToolsHash)
    }
    $extrasHash=(Get-FileHash -LiteralPath $extrasPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($extrasHash -ne '689AE752C16F91F9CB11E95A74204043A210BF24658802B50A0543A7308DA27B') {
        throw ('WAVE studio template script SHA mismatch: ' + $extrasHash)
    }

    $appText=[IO.File]::ReadAllText($appPath)
    $deletedContext='state.ownReleases = r.tracks || [];'
    if (-not $appText.Contains($deletedContext)) { throw 'WAVE deleted release list context missing' }
    if ($appText.Split([string[]]@($deletedContext),[StringSplitOptions]::None).Length -ne 2) { throw 'Ambiguous WAVE deleted release list context' }
    $appText=$appText.Replace($deletedContext,"state.ownReleases = (r.tracks || []).filter(track => track.status !== 'deleted');")
    [IO.File]::WriteAllText($appPath,$appText,(New-Object Text.UTF8Encoding($false)))

    $cssPath=Join-Path $Source 'web\app.css'
    $cssText=[IO.File]::ReadAllText($cssPath)
    $extraCss=@'

/* WAVE_STUDIO_PRESETS_V033: scrollbar hidden, scrolling retained. */
/* CEF/Chrome uses WebKit scrollbar geometry on the document and nested scroll regions.
   Hide only vertical tracks; keep horizontal piano-roll navigation functional. */
html,body,#app,.view,.app,.screen,.content,.page,.card{scrollbar-width:none}
html::-webkit-scrollbar,body::-webkit-scrollbar,#app::-webkit-scrollbar,.view::-webkit-scrollbar,.app::-webkit-scrollbar,.screen::-webkit-scrollbar,.content::-webkit-scrollbar,.page::-webkit-scrollbar,.card::-webkit-scrollbar{width:0;display:none}
*::-webkit-scrollbar{width:0!important}
*::-webkit-scrollbar:vertical{width:0!important;display:none}
*::-webkit-scrollbar-thumb:vertical{background:transparent}
.wave-bar-navigator{margin-bottom:.55rem}
.wave-bar-head{display:flex;justify-content:space-between;gap:.35rem;align-items:center}
.wave-bar-controls{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:.35rem}
.wave-bar-steps{display:flex;gap:.22rem;flex-wrap:wrap;margin-top:.35rem}
.wave-bar-step{min-width:1.8rem}
.wave-bar-hint{font-size:.63rem;margin-top:.35rem}
.wave-template-card{margin-bottom:.55rem}
.wave-template-controls{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.45rem;margin-top:.4rem}
.wave-template-controls select{min-width:0}
.wave-template-controls button{white-space:nowrap}
.wave-template-info{font-size:.66rem;margin-top:.35rem}
.wave-template-warning{color:#fecdd3}
.wave-score-quick{display:flex;flex-direction:column;gap:.38rem;margin-top:.5rem}
.wave-score-quick-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.35rem;align-items:center}
.wave-score-quick-row:nth-child(2){grid-template-columns:auto minmax(0,1fr) auto}
.wave-score-quick-row label{font-size:.68rem}
.wave-score-quick-row input{min-width:0;max-width:100%;box-sizing:border-box}
#waveScoreEstimate,#waveScoreMessage{font-size:.66rem;line-height:1.4}
'@
    if ($cssText.Contains('WAVE_STUDIO_PRESETS_V033')) { throw 'WAVE studio stylesheet is already patched' }
    [IO.File]::WriteAllText($cssPath,($cssText + $extraCss),(New-Object Text.UTF8Encoding($false)))

    $htmlPath=Join-Path $Source 'web\index.html'
    $htmlText=[IO.File]::ReadAllText($htmlPath)
    if (-not $htmlText.Contains('</body>')) { throw 'Cannot find WAVE document footer' }
    $htmlText=$htmlText.Replace('</body>',"  <script src='studio-extras.js'></script>" + [Environment]::NewLine + '</body>')
    if (-not $htmlText.Contains("<script src='studio-extras.js'></script>")) { throw 'WAVE studio extras script reference missing' }
    $htmlText=$htmlText.Replace("<script src='studio-extras.js'></script>","<script src='studio-extras.js'></script>" + [Environment]::NewLine + "  <script src='score-tools.js'></script>")
    [IO.File]::WriteAllText($htmlPath,$htmlText,(New-Object Text.UTF8Encoding($false)))

    $manifestText=[IO.File]::ReadAllText($manifestPath)
    # The existing manifest registers all web assets via 'web/**/*'. No per-file entry needed.
    if (-not $manifestText.Contains("'web/**/*'")) { throw 'WAVE manifest web asset glob missing' }
    if (-not $manifestText.Contains("version '0.3.2-test'")) { throw 'WAVE manifest version before studio update is unexpected' }
    $manifestText=$manifestText.Replace("version '0.3.2-test'","version '0.3.6-test'")
    [IO.File]::WriteAllText($manifestPath,$manifestText,(New-Object Text.UTF8Encoding($false)))
    Write-Host 'WAVE v0.3.3 studio templates and cleaner library: PASS' -ForegroundColor Green

    Step 'Running WAVE safety checks'
    foreach($required in $CriticalFiles) {
        if (-not (Test-Path (Join-Path $Source $required))) { throw ('Missing required WAVE file: ' + $required) }
    }
    $manifest=[IO.File]::ReadAllText((Join-Path $Source 'fxmanifest.lua'))
    if ($manifest -notmatch ("version\s+'" + [regex]::Escape($ExpectedVersion) + "'")) { throw 'Unexpected WAVE version after patch' }
    $app=[IO.File]::ReadAllText($appPath)
    if ($app -match '\b(?:prompt|confirm)\s*\(') { throw 'Blocking browser prompt/confirm found in WAVE app.js' }
    if ($app -notmatch 'WAVE_PUBLISH_DIAGNOSTICS_V023' -or $app -notmatch 'requestId') { throw 'Publish diagnostics wiring missing' }
    if ($app -notmatch 'WAVE_RELEASE_ACTION_FEEDBACK_V031' -or $app -notmatch 'ownReleaseFeedback') { throw 'Own-release feedback wiring missing' }
    if ($app -notmatch "track.status !== 'deleted'") { throw 'Deleted releases are still visible in the owner library' }
    $extras=[IO.File]::ReadAllText((Join-Path $Source 'web\studio-extras.js'))
    if ($extras -notmatch 'WAVE_STUDIO_PRESETS_V033' -or $extras -notmatch 'enhanceTimbres' -or $extras -notmatch 'WAVE_BAR_NAVIGATOR_V034') { throw 'WAVE studio templates, bar navigation or timbre enhancement missing' }
    $scoreTools=[IO.File]::ReadAllText($scoreToolsPath)
    if ($scoreTools -notmatch 'WAVE_LONG_SCORE_TOOLS_V035' -or $scoreTools -notmatch 'durationLabel' -or $scoreTools -notmatch 'WAVE_RANGE_EDIT_V036') { throw 'WAVE long score tools missing' }
    $html=[IO.File]::ReadAllText((Join-Path $Source 'web\index.html'))
    if ($html -notmatch 'studio-extras.js' -or $html -notmatch 'score-tools.js') { throw 'WAVE score tools scripts not loaded in HTML' }
    if (-not $manifest.Contains("'web/**/*'")) { throw 'WAVE manifest does not cover studio extras script' }
    $server=[IO.File]::ReadAllText((Join-Path $Source 'server\main.lua'))
    if ($server -notmatch 'wave_schema_meta' -or $server -notmatch 'wave:listOwnTracks' -or $server -notmatch 'wave:updateOwnTrack') { throw 'WAVE v0.3.0 server wiring missing' }
    if ($server -notmatch 'Atomic status predicates' -or $app -notmatch 'ERROR_TEXT.TRACK_STATE_CHANGED') { throw 'WAVE release-state safety patch missing' }
    if ($server -notmatch 'A no-op UPDATE can report zero affected rows' -or $server -notmatch 'Re-saving unchanged metadata') { throw 'WAVE idempotent-save patch missing' }
    if ($server -notmatch 'A new caller must not be throttled at uptime zero') { throw 'WAVE rate-limit patch missing' }
    if ($server -notmatch 'PROJECT_ALREADY_RELEASED' -or $server -notmatch 'publishingProjects\[key\] = nil' -or $app -notmatch 'ERROR_TEXT.PROJECT_ALREADY_RELEASED') { throw 'WAVE duplicate-release protection missing' }
    $config=[IO.File]::ReadAllText((Join-Path $Source 'config\shared.lua'))
    if ($config -notmatch 'SchemaVersion\s*=\s*3') { throw 'WAVE schema version mismatch' }
    $css=[IO.File]::ReadAllText((Join-Path $Source 'web\app.css'))
    if ($css -match '(?<![A-Za-z0-9_-])-?\d*\.?\d+px\b') { throw 'CSS contains px units while LB Phone fixBlur is enabled' }
    if ($css -notmatch '\*::\-webkit-scrollbar\{width:0!important\}') { throw 'WAVE scrollbar hiding is missing' }
    $node=Get-Command node -ErrorAction SilentlyContinue
    if ($node) {
        & $node.Source --check $appPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE JavaScript syntax check failed' }
        & $node.Source --check $extrasPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE studio extras JavaScript syntax check failed' }
        & $node.Source --check $scoreToolsPath
        if ($LASTEXITCODE -ne 0) { throw 'WAVE score tools JavaScript syntax check failed' }
        Write-Host 'JavaScript syntax: PASS' -ForegroundColor Green
    }
    else { Write-Host 'JavaScript syntax: SKIPPED (node not found)' -ForegroundColor Yellow }

    $lua=Get-Command luac54 -ErrorAction SilentlyContinue
    if (-not $lua) { $lua=Get-Command luac5.4 -ErrorAction SilentlyContinue }
    if (-not $lua) { $lua=Get-Command luac -ErrorAction SilentlyContinue }
    if ($lua) {
        Get-ChildItem -LiteralPath $Source -Recurse -Filter '*.lua' -File | ForEach-Object {
            & $lua.Source -p $_.FullName
            if ($LASTEXITCODE -ne 0) { throw ('WAVE Lua syntax check failed: ' + $_.FullName) }
        }
        Write-Host 'Lua syntax: PASS' -ForegroundColor Green
    } else { Write-Host 'Lua syntax: SKIPPED (luac not found; CI validates Lua)' -ForegroundColor Yellow }

    Step 'Checking WAVE path safety'
    Assert-SafeResourceTree $Destination
    Assert-SafeResourceTree $BackupRoot $false

    Step 'Checking duplicate WAVE resources'
    $duplicates=Get-ChildItem -LiteralPath $Resources -Recurse -Filter fxmanifest.lua -File -ErrorAction SilentlyContinue | Where-Object {$_.Directory.Name -eq 'wave' -and $_.Directory.FullName -ne $Destination} | Select-Object -ExpandProperty DirectoryName -Unique
    if ($duplicates) { $duplicates | ForEach-Object {Write-Host ('  ' + $_) -ForegroundColor Yellow}; throw 'Duplicate WAVE resource found' }

    Step 'Checking whether WAVE is already current'
    if (Test-DeploymentMatches $Source $Destination) {
        Write-Host 'Deployment verification: PASS (unchanged)' -ForegroundColor Green
        Step 'WAVE already up to date'
        Write-Host 'No resource replacement, backup or server restart needed.' -ForegroundColor Green
        exit 0
    }

    Step 'Staging WAVE resource'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $StagePath) | Out-Null
    Copy-Item -LiteralPath $Source -Destination $StagePath -Recurse -Force
    if (-not (Test-DeploymentMatches $Source $StagePath $false)) {
        throw 'Staged WAVE files do not match validated build'
    }
    Write-Host 'Staging verification: PASS' -ForegroundColor Green
    if (Test-Path -LiteralPath $Destination) {
        Step 'Backing up current WAVE resource'
        New-Item -ItemType Directory -Force -Path $BackupRoot | Out-Null
        $backup=Join-Path $BackupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
        Copy-Item -LiteralPath $Destination -Destination $backup -Recurse -Force
        if (-not (Test-DeploymentMatches $Destination $backup $false)) {
            throw 'Backup WAVE files do not match installed resource; deployment aborted'
        }
        $ActiveBackup=$backup
        Write-Host 'Backup verification: PASS' -ForegroundColor Green
    }

    Step 'Deploying WAVE to the test server'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $Destination) | Out-Null
    Assert-DeploymentPreconditions $Destination $ActiveBackup
    $DeploymentStarted=$true
    if (Test-Path -LiteralPath $Destination) {
        Remove-Item -LiteralPath $Destination -Recurse -Force
    }
    Move-Item -LiteralPath $StagePath -Destination $Destination
    if (-not $ActiveBackup) { $FirstInstallMoved = $true }

    Step 'Verifying deployed WAVE resource'
    $sourceFiles=@(Get-ChildItem -LiteralPath $Source -Recurse -File -Force)
    $deployedFiles=@(Get-ChildItem -LiteralPath $Destination -Recurse -File -Force)
    if ($sourceFiles.Count -ne $deployedFiles.Count) { throw 'Deployed WAVE file count mismatch' }
    foreach($sourceFile in $sourceFiles) {
        $relative=$sourceFile.FullName.Substring($Source.Length + 1)
        $deployedFile=Join-Path $Destination $relative
        if (-not (Test-Path -LiteralPath $deployedFile)) { throw ('Deployed WAVE file missing: ' + $relative) }
        $sourceHash=(Get-FileHash -LiteralPath $sourceFile.FullName -Algorithm SHA256).Hash
        $deployedHash=(Get-FileHash -LiteralPath $deployedFile -Algorithm SHA256).Hash
        if ($sourceHash -ne $deployedHash) { throw ('Deployed WAVE file verification failed: ' + $relative) }
    }
    @('branch=' + $Branch,'commit=' + $head,'base_sha256=' + $baseHash,'version=' + $ExpectedVersion,'installed=' + (Get-Date -Format o)) | Set-Content -LiteralPath (Join-Path $Destination '.wave-build.txt') -Encoding UTF8
    $DeploymentComplete=$true
    # Retention is housekeeping: a cleanup error must never turn a verified
    # deployment into a false failure. Preserve the rollback source in any case.
    try {
        Invoke-BackupRetention $BackupRoot $ActiveBackup 5
    } catch {
        Write-Host ('Backup cleanup skipped: ' + $_.Exception.Message) -ForegroundColor Yellow
    }
    Write-Host 'Deployment verification: PASS' -ForegroundColor Green

    Step 'WAVE deployment complete'
    Write-Host ('Installed: ' + $Destination) -ForegroundColor Green
    Write-Host 'txAdmin: refresh ; restart wave ; wave_selftest' -ForegroundColor Cyan
    exit 0
} catch {
    Write-Host ''
    Write-Host ('WAVE UPDATE FAILED: ' + $_.Exception.Message) -ForegroundColor Red
    if ($DeploymentStarted -and -not $DeploymentComplete) {
        try {
            if ($ActiveBackup -and (Test-Path -LiteralPath $ActiveBackup)) {
                Assert-SafeResourceTree $ActiveBackup
                $rollbackAction = Get-ExistingInstallRollbackAction $Source $Destination $ActiveBackup
                if ($rollbackAction -eq 'unchanged') {
                    Write-Host 'Previous WAVE resource is already intact; rollback not needed.' -ForegroundColor Green
                } elseif ($rollbackAction -eq 'preserve') {
                    Write-Host 'Preserving changed WAVE destination; automatic rollback would overwrite unverified files.' -ForegroundColor Yellow
                } else {
                    Write-Host 'Restoring previous WAVE resource...' -ForegroundColor Yellow
                    Assert-SafeResourceTree $Destination
                    if (Test-Path -LiteralPath $Destination) {
                        Remove-Item -LiteralPath $Destination -Recurse -Force
                    }
                    Copy-Item -LiteralPath $ActiveBackup -Destination $Destination -Recurse -Force
                    if (-not (Test-DeploymentMatches $ActiveBackup $Destination $false)) {
                        throw 'Restored WAVE resource failed hash verification'
                    }
                    Write-Host 'Previous WAVE resource restored and verified.' -ForegroundColor Green
                }
            } elseif (Test-Path -LiteralPath $Destination) {
                # Preserve another process's files if the move failed or if
                # installed content changed before rollback could complete.
                Assert-SafeResourceTree $Destination
                if (Test-FirstInstallRollbackSafe $Source $Destination $FirstInstallMoved) {
                    Write-Host 'Removing incomplete first installation...' -ForegroundColor Yellow
                    Remove-Item -LiteralPath $Destination -Recurse -Force
                } else {
                    Write-Host 'Preserving first-install destination (ownership/content not verified).' -ForegroundColor Yellow
                }
            }
        } catch {
            Write-Host ('ROLLBACK FAILED: ' + $_.Exception.Message) -ForegroundColor Red
        }
    }
    exit 1
}
finally {
    if ($UpdateLock) { $UpdateLock.Dispose() }
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
