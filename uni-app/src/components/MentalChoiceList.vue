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

<style scoped lang="scss">
.opt-list {
  display: flex;
  flex-direction: column;
  gap: $gap-item;
}

.opt-item {
  min-height: 104rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  background-color: $bg-card;
  border: 2rpx solid transparent;
  border-radius: $radius-md;
  padding: 16rpx 28rpx;
  box-shadow: $shadow-card-sm;
}

.opt-item.correct {
  border-color: $success;
  background-color: $success-bg;
  box-shadow: 0 6rpx 18rpx rgba(16, 185, 129, 0.16);
}

.opt-item.wrong {
  border-color: $danger;
  background-color: $danger-bg;
  box-shadow: 0 6rpx 18rpx rgba(239, 68, 68, 0.14);
}

.opt-item.dim {
  opacity: 0.5;
}

.opt-label {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background-color: $brand-50;
  color: $brand-600;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 27rpx;
  flex-shrink: 0;
}

.opt-item.correct .opt-label {
  background-color: $success;
  color: #ffffff;
}

.opt-item.wrong .opt-label {
  background-color: $danger;
  color: #ffffff;
}

.opt-text {
  font-size: 30rpx;
  min-width: 0;
  word-break: break-all;
}
</style>
