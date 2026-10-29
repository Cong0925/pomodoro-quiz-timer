/**
 * 历史记录 store：后端分页 + 筛选 + 追加加载（加载更多）
 * 归档/编辑/删除后按原生口径自动刷新当前页
 */
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as historyApi from '../api/history'
import type { HistoryArchivePayload, HistoryItem } from '../types'

export interface HistoryFilter {
  mode: string
  catId: string
  subId: string
}

const PAGE_LIMIT = 20

export const useHistoryStore = defineStore('history', () => {
  const list = ref<HistoryItem[]>([])
  const total = ref(0)
  const page = ref(1)
  const totalPages = ref(1)
  const filter = ref<HistoryFilter>({ mode: '', catId: '', subId: '' })

  const isEmpty = computed(() => list.value.length === 0)

  let reqSeq = 0 // 请求序号：响应回来先比对，过期响应丢弃（防快速连点/切换筛选乱序覆盖）

  async function loadPage(opts: { page?: number; append?: boolean } = {}): Promise<void> {
    const p = opts.page || 1
    const seq = ++reqSeq
    try {
      const data = await historyApi.fetchHistoryPage({
        ...filter.value,
        page: p,
        limit: PAGE_LIMIT,
      })
      if (seq !== reqSeq) return // 已有更新的请求发出，丢弃过期响应
      list.value = opts.append && page.value === data.page - 1 ? [...list.value, ...data.list] : data.list
      total.value = data.total
      page.value = data.page
      totalPages.value = data.totalPages
    } catch (e) {
      console.error('【加载历史记录分页失败】', e)
      throw e
    }
  }

  async function setFilter(f: Partial<HistoryFilter>): Promise<void> {
    filter.value = { ...filter.value, ...f }
    await loadPage({ page: 1 })
  }

  async function loadMore(): Promise<void> {
    if (page.value >= totalPages.value) return
    await loadPage({ page: page.value + 1, append: true })
  }

  /** 归档一轮（成功后回到第一页，新记录在最前） */
  async function archive(payload: HistoryArchivePayload): Promise<number> {
    try {
      const r = await historyApi.archiveRound(payload)
      await loadPage({ page: 1 })
      return r.id
    } catch (e) {
      console.error('【归档历史轮次失败】', e)
      throw e
    }
  }

  async function update(id: number, patch: historyApi.HistoryPatch): Promise<void> {
    try {
      await historyApi.updateHistory(id, patch)
      await loadPage({ page: page.value })
    } catch (e) {
      console.error('【编辑历史记录失败】', e)
      throw e
    }
  }

  async function updateNote(roundId: number, no: number, note: string): Promise<void> {
    try {
      await historyApi.updateRecordNote(roundId, no, note)
      const h = list.value.find((x) => x.id === roundId)
      const rec = h?.records?.find((r) => r.no === no)
      if (rec) rec.note = note
    } catch (e) {
      console.error('【保存知识点描述失败】', e)
      throw e
    }
  }

  async function remove(id: number): Promise<void> {
    try {
      await historyApi.deleteHistory(id)
      let p = page.value
      if (list.value.length === 1 && p > 1) p--
      await loadPage({ page: p })
    } catch (e) {
      console.error('【删除历史记录失败】', e)
      throw e
    }
  }

  async function clearAll(): Promise<void> {
    try {
      await historyApi.clearHistory()
      await loadPage({ page: 1 })
    } catch (e) {
      console.error('【清空历史记录失败】', e)
      throw e
    }
  }

  /** 更新某轮的收藏题号列表（收藏/取消后本地同步，徽标联动） */
  function setFavNos(roundId: number, favNos: Array<{ no: number; id: number }>): void {
    const h = list.value.find((x) => x.id === roundId)
    if (h) h.favNos = favNos
  }

  return { list, total, page, totalPages, filter, isEmpty, loadPage, setFilter, loadMore, archive, update, updateNote, remove, clearAll, setFavNos }
})
