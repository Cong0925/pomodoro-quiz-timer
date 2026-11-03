<template>
  <view class="page">
    <!-- 欢迎 -->
    <view class="hero">
      <view class="hero-badge">{{ greet }} · 坚持刷题</view>
      <view class="hero-title">刷题计时器</view>
      <view class="hero-sub">题库练习 · 速算 · 计时，一套搞定</view>
    </view>

    <!-- 今日统计 -->
    <view class="today-card" v-if="today">
      <view class="today-head">
        <text class="today-title">今日练习</text>
        <text class="today-date">{{ todayDate }}</text>
      </view>
      <view class="today-cells">
        <view class="today-cell">
          <view class="today-num">{{ today.questions }}</view>
          <view class="today-label">做题</view>
        </view>
        <view class="today-cell">
          <view class="today-num">{{ today.rate }}%</view>
          <view class="today-label">正确率</view>
        </view>
        <view class="today-cell">
          <view class="today-num">{{ fmtMin(today.workMs) }}</view>
          <view class="today-label">做题分钟</view>
        </view>
        <view class="today-cell">
          <view class="today-num">{{ fmtMin(today.studyMs) }}</view>
          <view class="today-label">学习分钟</view>
        </view>
      </view>
    </view>

    <!-- 功能入口 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">入口</text>开始练习</view>
      <view class="entry-grid">
        <view class="entry-card" :class="'c1'" @tap="go('/pages/quiz/index')">
          <view class="entry-icon">库</view>
          <view class="entry-name">题库练习</view>
          <view class="entry-desc">专项刷题</view>
        </view>
        <view class="entry-card" :class="'c2'" @tap="go('/pages/mental/index')">
          <view class="entry-icon">算</view>
          <view class="entry-name">速算练习</view>
          <view class="entry-desc">心算提速</view>
        </view>
        <view class="entry-card" :class="'c3'" @tap="go('/pages/timer/single')">
          <view class="entry-icon">秒</view>
          <view class="entry-name">单题计时</view>
          <view class="entry-desc">一题一练</view>
        </view>
        <view class="entry-card" :class="'c4'" @tap="go('/pages/timer/batch')">
          <view class="entry-icon">组</view>
          <view class="entry-name">整组计时</view>
          <view class="entry-desc">整组提速</view>
        </view>
      </view>
    </view>

    <!-- 近 7 天趋势 -->
    <view class="sec" v-if="trend.length">
      <view class="sec-title"><text class="sec-no">趋势</text>近 7 天做题量</view>
      <view class="trend">
        <view v-for="d in trend" :key="d.key" class="trend-col">
          <view class="trend-bar-wrap">
            <view class="trend-bar" :style="{ height: barHeight(d) + '%' }"></view>
          </view>
          <text class="trend-label">{{ dayLabel(d.key) }}</text>
          <text class="trend-num">{{ d.questions }}</text>
        </view>
      </view>
    </view>

    <!-- 最近练习 -->
    <view class="sec">
      <view class="sec-title">
        <text class="sec-no">最近</text>最近练习
        <text class="sec-link" @tap="go('/pages/quiz/records')">全部</text>
      </view>
      <view v-if="recent.length" class="recent-list">
        <view v-for="it in recent" :key="it.id" class="recent-item" @tap="goDetail(it.id)">
          <view class="recent-left">
            <view class="recent-name">{{ it.bank_name }}</view>
            <view class="recent-meta">{{ modeLabel(it.mode) }} · {{ fmtTime(it.finished_at || it.started_at) }}</view>
          </view>
          <view class="recent-right">
            <view class="recent-rate">{{ it.rate }}%</view>
            <view class="recent-sub">{{ it.done_count }}/{{ it.total_count }} 题</view>
          </view>
        </view>
      </view>
      <view v-else class="empty-box slim">
        <view class="empty-title">还没有练习记录</view>
        <view class="empty-text">点上方「题库练习」开始第一组</view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 首页：今日统计 + 四功能入口 + 近 7 天趋势 + 最近练习
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
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

