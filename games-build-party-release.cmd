@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0games-build-party-release.ps1"
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (
  echo Flecity Games PARTY release build finished.
) else (
  echo Flecity Games PARTY release build failed.
)
pause
exit /b %CODE%
