@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
if not exist "%~dp0..\logs" mkdir "%~dp0..\logs"
for /f %%T in ('powershell.exe -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss_fff"') do set "STAMP=%%T"
set "LOG=%~dp0..\logs\WAVE_v20_RINGTONE_VERIFY_%STAMP%.log"
echo [CMD] WAVE v20 ringtone verification started at %DATE% %TIME%>"%LOG%"
set "RC=0"
if not exist "%~dp0WAVE_Test_Server.local.cmd" (echo Missing scripts\WAVE_Test_Server.local.cmd>>"%LOG%"&set "RC=3"&goto finish)
call "%~dp0WAVE_Test_Server.local.cmd" >>"%LOG%" 2>&1
if not defined WAVE_RESOURCE_PATH (echo WAVE_RESOURCE_PATH is missing>>"%LOG%"&set "RC=3"&goto finish)
if not defined WAVE_BACKUP_ROOT (echo WAVE_BACKUP_ROOT is missing>>"%LOG%"&set "RC=3"&goto finish)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0WAVE_v20_RingtonePatch.ps1" -Mode Verify -ResourcePath "%WAVE_RESOURCE_PATH%" -BackupRoot "%WAVE_BACKUP_ROOT%" >>"%LOG%" 2>&1
set "RC=%ERRORLEVEL%"
:finish
if "%RC%"=="0" (echo [CMD] RESULT=PASS>>"%LOG%") else (echo [CMD] RESULT=FAIL; EXIT_CODE=%RC%>>"%LOG%")
echo [CMD] Log saved: %LOG%
type "%LOG%"
echo.
echo Press any key to close this window.
pause >nul
exit /b %RC%
