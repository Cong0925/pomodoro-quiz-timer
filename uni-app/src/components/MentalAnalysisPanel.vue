<template>
  <!-- 判题 + 技巧解析：答后浮出，颜色 + 图标双信号 -->
  <view class="analysis" :class="'r-' + result.result">
    <view class="ans-head">
      <view class="ans-mark" :class="result.result">
        {{ result.result === 'ok' ? '✓' : result.result === 'ng' ? '✕' : '○' }}
      </view>
      <view class="ans-main">
        <view class="ans-title">{{ title }}</view>
        <view v-if="result.result === 'ng'" class="ans-detail">
          你的答案：{{ mineText }}
        </view>
        <view class="ans-detail">正确答案：{{ result.correctAnswer }}</view>
      </view>
    </view>

    <view v-if="tip" class="tip-box">
      <text class="tip-label">技巧</text>
      <text class="tip-text">{{ tip }}</text>
    </view>

    <button class="btn-primary next-btn" @tap="$emit('next')">
      {{ isLast ? '查看结果' : '下一题' }}
    </button>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算判题解析面板：正确/错误/跳过 + 正确答案 + 技巧提示 + 下一题
 */
import { computed } from 'vue'
import type { MentalAnswerResult } from '@/types/mental'

const props = withDefaults(
  defineProps<{
    result: MentalAnswerResult
    myAnswerText?: string
    isLast?: boolean
  }>(),
  { isLast: false, myAnswerText: '' }
)

defineEmits<{ next: [] }>()

const title = computed(() =>
  props.result.result === 'ok'
    ? '回答正确'
    : props.result.result === 'ng'
      ? '回答错误'
      : '本题跳过'
)

const tip = computed(() => props.result.tip || '')
const mineText = computed(() => props.myAnswerText || '—')
</script>

<style scoped lang="scss">
.analysis {
  margin-top: 24rpx;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  box-shadow: $shadow-l2;
}

.ans-head {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.ans-mark {
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 50%;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.ans-mark.ok {
  background-color: $success;
}

.ans-mark.ng {
  background-color: $danger;
}

.ans-mark.skip {
  background-color: $warning;
}

.ans-main {
  flex: 1;
  min-width: 0;
}

.ans-title {
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
}

.r-ok .ans-title {
  color: $success;
}

.r-ng .ans-title {
  color: $danger;
}

.r-skip .ans-title {
  color: $warning;
}

.ans-detail {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.5;
}

.tip-box {
  margin-top: 22rpx;
  padding: 20rpx;
  border-radius: $radius-md;
  background-color: $brand-50;
}

.tip-label {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  color: $brand-600;
  letter-spacing: 2rpx;
  margin-bottom: 8rpx;
}

.tip-text {
  font-size: 26rpx;
  line-height: 1.65;
  color: $ink-2;
}

.next-btn {
  margin-top: 24rpx;
}
</style>
