@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 goto :failed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0wave-update.ps1"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo WAVE update finished.
) else (
  echo WAVE update failed. Review the messages above.
)
echo.
pause
exit /b %RC%
:failed
echo Could not open the WAVE repository folder.
pause
exit /b 1
