/**
 * 分类树 API（后端 /api/categories）
 */
import { request } from '@/utils/request'
import type { Category } from '@/types/category'

/** 全部分类树（大类 + 小类） */
export function fetchCategories(): Promise<Category[]> {
  return request<Category[]>({ url: '/api/categories' })
}
