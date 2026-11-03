<template>
  <view>
    <!-- 成绩卡：品牌渐变底 + 白色大数字（Keep 式数据反馈） -->
    <view class="result-hero">
      <view class="rate-label">正确率</view>
      <view class="rate-num">{{ finishRes.rate }}%</view>
      <view class="rate-sub">共 {{ finishRes.total }} 题 · 本场成绩</view>
      <view class="result-meta">
        <view class="rm-item">
          <view class="rm-num ok">{{ finishRes.correct }}</view>
          <view class="rm-label">答对</view>
        </view>
        <view class="rm-divider"></view>
        <view class="rm-item">
          <view class="rm-num ng">{{ finishRes.wrong }}</view>
          <view class="rm-label">答错</view>
        </view>
        <view class="rm-divider"></view>
        <view class="rm-item">
          <view class="rm-num sk">{{ finishRes.skipped }}</view>
          <view class="rm-label">跳过</view>
        </view>
        <view class="rm-divider"></view>
        <view class="rm-item">
          <view class="rm-num time">{{ formatTime(finishRes.totalMs) }}</view>
          <view class="rm-label">用时</view>
        </view>
      </view>
      <view class="result-btns">
        <button class="btn-again" @tap="$emit('again')">再练一次</button>
        <button class="btn-back" @tap="$emit('back')">返回选题</button>
      </view>
    </view>

    <view class="review-title">
      <text class="review-bar"></text>
      错题回顾（{{ wrongItems.length }} 题）· 复盘技巧，下次更快
    </view>
    <view v-if="wrongItems.length" class="review-list">
      <view v-for="(w, i) in wrongItems" :key="i" class="review-item">
        <view class="ri-no">NO.{{ i + 1 }}</view>
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

<style scoped lang="scss">
.result-hero {
  background: $brand-gradient;
  border-radius: $radius-lg;
  padding: 48rpx 32rpx 36rpx;
  text-align: center;
  box-shadow: $shadow-btn;
}

.rate-label {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.75);
  letter-spacing: 4rpx;
}

.rate-num {
  font-size: 108rpx;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.rate-sub {
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 2rpx;
}

.result-meta {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-top: 30rpx;
  background-color: rgba(255, 255, 255, 0.14);
  border-radius: $radius-md;
  padding: 20rpx 8rpx;
}

.rm-item {
  flex: 1;
  min-width: 0;
}

.rm-num {
  font-size: 34rpx;
  font-weight: 800;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}

.rm-num.time {
  font-size: 30rpx;
}

.rm-label {
  font-size: 21rpx;
  color: rgba(255, 255, 255, 0.75);
  margin-top: 2rpx;
}

.rm-divider {
  width: 1rpx;
  height: 40rpx;
  background-color: rgba(255, 255, 255, 0.25);
}

.result-btns {
  display: flex;
  gap: $gap-item;
  margin-top: 32rpx;
}

.btn-again,
.btn-back {
  flex: 1;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: $radius-md;
  font-size: 31rpx;
  font-weight: 700;
  border: none;
}

.btn-again {
  background-color: #ffffff;
  color: $brand-600;
  box-shadow: 0 10rpx 24rpx rgba(15, 23, 42, 0.18);
}

.btn-back {
  background-color: rgba(255, 255, 255, 0.18);
  color: #ffffff;
  border: 2rpx solid rgba(255, 255, 255, 0.5);
}

.btn-again::after,
.btn-back::after {
  border: none;
}

.review-title {
  display: flex;
  align-items: center;
  font-size: 27rpx;
  font-weight: 700;
  margin: 32rpx 0 16rpx;
  color: $text-main;
}

.review-bar {
  width: 8rpx;
  height: 28rpx;
  border-radius: 4rpx;
  background: $brand-gradient;
  margin-right: 14rpx;
}

.review-item {
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 22rpx 24rpx;
  margin-bottom: 16rpx;
  box-shadow: $shadow-card-sm;
}

.ri-no {
  font-size: 20rpx;
  font-weight: 800;
  color: $brand-400;
  letter-spacing: 2rpx;
  margin-bottom: 6rpx;
}

.ri-q {
  font-size: 28rpx;
  font-weight: 600;
  line-height: 1.5;
  color: $text-main;
}

.ri-ans {
  font-size: 25rpx;
  color: $success;
  margin-top: 8rpx;
}

.ri-tip {
  font-size: 24rpx;
  color: $text-sub;
  margin-top: 6rpx;
  line-height: 1.5;
}

.empty {
  text-align: center;
  padding: 60rpx 20rpx;
  color: $text-weak;
  font-size: 27rpx;
}
</style>
