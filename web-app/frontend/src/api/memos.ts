/** 日历备忘 API（/api/memos） */
import { http } from './http'
import type { MemoItem, MemoSavePayload } from '../types'

export function fetchMemosMonth(month: string): Promise<MemoItem[]> {
  return http.get<MemoItem[]>(`/memos?month=${month}`)
}

export function fetchMemoDay(date: string): Promise<MemoItem | null> {
  return http.get<MemoItem | null>(`/memos/${date}`)
}

export function saveMemo(date: string, payload: MemoSavePayload): Promise<{ ok: boolean; deleted?: boolean }> {
  return http.put<{ ok: boolean; deleted?: boolean }>(`/memos/${date}`, payload)
}

export function deleteMemo(date: string): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/memos/${date}`)
}
