/** 分类管理 API（/api/categories） */
import { http } from './http'
import type { Category } from '../types'

export function fetchCategories(): Promise<Category[]> {
  return http.get<Category[]>('/categories')
}

export function createCategory(name: string): Promise<Category> {
  return http.post<Category>('/categories', { name })
}

export function renameCategory(id: string, name: string): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/categories/${id}`, { name })
}

export function deleteCategory(id: string): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/categories/${id}`)
}

export function createSub(catId: string, name: string): Promise<{ id: string; name: string }> {
  return http.post<{ id: string; name: string }>(`/categories/${catId}/subs`, { name })
}

export function renameSub(catId: string, subId: string, name: string): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/categories/${catId}/subs/${subId}`, { name })
}

export function deleteSub(catId: string, subId: string): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/categories/${catId}/subs/${subId}`)
}

export function restoreBuiltin(): Promise<{ ok: boolean; added: number }> {
  return http.post<{ ok: boolean; added: number }>('/categories/restore')
}
