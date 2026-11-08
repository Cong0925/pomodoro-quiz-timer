<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">速算 · 技巧速查</view>
      <view class="hero-title">技巧手册</view>
      <view class="hero-sub">百化分 · 平方数 · 幂次估算，练前背一遍</view>
    </view>

    <!-- 百化分速查表 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">01</text>百化分速查表</view>
      <view class="bento manual-card">
        <view class="tbl">
          <view class="tbl-row" v-for="(row, i) in percentRows" :key="i">
            <text class="tbl-key">{{ row[0] }}</text>
            <text class="tbl-val">{{ row[1] }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 平方数速查表 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">02</text>平方数速查表</view>
      <view class="bento manual-card">
        <view class="tbl">
          <view class="tbl-row" v-for="(row, i) in squareRows" :key="i">
            <text class="tbl-key">{{ row[0] }}</text>
            <text class="tbl-val">{{ row[1] }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 幂次估算速查表 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">03</text>幂次估算速查表</view>
      <view class="bento manual-card">
        <view class="tbl">
          <view class="tbl-row" v-for="(row, i) in powRows" :key="i">
            <text class="tbl-key">{{ row[0] }}</text>
            <text class="tbl-val">{{ row[1] }}</text>
          </view>
        </view>
      </view>
    </view>

    <view class="note-card">
      <text class="note-label">练习建议</text>
      <text class="note-text">技巧随答随看：练习中答完立即给出对应速算技巧，坚持练习形成肌肉记忆。</text>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算技巧手册：百化分 / 平方数 / 幂次估算 三张速查表
 * 数据与 web-app 版 MentalManual 组件一致（列优先对折排版）
 */
import { ref } from 'vue'

/** 1/2 ~ 1/20 的百化分（百分数保留 1 位，1/16 用精确值 6.25%） */
const percentRows = ref<Array<[string, string]>>(
  [
    [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [1, 9], [1, 10],
    [1, 11], [1, 12], [1, 13], [1, 14], [1, 15], [1, 16], [1, 17], [1, 18], [1, 19], [1, 20],
  ].map((p) => {
    const v = (100 / p[1]).toFixed(1).replace(/\.0$/, '')
    return [`${p[0]}/${p[1]}`, `${v}%`]
  })
)

/** 1² ~ 20² */
const squareRows = ref<Array<[string, string]>>(
  Array.from({ length: 20 }, (_, i) => {
    const n = i + 1
    return [`${n}²`, String(n * n)]
  })
)

/** 幂次估算表（增长类常用近似值） */
const powRows = ref<Array<[string, string]>>([
  ['1.2³', '1.7'],
  ['1.2⁴', '2'],
  ['1.3³', '2.2'],
  ['1.3⁴', '2.9'],
  ['1.4³', '2.7'],
  ['1.4⁴', '3.8'],
  ['1.05⁴', '1.21'],
  ['1.1⁴', '1.46'],
  ['1.15⁴', '1.75'],
  ['1.1⁵', '1.61'],
])
</script>

<style scoped lang="scss">
.page {
  padding-bottom: 80rpx;
}

.manual-card {
  padding: 20rpx;
}

.tbl {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.tbl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 18rpx;
  border-radius: $radius-xs;
  background-color: $bg-soft;
  min-width: 0;
}

/* 奇数尾行横跨两列并居中，避免 2 列网格留下半格空白 */
.tbl-row:last-child:nth-child(odd) {
  grid-column: span 2;
  justify-content: center;
  gap: 36rpx;
  background-color: $brand-50;
}

.tbl-key {
  font-size: 25rpx;
  font-weight: 700;
  color: $brand-600;
  font-variant-numeric: tabular-nums;
}

.tbl-val {
  font-size: 25rpx;
  font-weight: 600;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.note-card {
  margin-top: 32rpx;
  padding: 22rpx 24rpx;
  border-radius: $radius-md;
  background-color: $bg-card;
  border-left: 8rpx solid $amber;
  box-shadow: $shadow-l1;
}

.note-label {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  color: $amber;
  letter-spacing: 2rpx;
  margin-bottom: 6rpx;
}

.note-text {
  font-size: 23rpx;
  color: $ink-2;
  line-height: 1.6;
}
</style>