function dayLabel(key: string): string {
  const d = new Date(key + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return key.slice(5)
  return ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
}

function barHeight(d: StudyStatsDay): number {
  const max = Math.max(...trend.value.map((x) => x.questions), 1)
  return Math.max(8, Math.round((d.questions / max) * 100))
}

const todayDate = (() => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})()

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
    trend.value = statsRes.list.slice(0, 7)
    recent.value = histRes.list
  } catch (err) {
    console.error('【首页统计接口请求失败】', err)
  }
}

onShow(() => {
  void loadAll()
})
</script>

<style scoped lang="scss">
.today-card {
  background: $brand-gradient; border-radius: $radius-lg; padding: 26rpx 28rpx; color: #ffffff;
  box-shadow: $shadow-btn; margin-bottom: 8rpx;
}
.today-head { display: flex; justify-content: space-between; align-items: center; }
.today-title { font-size: 26rpx; font-weight: 700; }
.today-date { font-size: 21rpx; opacity: 0.75; }
.today-cells { display: flex; justify-content: space-between; margin-top: 22rpx; }
.today-cell { text-align: center; flex: 1; }
.today-num { font-size: 38rpx; font-weight: 800; }
.today-label { font-size: 21rpx; opacity: 0.75; margin-top: 4rpx; }

.entry-grid { display: grid; grid-template-columns: 1fr 1fr; gap: $gap-item; }
.entry-card {
  background-color: $bg-card; border-radius: $radius-md; padding: 26rpx; box-shadow: $shadow-card-sm;
  border-top: 6rpx solid transparent;
}
.entry-card.c1 { border-top-color: $brand-600; }
.entry-card.c2 { border-top-color: $success; }
.entry-card.c3 { border-top-color: $warning; }
.entry-card.c4 { border-top-color: $danger; }
.entry-icon {
  width: 72rpx; height: 72rpx; line-height: 72rpx; text-align: center; border-radius: $radius-md;
  font-size: 30rpx; font-weight: 800; color: #ffffff; margin-bottom: 14rpx;
}
.entry-card.c1 .entry-icon { background: $brand-gradient; }
.entry-card.c2 .entry-icon { background: linear-gradient(135deg, #10b981, #059669); }
.entry-card.c3 .entry-icon { background: linear-gradient(135deg, #f59e0b, #d97706); }
.entry-card.c4 .entry-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }
.entry-name { font-size: 29rpx; font-weight: 700; color: $text-main; }
.entry-desc { font-size: 22rpx; color: $text-weak; margin-top: 4rpx; }

.sec-link { margin-left: auto; font-size: 23rpx; color: $brand-600; font-weight: 400; }

.trend { display: flex; gap: 12rpx; align-items: flex-end; height: 300rpx; padding-top: 20rpx; }
.trend-col { flex: 1; display: flex; flex-direction: column; align-items: center; }
.trend-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.trend-bar { width: 36rpx; background: $brand-gradient; border-radius: $radius-full $radius-full 0 0; min-height: 8rpx; }
.trend-label { font-size: 21rpx; color: $text-sub; margin-top: 8rpx; }
.trend-num { font-size: 21rpx; color: $brand-600; font-weight: 600; margin-top: 4rpx; }

.recent-list { display: flex; flex-direction: column; gap: $gap-item; }
.recent-item {
  display: flex; justify-content: space-between; align-items: center; gap: 16rpx;
  background-color: $bg-card; border-radius: $radius-md; padding: 20rpx 24rpx; box-shadow: $shadow-card-sm;
}
.recent-left { flex: 1; min-width: 0; }
.recent-name { font-size: 27rpx; font-weight: 700; color: $text-main; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.recent-meta { font-size: 21rpx; color: $text-weak; margin-top: 6rpx; }
.recent-right { text-align: right; flex-shrink: 0; }
.recent-rate { font-size: 32rpx; font-weight: 800; color: $brand-600; }
.recent-sub { font-size: 21rpx; color: $text-weak; margin-top: 4rpx; }
.empty-box.slim { padding: 48rpx 32rpx; }
</style>
