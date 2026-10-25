@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 goto :failed

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0lbphone-gifyu-fix.ps1"
set "FIX_RC=%ERRORLEVEL%"

echo.
if "%FIX_RC%"=="0" (
  echo LB Phone Gifyu configuration check finished.
) else (
  echo LB Phone Gifyu configuration check failed. Review the messages above.
)
echo.
pause
exit /b %FIX_RC%

:failed
echo.
echo Could not open the repository folder.
pause
exit /b 1
