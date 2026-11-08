<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">累计 {{ stats.all.sessions }} 场 · 正确率 {{ stats.all.rate }}%</view>
      <view class="hero-title">速算记录</view>
      <view class="hero-sub">累计与今日数据 · 展开逐题明细 · 支持删除</view>
    </view>

    <!-- 累计数据 -->
    <view class="stats-card bento">
      <view class="ring stats-ring" :style="{ background: ringBg(stats.all.rate) }">
        <view class="ring-inner stats-ring-inner">
          <text class="stats-rate">{{ stats.all.rate }}<text class="stats-pct">%</text></text>
          <text class="stats-label">正确率</text>
        </view>
      </view>
      <view class="stats-grid">
        <view class="stats-cell">
          <text class="sc-num">{{ stats.all.sessions }}</text>
          <text class="sc-label">累计场次</text>
        </view>
        <view class="stats-cell">
          <text class="sc-num">{{ stats.all.totalQ }}</text>
          <text class="sc-label">累计题量</text>
        </view>
        <view class="stats-cell">
          <text class="sc-num brand">{{ stats.today.totalQ }}</text>
          <text class="sc-label">今日题量</text>
        </view>
        <view class="stats-cell">
          <text class="sc-num mint">{{ todayMinutes }}</text>
          <text class="sc-label">今日分钟</text>
        </view>
      </view>
    </view>

    <!-- 列表 -->
    <view v-if="list.length === 0 && !loading" class="empty-box">
      <view class="empty-title">还没有速算记录</view>
      <view class="empty-text">去「速算」页开始第一次练习，记录会自动归档</view>
    </view>

    <view
      v-for="row in list"
      :key="row.id"
      class="rec-card"
      :class="{ open: openId === row.id }"
      hover-class="rec-press"
      @tap="toggleDetail(row.id)"
    >
      <view class="rec-top">
        <view class="rec-type-wrap">
          <view class="rec-type">{{ row.qtype_name }}</view>
          <view class="rec-tags">
            <text class="tag">{{ diffName(row.difficulty) }}</text>
            <text class="tag amber">{{ formatDate(row.started_at) }}</text>
          </view>
        </view>
        <view class="rec-rate" :class="{ low: row.rate < 60 }">{{ row.rate }}<text class="rec-pct">%</text></view>
      </view>

      <view class="rec-bar">
        <view class="rec-bar-inner" :style="{ width: donePct(row) + '%' }"></view>
      </view>

      <view class="rec-meta">
        <text>{{ row.total_count }} 题</text>
        <text class="ok">对 {{ row.correct_count }}</text>
        <text class="ng">错 {{ row.wrong_count }}</text>
        <text class="sk">跳 {{ row.skipped_count }}</text>
        <text class="rec-time">{{ formatTime(row.total_ms) }}</text>
      </view>

      <view class="rec-actions">
        <text class="rec-toggle">{{ openId === row.id ? '收起明细' : '查看明细' }}</text>
        <text class="rec-del" @tap.stop="onDelete(row.id)">删除</text>
      </view>

      <!-- 明细 -->
      <view v-if="openId === row.id" class="rec-detail">
        <view v-if="detailLoadingId === row.id" class="detail-loading">明细加载中…</view>
        <view v-else-if="detailMap[row.id] && detailMap[row.id].length === 0" class="detail-loading">本场无作答记录</view>
        <view v-for="d in detailMap[row.id] || []" :key="d.no" class="rd-cell">
          <view class="rd-mark" :class="d.result">
            <text>{{ mark(d.result) }}</text>
          </view>
          <view class="rd-body">
            <view class="rd-stem">{{ d.stem }}</view>
            <view class="rd-ans">正确答案：{{ d.answer }}</view>
            <view v-if="d.tip" class="rd-tip">技巧：{{ d.tip }}</view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading" class="load-tip">加载中…</view>
    <view v-else-if="hasMore" class="load-more" @tap="loadMore">加载更多</view>
    <view v-else-if="list.length > 0" class="load-tip">已加载全部</view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算记录页：统计条（累计 + 今日）+ 会话列表 + 展开明细 + 删除
 * 数据按 user_id 隔离（后端契约 /api/mental/stats、/history）
 */
import { computed, ref } from 'vue'
import { onReachBottom, onShow } from '@dcloudio/uni-app'
import { deleteMentalSession, fetchMentalDetail, fetchMentalHistory, fetchMentalStats } from '@/api/mental'
import type { MentalDetailRecord, MentalSessionRow, MentalStats } from '@/types/mental'

