<template>
  <view class="page">
    <view class="hero hero-strong profile-hero">
      <view class="hero-badge">个人中心 · 学习档案</view>
      <view class="hero-title">我的</view>
      <view class="hero-sub">登录信息 · 累计统计 · 记录管理</view>
    </view>

    <!-- 用户卡（浮在头图下沿） -->
    <view class="user-card">
      <view class="avatar">{{ avatarText }}</view>
      <view class="user-info">
        <view class="user-name">{{ me?.nickname || '微信用户' }}</view>
        <view class="user-meta">
          <text class="tag brand">{{ me?.role || '未登录' }}</text>
          <text class="user-sync">学习记录已同步</text>
        </view>
      </view>
      <view class="login-btn" :class="{ ok: !!me }" @tap="doLogin" hover-class="press">
        {{ me ? '已登录' : '登录' }}
      </view>
    </view>

    <!-- 累计统计 -->
    <view v-if="sum" class="stats-card bento">
      <view class="stats-head">
        <text class="stats-title">累计学习</text>
        <text class="stats-sub">全部历史记录</text>
      </view>
      <view class="stats-main">
        <view class="ring profile-ring" :style="{ background: ringBg(sumRate) }">
          <view class="ring-inner profile-ring-inner">
            <text class="profile-rate">{{ sumRate }}<text class="profile-pct">%</text></text>
            <text class="profile-label">正确率</text>
          </view>
        </view>
        <view class="stats-grid">
          <view class="stats-cell">
            <text class="sc-num">{{ sum.questions }}</text>
            <text class="sc-label">累计做题</text>
          </view>
          <view class="stats-cell">
            <text class="sc-num">{{ sum.rounds }}</text>
            <text class="sc-label">练习轮次</text>
          </view>
          <view class="stats-cell">
            <text class="sc-num mint">{{ fmtHour(sum.studyMs) }}</text>
            <text class="sc-label">学习小时</text>
          </view>
          <view class="stats-cell">
            <text class="sc-num">{{ sum.skipped }}</text>
            <text class="sc-label">跳过题数</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 记录入口 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">记录</text>查看与管理</view>
      <view class="list-card">
        <view class="list-row" hover-class="row-press" @tap="go('/pages/quiz/records')">
          <view class="row-ic blue">题</view>
          <view class="row-text">
            <view class="row-name">练习记录</view>
            <view class="row-desc">题库刷题回顾 · 错题重练</view>
          </view>
          <view class="entry-arrow"></view>
        </view>
        <view class="list-row" hover-class="row-press" @tap="go('/pages/mental/records')">
          <view class="row-ic mint">算</view>
          <view class="row-text">
            <view class="row-name">速算记录</view>
            <view class="row-desc">速算练习回顾 · 逐题技巧</view>
          </view>
          <view class="entry-arrow"></view>
        </view>
        <view class="list-row" hover-class="row-press" @tap="go('/pages/timer/records')">
          <view class="row-ic amber">时</view>
          <view class="row-text">
            <view class="row-name">计时记录</view>
            <view class="row-desc">单题 / 整组计时归档</view>
          </view>
          <view class="entry-arrow"></view>
        </view>
      </view>
    </view>

    <!-- 设置 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">设置</text>数据管理</view>
      <view class="list-card">
        <view class="list-row" hover-class="row-press" @tap="clearOne('practice')">
          <view class="row-ic danger">清</view>
          <view class="row-text">
            <view class="row-name danger">清空练习记录</view>
            <view class="row-desc">题库练习历史全部删除</view>
          </view>
        </view>
        <view class="list-row" hover-class="row-press" @tap="clearOne('mental')">
          <view class="row-ic danger">清</view>
          <view class="row-text">
            <view class="row-name danger">清空速算记录</view>
            <view class="row-desc">速算历史全部删除</view>
          </view>
        </view>
        <view class="list-row" hover-class="row-press" @tap="clearOne('timer')">
          <view class="row-ic danger">清</view>
          <view class="row-text">
            <view class="row-name danger">清空计时记录</view>
            <view class="row-desc">计时归档全部删除</view>
          </view>
        </view>
        <view class="list-row" hover-class="row-press" @tap="about">
          <view class="row-ic plain">关</view>
          <view class="row-text">
            <view class="row-name">关于</view>
            <view class="row-desc">刷题计时器 v1.0.0</view>
          </view>
          <view class="entry-arrow"></view>
        </view>
      </view>
    </view>
    <AppTabBarH5 active="profile" />
  </view>
</template>

<script setup lang="ts">
/**
 * 我的：登录态 + 累计统计（正确率环 + 指标格）+ 记录入口 + 数据清空
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBarH5 from '@/components/AppTabBarH5.vue'
import { clearPracticeHistory } from '@/api/practice'
import { clearMentalHistory } from '@/api/mental'
import { clearTimerHistory } from '@/api/timer'
import { fetchMe, fetchStudyStats } from '@/api/stats'
import { login } from '@/utils/auth'
import type { Me } from '@/types/stats'

interface SumLike {
  rounds: number
  questions: number
  correct: number
  skipped: number
  workMs: number
  studyMs: number
}

const me = ref<Me | null>(null)
const sum = ref<SumLike | null>(null)

const avatarText = computed(() => {
  const name = me.value?.nickname || '微'
  return name.slice(0, 1)
})
const sumRate = computed(() => {
  if (!sum.value || sum.value.questions === 0) return 0
  return +((sum.value.correct / sum.value.questions) * 100).toFixed(1)
})

/** 正确率环（conic-gradient） */
function ringBg(rate: number): string {
  const r = Math.max(0, Math.min(100, rate))
  const deg = r * 3.6
  return `conic-gradient(from -90deg, #4f86ff 0deg, #2f6bff ${deg}deg, #e8eef7 ${deg}deg 360deg)`
}

