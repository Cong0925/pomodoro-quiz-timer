/** 题库练习 API（/api/practice） */
import { http } from './http'

/* ---- 题库 ---- */
export interface Bank {
  id: number
  name: string
  catId: string | null
  subId: string | null
  description: string
  catName?: string | null
  subName?: string | null
  count: number
  createdAt?: string
}

export interface BankPayload {
  name: string
  catId: string
  subId: string
  description: string
}

export function fetchBanks(): Promise<Bank[]> {
  return http.get<Bank[]>('/practice/banks')
}

export function createBank(payload: BankPayload): Promise<Bank> {
  return http.post<Bank>('/practice/banks', payload)
}

export function updateBank(id: number, payload: BankPayload): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/practice/banks/${id}`, payload)
}

export function deleteBank(id: number): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/practice/banks/${id}`)
}

/* ---- 题目 ---- */
/** 选项：文字（老数据）或 { text, img } 图片混合（方案C） */
export type PracticeOption = string | { text?: string; img?: string }

export interface PracticeQuestion {
  id: number
  bank_id?: number
  bankId?: number
  type: string
  stem: string
  /** GET 题目行返回原始列名（与 bank_id 同约定）；start/answer 等映射接口返回驼峰 stemImg */
  stem_img?: string[] | null
  options: PracticeOption[]
  answer: string
  analysis?: string | null
  difficulty: number
  source?: string
  /** 逻辑删除/停用 0=正常 1=已停用（仅 includeDeleted=1 时返回） */
  is_deleted?: number
}

export interface QuestionPayload {
  bankId: number
  type: string
  stem: string
  stemImg?: string[]
  options: PracticeOption[]
  answer: string
  analysis: string
  difficulty: number
  source: string
}

export function fetchQuestionsAll(bankId: number): Promise<PracticeQuestion[]> {
  return http.get<PracticeQuestion[]>(`/practice/banks/${bankId}/questions`)
}

export type QuestionStatus = 'normal' | 'deleted' | 'all'

export function fetchQuestionsPage(
  bankId: number,
  page: number,
  pageSize: number,
  status: QuestionStatus = 'normal'
): Promise<{ total: number; list: PracticeQuestion[] }> {
  return http.get<{ total: number; list: PracticeQuestion[] }>(
    `/practice/banks/${bankId}/questions?page=${page}&pageSize=${pageSize}&status=${status}`
  )
}

export function createQuestion(payload: QuestionPayload): Promise<{ id: number }> {
  return http.post<{ id: number }>('/practice/questions', payload)
}

export function updateQuestion(id: number, payload: QuestionPayload): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/practice/questions/${id}`, payload)
}

export function deleteQuestion(id: number): Promise<{ ok: boolean }> {
  /* 后端为逻辑删除（停用），数据保留可恢复 */
  return http.del<{ ok: boolean }>(`/practice/questions/${id}`)
}

export function restoreQuestion(id: number): Promise<{ ok: boolean }> {
  return http.post<{ ok: boolean }>(`/practice/questions/${id}/restore`)
}

/* ---- 会话 ---- */
export interface StartResult {
  sessionId: number
  bank: { id: number; name: string; catName: string; subName: string }
  mode: string
  questions: Array<{ id: number; type: string; stem: string; stemImg?: string[] | null; options: PracticeOption[]; difficulty: number }>
  total: number
}

export function startPractice(bankId: number, mode: string, count: number): Promise<StartResult> {
  return http.post<StartResult>('/practice/start', { bankId, mode, count })
}

export interface AnswerResult {
  result: 'ok' | 'ng' | 'skip'
  correctAnswer: string
  analysis: string | null
  stem?: string
  stemImg?: string[] | null
  options?: PracticeOption[]
}

export function answerQuestion(
  sessionId: number,
  no: number,
  questionId: number,
  answer: string,
  ms = 0
): Promise<AnswerResult> {
  return http.post<AnswerResult>(`/practice/${sessionId}/answer`, { no, questionId, answer, ms })
}

export function skipQuestion(sessionId: number, no: number, questionId: number, ms = 0): Promise<AnswerResult> {
  return http.post<AnswerResult>(`/practice/${sessionId}/skip`, { no, questionId, ms })
}

export interface FinishResult {
  id: number
  rate: number
  total: number
  done: number
  correct: number
  wrong: number
  skipped: number
  totalMs: number
  archived: { id: number }
}

export function finishPractice(sessionId: number, ms: number): Promise<FinishResult> {
  return http.post<FinishResult>(`/practice/${sessionId}/finish`, { ms })
}

/* ---- 记录 / 统计 ---- */
export interface PracticeSessionRow {
  id: number
  bank_name: string
  mode: string
  total_count: number
  done_count: number
  correct_count: number
  wrong_count: number
  skipped_count: number
  rate: number
  total_ms: number
  cat_name: string | null
  sub_name: string | null
  started_at: string
  finished_at: string | null
}

export function fetchPracticeHistory(
  page: number,
  limit = 20
): Promise<{ total: number; page: number; limit: number; list: PracticeSessionRow[] }> {
  return http.get<{ total: number; page: number; limit: number; list: PracticeSessionRow[] }>(
    `/practice/history?page=${page}&limit=${limit}`
  )
}

export interface PracticeDetailRecord {
  no: number
  questionId: number
  userAnswer: string | null
  result: 'ok' | 'ng' | 'skip'
  ms: number
  stem: string
  stemImg?: string[] | null
  correctAnswer: string
  analysis: string
  options: PracticeOption[]
}

export function fetchPracticeDetail(
  id: number
): Promise<{ session: PracticeSessionRow; records: PracticeDetailRecord[] }> {
  return http.get<{ session: PracticeSessionRow; records: PracticeDetailRecord[] }>(`/practice/history/${id}`)
}

export interface PracticeStats {
  all: { sessions: number; totalQ: number; correctQ: number; wrongQ: number; skipQ: number; totalMs: number; rate: number }
  today: { sessions: number; totalQ: number; correctQ: number; wrongQ: number; skipQ: number; totalMs: number }
}

export function fetchPracticeStats(): Promise<PracticeStats> {
  return http.get<PracticeStats>('/practice/stats')
}

export function deletePracticeSession(id: number): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/practice/history/${id}`)
}

/* 本场错题重练：取该会话错题开新会话（返回结构与 start 一致） */
export function replayErrors(sessionId: number): Promise<StartResult> {
  return http.post<StartResult>(`/practice/${sessionId}/replay-errors`)
}
