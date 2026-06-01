@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File tools\qa-fallback.ps1
exit /b %ERRORLEVEL%
