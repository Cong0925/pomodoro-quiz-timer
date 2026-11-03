<template>
  <view>
    <view class="card result-hero">
      <view class="rate-num">{{ finishRes.rate }}%</view>
      <view class="rate-sub">共 {{ finishRes.total }} 题 · 正确率</view>
      <view class="result-meta">
        对 <text class="ok">{{ finishRes.correct }}</text> · 错
        <text class="ng">{{ finishRes.wrong }}</text> · 跳
        <text class="sk">{{ finishRes.skipped }}</text> · 用时 {{ formatTime(finishRes.totalMs) }}
      </view>
      <view class="result-btns">
        <button class="btn-primary" @tap="$emit('again')">再练一次</button>
        <button class="btn-ghost" @tap="$emit('back')">返回选题</button>
      </view>
    </view>

    <view class="review-title">错题回顾（{{ wrongItems.length }} 题）· 复盘技巧，下次更快</view>
    <view v-if="wrongItems.length" class="review-list">
      <view v-for="(w, i) in wrongItems" :key="i" class="review-item">
        <view class="ri-q">{{ w.stem }}</view>
        <view class="ri-ans">正确答案：{{ w.correctAnswer }}{{ w.skipped ? '（本题跳过）' : '' }}</view>
        <view v-if="w.tip" class="ri-tip">技巧：{{ w.tip }}</view>
      </view>
    </view>
    <view v-else class="empty">全部答对，无需回顾</view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算结算面板：正确率 + 对错跳 + 用时 + 错题回顾
 * 由答题页在 finish 后传入结算结果，操作事件向上抛出
 */
import type { MentalFinishResult, MentalWrongItem } from '@/types/mental'

defineProps<{
  finishRes: MentalFinishResult
  wrongItems: MentalWrongItem[]
}>()

defineEmits<{ again: []; back: [] }>()

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
</script>

<style scoped>
.card {
  background-color: #ffffff;
  border: 1rpx solid #e3e8f0;
  border-radius: 28rpx;
}

.result-hero {
  text-align: center;
  padding: 44rpx 32rpx;
}

.rate-num {
  font-size: 88rpx;
  font-weight: 800;
  color: #2563eb;
  line-height: 1.2;
}

.rate-sub {
  font-size: 26rpx;
  color: #6b7280;
  margin-top: 4rpx;
}

.result-meta {
  display: flex;
  justify-content: center;
  gap: 32rpx;
  font-size: 27rpx;
  margin-top: 24rpx;
}

.result-meta .ok {
  color: #16a34a;
}

.result-meta .ng {
  color: #dc2626;
}

.result-meta .sk {
  color: #d97706;
}

.result-btns {
  display: flex;
  gap: 20rpx;
  margin: 28rpx 0 8rpx;
}

.btn-primary {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 24rpx;
  background-color: #2563eb;
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 700;
  border: none;
}

.btn-primary::after {
  border: none;
}

.btn-ghost {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  border: 3rpx solid #e3e8f0;
  border-radius: 24rpx;
  background-color: #ffffff;
  color: #1f2937;
  font-size: 31rpx;
  font-weight: 600;
}

.btn-ghost::after {
  border: none;
}

.review-title {
  font-size: 27rpx;
  font-weight: 700;
  margin: 32rpx 0 16rpx;
}

.review-item {
  background-color: #ffffff;
  border: 1rpx solid #e3e8f0;
  border-radius: 24rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 16rpx;
}

.ri-q {
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.5;
}

.ri-ans {
  font-size: 25rpx;
  color: #16a34a;
  margin-top: 8rpx;
}

.ri-tip {
  font-size: 24rpx;
  color: #6b7280;
  margin-top: 6rpx;
  line-height: 1.5;
}

.empty {
  text-align: center;
  padding: 60rpx 20rpx;
  color: #9ca3af;
  font-size: 27rpx;
}
</style>
