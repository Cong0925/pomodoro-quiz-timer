<template>
  <view class="page">
    <!-- 百化分速查表 -->
    <view class="card">
      <view class="card-title">百化分速查表（1/2 ~ 1/20）</view>
      <view class="tbl">
        <view class="tbl-row" v-for="(row, i) in percentRows" :key="i">
          <view class="tbl-cell key">{{ row[0] }}</view>
          <view class="tbl-cell val">{{ row[1] }}</view>
        </view>
      </view>
    </view>

    <!-- 平方数速查表 -->
    <view class="card">
      <view class="card-title">平方数速查表（1² ~ 20²）</view>
      <view class="tbl">
        <view class="tbl-row" v-for="(row, i) in squareRows" :key="i">
          <view class="tbl-cell key">{{ row[0] }}</view>
          <view class="tbl-cell val">{{ row[1] }}</view>
        </view>
      </view>
    </view>

    <!-- 幂次估算速查表 -->
    <view class="card">
      <view class="card-title">幂次估算速查表（增长类常用）</view>
      <view class="tbl">
        <view class="tbl-row" v-for="(row, i) in powRows" :key="i">
          <view class="tbl-cell key">{{ row[0] }}</view>
          <view class="tbl-cell val">{{ row[1] }}</view>
        </view>
      </view>
    </view>

    <view class="note">技巧随答随看：练习中答完立即给出对应速算技巧，坚持练习形成肌肉记忆。</view>
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

<style scoped>
.page {
  padding: 24rpx 32rpx 48rpx;
}

.card {
  background-color: #ffffff;
  border: 1rpx solid #e3e8f0;
  border-radius: 28rpx;
  padding: 24rpx;
  margin-bottom: 24rpx;
}

.card-title {
  font-size: 27rpx;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 20rpx;
}

.tbl {
  display: flex;
  flex-wrap: wrap;
}

.tbl-row {
  width: 50%;
  display: flex;
  border: 1rpx solid #e3e8f0;
  margin-left: -1rpx;
  margin-top: -1rpx;
}

.tbl-cell {
  flex: 1;
  text-align: center;
  padding: 14rpx 4rpx;
  font-size: 26rpx;
  font-variant-numeric: tabular-nums;
  min-width: 0;
  overflow: hidden;
}

.tbl-cell.key {
  background-color: #fafbfc;
  font-weight: 600;
}

.note {
  font-size: 24rpx;
  color: #9ca3af;
  line-height: 1.6;
  text-align: center;
  margin-top: 8rpx;
}
</style>
