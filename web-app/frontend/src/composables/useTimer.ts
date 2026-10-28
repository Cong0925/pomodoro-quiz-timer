/**
 * 计时核心状态机（单题/整组两种模式）
 * 逻辑与主版本 modules/timer.js 完全同口径：
 * - 单题：空格开始/结束一题 → 弹对错框（Y=对 N=错 P=跳过）
 * - 整组：空格开始整组计时 → 结束后标记错题面板
 * - 满 MAX_ROUND 题自动归档；归档调用注入的 archive 回调
 */
import { computed, reactive, ref } from 'vue'
import type { HistoryArchivePayload, QuizResult } from '../types'
import { formatDate, formatTime } from '../utils/format'

export interface TimerRecord {
  no: number
  ms: number
  cumMs: number
  timeStr: string
  result: QuizResult
}

export interface TimerCat {
  catId: string
  catName: string
  subId: string
  subName: string
}

export type TimerMode = 'single' | 'batch'

export interface UseTimerOptions {
  /** 归档回调：把当前轮提交到后端；失败时抛错由调用方提示 */
  archive: (payload: HistoryArchivePayload) => Promise<number>
  /** 归档成功/失败提示（ElMessage） */
  notify: (msg: string, type?: 'success' | 'error' | 'info') => void
  /** 当前轮分类（归档时写名称快照） */
  getCat: () => TimerCat
}

const PER_COL = 5