const stats = ref<MentalStats>({
  all: { sessions: 0, totalQ: 0, correctQ: 0, wrongQ: 0, skipQ: 0, totalMs: 0, rate: 0 },
  today: { sessions: 0, totalQ: 0, correctQ: 0, wrongQ: 0, skipQ: 0, totalMs: 0 },
})

const list = ref<MentalSessionRow[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const openId = ref<number | null>(null)
const detailLoadingId = ref<number | null>(null)
/** 单场明细本地缓存（展开/收起不重复请求） */
const detailMap = ref<Record<number, MentalDetailRecord[]>>({})

const hasMore = computed(() => list.value.length < total.value)
const todayMinutes = computed(() => Math.round(stats.value.today.totalMs / 60000))

const DIFF_NAMES = ['不限', '简单', '中等', '困难']

function diffName(d: number): string {
  return DIFF_NAMES[d] || '不限'
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function formatDate(s: string): string {
  if (!s) return ''
  return s.replace('T', ' ').slice(0, 16)
}

function mark(result: string): string {
  if (result === 'ok') return '✓'
  if (result === 'skip') return '○'
  return '✗'
}

/** 完成度百分比（防 0 除） */
function donePct(row: MentalSessionRow): number {
  if (!row.total_count) return 0
  return Math.min(100, Math.round((row.done_count / row.total_count) * 100))
}

/** 正确率环（conic-gradient） */
function ringBg(rate: number): string {
  const r = Math.max(0, Math.min(100, rate))
  const deg = r * 3.6
  return `conic-gradient(from -90deg, #4f86ff 0deg, #2f6bff ${deg}deg, #e8eef7 ${deg}deg 360deg)`
}

/** 加载统计 */
async function loadStats(): Promise<void> {
  try {
    stats.value = await fetchMentalStats()
  } catch (err) {
    console.error('【速算统计接口请求失败】', err)
  }
}

/** 加载历史列表（isRefresh=true 重置分页） */
async function loadHistory(targetPage: number, isRefresh: boolean): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const res = await fetchMentalHistory(targetPage, 20)
    total.value = res.total
    if (isRefresh) {
      list.value = res.list
      page.value = 1
    } else {
      /* 按 id 去重合并（防分页重叠） */
      const exist = new Set(list.value.map((x) => x.id))
      list.value = list.value.concat(res.list.filter((x) => !exist.has(x.id)))
      page.value = targetPage
    }
  } catch (err) {
    console.error('【速算历史列表接口请求失败】', err)
  } finally {
    loading.value = false
  }
}

function loadMore(): void {
  if (hasMore.value) {
    void loadHistory(page.value + 1, false)
  }
}

/** 展开/收起明细 */
async function toggleDetail(id: number): Promise<void> {
  if (openId.value === id) {
    openId.value = null
    return
  }
  openId.value = id
  if (detailMap.value[id]) return
  detailLoadingId.value = id
  try {
    const res = await fetchMentalDetail(id)
    detailMap.value = { ...detailMap.value, [id]: res.records }
  } catch (err) {
    console.error('【速算单场明细接口请求失败】', err)
  } finally {
    detailLoadingId.value = null
  }
}

/** 删除单场记录（明细级联删除，二次确认） */
function onDelete(id: number): void {
  uni.showModal({
    title: '删除该条记录？',
    content: '删除后不可恢复，将同时删除本场明细。',
    confirmText: '删除',
    confirmColor: '#dc2626',
    success: (r) => {
      if (!r.confirm) return
      void doDelete(id)
    },
  })
}

async function doDelete(id: number): Promise<void> {
  try {
    await deleteMentalSession(id)
    uni.showToast({ title: '已删除', icon: 'success' })
    openId.value = null
    const next = { ...detailMap.value }
    delete next[id]
    detailMap.value = next
    await Promise.all([loadHistory(1, true), loadStats()])
  } catch (err) {
    console.error('【速算记录删除接口请求失败】', err)
  }
}

onShow(() => {
  void loadStats()
  void loadHistory(1, true)
})

onReachBottom(() => {
  loadMore()
})
</script>

<style scoped lang="scss">
.page {
  padding-bottom: 80rpx;
}

/* ---- 统计卡 ---- */
.stats-card {
  display: flex;
  align-items: center;
  gap: 26rpx;
  margin-top: 24rpx;
  padding: 28rpx;
}

