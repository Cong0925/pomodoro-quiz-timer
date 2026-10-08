@echo off
chcp 65001 >nul
title 刷题计时器 - 停止
echo 正在停止刷题计时器服务，请稍候...
powershell -NoProfile -Command "$procs = Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'node.exe' -and ($_.CommandLine -like '*server/index.js*' -or $_.CommandLine -like '*npm-cli.js*start*')) -or ($_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*quiz-timer-server*') }; $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Write-Output ('已停止 ' + @($procs).Count + ' 个相关进程')"
timeout /t 2 /nobreak >nul
exit