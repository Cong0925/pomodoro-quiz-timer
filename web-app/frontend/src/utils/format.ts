/**
 * 通用格式化工具（与主版本 utils.js 口径一致）
 */

/** 两位补零 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** mm:ss.xx（含百分秒，计时显示用） */
export function formatTime(ms: number): string {
  const totalSec = ms / 1000
  const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const seconds = (totalSec % 60).toFixed(2).padStart(5, '0')
  return `${minutes}:${seconds}`
}

/** mm:ss（整数秒，练习/短用时展示用） */
export function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** YYYY-MM-DD HH:mm:ss（本地时区） */
export function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
}

/** 日期键 YYYY-MM-DD */
export function todayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** 时长人性化：不足 1 分钟 / X 分钟 / X 小时 Y 分 */
export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000)
  if (totalMin < 1) return '不足 1 分钟'
  if (totalMin < 60) return totalMin + ' 分钟'
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return m === 0 ? h + ' 小时' : h + ' 小时 ' + m + ' 分'
}
