/**
 * 分类树类型（与后端 /api/categories 契约对齐）
 */

export interface SubCategory {
  id: string
  name: string
  sortOrder: number
}

export interface Category {
  id: string
  name: string
  builtin: boolean
  subs: SubCategory[]
}
