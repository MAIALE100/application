@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 goto :failed

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0games-update.ps1"
set "UPDATE_RC=%ERRORLEVEL%"
if not "%UPDATE_RC%"=="0" goto :failed

exit /b 0

:failed
echo.
echo Update failed. Review the message above.
pause
exit /b 1
