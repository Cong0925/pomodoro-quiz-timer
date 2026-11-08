<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">累计 {{ total }} 场练习</view>
      <view class="hero-title">练习记录</view>
      <view class="hero-sub">回顾解析 · 只看错题 · 本场错题重练</view>
    </view>

    <!-- 模式筛选 -->
    <view class="seg filter-seg">
      <view
        v-for="f in filters"
        :key="f.value"
        class="seg-item"
        :class="{ active: curFilter === f.value }"
        @tap="onFilter(f.value)"
      >
        {{ f.label }}
      </view>
    </view>

    <!-- 历史列表 -->
    <view v-if="list.length" class="rec-list">
      <view
        v-for="it in list"
        :key="it.id"
        class="rec-card"
        :class="rateClass(it.rate)"
        hover-class="rec-press"
        @tap="goDetail(it.id)"
      >
        <view class="rec-top">
          <view class="rec-name-wrap">
            <view class="rec-name">{{ it.bank_name }}</view>
            <view class="rec-tags">
              <text v-if="it.cat_name" class="tag brand">{{ it.cat_name }}</text>
              <text v-if="it.sub_name" class="tag">{{ it.sub_name }}</text>
              <text class="tag amber">{{ modeLabel(it.mode) }}</text>
            </view>
          </view>
          <view class="rec-rate" :class="rateClass(it.rate)">{{ it.rate }}<text class="pct">%</text></view>
        </view>

        <view class="rec-progress">
          <view class="rec-progress-inner" :style="{ width: progressPct(it) + '%' }"></view>
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

    <view v-if="loading" class="load-tip">加载中…</view>
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

function rateClass(rate: number): string {
  const r = Number(rate) || 0
  if (r >= 80) return 'good'
  if (r >= 60) return 'mid'
  if (r >= 40) return 'warn'
  return 'bad'
}

function fmtTime(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 完成度百分比（防 0 除） */
function progressPct(it: PracticeHistoryItem): number {
  if (!it.total_count) return 0
  return Math.min(100, Math.round((it.done_count / it.total_count) * 100))
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
.filter-seg {
  margin-top: 28rpx;
}

.filter-seg .seg-item {
  font-size: 23rpx;
}

.rec-list {
  margin-top: 28rpx;
}

.rec-card {
  position: relative;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 26rpx 26rpx 26rpx 32rpx;
  margin-bottom: 18rpx;
  box-shadow: $shadow-l1;
  overflow: hidden;
}

.rec-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 26rpx;
  bottom: 26rpx;
  width: 8rpx;
  border-radius: 0 8rpx 8rpx 0;
  background: $brand-gradient;
}

.rec-card.good::before {
  background: linear-gradient(180deg, #35d07f, $success);
}

.rec-card.warn::before {
  background: linear-gradient(180deg, #ffc24d, $warning);
}

.rec-card.bad::before {
  background: linear-gradient(180deg, #ff8a80, $danger);
}

.rec-press {
  background-color: #fbfcff;
}

.rec-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.rec-name-wrap {
  flex: 1;
  min-width: 0;
}

.rec-name {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rec-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 10rpx;
}

.rec-rate {
  flex-shrink: 0;
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1;
  color: $brand-600;
  font-variant-numeric: tabular-nums;
}

.rec-rate.good {
  color: $success;
}

.rec-rate.warn {
  color: $warning;
}

.rec-rate.bad {
  color: $danger;
}

.pct {
  font-size: 22rpx;
  font-weight: 600;
  opacity: 0.62;
}

.rec-progress {
  height: 8rpx;
  margin-top: 20rpx;
  border-radius: $radius-full;
  background-color: $line;
  overflow: hidden;
}

.rec-progress-inner {
  height: 100%;
  border-radius: $radius-full;
  background: $brand-gradient;
}

.rec-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx 18rpx;
  margin-top: 16rpx;
}

.rec-stat {
  font-size: 23rpx;
  color: $ink-2;
}

.rec-stat.ok {
  color: $success;
}

.rec-stat.ng {
  color: $danger;
}

.rec-stat.sk {
  color: $warning;
}

.rec-time {
  margin-left: auto;
  font-size: 21rpx;
  color: $ink-3;
}

.rec-del {
  display: block;
  width: fit-content;
  margin-top: 12rpx;
  margin-left: auto;
  padding: 4rpx 16rpx;
  border-radius: $radius-full;
  background-color: $danger-bg;
  color: $danger;
  font-size: 20rpx;
}

.load-tip {
  padding: 28rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: $ink-3;
}

.load-more {
  margin-top: 10rpx;
  padding: 22rpx 0;
  text-align: center;
  border-radius: $radius-full;
  background-color: $bg-card;
  color: $brand-600;
  font-size: 25rpx;
  font-weight: 600;
  box-shadow: $shadow-l1;
}
</style>
