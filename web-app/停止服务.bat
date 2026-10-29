@echo off
rem web-app one-click stop (logic in stop-webapp.ps1, UTF-8 BOM)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-webapp.ps1"
echo.
pause
