/** 数据导入导出 API（/api/export /api/import /api/info） */
import { http } from './http'

export interface ExportPayload {
  version: number
  [key: string]: unknown
}

export function exportAll(): Promise<ExportPayload> {
  return http.get<ExportPayload>('/export')
}

export interface ImportInfo {
  ok: boolean
  h?: number
  f?: number
  hasCats?: boolean
  hasStudy?: boolean
  hasMemos?: boolean
  [key: string]: unknown
}

export function importAll(data: unknown): Promise<ImportInfo> {
  return http.post<ImportInfo>('/import', data)
}

export interface DbInfo {
  dbName: string
  host: string
  categories: number
  categorySubs: number
  rounds: number
  records: number
  favorites: number
  memos: number
  studyDays: number
  studyMs: number
  questionBanks: number
  questions: number
  practiceSessions: number
  practiceRecords: number
  mentalQuestions: number
  mentalSessions: number
  mentalRecords: number
}

export function fetchDbInfo(): Promise<DbInfo> {
  return http.get<DbInfo>('/info')
}
