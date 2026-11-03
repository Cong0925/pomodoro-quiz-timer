/**
 * 计时模式 API（后端 /api/timer）
 */
import { request } from '@/utils/request'
import type {
  TimerFinishRes,
  TimerHistoryDetail,
  TimerHistoryItem,
  TimerMode,
  TimerRecord,
  TimerStats,
} from '@/types/timer'

/** 归档一段计时轮次（前端计时结束后一次性上报） */
export function finishTimer(data: {
  mode: TimerMode
  title?: string
  description?: string
  maxCount: number
  totalMs: number
  catId?: string
  catName?: string
  subId?: string
  subName?: string
  records: TimerRecord[]
}): Promise<TimerFinishRes> {
  return request<TimerFinishRes>({
    url: '/api/timer/finish',
    method: 'POST',
    data,
  })
}

/** 计时历史分页：page/limit/mode */
export function fetchTimerHistory(params: {
  page?: number
  limit?: number
  mode?: TimerMode
}): Promise<{ total: number; page: number; limit: number; list: TimerHistoryItem[] }> {
  return request({ url: '/api/timer/history', data: params })
}

/** 计时历史详情 */
export function fetchTimerHistoryDetail(id: number): Promise<TimerHistoryDetail> {
  return request<TimerHistoryDetail>({ url: `/api/timer/history/${id}` })
}

/** 删除单条计时记录 */
export function deleteTimerHistory(id: number): Promise<{ ok: boolean }> {
  return request({ url: `/api/timer/history/${id}`, method: 'DELETE' })
}

/** 清空计时历史 */
export function clearTimerHistory(): Promise<{ ok: boolean }> {
  return request({ url: '/api/timer/history', method: 'DELETE' })
}

/** 计时统计（累计 + 今日） */
export function fetchTimerStats(): Promise<TimerStats> {
  return request<TimerStats>({ url: '/api/timer/stats' })
}
