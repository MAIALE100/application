@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0mining-test.ps1"
set RC=%ERRORLEVEL%

echo.
if not "%RC%"=="0" (
  echo Mining one-click test reported an error.
) else (
  echo Mining one-click test finished.
)
echo.
pause
exit /b %RC%
