<template>
  <view class="page">
    <view class="hero">
      <text class="title">刷题计时器</text>
      <text class="desc">题库练习 · 速算练习 · 计时模式</text>
    </view>
    <view class="placeholder">
      <text>首页开发中——待 Demo 确认后实现聚合入口与数据概览</text>
    </view>
  </view>
</template>

<script setup lang="ts">
// 首页：聚合入口（模式选择 + 数据概览），功能开发前先出 Demo 讨论
</script>

<style scoped>
.page {
  padding: 60rpx 32rpx;
}
.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80rpx 0 40rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 600;
  color: #1f2937;
}
.desc {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #9ca3af;
}
.placeholder {
  margin-top: 40rpx;
  padding: 32rpx;
  border-radius: 16rpx;
  background-color: #ffffff;
  text-align: center;
  font-size: 26rpx;
  color: #9ca3af;
}
</style>
