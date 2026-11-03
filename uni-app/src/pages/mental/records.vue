<template>
  <view class="page">
    <!-- 统计条 -->
    <view class="stats-bar">
      <view class="st">
        <view class="st-num">{{ stats.all.sessions }}</view>
        <view class="st-label">累计练习</view>
      </view>
      <view class="st">
        <view class="st-num">{{ stats.all.totalQ }}</view>
        <view class="st-label">累计题量</view>
      </view>
      <view class="st">
        <view class="st-num">{{ stats.all.rate }}%</view>
        <view class="st-label">累计正确率</view>
      </view>
    </view>
    <view class="st2row">
      <view class="st2">
        <view class="st2-num">{{ stats.today.totalQ }}</view>
        <view class="st2-label">今日题量</view>
      </view>
      <view class="st2">
        <view class="st2-num">{{ todayMinutes }}</view>
        <view class="st2-label">今日分钟</view>
      </view>
    </view>

    <!-- 列表 -->
    <view v-if="list.length === 0 && !loading" class="empty">
      <text>还没有速算记录，去「速算」页开始第一次练习吧</text>
    </view>

    <view v-for="row in list" :key="row.id" class="rec-item" :class="{ open: openId === row.id }" @tap="toggleDetail(row.id)">
      <view class="rec-top">
        <view class="rec-type">
          {{ row.qtype_name }}
          <text class="rec-sub">{{ diffName(row.difficulty) }}</text>
        </view>
        <view class="rec-rate" :class="{ low: row.rate < 60 }">{{ row.rate }}%</view>
      </view>
      <view class="rec-meta">
        <text class="rec-left">
          {{ row.total_count }} 题 · 对 {{ row.correct_count }} / 错 {{ row.wrong_count }} / 跳
          {{ row.skipped_count }} · {{ formatTime(row.total_ms) }}
        </text>
        <text class="rec-time">{{ formatDate(row.started_at) }}</text>
      </view>
      <view class="rec-del-row">
        <view class="rec-toggle">{{ openId === row.id ? '收起明细' : '查看明细' }}</view>
        <view class="rec-del" @tap.stop="onDelete(row.id)">删除</view>
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

    <view v-if="loading" class="load-more">加载中…</view>
    <view v-else-if="hasMore" class="load-more" @tap="loadMore">上滑加载更多</view>
    <view v-else-if="list.length > 0" class="load-more">已加载全部</view>
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
/* 统计条：品牌渐变数据卡（Keep 式大数字反馈） */
.stats-bar {
  display: flex;
  background: $brand-gradient;
  border-radius: $radius-lg;
  padding: 30rpx 0;
  margin-bottom: $gap-item;
  box-shadow: $shadow-btn;
}

.st {
  flex: 1;
  text-align: center;
}

.st + .st {
  border-left: 1rpx solid rgba(255, 255, 255, 0.25);
}

.st-num {
  font-size: 40rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: #ffffff;
}

.st-label {
  font-size: 23rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4rpx;
}

.st2row {
  display: flex;
  gap: $gap-item;
  margin-bottom: $gap-item;
}

.st2 {
  flex: 1;
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 22rpx 0;
  text-align: center;
  box-shadow: $shadow-card-sm;
}

.st2-num {
  font-size: 34rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: $brand-600;
}

.st2-label {
  font-size: 23rpx;
  color: $text-sub;
  margin-top: 4rpx;
}

/* 会话卡片 */
.rec-item {
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx;
  margin-bottom: $gap-item;
  box-shadow: $shadow-card-sm;
}

.rec-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rec-type {
  font-size: 30rpx;
  font-weight: 700;
  color: $text-main;
}

.rec-sub {
  font-size: 23rpx;
  color: $text-weak;
  font-weight: 400;
  margin-left: 12rpx;
}

.rec-rate {
  font-size: 30rpx;
  font-weight: 800;
  color: $success;
  font-variant-numeric: tabular-nums;
}

.rec-rate.low {
  color: $danger;
}

.rec-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: $text-sub;
  gap: 16rpx;
  flex-wrap: wrap;
}

.rec-left {
  min-width: 0;
}

.rec-time {
  min-width: 0;
  color: $text-weak;
}

.rec-del-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10rpx;
}

.rec-toggle {
  font-size: 24rpx;
  color: $brand-600;
  font-weight: 600;
}

.rec-del {
  font-size: 24rpx;
  color: $danger;
  padding: 8rpx 4rpx;
}

/* 明细 */
.rec-detail {
  border-top: 1rpx dashed $line;
  margin-top: 16rpx;
  padding-top: 16rpx;
}

.detail-loading {
  font-size: 24rpx;
  color: $text-weak;
  text-align: center;
  padding: 24rpx 0;
}

.rd-cell {
  display: flex;
  gap: 16rpx;
  padding: 14rpx 0;
  font-size: 25rpx;
  border-bottom: 1rpx solid $line;
  align-items: flex-start;
}

.rd-cell:last-child {
  border-bottom: none;
}

.rd-mark {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 22rpx;
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
  line-height: 1.45;
  color: $text-main;
}

.rd-ans {
  color: $success;
  margin-top: 4rpx;
}

.rd-tip {
  color: $text-sub;
  margin-top: 4rpx;
}

/* 空态 / 加载 */
.empty {
  text-align: center;
  padding: 120rpx 20rpx;
  color: $text-weak;
  font-size: 27rpx;
}

.load-more {
  text-align: center;
  font-size: 25rpx;
  color: $text-weak;
  padding: 20rpx 0 4rpx;
}
</style>
