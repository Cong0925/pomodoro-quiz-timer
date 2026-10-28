/**
 * 学习时长 store：打开页面自动计时，每 60s 上报增量，
 * 关闭页面 sendBeacon 补尾；localStorage 单实例计时锁防多开重复累计。
 * 与主版本 dataModel.js 学习时长段逻辑完全同口径。
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { reportStudyDelta, fetchStats } from '../api/stats'
import { todayKey } from '../utils/format'

const OWNER_KEY = 'pq_study_owner'
const HEARTBEAT_MS = 30000

export const useStudyStore = defineStore('study', () => {
  const running = ref(false)
  const todayBaseMs = ref(0) // 页面加载时读取的今日已入库时长
  const sessionMs = ref(0) // 本次会话已上报累计

  let lastTick: number | null = null
  let reportTimer: number | null = null
  let heartbeatTimer: number | null = null
  let myToken: string | null = null

  /** 本次计时中尚未上报的时长 */
  const pendingMs = computed(() => (running.value && lastTick ? Date.now() - lastTick : 0))

  /** 今日总学习时长 = 已入库基数 + 已上报 + 未上报（悬浮窗显示口径，与统计面板同步） */
  const todayTotal = computed(() => todayBaseMs.value + sessionMs.value + pendingMs.value)

  function report(addMs: number): void {
    if (addMs <= 0) return
    sessionMs.value += addMs
    reportStudyDelta(todayKey(), addMs).catch((e) => {
      console.error('【学习时长上报失败】', e)
    })
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

  /** 页面启动：自动开始计时（学习时长只多不少） */
  function startSession(): void {
    claimOwner()
    running.value = true
    lastTick = Date.now()
    if (reportTimer) clearInterval(reportTimer)
    reportTimer = window.setInterval(() => {
      if (running.value && lastTick) {
        const now = Date.now()
        report(now - lastTick)
        lastTick = now
      }
    }, 60000)
  }

  /** 悬浮窗：开始计时 */
  function start(): void {
    if (running.value) return
    claimOwner()
    running.value = true
    lastTick = Date.now()
  }

  /** 暂停：立即上报已计部分并释放计时权 */
  function pause(): void {
    if (!running.value) return
    const now = Date.now()
    if (lastTick) report(now - lastTick)
    running.value = false
    lastTick = null
    releaseOwner()
  }

  /** 页面关闭：用 sendBeacon 上报计时中未上报部分（可靠送达） */
  function beaconReport(): void {
    if (!running.value || !lastTick) return
    const addMs = Date.now() - lastTick
    if (addMs <= 0) return
    try {
      navigator.sendBeacon(
        '/api/study-daily',
        new Blob([JSON.stringify({ date: todayKey(), addMs })], { type: 'application/json' })
      )
    } catch (e) {
      console.error('【学习时长 beacon 上报失败】', e)
    }
  }

  /** 页面加载时读取今日已入库基数（与统计面板同源） */
  async function loadTodayBase(): Promise<void> {
    try {
      const r = await fetchStats('day')
      todayBaseMs.value = r && r.today ? Number(r.today.studyMs) : 0
    } catch (e) {
      console.error('【读取今日学习时长基数失败】', e)
      todayBaseMs.value = 0
    }
  }

  return { running, todayTotal, pendingMs, startSession, start, pause, beaconReport, loadTodayBase, onStorageEvent }
})
