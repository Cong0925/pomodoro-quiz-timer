/** 错题收藏 API（/api/favorites） */
import { http } from './http'
import type { CatPick, FavoriteItem, FavoritePayload, PageResult } from '../types'

export interface FavQuery {
  mode?: string
  catId?: string
  subId?: string
  page?: number
  limit?: number
}

export function fetchFavorites(q: FavQuery): Promise<PageResult<FavoriteItem>> {
  const params = new URLSearchParams()
  if (q.mode) params.set('mode', q.mode)
  if (q.catId) params.set('catId', q.catId)
  if (q.subId) params.set('subId', q.subId)
  params.set('page', String(q.page || 1))
  params.set('limit', String(q.limit || 20))
  return http.get<PageResult<FavoriteItem>>(`/favorites?${params.toString()}`)
}

export function addFavorite(payload: FavoritePayload): Promise<{ ok: boolean; id: number }> {
  return http.post<{ ok: boolean; id: number }>('/favorites', payload)
}

export function updateFavorite(id: number, pick: CatPick): Promise<{ ok: boolean }> {
  return http.put<{ ok: boolean }>(`/favorites/${id}`, pick)
}

export function deleteFavorite(id: number): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>(`/favorites/${id}`)
}

export function clearFavorites(): Promise<{ ok: boolean }> {
  return http.del<{ ok: boolean }>('/favorites')
}
