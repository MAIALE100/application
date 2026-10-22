param(
    [string]$Path = "D:\FiveM_Dev\application"
)

$ErrorActionPreference = "Stop"
$Repo = "https://github.com/MAIALE100/application.git"
$Branch = "games/party-dev"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "Git が見つかりません。先に Git for Windows をインストールしてください。"
}

if (Test-Path (Join-Path $Path ".git")) {
    Write-Host "既存リポジトリを更新します: $Path"
    git -C $Path fetch origin
    git -C $Path checkout $Branch
    git -C $Path pull --ff-only origin $Branch
} else {
    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Write-Host "PARTY開発ブランチをcloneします: $Path"
    git clone --branch $Branch $Repo $Path
}

git -C $Path config pull.ff only
Write-Host ""
Write-Host "PARTY開発環境の同期が完了しました。"
Write-Host "Branch: $Branch"
Write-Host "Path:   $Path"
