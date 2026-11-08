<template>
  <view class="opt-list">
    <view
      v-for="(opt, i) in options"
      :key="i"
      class="opt-item"
      :class="optClass(i)"
      hover-class="opt-press"
      @tap="$emit('choose', i)"
    >
      <view class="opt-label">
        <text v-if="result && result.correctIndex === i">✓</text>
        <text v-else-if="result && selectedIndex === i">✕</text>
        <text v-else>{{ letter(i) }}</text>
      </view>
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
  gap: 16rpx;
}

.opt-item {
  min-height: 104rpx;
  display: flex;
  align-items: center;
  gap: 20rpx;
  background-color: $bg-card;
  border: 2rpx solid $line;
  border-radius: $radius-md;
  padding: 18rpx 24rpx;
  box-sizing: border-box;
  transition: background 0.16s ease, border-color 0.16s ease, opacity 0.16s ease;
}

.opt-item.correct {
  border-color: $success;
  background-color: $success-bg;
}

.opt-item.wrong {
  border-color: $danger;
  background-color: $danger-bg;
}

.opt-item.dim {
  opacity: 0.45;
}

.opt-press {
  background-color: $bg-soft;
}

.opt-label {
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 50%;
  background-color: $bg-soft;
  color: $ink-2;
  font-weight: 700;
  font-size: 26rpx;
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
  font-size: 29rpx;
  color: $ink;
  min-width: 0;
  word-break: break-all;
}
</style>
