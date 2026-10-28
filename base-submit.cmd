@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0base-submit.ps1" %*
if errorlevel 1 (
    echo.
    echo BASE submission build failed.
    pause
    exit /b 1
)
echo.
pause
