@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0games-update.ps1"
if errorlevel 1 (
    echo.
    echo Update failed. Review the message above.
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
exit /b 0
