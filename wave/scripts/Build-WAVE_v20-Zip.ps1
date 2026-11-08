param(
  [Parameter(Mandatory=$true)] [string]$PackageRoot,
  [Parameter(Mandatory=$true)] [string]$Destination
)

$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$package=(Resolve-Path -LiteralPath $PackageRoot).Path.TrimEnd('\')
$destinationParent=Split-Path -Parent $Destination
if(-not(Test-Path -LiteralPath $destinationParent -PathType Container)){throw "Destination directory missing: $destinationParent"}
if(Test-Path -LiteralPath $Destination){throw "Refusing to overwrite existing candidate: $Destination"}

$files=@()
foreach($file in Get-ChildItem -LiteralPath $package -File -Recurse -Force){
  $relative=$file.FullName.Substring($package.Length+1).Replace('\','/')
  if($relative -eq 'scripts/WAVE_Test_Server.local.cmd' -or $relative.StartsWith('logs/')){continue}
  if($relative -match '(^|/)([^/]*\.(sql|dump|env|bak))$'){throw "Refusing to package private data: $relative"}
  $files+=,[pscustomobject]@{File=$file;Relative=$relative;Hash=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToUpperInvariant()}
}
$files=@($files|Sort-Object Relative)
if($files.Count -ne 27){throw "Unexpected package entry count: $($files.Count); expected 27."}
if(@($files|Where-Object{$_.Relative -eq 'scripts/WAVE_Test_Server.local.cmd'}).Count -ne 0){throw 'Local server configuration must not be included.'}

$stream=[System.IO.File]::Open($Destination,[System.IO.FileMode]::CreateNew,[System.IO.FileAccess]::ReadWrite,[System.IO.FileShare]::None)
try{
  $archive=[System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create,$false)
  try{
    foreach($item in $files){[void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$item.File.FullName,$item.Relative,[System.IO.Compression.CompressionLevel]::Optimal)}
  }finally{$archive.Dispose()}
}finally{$stream.Dispose()}

$zip=[System.IO.Compression.ZipFile]::OpenRead($Destination)
try{
  $actual=@($zip.Entries|ForEach-Object FullName|Sort-Object)
  $expected=@($files|ForEach-Object Relative|Sort-Object)
  if((Compare-Object $expected $actual).Count -gt 0){throw 'ZIP entries differ from the reviewed package contents.'}
  foreach($entry in $zip.Entries){
    $item=$files|Where-Object{$_.Relative -ceq $entry.FullName}|Select-Object -First 1
    if(-not$item){throw "Unexpected ZIP entry: $($entry.FullName)"}
    $entryStream=$entry.Open()
    try{$sha=[System.Security.Cryptography.SHA256]::Create();try{$digest=[BitConverter]::ToString($sha.ComputeHash($entryStream)).Replace('-','')}finally{$sha.Dispose()}}finally{$entryStream.Dispose()}
    if($digest -cne $item.Hash){throw "ZIP entry hash mismatch: $($entry.FullName)"}
  }
}finally{$zip.Dispose()}
$zipHash=(Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToUpperInvariant()
Write-Output ('ZIP PASS: entries={0}; local server settings and logs excluded; sha256={1}' -f $files.Count,$zipHash)
