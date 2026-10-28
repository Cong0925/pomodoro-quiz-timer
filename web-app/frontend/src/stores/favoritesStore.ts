/**
 * 错题收藏 store：后端分页 + 筛选 + 追加加载
 * 收藏动作本身在历史明细里触发，本 store 负责收藏页数据与徽标
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as favoritesApi from '../api/favorites'
import type { CatPick, FavoriteItem, FavoritePayload } from '../types'

export interface FavFilter {
  mode: string
  catId: string
  subId: string
}

const PAGE_LIMIT = 20

export const useFavoritesStore = defineStore('favorites', () => {
  const list = ref<FavoriteItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const totalPages = ref(1)
  const filter = ref<FavFilter>({ mode: '', catId: '', subId: '' })

  async function loadPage(opts: { page?: number; append?: boolean } = {}): Promise<void> {
    const p = opts.page || 1
    try {
      const data = await favoritesApi.fetchFavorites({ ...filter.value, page: p, limit: PAGE_LIMIT })
      list.value = opts.append && page.value === data.page - 1 ? [...list.value, ...data.list] : data.list
      total.value = data.total
      page.value = data.page
      totalPages.value = data.totalPages
    } catch (e) {
      console.error('【加载错题收藏分页失败】', e)
      throw e
    }
  }

  async function setFilter(f: Partial<FavFilter>): Promise<void> {
    filter.value = { ...filter.value, ...f }
    await loadPage({ page: 1 })
  }

  async function loadMore(): Promise<void> {
    if (page.value >= totalPages.value) return
    await loadPage({ page: page.value + 1, append: true })
  }

  async function add(payload: FavoritePayload): Promise<number> {
    try {
      const r = await favoritesApi.addFavorite(payload)
      await loadPage({ page: 1 })
      return r.id
    } catch (e) {
      console.error('【收藏错题失败】', e)
      throw e
    }
  }

  async function remove(id: number): Promise<void> {
    try {
      await favoritesApi.deleteFavorite(id)
      let p = page.value
      if (list.value.length === 1 && p > 1) p--
      await loadPage({ page: p })
    } catch (e) {
      console.error('【取消收藏失败】', e)
      throw e
    }
  }

  async function updateCat(id: number, pick: CatPick): Promise<void> {
    try {
      await favoritesApi.updateFavorite(id, pick)
      await loadPage({ page: page.value })
    } catch (e) {
      console.error('【修改收藏分类失败】', e)
      throw e
    }
  }

  async function clearAll(): Promise<void> {
    try {
      await favoritesApi.clearFavorites()
      await loadPage({ page: 1 })
    } catch (e) {
      console.error('【清空错题收藏失败】', e)
      throw e
    }
  }

  return { list, total, page, totalPages, filter, loadPage, setFilter, loadMore, add, remove, updateCat, clearAll }
})
