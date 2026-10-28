@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 goto :failed
where git >nul 2>&1
if errorlevel 1 goto :nogit
echo.
echo ==> Fetching latest WAVE updater
git fetch origin wave/dev
if errorlevel 1 goto :fetchfailed
rem Pin the updater and all build parts to the same fetched commit.
set "WAVE_HEAD="
set "UPDATER_TEMP="
for /f "delims=" %%H in ('git rev-parse origin/wave/dev 2^>nul') do set "WAVE_HEAD=%%H"
if not defined WAVE_HEAD goto :updaterfailed
set "UPDATER_TEMP=%TEMP%\wave-updater-%RANDOM%-%RANDOM%.ps1"
git show %WAVE_HEAD%:wave-update.ps1 > "%UPDATER_TEMP%"
if errorlevel 1 goto :updaterfailed
for %%I in ("%UPDATER_TEMP%") do if %%~zI EQU 0 goto :updaterfailed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%UPDATER_TEMP%" -RepoRoot "%~dp0." -SourceCommit "%WAVE_HEAD%" -NoFetch
set "RC=%ERRORLEVEL%"
del /q "%UPDATER_TEMP%" >nul 2>&1
goto :result

:updaterfailed
if defined UPDATER_TEMP del /q "%UPDATER_TEMP%" >nul 2>&1
echo WAVE updater could not be loaded from wave/dev.
goto :failed
:fetchfailed
echo Could not fetch wave/dev. Existing server files were not changed.
goto :failed
:nogit
echo Git was not found in PATH.
goto :failed
:failed
set "RC=1"
:result
echo.
if "%RC%"=="0" (
  echo WAVE update finished.
) else (
  echo WAVE update failed. Review the messages above.
)
echo.
pause
exit /b %RC%
