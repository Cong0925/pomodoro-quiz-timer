/** 历史记录 API（/api/history） */
import { http } from './http'
import type { HistoryArchivePayload, HistoryItem, PageResult } from '../types'

export interface HistoryQuery {
  mode?: string
  catId?: string
  subId?: string
  page?: number
  limit?: number
}

export function fetchHistoryPage(q: HistoryQuery): Promise<PageResult<HistoryItem>> {
  const params = new URLSearchParams()
  if (q.mode) params.set('mode', q.mode)
  if (q.catId) params.set('catId', q.catId)
  if (q.subId) params.set('subId', q.subId)
  params.set('page', String(q.page || 1))
  params.set('limit', String(q.limit || 20))
  return http.get<PageResult<HistoryItem>>(`/history?${params.toString()}`)
}

export function fetchHistoryDetail(id: number): Promise<HistoryItem> {
  return http.get<HistoryItem>(`/history/${id}`)
}

export function archiveRound(payload: HistoryArchivePayload): Promise<{ id: number }> {
  return http.post<{ id: number }>('/history', payload)
}

export interface HistoryPatch {
  title: string
  description: string
  catId: string
  catName: string
  subId: string
  subName: string
}

export function updateHistory(id: number, patch: HistoryPatch): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/history/${id}`, patch)
}

export function updateRecordNote(roundId: number, no: number, note: string): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/history/${roundId}/record/${no}`, { note })
}

export function deleteHistory(id: number): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/history/${id}`)
}

export function clearHistory(): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>('/history')
}
