/**
 * 小程序通用类型定义（骨架版，后端对接时按实际接口补充/修正）
 */

/** 分类（大类） */
export interface Category {
  id: string
  name: string
}

/** 题库（二级分类） */
export interface QuestionBank {
  id: number
  name: string
  catId: string
  count?: number
}

/** 题目（与 web-app 后端 /api/practice/questions 驼峰约定一致） */
export interface Question {
  id: number
  bankId: number
  type: 'choice' | 'fill'
  stem: string
  stemImg?: string[]
  options?: string[]
  answer: string
  analysis: string
  difficulty?: number
  source?: string
  isDeleted?: number
}

/** 练习记录（概要） */
export interface PracticeRecordSummary {
  id: number
  bankId: number
  bankName?: string
  total: number
  correct: number
  duration: number
  createdAt: string
  mode: string
}

/** 当前用户（后端 /api/auth/login 返回） */
export interface UserInfo {
  id: number
  nickname: string
  avatar: string
}
