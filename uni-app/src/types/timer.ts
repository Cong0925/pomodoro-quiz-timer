/**
 * 计时模式类型定义（与后端 /api/timer 契约对齐）
 */

export type TimerMode = 'single' | 'batch'
export type TimerResult = 'ok' | 'ng' | 'skip'

/** 归档请求中的逐题明细 */
export interface TimerRecord {
  no: number
  ms: number
  result: TimerResult
}

/** 归档返回 */
export interface TimerFinishRes {
  id: number
  rate: number
  total: number
  correct: number
  totalMs: number
}

/** 计时历史列表行 */
export interface TimerHistoryItem {
  id: number
  mode: TimerMode
  modeName: string
  title: string
  description: string
  finishedAt: string
  maxCount: number
  totalMs: number
  correct: number
  rate: number
  catId: string | null
  catName: string
  subId: string | null
  subName: string
  questions: number
}

/** 计时历史明细 */
export interface TimerHistoryRecord {
  no: number
  ms: number
  cumMs: number
  timeStr: string
  result: TimerResult
  note: string
}

/** 计时历史详情 */
export interface TimerHistoryDetail {
  round: TimerHistoryItem
  records: TimerHistoryRecord[]
}

/** 计时统计（累计 + 今日） */
export interface TimerStats {
  all: { rounds: number; questions: number; correct: number; totalMs: number }
  today: { rounds: number; questions: number; correct: number; totalMs: number }
}
