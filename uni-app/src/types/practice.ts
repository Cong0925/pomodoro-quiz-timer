/**
 * 题库练习类型定义（与后端 /api/practice 契约对齐）
 */

export type PracticeMode = 'order' | 'random' | 'review'
export type PracticeQuestionType = 'single' | 'multi' | 'judge'

/** 题库（banks 列表项） */
export interface PracticeBank {
  id: number
  name: string
  catId: string | null
  subId: string | null
  description: string
  catName: string
  subName: string
  count: number
  createdAt: string
}

/** 练习题目（不含答案/解析，开始会话时下发） */
export interface PracticeQuestion {
  id: number
  type: PracticeQuestionType
  stem: string
  stemImg: string[] | null
  options: string[]
  difficulty: number
}

/** 开始会话 / 错题重练返回 */
export interface PracticeStartRes {
  sessionId: number
  bank: { id: number; name: string; catName: string; subName: string }
  mode: PracticeMode
  questions: PracticeQuestion[]
  total: number
}

/** 判题返回 */
export interface PracticeAnswerRes {
  result: 'ok' | 'ng'
  correctAnswer: string
  analysis: string
  stem: string
  stemImg: string[] | null
  options: string[]
}

/** 结算返回（与速算 MentalFinishResult 同形，可复用结算组件） */
export interface PracticeFinishRes {
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
export interface PracticeHistoryItem {
  id: number
  bank_name: string
  mode: PracticeMode
  total_count: number
  done_count: number
  correct_count: number
  wrong_count: number
  skipped_count: number
  rate: number
  total_ms: number
  cat_name: string
  sub_name: string
  started_at: string
  finished_at: string | null
}

/** 历史明细记录 */
export interface PracticeRecordDetail {
  no: number
  questionId: number
  userAnswer: string | null
  result: 'ok' | 'ng' | 'skip'
  ms: number
  stem: string
  stemImg: string[] | null
  correctAnswer: string
  analysis: string
  options: string[]
}

/** 历史详情（会话 + 明细） */
export interface PracticeHistoryDetail {
  session: {
    id: number
    bank_id: number
    bank_name: string
    mode: PracticeMode
    total_count: number
    done_count: number
    correct_count: number
    wrong_count: number
    skipped_count: number
    rate: number
    total_ms: number
    cat_id: string
    cat_name: string
    sub_id: string
    sub_name: string
    started_at: string
    finished_at: string | null
  }
  records: PracticeRecordDetail[]
}

/** 练习统计（累计 + 今日） */
export interface PracticeStats {
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
