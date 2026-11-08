<template>
  <view class="page home-page">
    <!-- 主视觉 -->
    <view class="hero hero-strong home-hero">
      <view class="hero-badge">{{ greet }} · 坚持刷题</view>
      <view class="hero-title">刷题计时器</view>
      <view class="hero-sub">题库练习 · 速算 · 计时，一套搞定</view>
      <view v-if="today" class="hero-foot">
        <view class="hero-pill">今日 {{ today.questions }} 题</view>
        <view class="hero-pill">正确率 {{ today.rate }}%</view>
        <view class="hero-pill">{{ today.rounds }} 轮</view>
      </view>
    </view>

    <!-- 今日 Bento -->
    <view v-if="today" class="today-main bento">
      <view class="today-ring ring" :style="{ background: ringBg(today.rate) }">
        <view class="ring-inner today-ring-inner">
          <text class="today-num">{{ today.questions }}</text>
          <text class="today-unit">今日做题</text>
        </view>
      </view>
      <view class="today-info">
        <text class="today-kicker">今日正确率</text>
        <text class="today-rate">{{ today.rate }}<text class="today-pct">%</text></text>
        <view class="today-bar">
          <view class="today-bar-inner" :style="{ width: Math.min(100, today.rate) + '%' }"></view>
        </view>
        <text class="today-sub">已完成 {{ today.rounds }} 轮 · 跳过 {{ today.skipped }} 题</text>
      </view>
    </view>

    <view v-if="today" class="today-side">
      <view class="bento today-mini">
        <text class="mini-num">{{ fmtMin(today.workMs) }}<text class="mini-unit">min</text></text>
        <text class="mini-label">做题时长</text>
      </view>
      <view class="bento today-mini mint-card">
        <text class="mini-num mint-text">{{ fmtMin(today.studyMs) }}<text class="mini-unit">min</text></text>
        <text class="mini-label">学习时长</text>
      </view>
    </view>

    <!-- 功能入口 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">入口</text>开始练习</view>
      <view class="entry-grid">
        <view class="bento-action entry-card c1" hover-class="press" @tap="go('/pages/quiz/index')">
          <view class="entry-top">
            <view class="entry-icon">库</view>
            <view class="entry-arrow"></view>
          </view>
          <view class="entry-name">题库练习</view>
          <view class="entry-desc">专项刷题 · 即时解析</view>
        </view>
        <view class="bento-action entry-card c2" hover-class="press" @tap="go('/pages/mental/index')">
          <view class="entry-top">
            <view class="entry-icon">算</view>
            <view class="entry-arrow"></view>
          </view>
          <view class="entry-name">速算练习</view>
          <view class="entry-desc">心算提速 · 技巧提示</view>
        </view>
        <view class="bento-action entry-card c3" hover-class="press" @tap="go('/pages/timer/single')">
          <view class="entry-top">
            <view class="entry-icon">秒</view>
            <view class="entry-arrow"></view>
          </view>
          <view class="entry-name">单题计时</view>
          <view class="entry-desc">一题一练 · 手动标记</view>
        </view>
        <view class="bento-action entry-card c4" hover-class="press" @tap="go('/pages/timer/batch')">
          <view class="entry-top">
            <view class="entry-icon">组</view>
            <view class="entry-arrow"></view>
          </view>
          <view class="entry-name">整组计时</view>
          <view class="entry-desc">整组提速 · 统一归档</view>
        </view>
      </view>
    </view>

    <!-- 近 7 天趋势 -->
    <view class="sec">
      <view class="sec-title">
        <text class="sec-no">趋势</text>近 7 天
        <text class="sec-link" @tap="go('/pages/quiz/records')">练习记录</text>
      </view>
      <view class="bento trend-card">
        <view v-if="hasTrend" class="trend">
          <view v-for="d in trend" :key="d.key" class="trend-col">
            <text class="trend-val">{{ d.questions }}</text>
            <view class="trend-bar-wrap">
              <view class="trend-bar" :style="{ height: barHeight(d) + '%' }"></view>
            </view>
            <text class="trend-label">{{ dayLabel(d.key) }}</text>
          </view>
        </view>
        <view v-else class="trend-empty">
          <view class="te-title">暂无数据</view>
          <view class="te-text">近 7 天还没有做题记录，去练一组吧</view>
        </view>
      </view>
    </view>

    <!-- 最近练习 -->
    <view class="sec">
      <view class="sec-title">
        <text class="sec-no">最近</text>最近练习
        <text class="sec-link" @tap="go('/pages/quiz/records')">全部</text>
      </view>
      <view v-if="recent.length" class="bento recent-card">
        <view
          v-for="it in recent"
          :key="it.id"
          class="recent-item"
          hover-class="row-press"
          @tap="goDetail(it.id)"
        >
          <view class="recent-left">
            <view class="recent-name">{{ it.bank_name }}</view>
            <view class="recent-meta">{{ modeLabel(it.mode) }} · {{ fmtTime(it.finished_at || it.started_at) }}</view>
          </view>
          <view class="recent-right">
            <text class="recent-rate" :class="rateClass(it.rate)">{{ it.rate }}<text class="recent-pct">%</text></text>
            <text class="recent-sub">{{ it.done_count }}/{{ it.total_count }} 题</text>
          </view>
        </view>
      </view>
      <view v-else class="empty-box">
        <view class="empty-title">还没有练习记录</view>
        <view class="empty-text">点上方「题库练习」开始第一组</view>
      </view>
    </view>
    <AppTabBarH5 active="home" />
  </view>
