<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">累计 {{ total }} 轮计时</view>
      <view class="hero-title">计时记录</view>
      <view class="hero-sub">单题 / 整组计时归档，支持查看明细与删除</view>
    </view>

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
            <view class="rec-name">{{ it.title }}</view>
            <view class="rec-tags">
              <text v-if="it.catName" class="tag brand">{{ it.catName }}</text>
              <text v-if="it.subName" class="tag">{{ it.subName }}</text>
              <text class="tag amber">{{ it.modeName }}</text>
            </view>
          </view>
          <view class="rec-rate" :class="rateClass(it.rate)">{{ it.rate }}<text class="pct">%</text></view>
        </view>

        <view class="rec-bar">
          <view class="rec-bar-inner" :style="{ width: correctPct(it) + '%' }"></view>
        </view>

        <view class="rec-bottom">
          <text class="rec-stat">题 {{ it.questions }}</text>
          <text class="rec-stat ok">对 {{ it.correct }}</text>
          <text class="rec-stat">{{ fmtMs(it.totalMs) }}</text>
          <text class="rec-time">{{ fmtTime(it.finishedAt) }}</text>
        </view>

        <view class="rec-del" @tap.stop="confirmDel(it.id)">删除</view>
      </view>
    </view>

    <view v-else-if="!loading" class="empty-box">
      <view class="empty-title">暂无计时记录</view>
      <view class="empty-text">用「单题计时」或「整组计时」刷一组，记录会展示在这里</view>
    </view>

    <view v-if="loading" class="load-tip">加载中…</view>
    <view v-else-if="hasMore" class="load-more" @tap="loadMore">加载更多</view>

    <!-- 明细抽屉（替代系统弹窗展示长明细） -->
    <AppSheet :show="showDetail" :title="detailTitle" :subtitle="detailSub" @close="closeDetail">
      <view v-if="detailLoading" class="detail-loading">明细加载中…</view>
      <view v-else-if="detail" class="detail-box">
        <view class="detail-stats">
          <view class="ds-cell">
            <text class="ds-num">{{ detail.round.maxCount }}</text>
            <text class="ds-label">题量</text>
          </view>
          <view class="ds-cell">
            <text class="ds-num ok">{{ detail.round.correct }}</text>
            <text class="ds-label">答对</text>
          </view>
          <view class="ds-cell">
            <text class="ds-num">{{ fmtMs(detail.round.totalMs) }}</text>
            <text class="ds-label">累计用时</text>
          </view>
        </view>

        <scroll-view scroll-y :show-scrollbar="false" class="detail-list" :style="{ height: detailListHeight }">
          <view v-for="rec in detail.records" :key="rec.no" class="detail-row" :class="rec.result">
            <text class="dr-no">第 {{ rec.no }} 题</text>
            <text class="dr-ms">{{ rec.ms > 0 ? fmtMs(rec.ms) : rec.timeStr || '—' }}</text>
            <text class="dr-mark">{{ markShort(rec.result) }}</text>
          </view>
        </scroll-view>
      </view>
    </AppSheet>
  </view>
</template>

<script setup lang="ts">
/**
 * 计时记录页：单题/整组过滤 + 分页列表 + 明细抽屉 + 删除
 */
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import AppSheet from '@/components/AppSheet.vue'
import { deleteTimerHistory, fetchTimerHistory, fetchTimerHistoryDetail } from '@/api/timer'
import type { TimerHistoryDetail, TimerHistoryItem, TimerMode, TimerResult } from '@/types/timer'

