<template>
  <view class="fill-box">
    <view class="fill-row">
      <text v-if="prefix" class="fill-affix">{{ prefix }}</text>
      <input
        class="fill-input"
        type="digit"
        :focus="focus"
        :value="modelValue"
        confirm-type="done"
        :adjust-position="true"
        :cursor-spacing="120"
        placeholder="填数字"
        @input="$emit('update:modelValue', $event.detail.value)"
        @confirm="$emit('submit')"
      />
      <text v-if="suffix" class="fill-affix">{{ suffix }}</text>
      <button class="fill-submit" @tap="$emit('submit')">提交</button>
    </view>
    <view class="fill-tip">
      输入数字后点键盘「<text class="key-hint">完成</text>」提交，点「<text class="key-hint">下一题</text>」继续，自动弹出键盘
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算填空题输入行：按 fillDir 显示 1/ 前缀或 % 后缀，自动聚焦弹出数字键盘
 * 键盘「完成」键 = 提交（提交由父组件处理，含判题与下一题流转）
 */
import { computed } from 'vue'
import type { MentalFillDir } from '@/types/mental'

const props = defineProps<{
  modelValue: string
  focus: boolean
  fillDir?: MentalFillDir
}>()

defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>()

const prefix = computed(() =>
  props.fillDir === 'den' || props.fillDir === 'frac' ? '1/' : ''
)
const suffix = computed(() => (props.fillDir === 'pct' ? '%' : ''))
</script>

<style scoped>
.fill-box {
  margin-top: 12rpx;
}

.fill-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.fill-affix {
  font-size: 44rpx;
  font-weight: 700;
}

.fill-input {
  flex: 1;
  min-width: 0;
  height: 100rpx;
  border: 3rpx solid #e3e8f0;
  border-radius: 24rpx;
  padding: 0 24rpx;
  font-size: 40rpx;
  font-weight: 700;
  text-align: center;
  background-color: #ffffff;
}

.fill-submit {
  height: 100rpx;
  line-height: 100rpx;
  padding: 0 40rpx;
  border-radius: 24rpx;
  background-color: #2563eb;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  margin: 0;
}

.fill-submit::after {
  border: none;
}

.fill-tip {
  font-size: 23rpx;
  color: #9ca3af;
  margin-top: 16rpx;
  line-height: 1.5;
}

.key-hint {
  background-color: #eef2ff;
  color: #2563eb;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 600;
}
</style>
