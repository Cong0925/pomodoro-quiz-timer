/**
 * 学习统计 / 用户 / 学习时长 API
 */
import { request } from '@/utils/request'
import type { Me, StudyStatsRes } from '@/types/stats'

/** 学习统计：gran=day|week|month，分页；today + sum + list */
export function fetchStudyStats(params: {
  gran?: 'day' | 'week' | 'month'
  page?: number
  limit?: number
}): Promise<StudyStatsRes> {
  return request<StudyStatsRes>({ url: '/api/stats', data: params })
}

/** 上报某日学习时长增量（分钟级粒度，前端每 60s 上报一次） */
export function reportStudyMs(date: string, addMs: number): Promise<{ ok: boolean; added: number }> {
  return request({
    url: '/api/study-daily',
    method: 'POST',
    data: { date, addMs },
  })
}

/** 当前用户信息（带 token） */
export function fetchMe(): Promise<Me> {
  return request<Me>({ url: '/api/auth/me' })
}
