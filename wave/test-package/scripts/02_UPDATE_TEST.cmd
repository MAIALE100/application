@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
if not exist "%~dp0WAVE_Test_Server.local.cmd" (echo Missing scripts\WAVE_Test_Server.local.cmd&pause&exit /b 3)
call "%~dp0WAVE_Test_Server.local.cmd"
if not defined WAVE_RESOURCE_PATH (echo WAVE_RESOURCE_PATH is missing&pause&exit /b 3)
if not defined WAVE_BACKUP_ROOT (echo WAVE_BACKUP_ROOT is missing&pause&exit /b 3)
if not exist "%~dp0..\logs" mkdir "%~dp0..\logs"
for /f %%T in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss_fff"') do set "STAMP=%%T"
set "LOG=%~dp0..\logs\WAVE_v20_APPLY_%STAMP%.log"
echo [CMD] WAVE v20 APPLY started at %DATE% %TIME%>"%LOG%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0WAVE_v20_Update.ps1" -Mode Apply -ResourcePath "%WAVE_RESOURCE_PATH%" -BackupRoot "%WAVE_BACKUP_ROOT%" >>"%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
if "%RC%"=="0" (echo [CMD] RESULT=PASS>>"%LOG%") else (echo [CMD] RESULT=FAIL; EXIT_CODE=%RC%>>"%LOG%")
echo [CMD] Log saved: %LOG%
type "%LOG%"
echo.
echo Press any key to close this window.
pause >nul
exit /b %RC%