export function useTimer(options: UseTimerOptions) {
  const mode = ref<TimerMode>('single')
  const maxRound = ref(20)
  const records = ref<TimerRecord[]>([])
  const archived = ref(false)
  const isTiming = ref(false)
  const timeText = ref('00:00.00')
  const showResultModal = ref(false)
  const showBatchPanel = ref(false)
  const showNewRoundBtn = ref(false)

  const roundMeta = reactive({ title: '', desc: '' })
  const batchResults = ref<Array<QuizResult | null>>([])
  const batchCurIdx = ref(0)

  let startTime: number | null = null
  let timerId: number | null = null
  let pendingMs = 0
  let roundTotalMs = 0

  /* ---- 统计 ---- */
  const totalMs = computed(() => {
    if (mode.value === 'batch') return roundTotalMs
    return records.value.reduce((s, i) => s + i.ms, 0)
  })
  const correctCount = computed(() => records.value.filter((i) => i.result === 'ok').length)
  const rateText = computed(() =>
    records.value.length === 0 ? '0%' : ((correctCount.value / records.value.length) * 100).toFixed(1) + '%'
  )
  /** 记录按 5 题一列分组（与主版本一致） */
  const recordColumns = computed(() => {
    const cols: TimerRecord[][] = []
    for (let c = 0; c * PER_COL < records.value.length; c++) {
      cols.push(records.value.slice(c * PER_COL, c * PER_COL + PER_COL))
    }
    return cols
  })

  /* ---- 计时控制 ---- */
  function resetTimer(): void {
    if (timerId) clearInterval(timerId)
    timerId = null
    isTiming.value = false
    timeText.value = '00:00.00'
  }

  function tick(): void {
    if (startTime !== null) timeText.value = formatTime(Date.now() - startTime)
  }

  function startTick(): void {
    isTiming.value = true
    startTime = Date.now()
    timerId = window.setInterval(tick, 20)
  }

  /* ---- 归档 ---- */
  async function archiveCurrentRound(): Promise<void> {
    if (records.value.length === 0 || archived.value) return
    const total = records.value.length
    const cat = options.getCat()
    const payload: HistoryArchivePayload = {
      mode: mode.value,
      modeName: mode.value === 'single' ? '单题模式' : '整组模式',
      title: roundMeta.title.trim(),
      description: roundMeta.desc.trim(),
      finishedAt: formatDate(Date.now()),
      maxCount: maxRound.value,
      totalMs: totalMs.value,
      correct: correctCount.value,
      rate: total === 0 ? 0 : +((correctCount.value / total) * 100).toFixed(1),
      ...cat,
      records: records.value.map((r) => ({ no: r.no, ms: r.ms, cumMs: r.cumMs, timeStr: r.timeStr, result: r.result })),
    }
    archived.value = true
    try {
      await options.archive(payload)
    } catch (e) {
      archived.value = false
      options.notify('归档失败：' + (e instanceof Error ? e.message : String(e)), 'error')
    }
  }

  /* ---- 记录一题（单题模式） ---- */
  function saveRecord(result: QuizResult): void {
    const no = records.value.length + 1
    records.value.push({ no, ms: pendingMs, cumMs: pendingMs, timeStr: formatTime(pendingMs), result })
    if (records.value.length >= maxRound.value) {
      archiveCurrentRound()
      showNewRoundBtn.value = true
      options.notify(`本轮 ${maxRound.value} 题已完成，已归档到历史记录`, 'success')
    }
  }

  /** 单题模式：修正已记录题目的状态（未归档、暂停时可改，ok→ng→skip 循环） */
  function toggleRecordResult(no: number): void {
    if (mode.value !== 'single' || archived.value) return
    if (isTiming.value) {
      options.notify('计时中，请先按空格暂停再修正对错', 'info')
      return
    }
    const rec = records.value.find((r) => r.no === no)
    if (!rec) return
    rec.result = rec.result === 'ok' ? 'ng' : rec.result === 'ng' ? 'skip' : 'ok'
  }

  function confirmResult(result: QuizResult): void {
    saveRecord(result)
    showResultModal.value = false
  }

  /* ---- 整组错题标记面板 ---- */
  function openBatchPanel(): void {
    batchResults.value = new Array(maxRound.value).fill(null)
    batchCurIdx.value = 0
    showBatchPanel.value = true
  }

  function cycleCell(i: number): void {
    const v = batchResults.value[i]
    batchResults.value[i] = v === 'ng' ? 'skip' : v === 'skip' ? null : 'ng'
    batchCurIdx.value = i
  }

  function setCell(i: number, val: QuizResult | null): void {
    if (i < 0 || i >= maxRound.value) return
    batchResults.value[i] = val
  }

  function moveSel(delta: number): void {
    batchCurIdx.value = Math.min(maxRound.value - 1, Math.max(0, batchCurIdx.value + delta))
  }

  const batchProgress = computed(() => {
    const wrong = batchResults.value.filter((x) => x === 'ng').length
    const skipped = batchResults.value.filter((x) => x === 'skip').length
    return { wrong, skipped, text: `已标错 ${wrong} 题 · 没做 ${skipped} 题（其余默认正确）` }
  })

  function finishBatchRound(): void {
    roundTotalMs = pendingMs
    records.value = batchResults.value.map((r, i) => ({
      no: i + 1,
      ms: 0,
      cumMs: 0,
      timeStr: '--:--.--',
      result: r === 'ng' ? 'ng' : r === 'skip' ? 'skip' : 'ok',
    }))
    showBatchPanel.value = false
    archiveCurrentRound()
    showNewRoundBtn.value = true
    const wrongCnt = records.value.filter((x) => x.result === 'ng').length
    const skipCnt = records.value.filter((x) => x.result === 'skip').length
    options.notify(`整组完成：共 ${maxRound.value} 题，错 ${wrongCnt} 题，没做 ${skipCnt} 题`, 'success')
  }

  function cancelBatchRound(): void {
    showBatchPanel.value = false
    resetTimer()
    newRound()
    options.notify('已取消本轮', 'info')
  }

  /* ---- 新一轮 ---- */
  function defaultRoundTitle(): string {
    const d = new Date()
    const modeName = mode.value === 'single' ? '单题模式' : '整组模式'
    return `${modeName}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  function newRound(): void {
    records.value = []
    archived.value = false
    roundTotalMs = 0
    batchResults.value = []
    roundMeta.title = defaultRoundTitle()
    roundMeta.desc = ''
    showNewRoundBtn.value = false
  }

  /* ---- 按钮动作 ---- */
  function stop(): void {
    resetTimer()
  }

  async function clearRound(): Promise<void> {
    if (records.value.length > 0 && !archived.value) {
      await archiveCurrentRound()
      options.notify('本轮已存入历史记录', 'success')
    }
    resetTimer()
    newRound()
  }

  async function startNewRound(): Promise<void> {
    if (records.value.length > 0 && !archived.value) {
      await archiveCurrentRound()
    }
    resetTimer()
    newRound()
  }

  /* ---- 空格主控（由视图的 keydown 调用；输入框聚焦时由视图拦截不进入） ---- */
  function onSpace(): void {
    if (records.value.length >= maxRound.value) return
    if (!isTiming.value) {
      startTick()
    } else {
      if (timerId) clearInterval(timerId)
      timerId = null
      isTiming.value = false
      pendingMs = Date.now() - (startTime ?? Date.now())
      if (mode.value === 'single') {
        resetTimer()
        showResultModal.value = true
      } else {
        openBatchPanel()
      }
    }
  }

  /** 模式切换（清空当前轮） */
  function applyMode(m: TimerMode): void {
    mode.value = m
    resetTimer()
    newRound()
  }

  return {
    mode,
    maxRound,
    records,
    archived,
    isTiming,
    timeText,
    roundMeta,
    showResultModal,
    showBatchPanel,
    showNewRoundBtn,
    batchResults,
    batchCurIdx,
    totalMs,
    correctCount,
    rateText,
    recordColumns,
    batchProgress,
    onSpace,
    confirmResult,
    toggleRecordResult,
    cycleCell,
    setCell,
    moveSel,
    finishBatchRound,
    cancelBatchRound,
    stop,
    clearRound,
    startNewRound,
    applyMode,
    newRound,
    archiveCurrentRound,
  }
}
