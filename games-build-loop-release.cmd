@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0games-build-loop-release.ps1"
set "code=%errorlevel%"
echo.
if not "%code%"=="0" (
  echo Flecity Games LOOP release build failed.
) else (
  echo Flecity Games LOOP release build finished.
)
pause
exit /b %code%
