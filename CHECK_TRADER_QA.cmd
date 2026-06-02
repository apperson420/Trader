@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 call npm test || exit /b 1
powershell -ExecutionPolicy Bypass -File tools\qa-fallback.ps1
exit /b %ERRORLEVEL%
