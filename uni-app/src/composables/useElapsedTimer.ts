/**
 * 速算答题页计时：会话总用时 + 单题用时 + 顶部计时文本
 * startTs 会话起点（结算传参用）；qStartMs 每题起点（答题 ms 传参用）
 */
import { ref } from 'vue'

export function useElapsedTimer() {
  const startTs = ref(0)
  const qStartMs = ref(0)
  const timerText = ref('00:00')
  let timerHandle: ReturnType<typeof setInterval> | null = null

  function formatTime(ms: number): string {
    const totalSec = Math.max(0, Math.floor(ms / 1000))
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
    const ss = String(totalSec % 60).padStart(2, '0')
    return `${mm}:${ss}`
  }

  function startTimer(): void {
    stopTimer()
    timerHandle = setInterval(() => {
      timerText.value = formatTime(Date.now() - startTs.value)
    }, 500)
  }

  function stopTimer(): void {
    if (timerHandle) {
      clearInterval(timerHandle)
      timerHandle = null
    }
  }

  return { startTs, qStartMs, timerText, formatTime, startTimer, stopTimer }
}
