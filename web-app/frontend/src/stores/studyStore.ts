/**
 * 学习时长 store：打开页面自动计时，每 60s 上报增量，
 * 关闭页面 sendBeacon 补尾；localStorage 单实例计时锁防多开重复累计。
 * 与主版本 dataModel.js 学习时长段逻辑完全同口径。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { reportStudyDelta, fetchStats } from '../api/stats'
import { todayKey, splitStudyByDay, type StudySegment } from '../utils/format'

const OWNER_KEY = 'pq_study_owner'
const HEARTBEAT_MS = 30000

export const useStudyStore = defineStore('study', () => {
  const running = ref(false)
  const todayBaseMs = ref(0) // 当前日期已入库时长（页面加载/统计同步时读取）
  const todayBaseDate = ref(todayKey())
  const sessionByDay = ref<Record<string, number>>({}) // 本次会话已上报累计（按日期分开）

  const lastTick = ref<number | null>(null)
  const nowMs = ref(Date.now()) // 每秒推进，驱动 pendingMs/todayTotal 响应式刷新
  let reportTimer: number | null = null
  let displayTimer: number | null = null
  let heartbeatTimer: number | null = null
  let myToken: string | null = null
  let carrySegs: StudySegment[] = [] // 上报失败待重试的时长（带日期，下次一并补传）

  /** 本次计时中尚未上报的时长 */
  const pendingMs = computed(() => (running.value && lastTick.value ? Math.max(0, nowMs.value - lastTick.value) : 0))

  /** 当前本地日期（nowMs 每秒推进，跨零点后自动切换） */
  const currentDay = computed(() => todayKey(new Date(nowMs.value)))

  /** 当前日期尚未上报的时长（跨零点按日期切分，旧日尾量不计入新日） */
  const pendingTodayMs = computed(() => {
    if (!running.value || !lastTick.value) return 0
    return splitStudyByDay(lastTick.value, nowMs.value)
      .filter((seg) => seg.date === currentDay.value)
      .reduce((sum, seg) => sum + seg.ms, 0)
  })

  /** 今日总学习时长 = 今日已入库基数 + 今日已上报 + 今日未上报；跨零点后旧基数不再计入 */
  const todayTotal = computed(() => {
    const base = todayBaseDate.value === currentDay.value ? todayBaseMs.value : 0
    return base + (sessionByDay.value[currentDay.value] || 0) + pendingTodayMs.value
  })

  function mergeSegments(segs: StudySegment[]): StudySegment[] {
    const map: Record<string, number> = {}
    segs.forEach((s) => {
      if (s && s.ms > 0) map[s.date] = (map[s.date] || 0) + s.ms
    })
    return Object.keys(map).map((date) => ({ date, ms: map[date] }))
  }

  function addSession(seg: StudySegment): void {
    sessionByDay.value = {
      ...sessionByDay.value,
      [seg.date]: (sessionByDay.value[seg.date] || 0) + seg.ms,
    }
  }

  /** 按真实区间上报；跨零点自动拆成多条，分别写入各自日期 */
  function reportRange(startTs: number, endTs: number): void {
    const fresh = splitStudyByDay(startTs, endTs)
    if (fresh.length === 0 && carrySegs.length === 0) return
    const sendSegs = mergeSegments(carrySegs.concat(fresh))
    carrySegs = []
    sendSegs.forEach((seg) => {
      reportStudyDelta(seg.date, seg.ms)
        .then(() => {
          // 上报成功才计入会话累计，避免失败重试期间本地虚高
          addSession(seg)
        })
        .catch((e) => {
          // 失败回队，保留原日期，下次上报一并补传，避免时长丢失/串日
          carrySegs.push(seg)
          console.error('【学习时长上报失败，已回队待重试】', e)
        })
    })
  }

  /** 以后端权威入库值为准刷新今日基数（统计页轮询时同步，消除本地会话累计与后端口径偏差） */
  function syncTodayBase(ms: number): void {
    todayBaseMs.value = Math.max(0, Number(ms) || 0)
    todayBaseDate.value = todayKey()
    sessionByDay.value = {}
  }

  /* ---- 单实例计时锁（多开/刷新时防止时长重复累计） ---- */
  function claimOwner(): void {
    myToken = Math.random().toString(36).slice(2) + Date.now().toString(36)
    localStorage.setItem(OWNER_KEY, JSON.stringify({ token: myToken, at: Date.now() }))
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = window.setInterval(() => {
      if (myToken) localStorage.setItem(OWNER_KEY, JSON.stringify({ token: myToken, at: Date.now() }))
    }, HEARTBEAT_MS)
  }

  function releaseOwner(): void {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
    try {
      const raw = localStorage.getItem(OWNER_KEY)
      if (raw) {
        const o = JSON.parse(raw) as { token?: string }
        if (o && o.token === myToken) localStorage.removeItem(OWNER_KEY)
      }
    } catch (e) {
      console.error('【释放学习计时权失败】', e)
    }
    myToken = null
  }

  /** 其他页面抢占计时权 → 本页立即暂停并上报已计部分 */
  function onStorageEvent(e: StorageEvent): void {
    if (e.key !== OWNER_KEY || !e.newValue) return
    try {
      const o = JSON.parse(e.newValue) as { token?: string }
      if (o && o.token !== myToken && running.value) pause()
    } catch (err) {
      console.error('【解析计时权事件失败】', err)
    }
  }

  /** 每秒推进 nowMs，让 pendingMs/todayTotal 响应式刷新（悬浮球逐秒显示） */
  function startDisplayTick(): void {
    if (displayTimer) clearInterval(displayTimer)
    nowMs.value = Date.now()
    displayTimer = window.setInterval(() => {
      nowMs.value = Date.now()
    }, 1000)
  }

  function stopDisplayTick(): void {
    if (displayTimer) clearInterval(displayTimer)
    displayTimer = null
  }

  /** 页面启动：自动开始计时（学习时长只多不少） */
  function startSession(): void {
    claimOwner()
    running.value = true
    lastTick.value = Date.now()
    startDisplayTick()
    if (reportTimer) clearInterval(reportTimer)
    reportTimer = window.setInterval(() => {
      if (running.value && lastTick.value) {
        const now = Date.now()
        reportRange(lastTick.value, now)
        lastTick.value = now
      }
    }, 60000)
  }

  /** 悬浮窗：开始计时 */
  function start(): void {
    if (running.value) return
    claimOwner()
    running.value = true
    lastTick.value = Date.now()
    startDisplayTick()
  }

  /** 暂停：立即上报已计部分并释放计时权 */
  function pause(): void {
    if (!running.value) return
    const now = Date.now()
    if (lastTick.value) reportRange(lastTick.value, now)
    running.value = false
    lastTick.value = null
    stopDisplayTick()
    releaseOwner()
  }

  /** 立即落一次账（页面切后台时调用，先按日切分上报，减少尾量丢失） */
  function flush(): void {
    if (!running.value || !lastTick.value) return
    const now = Date.now()
    reportRange(lastTick.value, now)
    lastTick.value = now
  }

  /** 页面关闭：用 sendBeacon 上报计时中未上报部分（可靠送达）
      跨零点时按日期拆成多条，前一天尾量不会被记到后一天 */
  function beaconReport(): void {
    if (!running.value || !lastTick.value) return
    const now = Date.now()
    const segs = splitStudyByDay(lastTick.value, now)
    segs.forEach((seg) => {
      try {
        const ok = navigator.sendBeacon(
          '/api/study-daily',
          new Blob([JSON.stringify({ date: seg.date, addMs: seg.ms })], { type: 'application/json' })
        )
        if (!ok) {
          // beacon 入队失败（队列满）时降级 keepalive fetch，尽量不丢尾量
          void fetch('/api/study-daily', {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: seg.date, addMs: seg.ms }),
          }).catch((e) => {
            console.error('【学习时长 fetch 补尾失败】', e)
          })
        }
      } catch (e) {
        console.error('【学习时长 beacon 上报失败】', e)
      }
    })
    // 推进起点：bfcache 恢复后不重复计已上报区间
    lastTick.value = now
  }

  /** bfcache 恢复：重新锚定计时起点并恢复逐秒刷新，防止重复计已上报区间 */
  function onPageShow(e: PageTransitionEvent): void {
    if (e.persisted && running.value) {
      lastTick.value = Date.now()
      startDisplayTick()
    }
  }

  /** 页面加载时读取今日已入库基数（与统计面板同源） */
  async function loadTodayBase(): Promise<void> {
    try {
      const r = await fetchStats('day')
      todayBaseMs.value = r && r.today ? Number(r.today.studyMs) : 0
      todayBaseDate.value = todayKey()
      sessionByDay.value = {}
    } catch (e) {
      console.error('【读取今日学习时长基数失败】', e)
      todayBaseMs.value = 0
      todayBaseDate.value = todayKey()
    }
  }

  return { running, todayTotal, pendingMs, startSession, start, pause, flush, beaconReport, onPageShow, loadTodayBase, syncTodayBase, onStorageEvent }
})
