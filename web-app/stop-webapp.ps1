# ============================================================
# stop-webapp.ps1 — web-app 前后端一键停止（由 停止服务.bat 调用）
# 编码要求：UTF-8 with BOM
# 三层清理：控制台窗口整树 → 监听端口 → 残留 node 兜底
# ============================================================
$ErrorActionPreference = 'Continue'

Write-Host '正在停止 web-app 前后端服务，请稍候...' -ForegroundColor Cyan

# 1) 关闭启动.bat 的控制台窗口（标题含「web-app 服务」），/T 连带杀整棵进程树
$wins = @(Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*web-app 服务*' })
foreach ($w in $wins) { taskkill /F /T /PID $w.Id 2>$null | Out-Null }
Write-Host "已关闭服务控制台窗口 $($wins.Count) 个"

# 2) 按监听端口清理（8888 后端 / 8889 前端），防窗口已关但进程残留
$portPids = @(Get-NetTCPConnection -LocalPort 8888, 8889 -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($p in $portPids) { taskkill /F /T /PID $p 2>$null | Out-Null }
Write-Host "按端口停止 $($portPids.Count) 个服务进程"

# 3) 兜底：清理 node --watch 监督进程、vite、web-app 路径下的残留
$left = @(Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'node.exe' -and (
        $_.CommandLine -like '*--watch index.js*' -or
        $_.CommandLine -like '*web-app\frontend*' -or
        $_.CommandLine -like '*web-app\backend*'
    )
})
foreach ($p in $left) { taskkill /F /T /PID $p.ProcessId 2>$null | Out-Null }
Write-Host "清理残留 node 进程 $($left.Count) 个"

Start-Sleep -Seconds 2
$still = @(Get-NetTCPConnection -LocalPort 8888, 8889 -State Listen -ErrorAction SilentlyContinue)
if ($still.Count -eq 0) {
    Write-Host '[完成] 前后端服务已全部停止。' -ForegroundColor Green
} else {
    Write-Host '[警告] 仍有端口被占用，请检查：' -ForegroundColor Yellow
    foreach ($c in $still) { Write-Host ("  {0}:{1} PID={2}" -f $c.LocalAddress, $c.LocalPort, $c.OwningProcess) }
}
