<template>
  <view class="result">
    <!-- 成绩卡：Bento 环形反馈 -->
    <view class="result-card">
      <text class="result-kicker">本场完成</text>
      <view class="result-ring ring" :style="{ background: ringBg }">
        <view class="result-ring-inner">
          <text class="rate-num">{{ finishRes.rate }}<text class="rate-pct">%</text></text>
          <text class="rate-label">正确率</text>
        </view>
      </view>
      <text class="result-sub">共 {{ finishRes.total }} 题 · 用时 {{ formatTime(finishRes.totalMs) }}</text>

      <view class="result-grid">
        <view class="rg-cell">
          <text class="rg-label">答对</text>
          <text class="rg-num ok">{{ finishRes.correct }}</text>
        </view>
        <view class="rg-cell">
          <text class="rg-label">答错</text>
          <text class="rg-num ng">{{ finishRes.wrong }}</text>
        </view>
        <view class="rg-cell">
          <text class="rg-label">跳过</text>
          <text class="rg-num sk">{{ finishRes.skipped }}</text>
        </view>
        <view class="rg-cell">
          <text class="rg-label">用时</text>
          <text class="rg-num time">{{ formatTime(finishRes.totalMs) }}</text>
        </view>
      </view>

      <view class="result-btns">
        <button class="btn-ghost back-btn" @tap="$emit('back')">返回</button>
        <button class="btn-primary again-btn" @tap="$emit('again')">再练一次</button>
      </view>
    </view>

    <!-- 错题回顾 -->
    <view class="review-head">
      <text class="review-title">错题回顾</text>
      <text class="review-count">{{ wrongItems.length }} 题</text>
    </view>

    <view v-if="wrongItems.length" class="review-list">
      <view v-for="(w, i) in wrongItems" :key="i" class="review-item">
        <view class="ri-top">
          <text class="ri-no">NO.{{ i + 1 }}</text>
          <text class="ri-ans">正确答案 {{ w.correctAnswer }}{{ w.skipped ? ' · 已跳过' : '' }}</text>
        </view>
        <view class="ri-q">{{ w.stem }}</view>
        <view v-if="w.tip" class="ri-tip">技巧：{{ w.tip }}</view>
      </view>
    </view>

    <view v-else class="review-empty">
      <view class="re-icon">✓</view>
      <view class="re-title">全部答对</view>
      <view class="re-sub">这一组没有错题，保持手感继续下一组</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算/题库结算面板：环形正确率 + 对错跳用时 + 错题回顾
 * 由答题页在 finish 后传入结算结果，操作事件向上抛出
 */
import { computed } from 'vue'
import type { MentalFinishResult, MentalWrongItem } from '@/types/mental'

const props = defineProps<{
  finishRes: MentalFinishResult
  wrongItems: MentalWrongItem[]
}>()

defineEmits<{ again: []; back: [] }>()

/** 环形进度：正确率映射到 360deg */
const ringBg = computed(() => {
  const rate = Math.max(0, Math.min(100, props.finishRes.rate))
  const deg = rate * 3.6
  return `conic-gradient(from -90deg, #4f86ff 0deg, #2f6bff ${deg}deg, #e8eef7 ${deg}deg 360deg)`
})

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const ss = String(totalSec % 60).padStart(2, '0')
  return `${mm}:${ss}`
}
</script>

<style scoped lang="scss">
.result-card {
  background-color: $bg-card;
  border-radius: $radius-lg;
  box-shadow: $shadow-l2;
  padding: 36rpx 32rpx 32rpx;
  text-align: center;
}

.result-kicker {
  display: block;
  font-size: 22rpx;
  font-weight: 600;
  color: $ink-3;
  letter-spacing: 2rpx;
}

.result-ring {
  width: 232rpx;
  height: 232rpx;
  padding: 18rpx;
  margin: 18rpx auto 0;
  box-sizing: border-box;
}

.result-ring-inner {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-color: #ffffff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.rate-num {
  font-size: 76rpx;
  font-weight: 800;
  line-height: 1;
  color: $ink;
  font-variant-numeric: tabular-nums;
  letter-spacing: -1rpx;
}

.rate-pct {
  font-size: 28rpx;
  font-weight: 700;
  color: $brand-600;
  margin-left: 2rpx;
}

.rate-label {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: $ink-3;
}

.result-sub {
  display: block;
  margin-top: 16rpx;
  font-size: 24rpx;
  color: $ink-3;
}

.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
  margin-top: 28rpx;
  text-align: left;
}

.rg-cell {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  background-color: $bg-soft;
  border-radius: $radius-sm;
  padding: 18rpx 22rpx;
}

.rg-label {
  font-size: 23rpx;
  color: $ink-2;
}

.rg-num {
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.rg-num.ok {
  color: $success;
}

.rg-num.ng {
  color: $danger;
}

.rg-num.sk {
  color: $warning;
}

.rg-num.time {
  font-size: 28rpx;
}

.result-btns {
  display: flex;
  gap: 16rpx;
  margin-top: 30rpx;
}

.back-btn {
  flex: 1;
}

.again-btn {
  flex: 2;
}

/* ---- 错题回顾 ---- */
.review-head {
  display: flex;
  align-items: center;
  margin: 40rpx 0 18rpx;
}

.review-title {
  font-size: $fs-h3;
  font-weight: 700;
  color: $ink;
}

.review-count {
  margin-left: auto;
  font-size: 22rpx;
  color: $ink-3;
}

.review-item {
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: $shadow-l1;
  border-left: 8rpx solid $danger;
}

.ri-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 10rpx;
}

.ri-no {
  font-size: 20rpx;
  font-weight: 800;
  color: $danger;
  letter-spacing: 2rpx;
}

.ri-ans {
  font-size: 22rpx;
  color: $ink-2;
}

.ri-q {
  font-size: 27rpx;
  font-weight: 600;
  line-height: 1.5;
  color: $ink;
}

.ri-tip {
  margin-top: 10rpx;
  padding: 14rpx 18rpx;
  border-radius: $radius-sm;
  background-color: $brand-50;
  color: $ink-2;
  font-size: 24rpx;
  line-height: 1.55;
}

.review-empty {
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 52rpx 32rpx;
  text-align: center;
  box-shadow: $shadow-l1;
}

.re-icon {
  width: 88rpx;
  height: 88rpx;
  line-height: 88rpx;
  margin: 0 auto 16rpx;
  border-radius: 50%;
  background-color: $success-bg;
  color: $success;
  font-size: 44rpx;
  font-weight: 800;
}

.re-title {
  font-size: 32rpx;
  font-weight: 700;
  color: $ink;
}

.re-sub {
  margin-top: 8rpx;
  font-size: 24rpx;
  color: $ink-3;
}
</style>
