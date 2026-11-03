<template>
  <view class="opt-list">
    <view
      v-for="(opt, i) in options"
      :key="i"
      class="opt-item"
      :class="optClass(i)"
      @tap="$emit('choose', i)"
    >
      <view class="opt-label">{{ letter(i) }}</view>
      <text class="opt-text">{{ opt }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算选择题选项列表：点击作答，答后按判题结果标色（正确绿 / 选错红 / 其余淡化）
 */
import type { MentalAnswerResult } from '@/types/mental'

const props = defineProps<{
  options: string[]
  result: MentalAnswerResult | null
  selectedIndex: number | null
}>()

defineEmits<{ choose: [i: number] }>()

function letter(i: number): string {
  return String.fromCharCode(65 + i)
}

function optClass(i: number): string {
  if (!props.result) return ''
  if (props.result.correctIndex === i) return 'correct'
  if (props.selectedIndex === i) return 'wrong'
  return 'dim'
}
</script>

<style scoped>
.opt-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.opt-item {
  min-height: 104rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  background-color: #ffffff;
  border: 3rpx solid #e3e8f0;
  border-radius: 24rpx;
  padding: 16rpx 28rpx;
}

.opt-item.correct {
  border-color: #16a34a;
  background-color: #f0fdf4;
}

.opt-item.wrong {
  border-color: #dc2626;
  background-color: #fef2f2;
}

.opt-item.dim {
  opacity: 0.5;
}

.opt-label {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background-color: #f1f3f7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 27rpx;
  flex-shrink: 0;
}

.opt-item.correct .opt-label {
  background-color: #16a34a;
  color: #ffffff;
}

.opt-item.wrong .opt-label {
  background-color: #dc2626;
  color: #ffffff;
}

.opt-text {
  font-size: 30rpx;
  min-width: 0;
  word-break: break-all;
}
</style>
