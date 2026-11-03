<template>
  <view class="analysis" :class="resultClass">
    <view v-if="result.result === 'ng'" class="my-ans">你的答案：{{ myAnswerText }}</view>
    <view v-if="result.result === 'skip'" class="skip-tag">本题跳过</view>
    <view class="green-ans" :class="{ ok: result.result === 'ok' }">
      <text class="ans-mark">{{ result.result === 'ok' ? '✓' : '✗' }}</text>
      <text class="ans-text">正确答案：{{ result.correctAnswer }}</text>
    </view>
    <view v-if="result.tip" class="tip">技巧：{{ result.tip }}</view>
    <button class="next-btn" @tap="$emit('next')">{{ isLast ? '完成' : '下一题' }}</button>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算答题结果面板：判题结论 + 正确答案 + 技巧 + 下一题
 * 选择/填空共用；按钮文案由父组件按是否末题传入
 */
import { computed } from 'vue'
import type { MentalAnswerResult } from '@/types/mental'

const props = defineProps<{
  result: MentalAnswerResult
  myAnswerText: string
  isLast: boolean
}>()

defineEmits<{ next: [] }>()

/** 结果卡主基调：答对绿色 / 答错红色 / 跳过橙色 */
const resultClass = computed(() => {
  if (props.result.result === 'ok') return 'ok'
  if (props.result.result === 'skip') return 'skip'
  return 'ng'
})
</script>

<style scoped lang="scss">
.analysis {
  margin-top: 28rpx;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  box-shadow: $shadow-card;
  border-top: 6rpx solid transparent;
}

.analysis.ok {
  border-top-color: $success;
}

.analysis.ng {
  border-top-color: $danger;
}

.analysis.skip {
  border-top-color: $warning;
}

.my-ans {
  font-size: 26rpx;
  color: $danger;
  margin-bottom: 8rpx;
}

.skip-tag {
  display: inline-block;
  font-size: 23rpx;
  color: $warning;
  border: 1rpx solid $warning;
  border-radius: 10rpx;
  padding: 2rpx 14rpx;
  margin-bottom: 10rpx;
}

.green-ans {
  display: flex;
  align-items: center;
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 14rpx;
}

.ans-mark {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background-color: $danger;
  color: #ffffff;
  font-size: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 14rpx;
  flex-shrink: 0;
}

.ans-text {
  color: $danger;
}

.green-ans.ok .ans-mark {
  background-color: $success;
}

.green-ans.ok .ans-text {
  color: $success;
}

.tip {
  font-size: 26rpx;
  color: $text-main;
  line-height: 1.55;
  margin-bottom: 20rpx;
  background-color: $brand-50;
  border-radius: $radius-sm;
  padding: 16rpx 20rpx;
}

.next-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: $radius-md;
  background: $brand-gradient;
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 700;
  border: none;
  box-shadow: $shadow-primary;
}

.next-btn::after {
  border: none;
}
</style>
