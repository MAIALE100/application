@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0games-update.ps1"
if errorlevel 1 (
    echo.
    echo Flecity Games update failed. Keep this window open and send the error screen.
    echo.
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
exit /b 0