function go(url: string): void {
  uni.navigateTo({ url })
}

async function doLogin(): Promise<void> {
  if (me.value) return
  const ok = await login()
  if (!ok) {
    uni.showToast({ title: '登录失败，请稍后重试', icon: 'none' })
    return
  }
  await loadUser()
}

async function loadUser(): Promise<void> {
  try {
    me.value = await fetchMe()
  } catch (err) {
    console.error('【用户信息接口请求失败】', err)
  }
}

async function loadSum(): Promise<void> {
  try {
    const res = await fetchStudyStats({ gran: 'day', page: 1, limit: 1 })
    sum.value = res.sum
  } catch (err) {
    console.error('【累计统计接口请求失败】', err)
  }
}

function clearOne(kind: 'practice' | 'mental' | 'timer'): void {
  const label = kind === 'practice' ? '练习' : kind === 'mental' ? '速算' : '计时'
  uni.showModal({
    title: `清空${label}记录`,
    content: `确定清空全部${label}记录？此操作不可恢复。`,
    success: async (r) => {
      if (!r.confirm) return
      try {
        if (kind === 'practice') await clearPracticeHistory()
        else if (kind === 'mental') await clearMentalHistory()
        else await clearTimerHistory()
        uni.showToast({ title: '已清空', icon: 'success' })
        void loadSum()
      } catch (err) {
        console.error('【清空记录接口请求失败】', err)
        uni.showToast({ title: '清空失败', icon: 'none' })
      }
    },
  })
}

function about(): void {
  uni.showModal({
    title: '刷题计时器',
    content: 'v1.0.0\n题库练习 · 速算 · 计时一体\n数据保存在本机服务，可随时清空。',
    showCancel: false,
  })
}

function fmtHour(ms: number): string {
  return (ms / 3600000).toFixed(1)
}

/** 同步自定义 tabBar 选中态（index=3 我的） */
function syncTab(index: number): void {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as unknown as {
    getTabBar?: () => { setData: (d: { selected: number }) => void }
  }
  const tb = page?.getTabBar?.()
  if (tb) tb.setData({ selected: index })
}

onShow(() => {
  syncTab(3)
  void loadUser()
  void loadSum()
})
</script>

<style scoped lang="scss">
.page {
  padding-bottom: 190rpx;
}

.profile-hero {
  padding-bottom: 80rpx;
}

/* ---- 用户卡 ---- */
.user-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin-top: -52rpx;
  margin-left: 0;
  margin-right: 0;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 24rpx 26rpx;
  box-shadow: $shadow-l2;
}

.avatar {
  width: 104rpx;
  height: 104rpx;
  border-radius: 50%;
  background: $brand-gradient;
  color: #ffffff;
  font-size: 40rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 8rpx 18rpx rgba(47, 107, 255, 0.28);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 8rpx;
}

.user-sync {
  font-size: 21rpx;
  color: $ink-3;
}

.login-btn {
  flex-shrink: 0;
  font-size: 23rpx;
  color: $brand-600;
  border: 2rpx solid $brand-100;
  border-radius: $radius-full;
  padding: 8rpx 22rpx;
  background-color: $brand-50;
  font-weight: 600;
}

.login-btn.ok {
  color: $success;
  border-color: #c7f0dd;
  background-color: $success-bg;
}

/* ---- 累计统计 ---- */
.stats-card {
  margin-top: 24rpx;
  padding: 28rpx;
}

.stats-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 20rpx;
}

.stats-title {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
}

.stats-sub {
  font-size: 21rpx;
  color: $ink-3;
}

.stats-main {
  display: flex;
  align-items: center;
  gap: 26rpx;
}

.profile-ring {
  width: 176rpx;
  height: 176rpx;
  padding: 14rpx;
  box-sizing: border-box;
  flex-shrink: 0;
}

.profile-ring-inner {
  width: 100%;
  height: 100%;
}

.profile-rate {
  font-size: 46rpx;
  font-weight: 800;
  line-height: 1;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.profile-pct {
  font-size: 22rpx;
  font-weight: 700;
  color: $brand-600;
}

.profile-label {
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
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.sc-num.mint {
  color: $mint;
}

.sc-label {
  font-size: 20rpx;
  color: $ink-3;
}

/* ---- 列表 ---- */
.list-card {
  background-color: $bg-card;
  border-radius: $radius-md;
  box-shadow: $shadow-l1;
  overflow: hidden;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 24rpx;
}

.list-row + .list-row {
  border-top: 1rpx solid $line;
}

.row-press {
  background-color: $bg-soft;
}

.row-ic {
  width: 64rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  border-radius: 18rpx;
  font-size: 24rpx;
  font-weight: 800;
  flex-shrink: 0;
}

.row-ic.blue {
  background-color: $brand-50;
  color: $brand-600;
}

.row-ic.mint {
  background-color: $mint-bg;
  color: $mint;
}

.row-ic.amber {
  background-color: $amber-bg;
  color: $amber;
}

.row-ic.danger {
  background-color: $danger-bg;
  color: $danger;
}

.row-ic.plain {
  background-color: $bg-soft;
  color: $ink-3;
}

.row-text {
  flex: 1;
  min-width: 0;
}

.row-name {
  font-size: 28rpx;
  font-weight: 600;
  color: $ink;
}

.row-name.danger {
  color: $danger;
}

.row-desc {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
}
</style>
