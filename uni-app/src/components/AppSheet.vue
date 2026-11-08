<template>
  <view
    v-if="show"
    class="sheet-mask"
    @tap="onMask"
    @touchmove.stop.prevent="noop"
  >
    <view class="sheet-panel" @tap.stop>
      <view class="sheet-handle"></view>
      <view v-if="title" class="sheet-head">
        <text class="sheet-title">{{ title }}</text>
        <text v-if="subtitle" class="sheet-sub">{{ subtitle }}</text>
      </view>
      <view class="sheet-body">
        <slot />
      </view>
      <view class="sheet-safe"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 通用底部抽屉：替代系统 ActionSheet
 * 用法：<AppSheet :show="visible" title="..." subtitle="..." @close="visible = false">内容</AppSheet>
 */
defineProps<{
  show: boolean
  title?: string
  subtitle?: string
}>()

const emit = defineEmits<{ close: [] }>()

function onMask(): void {
  emit('close')
}

/** 阻止遮罩层滚动穿透 */
function noop(): void {
  // 仅用于 catchtouchmove
}
</script>

<style scoped lang="scss">
.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  background-color: rgba(11, 18, 32, 0.45);
  animation: maskIn 0.22s ease both;
}

.sheet-panel {
  width: 100%;
  box-sizing: border-box;
  background-color: #ffffff;
  border-radius: $radius-sheet $radius-sheet 0 0;
  padding: 18rpx 32rpx 0;
  box-shadow: 0 -24rpx 60rpx rgba(15, 23, 42, 0.18);
  animation: sheetUp 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.sheet-handle {
  width: 72rpx;
  height: 8rpx;
  margin: 0 auto 22rpx;
  border-radius: $radius-full;
  background-color: rgba(15, 23, 42, 0.18);
}

.sheet-head {
  margin-bottom: 8rpx;
}

.sheet-title {
  display: block;
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
  letter-spacing: -0.3rpx;
}

.sheet-sub {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $ink-3;
  line-height: 1.5;
}

.sheet-body {
  padding-top: 16rpx;
}

.sheet-safe {
  height: calc(24rpx + env(safe-area-inset-bottom));
}

@keyframes maskIn {
  from {
    background-color: rgba(11, 18, 32, 0);
  }
  to {
    background-color: rgba(11, 18, 32, 0.45);
  }
}

@keyframes sheetUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
</style>
