<template>
  <view class="analysis">
    <view v-if="result.result === 'ng'" class="my-ans">你的答案：{{ myAnswerText }}</view>
    <view v-if="result.result === 'skip'" class="skip-tag">本题跳过</view>
    <view class="green-ans" :class="{ ok: result.result === 'ok' }">
      正确答案：{{ result.correctAnswer }}
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
import type { MentalAnswerResult } from '@/types/mental'

defineProps<{
  result: MentalAnswerResult
  myAnswerText: string
  isLast: boolean
}>()

defineEmits<{ next: [] }>()
</script>

<style scoped>
.analysis {
  margin-top: 28rpx;
  background-color: #ffffff;
  border: 1rpx solid #e3e8f0;
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
}

.my-ans {
  font-size: 26rpx;
  color: #dc2626;
  margin-bottom: 8rpx;
}

.skip-tag {
  display: inline-block;
  font-size: 23rpx;
  color: #d97706;
  border: 1rpx solid #d97706;
  border-radius: 10rpx;
  padding: 2rpx 14rpx;
  margin-bottom: 10rpx;
}

.green-ans {
  font-size: 30rpx;
  font-weight: 700;
  margin-bottom: 12rpx;
}

.green-ans.ok {
  color: #16a34a;
}

.tip {
  font-size: 26rpx;
  color: #1f2937;
  line-height: 1.55;
  margin-bottom: 20rpx;
}

.next-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 24rpx;
  background-color: #2563eb;
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 700;
  border: none;
}

.next-btn::after {
  border: none;
}
</style>
