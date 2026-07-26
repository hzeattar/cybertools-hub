@echo off
setlocal
cd /d "%~dp0"
echo CyberTools Desktop Bridge - Free Local Validation
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0validate-local.ps1" -InstallMissingTools
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo Validation completed successfully.
) else (
  echo Validation failed. Check the newest file inside validation-logs.
)
pause
exit /b %RESULT%
