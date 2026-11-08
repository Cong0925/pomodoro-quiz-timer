<template>
  <view v-if="visible" class="h5-tabbar">
    <view class="h5-tabbar-inner">
      <view
        v-for="item in tabs"
        :key="item.key"
        class="h5-tab"
        :class="{ active: active === item.key }"
        @tap="go(item)"
      >
        <view class="h5-icon-wrap" :class="{ active: active === item.key }">
          <view class="h5-glyph" :class="[`h5-${item.icon}`, { on: active === item.key }]">
            <template v-if="item.icon === 'book'">
              <view class="h5-book-page"></view>
              <view class="h5-book-page"></view>
            </template>
            <template v-else-if="item.icon === 'user'">
              <view class="h5-u-head"></view>
              <view class="h5-u-body"></view>
            </template>
          </view>
        </view>
        <text class="h5-label" :class="{ active: active === item.key }">{{ item.text }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

type TabKey = 'home' | 'quiz' | 'mental' | 'profile'

defineProps<{ active: TabKey }>()

const visible = ref(false)
// #ifdef H5
visible.value = true
// #endif

const tabs: { key: TabKey; text: string; icon: string; url: string }[] = [
  { key: 'home', text: '首页', icon: 'home', url: '/pages/index/index' },
  { key: 'quiz', text: '题库', icon: 'book', url: '/pages/quiz/index' },
  { key: 'mental', text: '速算', icon: 'bolt', url: '/pages/mental/index' },
  { key: 'profile', text: '我的', icon: 'user', url: '/pages/profile/index' },
]

function go(item: { key: TabKey; url: string }): void {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1]
  if (cur && cur.route === item.url.replace(/^\//, '')) return
  uni.switchTab({ url: item.url })
}
</script>

<style scoped lang="scss">
.h5-tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  z-index: 999;
  pointer-events: none;
}

.h5-tabbar-inner {
  pointer-events: auto;
  display: flex;
  align-items: stretch;
  height: 112rpx;
  padding: 8rpx 10rpx;
  box-sizing: border-box;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.94) 0%, rgba(255, 255, 255, 0.82) 100%);
  border-radius: 44rpx;
  box-shadow: 0 20rpx 50rpx rgba(15, 23, 42, 0.14);
  border: 1rpx solid rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(24rpx) saturate(160%);
  -webkit-backdrop-filter: blur(24rpx) saturate(160%);
}

.h5-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 4rpx;
  border-radius: 34rpx;
  transition: background 0.22s ease, box-shadow 0.22s ease;
}

.h5-tab.active {
  background: linear-gradient(135deg, #5b8cff 0%, #2f6bff 52%, #1d4ed8 100%);
  box-shadow: 0 10rpx 24rpx rgba(47, 107, 255, 0.28);
}

.h5-icon-wrap {
  width: 56rpx;
  height: 56rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.h5-icon-wrap.active {
  transform: translateY(-2rpx);
}

.h5-glyph {
  color: #98a2b3;
  transition: color 0.2s ease;
}

.h5-glyph.on {
  color: #ffffff;
}

.h5-home {
  width: 38rpx;
  height: 34rpx;
  background-color: currentColor;
  clip-path: polygon(50% 0, 100% 42%, 100% 100%, 0 100%, 0 42%);
}

.h5-book {
  width: 36rpx;
  height: 40rpx;
  box-sizing: border-box;
  border: 3rpx solid currentColor;
  border-radius: 7rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding-left: 7rpx;
}

.h5-book-page {
  width: 15rpx;
  height: 3rpx;
  border-radius: 2rpx;
  background-color: currentColor;
}

.h5-book-page:first-child {
  margin-bottom: 5rpx;
}

.h5-bolt {
  width: 24rpx;
  height: 38rpx;
  background-color: currentColor;
  clip-path: polygon(56% 0, 14% 62%, 40% 62%, 30% 100%, 88% 38%, 60% 38%);
}

.h5-user {
  width: 42rpx;
  height: 38rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}

.h5-u-head {
  width: 18rpx;
  height: 18rpx;
  border-radius: 50%;
  background-color: currentColor;
}

.h5-u-body {
  width: 34rpx;
  height: 16rpx;
  margin-top: 4rpx;
  border-radius: 16rpx 16rpx 8rpx 8rpx;
  background-color: currentColor;
}

.h5-label {
  display: block;
  margin-top: 2rpx;
  font-size: 22rpx;
  line-height: 1;
  color: #98a2b3;
  font-weight: 500;
  transition: color 0.2s ease;
}

.h5-label.active {
  color: #ffffff;
  font-weight: 700;
}
</style>
