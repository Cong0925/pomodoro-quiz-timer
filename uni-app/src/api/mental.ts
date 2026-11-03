/**
 * 速算练习 API 封装（后端 /api/mental，与 web-app/frontend/src/api/mental.ts 契约一致）
 * 请求统一走 utils/request：token 注入、超时、错误 toast、中文异常日志
 */
import { request } from '@/utils/request'
import type {
  MentalAnswerMode,
  MentalAnswerResult,
  MentalDetailResult,
  MentalFinishResult,
  MentalHistoryResult,
  MentalQtype,
  MentalStartQuestion,
  MentalStartResult,
  MentalStats,
} from '@/types/mental'

/** 开始一场速算练习（count<=0 为无限流；answerMode=fill 仅百化分/平方数生效） */
export function startMental(
  qtype: MentalQtype,
  difficulty: number,
  count: number,
  answerMode: MentalAnswerMode
): Promise<MentalStartResult> {
  return request<MentalStartResult>({
    url: '/api/mental/start',
    method: 'POST',
    data: { qtype, difficulty, count, answerMode },
  })
}

/** 作答一题：服务端判对错，返回正确答案与技巧；no 从 1 开始 */
export function answerMental(
  sessionId: number,
  no: number,
  questionId: number,
  answer: string,
  ms: number
): Promise<MentalAnswerResult> {
  return request<MentalAnswerResult>({
    url: `/api/mental/${sessionId}/answer`,
    method: 'POST',
    data: { no, questionId, answer, ms },
  })
}

/** 跳过一题（仅选择题模式） */
export function skipMental(
  sessionId: number,
  no: number,
  questionId: number,
  ms: number
): Promise<MentalAnswerResult> {
  return request<MentalAnswerResult>({
    url: `/api/mental/${sessionId}/skip`,
    method: 'POST',
    data: { no, questionId, ms },
  })
}

/** 无限流追加一批题目（10 题，排除已出） */
export function moreMental(sessionId: number): Promise<{ questions: MentalStartQuestion[] }> {
  return request<{ questions: MentalStartQuestion[] }>({
    url: `/api/mental/${sessionId}/more`,
    method: 'POST',
    data: {},
  })
}

/** 结算会话并归档历史 */
export function finishMental(sessionId: number, ms: number): Promise<MentalFinishResult> {
  return request<MentalFinishResult>({
    url: `/api/mental/${sessionId}/finish`,
    method: 'POST',
    data: { ms },
  })
}

/** 统计（累计 + 今日概况） */
export function fetchMentalStats(): Promise<MentalStats> {
  return request<MentalStats>({ url: '/api/mental/stats', method: 'GET' })
}

/** 历史会话分页列表 */
export function fetchMentalHistory(page: number, limit = 20): Promise<MentalHistoryResult> {
  return request<MentalHistoryResult>({
    url: `/api/mental/history?page=${page}&limit=${limit}`,
    method: 'GET',
  })
}

/** 单场会话明细（题目快照 + 每题作答结果） */
export function fetchMentalDetail(id: number): Promise<MentalDetailResult> {
  return request<MentalDetailResult>({ url: `/api/mental/history/${id}`, method: 'GET' })
}

/** 删除单场速算会话（明细级联删除） */
export function deleteMentalSession(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>({ url: `/api/mental/history/${id}`, method: 'DELETE' })
}

/** 清空速算历史 */
export function clearMentalHistory(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>({ url: '/api/mental/history', method: 'DELETE' })
}
