/**
 * 学习统计 / 用户类型（与后端 /api/stats、/api/auth、/api/study-daily 契约对齐）
 */

/** 学习统计单日行 */
export interface StudyStatsDay {
  key: string
  label: string
  rounds: number
  questions: number
  correct: number
  skipped: number
  rate: number
  workMs: number
  studyMs: number
}

/** /api/stats 响应 */
export interface StudyStatsRes {
  today: {
    rounds: number
    questions: number
    correct: number
    skipped: number
    rate: number
    workMs: number
    studyMs: number
  }
  sum: {
    rounds: number
    questions: number
    correct: number
    skipped: number
    workMs: number
    studyMs: number
  }
  list: StudyStatsDay[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** 当前用户（/api/auth/me） */
export interface Me {
  id: number
  openid: string
  nickname: string
  avatar: string
  role: string
  created_at: string
}
