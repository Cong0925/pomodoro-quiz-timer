# ============================================================
# start-webapp.ps1 — web-app 前后端一键启动（由 启动.bat 调用）
# 编码要求：UTF-8 with BOM（否则中文消息乱码）
# 单窗口方案：服务进程隐藏运行，本窗口只显示心跳与状态
# ============================================================
$ErrorActionPreference = 'Continue'
try { $Host.UI.RawUI.WindowTitle = 'web-app 服务' } catch { Write-Verbose "设置窗口标题失败：$_" }

$root = $PSScriptRoot
if (-not $root) { $root = Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = Split-Path -Parent $root
$logDir = Join-Path $repoRoot 'docs\错误日志'
$backendDir = Join-Path $root 'backend'
$frontendDir = Join-Path $root 'frontend'
$beLog = Join-Path $logDir 'web-app-backend.log'
$feLog = Join-Path $logDir 'web-app-frontend.log'

function Write-Banner([string]$text) { Write-Host $text -ForegroundColor Cyan }
function Write-Ok([string]$text) { Write-Host $text -ForegroundColor Green }
function Write-Note([string]$text) { Write-Host $text -ForegroundColor Yellow }
function Write-Err([string]$text) { Write-Host $text -ForegroundColor Red }

function Test-Url([string]$url) {
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2
        return ($r.StatusCode -eq 200)
    } catch { return $false }
}

function Install-IfMissing([string]$dir, [string]$label) {
    if (Test-Path (Join-Path $dir 'node_modules')) { return $true }
    Write-Note "[首次运行] 正在安装$label依赖..."
    Push-Location $dir
    try {
        npm install
        if ($LASTEXITCODE -ne 0) { Write-Err "$label 依赖安装失败，请检查网络后重试"; return $false }
        return $true
    } catch {
        Write-Err "$label 依赖安装异常：$_"
        return $false
    } finally { Pop-Location }
}

function Reset-Log([string]$log) {
    $header = '===== 启动 ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + " =====`r`n"
    [System.IO.File]::WriteAllText($log, $header, (New-Object System.Text.UTF8Encoding($false)))
}

function Start-Service([string]$dir, [string]$log, [string]$label) {
    $arg = '/c npm run dev >> "' + $log + '" 2>&1'
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList $arg -WorkingDirectory $dir -NoNewWindow -PassThru
    Write-Ok "[启动] $label（PID $($p.Id)）→ 日志已重定向"
}

try {
    Write-Banner '============================================'
    Write-Banner '  web-app 一键启动（后端 8888 + 前端 8889）'
    Write-Host  "  日志目录: $logDir"
    Write-Banner '============================================'

    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

    if (-not (Install-IfMissing $backendDir '后端')) { exit 1 }
    if (-not (Install-IfMissing $frontendDir '前端')) { exit 1 }

    $beUp = Test-Url 'http://localhost:8888/api/health'
    $feUp = Test-Url 'http://localhost:8889/'
    $startBe = -not $beUp
    $startFe = -not $feUp
    if (-not $startBe) { Write-Note '[跳过] 后端已在运行（8888）' }
    if (-not $startFe) { Write-Note '[跳过] 前端已在运行（8889）' }
    if (-not $startBe -and -not $startFe) { Write-Ok '[就绪] 前后端均已在运行，无需重复启动。' }

    if ($startBe) { Reset-Log $beLog; Start-Service $backendDir $beLog '后端' }
    if ($startFe) { Reset-Log $feLog; Start-Service $frontendDir $feLog '前端' }

    if ($startBe -or $startFe) {
        Write-Banner '[等待] 正在等待服务就绪（最多 30 秒）...'
        $ready = $false
        for ($i = 1; $i -le 30; $i++) {
            Start-Sleep -Seconds 1
            if ((Test-Url 'http://localhost:8888/api/health') -and (Test-Url 'http://localhost:8889/')) { $ready = $true; break }
        }
        if ($ready) {
            Write-Ok '[就绪] 前后端启动成功！'
        } else {
            Write-Note '[警告] 等待超时，可能启动失败。相关日志最后 15 行：'
            if ($startBe -and (Test-Path $beLog)) {
                Write-Host '---------- web-app-backend.log ----------'
                Get-Content -Path $beLog -Tail 15 -Encoding UTF8 | ForEach-Object { Write-Host $_ }
            }
            if ($startFe -and (Test-Path $feLog)) {
                Write-Host '---------- web-app-frontend.log ----------'
                Get-Content -Path $feLog -Tail 15 -Encoding UTF8 | ForEach-Object { Write-Host $_ }
            }
            Write-Note '完整日志见 docs\错误日志\ 目录，可交给 Claude 解读处理。'
        }
    }

    Start-Process 'http://localhost:8889'
    Write-Banner '浏览器已打开：http://localhost:8889'
    Write-Host ''
    Write-Host '本窗口为服务控制台（每 15 秒心跳检测）：'
    Write-Host '  - 停止：双击「停止服务.bat」，或直接关闭本窗口'
    Write-Host '  - 日志：docs\错误日志\web-app-backend.log / web-app-frontend.log'
    Write-Host ''

    $downCount = 0
    while ($true) {
        Start-Sleep -Seconds 15
        $beOk = Test-Url 'http://localhost:8888/api/health'
        $feOk = Test-Url 'http://localhost:8889/'
        $t = Get-Date -Format 'HH:mm:ss'
        $beS = 'OK'; if (-not $beOk) { $beS = 'DOWN' }
        $feS = 'OK'; if (-not $feOk) { $feS = 'DOWN' }
        Write-Host ("[{0}] backend {1} / frontend {2}" -f $t, $beS, $feS)
        if (-not $beOk) { Write-Note '  > 后端异常，查看 docs\错误日志\web-app-backend.log' }
        if (-not $feOk) { Write-Note '  > 前端异常，查看 docs\错误日志\web-app-frontend.log' }
        if (-not $beOk -and -not $feOk) {
            $downCount++
            if ($downCount -ge 2) { Write-Note '[退出] 前后端均已停止，监控结束。'; break }
        } else { $downCount = 0 }
    }
} catch {
    Write-Err "启动脚本异常：$_"
    exit 1
}
