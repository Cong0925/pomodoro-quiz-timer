/**
 * 速算模块类型定义
 * 与 web-app/backend/routes/mental.js 接口契约一一对应（字段名保持一致）
 */

/** 速算题型 */
export type MentalQtype = 'percent' | 'compare' | 'estimate' | 'square' | 'mixed'

/** 作答模式：choice=选择题 fill=填空题 */
export type MentalAnswerMode = 'choice' | 'fill'

/** 填空方向（后端 fillMeta 推导）：den=填分母 pct=填百分数 frac=填分数 val=填数值 dec=填小数 */
export type MentalFillDir = 'den' | 'pct' | 'frac' | 'val' | 'dec'

/** 单题作答结果 */
export type MentalResult = 'ok' | 'ng' | 'skip'

/** 开始/追加返回的题目（不含答案与技巧，防作弊下发；填空模式附 fillDir） */
export interface MentalStartQuestion {
  id: number
  qtype: MentalQtype
  difficulty: number
  stem: string
  options: string[]
  tag: string
  fillDir?: MentalFillDir
}

/** POST /api/mental/start 返回 */
export interface MentalStartResult {
  sessionId: number
  qtype: MentalQtype
  qtypeName: string
  answerMode: MentalAnswerMode
  total: number
  infinite: boolean
  questions: MentalStartQuestion[]
}

/** 作答/跳过接口返回 */
export interface MentalAnswerResult {
  result: MentalResult
  correctIndex: number | null
  correctAnswer: string
  tip: string
}

/** 结算接口返回 */
export interface MentalFinishResult {
  id: number
  rate: number
  total: number
  done: number
  correct: number
  wrong: number
  skipped: number
  totalMs: number
  archived?: { id: number }
}

/** 历史列表行（后端返回下划线字段，原样透传） */
export interface MentalSessionRow {
  id: number
  qtype: MentalQtype
  qtype_name: string
  difficulty: number
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

/** 历史列表返回 */
export interface MentalHistoryResult {
  total: number
  page: number
  limit: number
  list: MentalSessionRow[]
}

/** 单场明细记录 */
export interface MentalDetailRecord {
  no: number
  qtype: MentalQtype
  stem: string
  options: string[]
  answer: string
  tip: string
  userAnswer: string | null
  result: MentalResult
  ms: number
}

/** 单场明细返回 */
export interface MentalDetailResult {
  session: MentalSessionRow
  records: MentalDetailRecord[]
}

/** 统计返回（累计 + 今日） */
export interface MentalStats {
  all: {
    sessions: number
    totalQ: number
    correctQ: number
    wrongQ: number
    skipQ: number
    totalMs: number
    rate: number
  }
  today: {
    sessions: number
    totalQ: number
    correctQ: number
    wrongQ: number
    skipQ: number
    totalMs: number
  }
}

/** 题型中文名映射 */
export const MENTAL_TYPE_NAMES: Record<MentalQtype, string> = {
  percent: '百化分',
  compare: '分数比大小',
  estimate: '估算值',
  square: '平方数',
  mixed: '综合练习',
}

/** 错题回顾项（答错 + 跳过，结算页展示） */
export interface MentalWrongItem {
  stem: string
  correctAnswer: string
  tip: string
  skipped: boolean
}
