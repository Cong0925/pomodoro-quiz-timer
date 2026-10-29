@echo off
rem web-app one-click start (logic in start-webapp.ps1, UTF-8 BOM)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-webapp.ps1"
echo.
pause