</template>

<script setup lang="ts">
/**
 * 首页：今日 Bento + 四功能入口 + 近 7 天趋势 + 最近练习
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBarH5 from '@/components/AppTabBarH5.vue'
import { fetchPracticeHistory } from '@/api/practice'
import { fetchStudyStats } from '@/api/stats'
import type { PracticeHistoryItem } from '@/types/practice'
import type { StudyStatsDay } from '@/types/stats'

const today = ref<{
  rounds: number
  questions: number
  correct: number
  skipped: number
  rate: number
  workMs: number
  studyMs: number
} | null>(null)
const trend = ref<StudyStatsDay[]>([])
const recent = ref<PracticeHistoryItem[]>([])

/** 近 7 天是否有实际做题数据（全 0 时展示空面板而非空柱图） */
const hasTrend = computed(() => trend.value.some((d) => d.questions > 0))

function go(url: string): void {
  uni.switchTab({
    url,
    fail: () => uni.navigateTo({ url }),
  })
}

function goDetail(id: number): void {
  uni.navigateTo({ url: `/pages/quiz/record-detail?id=${id}` })
}

function fmtMin(ms: number): string {
  return String(Math.round(ms / 60000))
}

function fmtTime(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function modeLabel(m: string): string {
  return m === 'random' ? '随机' : m === 'review' ? '错题重练' : '顺序'
}

function rateClass(rate: number): string {
  const r = Number(rate) || 0
  if (r >= 80) return 'good'
  if (r >= 60) return 'mid'
  if (r >= 40) return 'warn'
  return 'bad'
}

function dayLabel(key: string): string {
  const d = new Date(key + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return key.slice(5)
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}

function barHeight(d: StudyStatsDay): number {
  const max = Math.max(...trend.value.map((x) => x.questions), 1)
  return Math.max(8, Math.round((d.questions / max) * 100))
}

/** 今日正确率环：conic-gradient 动态角度 */
function ringBg(rate: number): string {
  const r = Math.max(0, Math.min(100, rate))
  const deg = r * 3.6
  return `conic-gradient(from -90deg, #4f86ff 0deg, #2f6bff ${deg}deg, #e8eef7 ${deg}deg 360deg)`
}

const greet = (() => {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 12) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})()

async function loadAll(): Promise<void> {
  try {
    const [statsRes, histRes] = await Promise.all([
      fetchStudyStats({ gran: 'day', page: 1, limit: 7 }),
      fetchPracticeHistory({ page: 1, limit: 5 }),
    ])
    today.value = statsRes.today
    // 接口按日期倒序返回，图表需要从左到右为时间正序
    trend.value = statsRes.list.slice(0, 7).reverse()
    recent.value = histRes.list
  } catch (err) {
    console.error('【首页统计接口请求失败】', err)
  }
}

/** 同步自定义 tabBar 选中态（index=0 首页） */
function syncTab(index: number): void {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as unknown as {
    getTabBar?: () => { setData: (d: { selected: number }) => void }
  }
  const tb = page?.getTabBar?.()
  if (tb) tb.setData({ selected: index })
}

onShow(() => {
  syncTab(0)
  void loadAll()
})
</script>

<style scoped lang="scss">
.page {
  padding-bottom: 190rpx;
}

.home-hero {
  padding-bottom: 38rpx;
}

.hero-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.hero-pill {
  padding: 6rpx 18rpx;
  border-radius: $radius-full;
  background-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.92);
  font-size: 21rpx;
  font-weight: 500;
}

/* ---- 今日 Bento ---- */
.today-main {
  display: flex;
  align-items: center;
  gap: 26rpx;
  margin-top: 24rpx;
  padding: 28rpx;
}

.today-ring {
  width: 176rpx;
  height: 176rpx;
  padding: 14rpx;
  box-sizing: border-box;
}

.today-ring-inner {
  width: 100%;
  height: 100%;
}

.today-num {
  font-size: 52rpx;
  font-weight: 800;
  line-height: 1.05;
  color: $ink;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1rpx;
}

.today-unit {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: $ink-3;
}