const filters = ref([
  { value: '', label: '全部' },
  { value: 'single', label: '单题' },
  { value: 'batch', label: '整组' },
])
const curFilter = ref<'' | TimerMode>('')
const list = ref<TimerHistoryItem[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const hasMore = ref(true)
const limit = 20

/* ---- 明细抽屉 ---- */
const showDetail = ref(false)
const detailLoading = ref(false)
const detail = ref<TimerHistoryDetail | null>(null)

const detailTitle = computed(() =>
  detail.value ? `${detail.value.round.modeName} · 正确率 ${detail.value.round.rate}%` : '计时明细'
)
const detailSub = computed(() => {
  if (!detail.value) return ''
  return `${detail.value.round.title} · 共 ${detail.value.round.maxCount} 题 · ${fmtTime(detail.value.round.finishedAt)}`
})
/** 明细列表高度：按条数撑开，最多 560rpx 后内部滚动 */
const detailListHeight = computed(() => `${Math.min((detail.value?.records.length || 0) * 76, 560)}rpx`)

function fmtTime(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return `${m}:${s}`
}

/** 答对占比进度条（防 0 除） */
function correctPct(it: TimerHistoryItem): number {
  if (!it.questions) return 0
  return Math.min(100, Math.round((it.correct / it.questions) * 100))
}

function markShort(r: TimerResult): string {
  return r === 'ok' ? '对' : r === 'ng' ? '错' : '跳'
}

function rateClass(rate: number): string {
  const r = Number(rate) || 0
  if (r >= 80) return 'good'
  if (r >= 60) return 'mid'
  if (r >= 40) return 'warn'
  return 'bad'
}

async function load(reset: boolean): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const res = await fetchTimerHistory({
      page: reset ? 1 : page.value,
      limit,
      mode: curFilter.value || undefined,
    })
    list.value = reset ? res.list : [...list.value, ...res.list]
    total.value = res.total
    hasMore.value = list.value.length < res.total
    page.value = reset ? 2 : page.value + 1
  } catch (err) {
    console.error('【计时历史接口请求失败】', err)
  } finally {
    loading.value = false
  }
}

function onFilter(v: string): void {
  curFilter.value = (v as '' | TimerMode) || ''
  page.value = 1
  hasMore.value = true
  list.value = []
  void load(true)
}

function loadMore(): void {
  void load(false)
}

/** 查看明细：拉取后以底部抽屉展示全部逐题记录 */
async function goDetail(id: number): Promise<void> {
  showDetail.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await fetchTimerHistoryDetail(id)
  } catch (err) {
    console.error('【计时详情接口请求失败】', err)
    uni.showToast({ title: '明细加载失败', icon: 'none' })
    showDetail.value = false
  } finally {
    detailLoading.value = false
  }
}

function closeDetail(): void {
  showDetail.value = false
}

function confirmDel(id: number): void {
  uni.showModal({
    title: '删除记录',
    content: '删除后无法恢复，确定删除本轮计时记录？',
    success: async (r) => {
      if (!r.confirm) return
      try {
        await deleteTimerHistory(id)
        uni.showToast({ title: '已删除', icon: 'success' })
        page.value = 1
        hasMore.value = true
        list.value = []
        void load(true)
      } catch (err) {
        console.error('【计时记录删除失败】', err)
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
.page {
  padding-bottom: 80rpx;
}

.filter-seg {
  margin-top: 28rpx;
}

.rec-list {
  margin-top: 24rpx;
}

.rec-card {
  position: relative;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 26rpx 26rpx 24rpx 32rpx;
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

.rec-bar {
  height: 8rpx;
  margin-top: 20rpx;
  border-radius: $radius-full;
  background-color: $line;
  overflow: hidden;
}

.rec-bar-inner {
  height: 100%;
  border-radius: $radius-full;
  background: $brand-gradient;
}

.rec-bottom {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8rpx 18rpx;
  margin-top: 14rpx;
}

.rec-stat {
  font-size: 23rpx;
  color: $ink-2;
}

.rec-stat.ok {
  color: $success;
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
  padding: 24rpx 0;
  text-align: center;
  font-size: 23rpx;
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

/* ---- 明细抽屉 ---- */
.detail-loading {
  padding: 60rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: $ink-3;
}

.detail-box {
  padding-bottom: 8rpx;
}

.detail-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.ds-cell {
  background-color: $bg-soft;
  border-radius: $radius-sm;
  padding: 16rpx 10rpx;
  text-align: center;
}

.ds-num {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.ds-num.ok {
  color: $success;
}

.ds-label {
  font-size: 19rpx;
  color: $ink-3;
}

.detail-list {
  width: 100%;
}

.detail-list::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

.detail-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 18rpx;
  margin-bottom: 10rpx;
  border-radius: $radius-sm;
  background-color: $bg-page;
  border-left: 6rpx solid $line;
}

.detail-row.ok {
  border-left-color: $success;
}

.detail-row.ng {
  border-left-color: $danger;
}

.detail-row.skip {
  border-left-color: $warning;
}

.dr-no {
  width: 130rpx;
  font-size: 23rpx;
  color: $ink-2;
}

.dr-ms {
  flex: 1;
  font-size: 24rpx;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.dr-mark {
  font-size: 20rpx;
  color: #ffffff;
  padding: 3rpx 14rpx;
  border-radius: $radius-full;
}

.detail-row.ok .dr-mark {
  background-color: $success;
}

.detail-row.ng .dr-mark {
  background-color: $danger;
}

.detail-row.skip .dr-mark {
  background-color: $warning;
}
</style>
