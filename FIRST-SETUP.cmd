@echo off
setlocal EnableExtensions
chcp 65001 >nul
title Flecity 3 Apps - First Setup

set "REPO=D:\FiveM_Dev\application"

echo.
echo ==========================================
echo  Flecity 3 Apps - First Setup
echo  PuriPhoto / Photo Diary / FRAME
echo ==========================================
echo.

if not exist "%REPO%\.git" (
  echo Default repository was not found:
  echo   %REPO%
  echo.
  set /p "REPO=Enter the MAIALE100\application folder: "
)

if not exist "%REPO%\.git" (
  echo.
  echo ERROR: Git repository was not found.
  echo Send this CMD window to ChatGPT.
  pause
  exit /b 1
)

cd /d "%REPO%"

echo [1/3] Fetching GitHub...
git fetch origin frame-integration-test
if errorlevel 1 goto :error

echo [2/3] Switching to frame-integration-test...
git show-ref --verify --quiet refs/heads/frame-integration-test
if errorlevel 1 (
  git checkout -b frame-integration-test --track origin/frame-integration-test
) else (
  git checkout frame-integration-test
)
if errorlevel 1 goto :error

git pull --ff-only origin frame-integration-test
if errorlevel 1 goto :error

echo [3/3] Running first setup...
call "%REPO%\3apps-setup.cmd"
exit /b %errorlevel%

:error
echo.
echo ERROR: First setup failed.
echo Send this CMD window to ChatGPT.
pause
exit /b 1
