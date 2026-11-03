<template>
  <view class="page">
    <view class="head-title">速算练习</view>
    <view class="head-sub">资料分析专项技巧训练：答完即时给技巧提示 · 自动归档历史</view>

    <!-- 题型 -->
    <view class="sec-title">选择题型</view>
    <view class="type-grid">
      <view
        class="type-card"
        v-for="t in types"
        :key="t.key"
        :class="{ active: curType === t.key, wide: t.key === 'mixed' }"
        @tap="selectType(t.key)"
      >
        <view class="tc-left">
          <view class="tc-name">{{ t.name }}</view>
          <view class="tc-desc">{{ t.desc }}</view>
        </view>
        <view class="tc-check" v-if="t.key === 'mixed'">
          <view class="tc-dot" v-if="curType === 'mixed'"></view>
        </view>
      </view>
    </view>

    <!-- 难度 -->
    <view class="sec-title">难度</view>
    <view class="chip-row">
      <view
        class="chip"
        v-for="d in diffs"
        :key="d.value"
        :class="{ active: curDiff === d.value }"
        @tap="selectDiff(d.value)"
      >
        {{ d.label }}
      </view>
    </view>

    <!-- 题量 -->
    <view class="sec-title">题量</view>
    <view class="chip-row">
      <view
        class="chip"
        v-for="c in counts"
        :key="c.value"
        :class="{ active: curCount === c.value }"
        @tap="selectCount(c.value)"
      >
        {{ c.label }}
      </view>
    </view>

    <view class="hint">{{ setupHint }}</view>
    <button class="btn-primary" @tap="startPractice">开始练习</button>

    <!-- 入口 -->
    <view class="entry-row">
      <view class="entry-card" @tap="goRecords">
        <view class="entry-ic blue">
          <view class="ic-line3"></view>
        </view>
        <view class="entry-text">
          <view class="entry-name">练习记录</view>
          <view class="entry-sub">历史会话与明细</view>
        </view>
      </view>
      <view class="entry-card" @tap="goManual">
        <view class="entry-ic amber">
          <view class="ic-book"></view>
        </view>
        <view class="entry-text">
          <view class="entry-name">技巧手册</view>
          <view class="entry-sub">百化分 · 平方 · 幂次速查</view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算入口页：题型/难度/题量配置 + 开始练习 + 记录/手册入口
 * 与网页版 MentalView 的 setup 阶段对应；开始后跳转答题页（参数透传）
 */
import { computed, ref } from 'vue'
import type { MentalQtype } from '@/types/mental'
import { MENTAL_TYPE_NAMES } from '@/types/mental'

/** 题型配置（5 项：4 专项 + 综合全宽） */
const types = ref([
  { key: 'percent' as MentalQtype, name: '百化分', desc: '分数↔百分数互化，除转乘秒出' },
  { key: 'compare' as MentalQtype, name: '分数比大小', desc: '交叉相乘，一秒判断谁大' },
  { key: 'estimate' as MentalQtype, name: '估算值', desc: '取整估算，先数量级再微调' },
  { key: 'square' as MentalQtype, name: '平方数', desc: '10-20 平方秒回，资料分析基本功' },
  { key: 'mixed' as MentalQtype, name: '综合练习', desc: '多类题型混合，全面检验' },
])

/** 难度选项：0=不限 1=简单 2=中等 3=困难 */
const diffs = ref([
  { value: 0, label: '不限' },
  { value: 1, label: '简单' },
  { value: 2, label: '中等' },
  { value: 3, label: '困难' },
])

/** 题量选项：0=无限流 */
const counts = ref([
  { value: 10, label: '10 题' },
  { value: 15, label: '15 题' },
  { value: 20, label: '20 题' },
  { value: 0, label: '∞ 无限' },
])

const curType = ref<MentalQtype>('percent')
const curDiff = ref(0)
const curCount = ref(10)

/** 填空模式仅对百化分/平方数生效（后端契约：其他题型强制选择题） */
const answerMode = computed<'fill' | 'choice'>(() =>
  curType.value === 'percent' || curType.value === 'square' ? 'fill' : 'choice'
)

