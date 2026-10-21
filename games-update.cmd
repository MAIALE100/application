@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 goto :failed

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0games-update.ps1"
set "UPDATE_RC=%ERRORLEVEL%"

echo.
if "%UPDATE_RC%"=="0" (
  echo Flecity Games update finished.
) else (
  echo Flecity Games update failed. Review the messages above.
)
echo.
pause
exit /b %UPDATE_RC%

:failed
echo.
echo Could not open the Flecity Games repository folder.
pause
exit /b 1