.today-info {
  flex: 1;
  min-width: 0;
}

.today-kicker {
  display: block;
  font-size: 22rpx;
  color: $ink-3;
}

.today-rate {
  display: block;
  margin-top: 2rpx;
  font-size: 52rpx;
  font-weight: 800;
  line-height: 1.1;
  color: $ink;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1rpx;
}

.today-pct {
  font-size: 26rpx;
  font-weight: 700;
  color: $brand-600;
  margin-left: 2rpx;
}

.today-bar {
  height: 10rpx;
  margin-top: 10rpx;
  border-radius: $radius-full;
  background-color: $line;
  overflow: hidden;
}

.today-bar-inner {
  height: 100%;
  border-radius: $radius-full;
  background: $brand-gradient;
  transition: width 0.4s ease;
}

.today-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 21rpx;
  color: $ink-3;
  line-height: 1.4;
}

.today-side {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
  margin-top: 20rpx;
}

.today-mini {
  padding: 24rpx 26rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.today-mini.mint-card {
  background: linear-gradient(160deg, #ffffff 0%, #eafbf7 100%);
}

.mini-num {
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.1;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.mini-num.mint-text {
  color: $mint;
}

.mini-unit {
  font-size: 20rpx;
  font-weight: 600;
  color: $ink-3;
  margin-left: 4rpx;
}

.mini-label {
  font-size: 21rpx;
  color: $ink-3;
}

/* ---- 功能入口 ---- */
.entry-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

.entry-card {
  padding: 24rpx;
}

.entry-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
}

.entry-icon {
  width: 68rpx;
  height: 68rpx;
  line-height: 68rpx;
  text-align: center;
  border-radius: 20rpx;
  font-size: 28rpx;
  font-weight: 800;
  color: #ffffff;
}

.entry-card.c1 .entry-icon {
  background: $brand-gradient;
  box-shadow: 0 8rpx 18rpx rgba(47, 107, 255, 0.24);
}

.entry-card.c2 .entry-icon {
  background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%);
  box-shadow: 0 8rpx 18rpx rgba(20, 184, 166, 0.22);
}

.entry-card.c3 .entry-icon {
  background: linear-gradient(135deg, #ffc44d 0%, #ffb020 100%);
  box-shadow: 0 8rpx 18rpx rgba(255, 176, 32, 0.24);
}

.entry-card.c4 .entry-icon {
  background: linear-gradient(135deg, #ff8a8a 0%, #ff6b6b 100%);
  box-shadow: 0 8rpx 18rpx rgba(255, 107, 107, 0.24);
}

.entry-name {
  font-size: 30rpx;
  font-weight: 700;
  color: $ink;
}

.entry-desc {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
}

/* ---- 趋势 ---- */
.trend-card {
  padding: 28rpx 26rpx 22rpx;
}

.trend {
  display: flex;
  align-items: flex-end;
  gap: 10rpx;
  height: 250rpx;
}

.trend-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.trend-val {
  font-size: 20rpx;
  font-weight: 700;
  color: $brand-600;
  font-variant-numeric: tabular-nums;
  margin-bottom: 6rpx;
}

.trend-bar-wrap {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.trend-bar {
  width: 28rpx;
  min-height: 8rpx;
  border-radius: 14rpx 14rpx 6rpx 6rpx;
  background: linear-gradient(180deg, #5b8cff 0%, #2f6bff 100%);
}

.trend-label {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: $ink-3;
}

.trend-empty {
  padding: 44rpx 20rpx;
  text-align: center;
}

.te-title {
  font-size: 28rpx;
  font-weight: 700;
  color: $ink-2;
}

.te-text {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $ink-3;
}

/* ---- 最近练习 ---- */
.recent-card {
  padding: 0;
  overflow: hidden;
}

.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 24rpx 28rpx;
}

.recent-item + .recent-item {
  border-top: 1rpx solid $line;
}

.row-press {
  background-color: $bg-soft;
}

.recent-left {
  flex: 1;
  min-width: 0;
}

.recent-name {
  font-size: 27rpx;
  font-weight: 700;
  color: $ink;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-meta {
  margin-top: 6rpx;
  font-size: 21rpx;
  color: $ink-3;
}

.recent-right {
  text-align: right;
  flex-shrink: 0;
}

.recent-rate {
  font-size: 34rpx;
  font-weight: 800;
  color: $brand-600;
  font-variant-numeric: tabular-nums;
}

.recent-rate.good {
  color: $success;
}

.recent-rate.warn {
  color: $warning;
}

.recent-rate.bad {
  color: $danger;
}

.recent-pct {
  font-size: 20rpx;
  font-weight: 600;
  opacity: 0.62;
}

.recent-sub {
  display: block;
  margin-top: 2rpx;
  font-size: 20rpx;
  color: $ink-3;
}
</style>