.stats-ring {
  width: 172rpx;
  height: 172rpx;
  padding: 14rpx;
  box-sizing: border-box;
  flex-shrink: 0;
}

.stats-ring-inner {
  width: 100%;
  height: 100%;
}

.stats-rate {
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.stats-pct {
  font-size: 22rpx;
  font-weight: 700;
  color: $brand-600;
}

.stats-label {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: $ink-3;
}

.stats-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.stats-cell {
  background-color: $bg-soft;
  border-radius: $radius-sm;
  padding: 14rpx 18rpx;
  display: flex;
  flex-direction: column;
  gap: 2rpx;
}

.sc-num {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.sc-num.brand {
  color: $brand-600;
}

.sc-num.mint {
  color: $mint;
}

.sc-label {
  font-size: 20rpx;
  color: $ink-3;
}

/* ---- 会话卡 ---- */
.rec-card {
  position: relative;
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx 26rpx 22rpx 30rpx;
  margin-top: 18rpx;
  box-shadow: $shadow-l1;
  overflow: hidden;
}

.rec-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 24rpx;
  bottom: 24rpx;
  width: 8rpx;
  border-radius: 0 8rpx 8rpx 0;
  background: $brand-gradient;
}

.rec-card.open {
  box-shadow: $shadow-l2;
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

.rec-type-wrap {
  flex: 1;
  min-width: 0;
}

.rec-type {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
}

.rec-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 8rpx;
}

.rec-rate {
  flex-shrink: 0;
  font-size: 42rpx;
  font-weight: 800;
  line-height: 1;
  color: $success;
  font-variant-numeric: tabular-nums;
}

.rec-rate.low {
  color: $danger;
}

.rec-pct {
  font-size: 21rpx;
  font-weight: 600;
}

.rec-bar {
  height: 8rpx;
  margin-top: 18rpx;
  border-radius: $radius-full;
  background-color: $line;
  overflow: hidden;
}

.rec-bar-inner {
  height: 100%;
  border-radius: $radius-full;
  background: $brand-gradient;
}

.rec-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6rpx 16rpx;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: $ink-2;
}

.rec-meta .ok {
  color: $success;
}

.rec-meta .ng {
  color: $danger;
}

.rec-meta .sk {
  color: $warning;
}

.rec-time {
  margin-left: auto;
  color: $ink-3;
  font-variant-numeric: tabular-nums;
}

.rec-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
}

.rec-toggle {
  font-size: 23rpx;
  color: $brand-600;
  font-weight: 600;
}

.rec-del {
  font-size: 23rpx;
  color: $danger;
  padding: 6rpx 0 6rpx 20rpx;
}

/* ---- 明细 ---- */
.rec-detail {
  border-top: 1rpx dashed $line;
  margin-top: 16rpx;
  padding-top: 14rpx;
}

.detail-loading {
  font-size: 23rpx;
  color: $ink-3;
  text-align: center;
  padding: 22rpx 0;
}

.rd-cell {
  display: flex;
  gap: 14rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid $line;
  align-items: flex-start;
}

.rd-cell:last-child {
  border-bottom: none;
}

.rd-mark {
  width: 34rpx;
  height: 34rpx;
  line-height: 34rpx;
  text-align: center;
  border-radius: 50%;
  flex-shrink: 0;
  color: #ffffff;
  font-size: 20rpx;
  font-weight: 700;
  margin-top: 2rpx;
}

.rd-mark.ok {
  background-color: $success;
}

.rd-mark.ng {
  background-color: $danger;
}

.rd-mark.skip {
  background-color: $warning;
}

.rd-body {
  flex: 1;
  min-width: 0;
}

.rd-stem {
  font-size: 24rpx;
  line-height: 1.5;
  color: $ink;
}

.rd-ans {
  font-size: 22rpx;
  color: $success;
  margin-top: 4rpx;
}

.rd-tip {
  font-size: 22rpx;
  color: $ink-3;
  margin-top: 4rpx;
  line-height: 1.5;
}

/* 加载 */
.load-tip {
  text-align: center;
  font-size: 23rpx;
  color: $ink-3;
  padding: 24rpx 0;
}

.load-more {
  margin-top: 18rpx;
  padding: 22rpx 0;
  text-align: center;
  border-radius: $radius-full;
  background-color: $bg-card;
  color: $brand-600;
  font-size: 24rpx;
  font-weight: 600;
  box-shadow: $shadow-l1;
}
</style>
