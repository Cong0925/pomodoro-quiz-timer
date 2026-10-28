/**
 * 领域类型定义（与后端接口契约一一对应）
 * 数据来源：web-app/backend 9 个路由的返回结构
 */

/* ==================== 通用 ==================== */

/** 后端分页统一返回体 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

/** 题目作答结果：ok=对 ng=错 skip=跳过 */
export type QuizResult = 'ok' | 'ng' | 'skip'

/* ==================== 分类（两级） ==================== */

export interface CategorySub {
  id: string
  name: string
  sortOrder?: number
}

export interface Category {
  id: string
  name: string
  builtin: boolean
  subs: CategorySub[]
}

/** 分类选择结果（含名称快照） */
export interface CatPick {
  catId: string
  catName: string
  subId: string
  subName: string
}

/* ==================== 历史轮次 ==================== */

export interface HistoryRecord {
  no: number
  ms: number
  cumMs: number
  timeStr: string
  result: QuizResult
  note?: string | null
}

/** 列表项附带：该轮已收藏的题号（[{ no, id }]） */
export interface FavNoItem {
  no: number
  id: number
}

export interface HistoryItem {
  id: number
  mode: 'single' | 'batch' | 'practice' | 'mental'
  modeName: string
  title: string
  desc: string
  date: string
  maxCount: number
  totalMs: number
  correct: number
  rate: number
  catId?: string | null
  catName?: string | null
  subId?: string | null
  subName?: string | null
  records?: HistoryRecord[]
  favNos?: FavNoItem[]
}

/** 归档一轮的提交体 */
export interface HistoryArchivePayload {
  mode: 'single' | 'batch'
  modeName: string
  title: string
  description: string
  finishedAt: string
  maxCount: number
  totalMs: number
  correct: number
  rate: number
  catId: string
  catName: string
  subId: string
  subName: string
  records: Array<Pick<HistoryRecord, 'no' | 'ms' | 'cumMs' | 'timeStr' | 'result'>>
}

/* ==================== 错题收藏 ==================== */

export interface FavoriteItem {
  id: number
  hid: number
  no: number
  title: string
  mode: string
  modeName: string
  timeStr: string
  collectedAt: string
  catId?: string | null
  catName?: string | null
  subId?: string | null
  subName?: string | null
}

export interface FavoritePayload {
  roundId: number
  no: number
  title?: string
  mode?: string
  modeName?: string
  timeStr?: string
  catId?: string
  catName?: string
  subId?: string
  subName?: string
}

/* ==================== 学习统计 ==================== */

export interface StatsToday {
  rounds: number
  questions: number
  correct: number
  skipped: number
  rate: number
  workMs: number
  studyMs: number
}

export interface StatsRow {
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

export interface StatsData {
  today: StatsToday
  list: StatsRow[]
}

export type StatsGran = 'day' | 'week' | 'month'

/* ==================== 学习时长 ==================== */

export interface StudyDailyItem {
  date: string
  ms: number
}

export interface StudyRangeResult {
  start: string
  end: string
  totalMs: number
  list: StudyDailyItem[]
}

/* ==================== 日历备忘 ==================== */

export type MemoType = 'exam' | 'meeting' | 'study' | 'sport' | 'birthday' | 'travel' | 'other'

export interface MemoItem {
  date: string
  type: MemoType
  title: string
  content: string
}

export interface MemoSavePayload {
  type: MemoType
  title: string
  content: string
}

/** 备忘类型配置（颜色/文案，与主版本一致） */
export const MEMO_TYPES: Record<MemoType, { label: string; color: string; bg: string }> = {
  exam: { label: '考试', color: '#b91c1c', bg: '#fee2e2' },
  meeting: { label: '会议', color: '#1d4ed8', bg: '#dbeafe' },
  study: { label: '学习', color: '#15803d', bg: '#dcfce7' },
  sport: { label: '运动', color: '#c2410c', bg: '#ffedd5' },
  birthday: { label: '生日', color: '#be185d', bg: '#fce7f3' },
  travel: { label: '旅行', color: '#0e7490', bg: '#cffafe' },
  other: { label: '其他', color: '#4b5563', bg: '#f3f4f6' },
}
