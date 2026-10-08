@echo off
chcp 65001 >nul
title 刷题计时器 - 启动
cd /d "%~dp0"

echo ============================================
echo   刷题计时器 - 前后端分离版
echo ============================================

if not exist node_modules (
    echo.
    echo [首次运行] 正在安装依赖，请稍候...
    call npm install
    if errorlevel 1 (
        echo 依赖安装失败，请检查网络后重试
        pause
        exit /b 1
    )
)

echo.
echo [启动] 正在启动服务（窗口将最小化到任务栏）...
start "quiz-timer-server" /min cmd /c "npm start"

echo [等待] 正在等待服务就绪（最多 20 秒）...
set /a tries=0

:waitloop
set /a tries+=1
if %tries% gtr 20 goto giveup
timeout /t 1 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:3000/api/health' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 goto ready
goto waitloop

:giveup
echo [警告] 服务启动超时，请检查：
echo       1. MySQL 是否已启动
echo       2. 端口 3000 是否被其他程序占用
echo   仍将尝试打开浏览器，如无法访问请检查以上两项。
goto open

:ready
echo [就绪] 服务已启动成功！

:open
start "" "http://localhost:3000"
echo.
echo 浏览器已自动打开：http://localhost:3000
echo 服务在任务栏最小化窗口（标题 quiz-timer-server）中运行。
echo 需要停止时，双击「停止服务.bat」即可，或直接关闭那个最小化窗口。
echo.
timeout /t 5 /nobreak >nul
exit