<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">累计 {{ total }} 场练习</view>
      <view class="hero-title">练习记录</view>
      <view class="hero-sub">回顾解析 · 只看错题 · 本场错题重练</view>
    </view>

    <!-- 模式筛选 -->
    <view class="sec">
      <view class="chip-row">
        <view
          v-for="f in filters"
          :key="f.value"
          class="chip"
          :class="{ active: curFilter === f.value }"
          @tap="onFilter(f.value)"
        >
          {{ f.label }}
        </view>
      </view>
    </view>

    <!-- 历史列表 -->
    <view v-if="list.length" class="sec">
      <view v-for="it in list" :key="it.id" class="rec-card" @tap="goDetail(it.id)">
        <view class="rec-top">
          <view class="rec-name">{{ it.bank_name }}</view>
          <view class="rec-rate">{{ it.rate }}<text class="pct">%</text></view>
        </view>
        <view class="rec-tags">
          <text v-if="it.cat_name" class="rec-tag cat">{{ it.cat_name }}</text>
          <text v-if="it.sub_name" class="rec-tag">{{ it.sub_name }}</text>
          <text class="rec-tag mode">{{ modeLabel(it.mode) }}</text>
        </view>
        <view class="rec-bottom">
          <text class="rec-stat">答 {{ it.done_count }}/{{ it.total_count }}</text>
          <text class="rec-stat ok">对 {{ it.correct_count }}</text>
          <text class="rec-stat ng">错 {{ it.wrong_count }}</text>
          <text class="rec-stat sk">跳 {{ it.skipped_count }}</text>
          <text class="rec-time">{{ fmtTime(it.finished_at || it.started_at) }}</text>
        </view>
        <view class="rec-del" @tap.stop="confirmDel(it.id)">删除</view>
      </view>
    </view>

    <view v-else-if="!loading" class="empty-box">
      <view class="empty-title">暂无练习记录</view>
      <view class="empty-text">去「题库练习」刷一组题，记录会展示在这里</view>
    </view>

    <view v-if="loading" class="center-box"><text class="center-text">加载中…</text></view>
    <view v-else-if="hasMore" class="load-more" @tap="loadMore">加载更多</view>
  </view>
</template>

<script setup lang="ts">
/**
 * 练习记录页：模式筛选 + 分页列表 + 删除；点击进详情（回顾/错题重练）
 */
import { ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { deletePracticeHistory, fetchPracticeHistory } from '@/api/practice'
import type { PracticeHistoryItem, PracticeMode } from '@/types/practice'

const filters = ref([
  { value: '', label: '全部' },
  { value: 'order', label: '顺序' },
  { value: 'random', label: '随机' },
  { value: 'review', label: '错题重练' },
])
const curFilter = ref<'' | PracticeMode>('')
const list = ref<PracticeHistoryItem[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const hasMore = ref(true)
const limit = 20

function modeLabel(m: PracticeMode): string {
  return m === 'random' ? '随机' : m === 'review' ? '错题重练' : '顺序'
}

function fmtTime(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function load(reset: boolean): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const res = await fetchPracticeHistory({
      page: reset ? 1 : page.value,
      limit,
      mode: curFilter.value || undefined,
    })
    list.value = reset ? res.list : [...list.value, ...res.list]
    total.value = res.total
    hasMore.value = list.value.length < res.total
    page.value = reset ? 2 : page.value + 1
  } catch (err) {
    console.error('【练习历史接口请求失败】', err)
  } finally {
    loading.value = false
  }
}

function onFilter(v: string): void {
  curFilter.value = (v as '' | PracticeMode) || ''
  page.value = 1
  hasMore.value = true
  list.value = []
  void load(true)
}

function loadMore(): void {
  void load(false)
}

function goDetail(id: number): void {
  uni.navigateTo({ url: `/pages/quiz/record-detail?id=${id}` })
}

function confirmDel(id: number): void {
  uni.showModal({
    title: '删除记录',
    content: '删除后无法恢复，确定删除本场练习记录？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await deletePracticeHistory(id)
        uni.showToast({ title: '已删除', icon: 'success' })
        page.value = 1
        hasMore.value = true
        list.value = []
        void load(true)
      } catch (err) {
        console.error('【练习记录删除失败】', err)
      }
    },
  })
}

onShow(() => {
  page.value = 1
  hasMore.value = true
  list.value = []
  void load(true)
})

onReachBottom(() => {
  if (hasMore.value) void load(false)
})
</script>

<style scoped lang="scss">
.center-box { padding: 120rpx 32rpx; display: flex; flex-direction: column; align-items: center; }
.center-text { font-size: 26rpx; color: $text-weak; }
.load-more { text-align: center; padding: 30rpx 0; color: $brand-600; font-size: 26rpx; }

.rec-card {
  position: relative; background-color: $bg-card; border-radius: $radius-md; padding: 24rpx 26rpx;
  margin-bottom: $gap-item; box-shadow: $shadow-card-sm;
}
.rec-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; }
.rec-name { font-size: 29rpx; font-weight: 700; color: $text-main; flex: 1; min-width: 0; }
.rec-rate { font-size: 40rpx; font-weight: 800; color: $brand-600; flex-shrink: 0; }
.pct { font-size: 22rpx; font-weight: 600; color: $brand-400; }
.rec-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 12rpx; }
.rec-tag { font-size: 20rpx; color: $text-sub; background-color: #f1f5f9; border-radius: $radius-full; padding: 4rpx 14rpx; }
.rec-tag.cat { color: $brand-600; background-color: $brand-50; }
.rec-tag.mode { color: $warning; background-color: $warning-bg; }
.rec-bottom { display: flex; flex-wrap: wrap; align-items: center; gap: 8rpx 20rpx; margin-top: 14rpx; }
.rec-stat { font-size: 23rpx; color: $text-sub; }
.rec-stat.ok { color: $success; }
.rec-stat.ng { color: $danger; }
.rec-stat.sk { color: $warning; }
.rec-time { font-size: 22rpx; color: $text-weak; margin-left: auto; }
.rec-del {
  position: absolute; top: 22rpx; right: 22rpx; font-size: 21rpx; color: $text-weak;
  padding: 6rpx 16rpx; border: 2rpx solid $line; border-radius: $radius-full; background-color: $bg-page;
}
</style>
