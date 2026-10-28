/**
 * 分类 store：两级分类全量内存 + 计时视图上次选择记忆
 * 数据量小，加载一次后由各页面共享
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CatPick, Category } from '../types'
import * as categoriesApi from '../api/categories'

const LAST_CAT_KEY = 'pq_last_cat'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([])

  async function load(): Promise<void> {
    try {
      categories.value = await categoriesApi.fetchCategories()
    } catch (e) {
      console.error('【加载分类列表失败】', e)
      throw e
    }
  }

  function findCat(catId: string): Category | null {
    if (!catId) return null
    return categories.value.find((c) => c.id === catId) || null
  }

  function findSub(catId: string, subId: string) {
    const cat = findCat(catId)
    if (!cat || !subId) return null
    return cat.subs.find((s) => s.id === subId) || null
  }

  /**
   * 分类名解析：分类仍在用现名，分类已删则回落记录中的名称快照
   * 与主版本 categories.js labelOf 口径一致
   */
  function labelOf(item: { catId?: string | null; catName?: string | null; subId?: string | null; subName?: string | null }): CatPick {
    const cat = findCat(item.catId || '')
    const catName = cat ? cat.name : item.catName || ''
    let subName = ''
    if (cat) {
      const sub = item.subId ? cat.subs.find((s) => s.id === item.subId) : null
      subName = sub ? sub.name : item.subName || ''
    } else if (item.subName) {
      subName = item.subName
    }
    return { catId: item.catId || '', catName, subId: item.subId || '', subName }
  }

  /* ---- 计时视图上次选择（localStorage 记忆） ---- */
  function loadLastSel(): { catId: string; subId: string } {
    try {
      const raw = localStorage.getItem(LAST_CAT_KEY)
      if (!raw) return { catId: '', subId: '' }
      const o = JSON.parse(raw) as { catId?: string; subId?: string }
      return { catId: o.catId || '', subId: o.subId || '' }
    } catch (e) {
      console.error('【读取上次分类选择失败】', e)
      return { catId: '', subId: '' }
    }
  }

  function saveLastSel(catId: string, subId: string): void {
    try {
      localStorage.setItem(LAST_CAT_KEY, JSON.stringify({ catId: catId || '', subId: subId || '' }))
    } catch (e) {
      console.error('【保存上次分类选择失败】', e)
    }
  }

  return { categories, load, findCat, findSub, labelOf, loadLastSel, saveLastSel }
})
