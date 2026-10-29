/** 速算练习 API（/api/mental） */
import { http } from './http'

export interface MentalQuestion {
  id: number
  qtype: string
  difficulty: number
  stem: string
  options: string[]
  answer: string
  tip: string
  tag: string
  active: boolean
  fillable: boolean
  updatedAt?: string
  /** 填空方向（后端 fillMeta 推导）：den=填分母 pct=填百分数 frac=填分数 val=填数值 dec=填小数 */
  fillDir?: 'den' | 'pct' | 'frac' | 'val' | 'dec'
}

export interface MentalStartQuestion extends MentalQuestion {}

export interface MentalStartResult {
  sessionId: number
  qtype: string
  qtypeName: string
  answerMode: 'choice' | 'fill'
  total: number
  infinite: boolean
  questions: MentalStartQuestion[]
}

export function startMental(
  qtype: string,
  difficulty: number,
  count: number,
  answerMode: 'choice' | 'fill'
): Promise<MentalStartResult> {
  return http.post<MentalStartResult>('/mental/start', { qtype, difficulty, count, answerMode })
}

export interface MentalAnswerResult {
  result: 'ok' | 'ng' | 'skip'
  correctIndex?: number | null
  correctAnswer: string
  tip: string
}

export function answerMental(
  sessionId: number,
  no: number,
  questionId: number,
  answer: string,
  ms: number
): Promise<MentalAnswerResult> {
  return http.post<MentalAnswerResult>(`/mental/${sessionId}/answer`, { no, questionId, answer, ms })
}

export function skipMental(sessionId: number, no: number, questionId: number, ms: number): Promise<MentalAnswerResult> {
  return http.post<MentalAnswerResult>(`/mental/${sessionId}/skip`, { no, questionId, ms })
}

export function moreMental(sessionId: number): Promise<{ questions: MentalStartQuestion[] }> {
  return http.post<{ questions: MentalStartQuestion[] }>(`/mental/${sessionId}/more`, {})
}

export interface MentalFinishResult {
  id: number
  rate: number
  total: number
  done: number
  correct: number
  wrong: number
  skipped: number
  totalMs: number
}

export function finishMental(sessionId: number, ms: number): Promise<MentalFinishResult> {
  return http.post<MentalFinishResult>(`/mental/${sessionId}/finish`, { ms })
}

/* ---- 记录 / 统计 ---- */
export interface MentalSessionRow {
  id: number
  qtype: string
  qtype_name: string
  difficulty: number
  answer_mode?: 'choice' | 'fill'
  total_count: number
  done_count: number
  correct_count: number
  wrong_count: number
  skipped_count: number
  rate: number
  total_ms: number
  started_at: string
  finished_at: string | null
}

export function fetchMentalHistory(
  page: number,
  limit = 20
): Promise<{ total: number; page: number; limit: number; list: MentalSessionRow[] }> {
  return http.get<{ total: number; page: number; limit: number; list: MentalSessionRow[] }>(
    `/mental/history?page=${page}&limit=${limit}`
  )
}

export interface MentalDetailRecord {
  no: number
  qtype: string
  stem: string
  options: string[]
  answer: string
  tip: string
  userAnswer: string | null
  result: 'ok' | 'ng' | 'skip'
  ms: number
}

export function fetchMentalDetail(
  id: number
): Promise<{ session: MentalSessionRow; records: MentalDetailRecord[] }> {
  return http.get<{ session: MentalSessionRow; records: MentalDetailRecord[] }>(`/mental/history/${id}`)
}

export interface MentalStats {
  all: { sessions: number; totalQ: number; correctQ: number; wrongQ: number; skipQ: number; totalMs: number; rate: number }
  today: { sessions: number; totalQ: number; correctQ: number; wrongQ: number; skipQ: number; totalMs: number }
}

export function fetchMentalStats(): Promise<MentalStats> {
  return http.get<MentalStats>('/mental/stats')
}

export function deleteMentalSession(id: number): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/mental/history/${id}`)
}

/* ---- 题库管理（软删除=停用） ---- */
export interface MentalAdminQuery {
  qtype?: string
  tag?: string
  diff?: string
  kw?: string
  /** 状态三态筛选：normal=仅正常（默认）/ deleted=仅已停用 / all=全部 */
  status?: 'normal' | 'deleted' | 'all'
  /** @deprecated 旧二态参数（含停用=全部），保留兼容 */
  inactive?: boolean
  page?: number
  pageSize?: number
}

export interface MentalAdminGroup {
  n: number
  tags: Record<string, number>
}

export function fetchAdminQuestions(q: MentalAdminQuery): Promise<{
  total: number
  list: MentalQuestion[]
  groups?: Record<string, MentalAdminGroup>
  allTotal?: number
}> {
  const p = new URLSearchParams()
  if (q.qtype) p.set('qtype', q.qtype)
  if (q.tag) p.set('tag', q.tag)
  if (q.diff) p.set('diff', q.diff)
  if (q.kw) p.set('kw', q.kw)
  if (q.status) p.set('status', q.status)
  else if (q.inactive) p.set('inactive', '1')
  p.set('page', String(q.page || 1))
  p.set('pageSize', String(q.pageSize || 10))
  return http.get(`/mental/admin/questions?${p.toString()}`)
}

export interface MentalAdminPayload {
  qtype: string
  difficulty: number
  stem: string
  options: string[]
  answer: string
  tip: string
  tag: string
  fillable: boolean
  active?: boolean
}

export function createAdminQuestion(payload: MentalAdminPayload): Promise<{ id: number }> {
  return http.post<{ id: number }>('/mental/admin/questions', payload)
}

export function updateAdminQuestion(id: number, payload: MentalAdminPayload): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/mental/admin/questions/${id}`, payload)
}

/** 软删除（停用） */
export function deactivateQuestion(id: number): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/mental/admin/questions/${id}`)
}
