/** 学习统计与学习时长 API */
import { http } from './http'
import type { StatsData, StatsGran, StudyRangeResult } from '../types'

export function fetchStats(gran: StatsGran): Promise<StatsData> {
  return http.get<StatsData>(`/stats?gran=${gran}`)
}

export function reportStudyDelta(date: string, addMs: number): Promise<{ ok: boolean; added: number }> {
  return http.post<{ ok: boolean; added: number }>('/study-daily', { date, addMs })
}

export function fetchStudyDay(date: string): Promise<{ date: string; ms: number }> {
  return http.get<{ date: string; ms: number }>(`/study-daily?date=${date}`)
}

export function fetchStudyRange(start: string, end: string): Promise<StudyRangeResult> {
  return http.get<StudyRangeResult>(`/study-daily/range?start=${start}&end=${end}`)
}

export function deleteStudyDay(date: string): Promise<{ ok: boolean; deleted: boolean }> {
  return http.del<{ ok: boolean; deleted: boolean }>(`/study-daily?date=${date}`)
}
