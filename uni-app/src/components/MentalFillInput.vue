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
        @input="onInput"
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

const emit = defineEmits<{ 'update:modelValue': [value: string]; submit: [] }>()

/** input 输入事件：透传值（uni-app 模板事件推断为 Event，取 detail.value） */
function onInput(e: Event): void {
  const detail = (e as { detail?: { value?: string } }).detail
  emit('update:modelValue', detail?.value ?? '')
}

const prefix = computed(() =>
  props.fillDir === 'den' || props.fillDir === 'frac' ? '1/' : ''
)
const suffix = computed(() => (props.fillDir === 'pct' ? '%' : ''))
</script>

<style scoped lang="scss">
.fill-box {
  margin-top: 12rpx;
}

.fill-row {
  display: flex;
  align-items: center;
  gap: $gap-item;
}

.fill-affix {
  font-size: 44rpx;
  font-weight: 700;
  color: $text-main;
}

.fill-input {
  flex: 1;
  min-width: 0;
  height: 100rpx;
  border: 3rpx solid $brand-200;
  border-radius: $radius-md;
  padding: 0 24rpx;
  font-size: 40rpx;
  font-weight: 700;
  text-align: center;
  background-color: $brand-50;
  color: $text-main;
  box-shadow: $shadow-card-sm;
}

.fill-submit {
  height: 100rpx;
  line-height: 100rpx;
  padding: 0 40rpx;
  border-radius: $radius-md;
  background: $brand-gradient;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
  margin: 0;
  box-shadow: $shadow-primary;
}

.fill-submit::after {
  border: none;
}

.fill-tip {
  font-size: 23rpx;
  color: $text-weak;
  margin-top: 16rpx;
  line-height: 1.5;
}

.key-hint {
  background-color: $brand-50;
  color: $brand-600;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 600;
}
</style>
