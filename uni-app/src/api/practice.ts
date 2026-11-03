/**
 * 题库练习 API（后端 /api/practice）
 */
import { request } from '@/utils/request'
import type {
  PracticeAnswerRes,
  PracticeBank,
  PracticeFinishRes,
  PracticeHistoryDetail,
  PracticeHistoryItem,
  PracticeMode,
  PracticeStartRes,
  PracticeStats,
} from '@/types/practice'

/** 题库列表（含分类快照 + 题量） */
export function fetchBanks(): Promise<PracticeBank[]> {
  return request<PracticeBank[]>({ url: '/api/practice/banks' })
}

/** 开始练习会话：bankId + mode(order/random/review) + count */
export function startPractice(data: {
  bankId: number
  mode: PracticeMode
  count: number
}): Promise<PracticeStartRes> {
  return request<PracticeStartRes>({
    url: '/api/practice/start',
    method: 'POST',
    data,
  })
}

/** 作答：no(从1) + questionId + answer(字母串，multi 如 "AB") + ms */
export function answerPracticeQuestion(
  sessionId: number,
  data: { no: number; questionId: number; answer: string; ms: number }
): Promise<PracticeAnswerRes> {
  return request<PracticeAnswerRes>({
    url: `/api/practice/${sessionId}/answer`,
    method: 'POST',
    data,
  })
}

/** 跳过：仅记录本题跳过（不再下发答案/解析之外的内容） */
export function skipPracticeQuestion(
  sessionId: number,
  data: { no: number; questionId: number; ms: number }
): Promise<PracticeAnswerRes> {
  return request<PracticeAnswerRes>({
    url: `/api/practice/${sessionId}/skip`,
    method: 'POST',
    data,
  })
}

/** 结算会话：ms 总用时（毫秒） */
export function finishPractice(sessionId: number, ms: number): Promise<PracticeFinishRes> {
  return request<PracticeFinishRes>({
    url: `/api/practice/${sessionId}/finish`,
    method: 'POST',
    data: { ms },
  })
}

/** 本场错题重练：返回新的会话（mode=review），可直接进入答题 */
export function replayErrors(sessionId: number): Promise<PracticeStartRes> {
  return request<PracticeStartRes>({
    url: `/api/practice/${sessionId}/replay-errors`,
    method: 'POST',
  })
}

/** 练习历史分页：page/limit/mode */
export function fetchPracticeHistory(params: {
  page?: number
  limit?: number
  mode?: PracticeMode
}): Promise<{ total: number; page: number; limit: number; list: PracticeHistoryItem[] }> {
  return request({ url: '/api/practice/history', data: params })
}

/** 历史详情（会话 + 逐题明细，含解析） */
export function fetchPracticeHistoryDetail(id: number): Promise<PracticeHistoryDetail> {
  return request<PracticeHistoryDetail>({ url: `/api/practice/history/${id}` })
}

/** 删除单个练习会话 */
export function deletePracticeHistory(id: number): Promise<{ ok: boolean }> {
  return request({ url: `/api/practice/history/${id}`, method: 'DELETE' })
}

/** 清空练习历史 */
export function clearPracticeHistory(): Promise<{ ok: boolean }> {
  return request({ url: '/api/practice/history', method: 'DELETE' })
}

/** 练习统计（累计 + 今日） */
export function fetchPracticeStats(): Promise<PracticeStats> {
  return request<PracticeStats>({ url: '/api/practice/stats' })
}
