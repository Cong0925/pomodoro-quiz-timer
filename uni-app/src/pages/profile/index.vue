<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">学习数据都在这里</view>
      <view class="hero-title">我的</view>
      <view class="hero-sub">登录信息 · 累计统计 · 记录管理</view>
    </view>

    <!-- 用户卡 -->
    <view class="user-card">
      <view class="avatar">{{ avatarText }}</view>
      <view class="user-info">
        <view class="user-name">{{ me?.nickname || '微信用户' }}</view>
        <view class="user-role">{{ me?.role || '未登录' }} · 学习记录已同步</view>
      </view>
      <view class="login-btn" @tap="doLogin">{{ me ? '已登录' : '登录' }}</view>
    </view>

    <!-- 累计统计 -->
    <view class="stats-card" v-if="sum">
      <view class="stats-head">累计学习</view>
      <view class="stats-cells">
        <view class="stats-cell">
          <view class="stats-num">{{ sum.questions }}</view>
          <view class="stats-label">做题</view>
        </view>
        <view class="stats-cell">
          <view class="stats-num">{{ sumRate }}%</view>
          <view class="stats-label">正确率</view>
        </view>
        <view class="stats-cell">
          <view class="stats-num">{{ sum.rounds }}</view>
          <view class="stats-label">练习轮次</view>
        </view>
        <view class="stats-cell">
          <view class="stats-num">{{ fmtHour(sum.studyMs) }}</view>
          <view class="stats-label">学习小时</view>
        </view>
      </view>
    </view>

    <!-- 记录入口 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">记录</text>查看与管理</view>
      <view class="menu-list">
        <view class="menu-item" @tap="go('/pages/quiz/records')">
          <text class="menu-name">练习记录</text>
          <text class="menu-desc">题库刷题回顾</text>
          <view class="entry-arrow"></view>
        </view>
        <view class="menu-item" @tap="go('/pages/mental/records')">
          <text class="menu-name">速算记录</text>
          <text class="menu-desc">速算练习回顾</text>
          <view class="entry-arrow"></view>
        </view>
        <view class="menu-item" @tap="go('/pages/timer/records')">
          <text class="menu-name">计时记录</text>
          <text class="menu-desc">单题 / 整组计时</text>
          <view class="entry-arrow"></view>
        </view>
      </view>
    </view>

    <!-- 设置 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">设置</text>数据管理</view>
      <view class="menu-list">
        <view class="menu-item" @tap="clearOne('practice')">
          <text class="menu-name danger">清空练习记录</text>
          <text class="menu-desc">题库练习历史全部删除</text>
        </view>
        <view class="menu-item" @tap="clearOne('mental')">
          <text class="menu-name danger">清空速算记录</text>
          <text class="menu-desc">速算历史全部删除</text>
        </view>
        <view class="menu-item" @tap="clearOne('timer')">
          <text class="menu-name danger">清空计时记录</text>
          <text class="menu-desc">计时归档全部删除</text>
        </view>
        <view class="menu-item" @tap="about">
          <text class="menu-name">关于</text>
          <text class="menu-desc">刷题计时器 v1.0.0</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 我的：登录态 + 累计统计 + 记录入口 + 数据清空
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { clearPracticeHistory } from '@/api/practice'
import { clearMentalHistory } from '@/api/mental'
import { clearTimerHistory } from '@/api/timer'
import { fetchMe, fetchStudyStats } from '@/api/stats'
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

function go(url: string): void {
  uni.navigateTo({ url })
}

function doLogin(): void {
  // App.vue 启动时已静默登录；此处重新走一遍登录刷新用户信息
  const app = getApp<{ refreshUser?: () => void }>()
  app?.refreshUser?.()
  setTimeout(loadUser, 600)
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

onShow(() => {
  void loadUser()
  void loadSum()
})
</script>

<style scoped lang="scss">
.user-card {
  display: flex; align-items: center; gap: 20rpx; background-color: $bg-card;
  border-radius: $radius-lg; padding: 28rpx; box-shadow: $shadow-card; margin-bottom: 20rpx;
}
.avatar {
  width: 96rpx; height: 96rpx; border-radius: 50%; background: $brand-gradient; color: #ffffff;
  font-size: 40rpx; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.user-info { flex: 1; min-width: 0; }
.user-name { font-size: 32rpx; font-weight: 800; color: $text-main; }
.user-role { font-size: 22rpx; color: $text-weak; margin-top: 6rpx; }
.login-btn {
  font-size: 23rpx; color: $brand-600; border: 2rpx solid $brand-200; border-radius: $radius-full;
  padding: 8rpx 22rpx; background-color: $brand-50; flex-shrink: 0;
}

.stats-card {
  background: $brand-gradient; border-radius: $radius-lg; padding: 26rpx 28rpx; color: #ffffff;
  box-shadow: $shadow-btn; margin-bottom: 8rpx;
}
.stats-head { font-size: 26rpx; font-weight: 700; }
.stats-cells { display: flex; justify-content: space-between; margin-top: 20rpx; }
.stats-cell { text-align: center; flex: 1; }
.stats-num { font-size: 36rpx; font-weight: 800; }
.stats-label { font-size: 21rpx; opacity: 0.75; margin-top: 4rpx; }

.menu-list { display: flex; flex-direction: column; gap: $gap-item; }
.menu-item {
  display: flex; align-items: center; gap: 20rpx; background-color: $bg-card;
  border-radius: $radius-md; padding: 24rpx 26rpx; box-shadow: $shadow-card-sm;
}
.menu-name { font-size: 28rpx; font-weight: 600; color: $text-main; flex-shrink: 0; }
.menu-name.danger { color: $danger; }
.menu-desc { flex: 1; font-size: 22rpx; color: $text-weak; }
</style>
