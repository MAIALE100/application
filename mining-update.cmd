@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0mining-update.ps1"
if errorlevel 1 (
  echo.
  echo Mining update failed.
  pause
  exit /b 1
)
echo.
echo Mining update completed.
pause