/** 配置提示语 */
const setupHint = computed(() => {
  const name = MENTAL_TYPE_NAMES[curType.value]
  const diffNote = curDiff.value >= 1 ? ` · 难度${diffs.value[curDiff.value].label}` : ''
  const fillNote = answerMode.value === 'fill' ? '（填空题：直接填数字）' : ''
  return curCount.value === 0
    ? `「${name}」${diffNote}不限题量 · 循环随机抽题，答完自动续题，随时可结束${fillNote}`
    : `将抽取 ${curCount.value} 道「${name}」${diffNote}题，答完即时判对错并给出技巧${fillNote}`
})

function selectType(key: MentalQtype): void {
  curType.value = key
}

function selectDiff(value: number): void {
  curDiff.value = value
}

function selectCount(value: number): void {
  curCount.value = value
}

/** 开始练习：跳转答题页并透传配置 */
function startPractice(): void {
  uni.navigateTo({
    url: `/pages/mental/practice?qtype=${curType.value}&diff=${curDiff.value}&count=${curCount.value}&mode=${answerMode.value}`,
  })
}

function goRecords(): void {
  uni.navigateTo({ url: '/pages/mental/records' })
}

function goManual(): void {
  uni.navigateTo({ url: '/pages/mental/manual' })
}
</script>

<style scoped>
.page {
  padding: 32rpx;
}

.head-title {
  font-size: 34rpx;
  font-weight: 700;
  color: #1f2937;
}

.head-sub {
  font-size: 24rpx;
  color: #6b7280;
  margin: 4rpx 0 24rpx;
}

.sec-title {
  font-size: 28rpx;
  font-weight: 600;
  margin: 32rpx 0 16rpx;
}

/* 题型卡片：2×2 + 综合全宽 */
.type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.type-card {
  width: calc(50% - 10rpx);
  background-color: #ffffff;
  border: 3rpx solid #e3e8f0;
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.type-card.active {
  border-color: #2563eb;
  background-color: #eff6ff;
}

.type-card.wide {
  width: 100%;
}

.tc-name {
  font-size: 30rpx;
  font-weight: 700;
}

.tc-desc {
  font-size: 23rpx;
  color: #6b7280;
  margin-top: 6rpx;
  line-height: 1.45;
}

.tc-check {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  border: 3rpx solid #e3e8f0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.type-card.active .tc-check {
  border-color: #2563eb;
  background-color: #2563eb;
}

.tc-dot {
  width: 22rpx;
  height: 22rpx;
  border-radius: 50%;
  background-color: #ffffff;
}

/* chips */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  min-height: 72rpx;
  padding: 12rpx 36rpx;
  border-radius: 999rpx;
  background-color: #ffffff;
  border: 3rpx solid #e3e8f0;
  font-size: 28rpx;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
}

.chip.active {
  border-color: #2563eb;
  background-color: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.hint {
  font-size: 24rpx;
  color: #9ca3af;
  line-height: 1.5;
  margin: 32rpx 0 24rpx;
}

.btn-primary {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 24rpx;
  background-color: #2563eb;
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 700;
  border: none;
}

.btn-primary::after {
  border: none;
}

/* 入口 */
.entry-row {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.entry-card {
  flex: 1;
  background-color: #ffffff;
  border: 1rpx solid #e3e8f0;
  border-radius: 24rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.entry-ic {
  width: 64rpx;
  height: 64rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.entry-ic.blue {
  background-color: #eff6ff;
}

.entry-ic.amber {
  background-color: #fffbeb;
}

.entry-text {
  min-width: 0;
}

.entry-name {
  font-size: 27rpx;
  font-weight: 600;
}

.entry-sub {
  font-size: 22rpx;
  color: #9ca3af;
  margin-top: 2rpx;
}

/* 内联小图标（CSS 绘制） */
.ic-line3 {
  width: 30rpx;
  height: 30rpx;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.ic-line3::before,
.ic-line3::after {
  content: '';
  height: 6rpx;
  border-radius: 3rpx;
  background-color: #2563eb;
}

.ic-line3::after {
  background-color: #93c5fd;
}

.ic-book {
  width: 30rpx;
  height: 30rpx;
  border: 4rpx solid #d97706;
  border-radius: 4rpx;
  position: relative;
}

.ic-book::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 4rpx;
  bottom: 4rpx;
  width: 2rpx;
  background-color: #d97706;
}
</style>
