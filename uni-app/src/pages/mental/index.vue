<template>
  <view class="page">
    <!-- 渐变主视觉 -->
    <view class="hero">
      <view class="hero-badge">资料分析 · 专项技巧</view>
      <view class="hero-title">速算练习</view>
      <view class="hero-sub">答完即时给技巧提示 · 自动归档历史</view>
    </view>

    <!-- 题型 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">01</text>选择题型</view>
      <view class="type-grid">
        <view
          class="type-card"
          v-for="t in types"
          :key="t.key"
          :class="{ active: curType === t.key, wide: t.key === 'mixed' }"
          @tap="selectType(t.key)"
        >
          <view class="tc-icon" :style="{ backgroundColor: t.bg }">
            <text class="tc-symbol" :style="{ color: t.fg }">{{ t.symbol }}</text>
          </view>
          <view class="tc-left">
            <view class="tc-name">{{ t.name }}</view>
            <view class="tc-desc">{{ t.desc }}</view>
          </view>
          <view class="tc-check" v-if="curType === t.key">
            <view class="tc-tick"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 难度 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">02</text>难度</view>
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
    </view>

    <!-- 题量 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">03</text>题量</view>
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
        <view class="entry-arrow"></view>
      </view>
      <view class="entry-card" @tap="goManual">
        <view class="entry-ic amber">
          <view class="ic-book"></view>
        </view>
        <view class="entry-text">
          <view class="entry-name">技巧手册</view>
          <view class="entry-sub">百化分 · 平方 · 幂次速查</view>
        </view>
        <view class="entry-arrow"></view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 速算入口页：渐变主视觉 + 题型/难度/题量配置 + 开始练习 + 记录/手册入口
 */
import { computed, ref } from 'vue'
import type { MentalQtype } from '@/types/mental'
import { MENTAL_TYPE_NAMES } from '@/types/mental'

/** 题型配置（5 项：4 专项 + 综合全宽），带彩色图标 */
const types = ref([
  { key: 'percent' as MentalQtype, name: '百化分', desc: '分数↔百分数互化，除转乘秒出', symbol: '%', bg: '#e8f0fe', fg: '#2563eb' },
  { key: 'compare' as MentalQtype, name: '分数比大小', desc: '交叉相乘，一秒判断谁大', symbol: '½', bg: '#f3e8ff', fg: '#7c3aed' },
  { key: 'estimate' as MentalQtype, name: '估算值', desc: '取整估算，先数量级再微调', symbol: '≈', bg: '#fef3e2', fg: '#d97706' },
  { key: 'square' as MentalQtype, name: '平方数', desc: '10-20 平方秒回，基本功', symbol: 'x²', bg: '#e6f7f0', fg: '#059669' },
  { key: 'mixed' as MentalQtype, name: '综合练习', desc: '多类题型混合，全面检验', symbol: '∞', bg: '#eef2ff', fg: '#4f46e5' },
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
  padding: 32rpx 32rpx 40rpx;
  min-height: 100vh;
  box-sizing: border-box;
}

/* 渐变主视觉 */
.hero {
  padding: 44rpx 40rpx 50rpx;
  border-radius: 32rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%);
  box-shadow: 0 16rpx 32rpx rgba(37, 99, 235, 0.28);
  overflow: hidden;
}

.hero-badge {
  display: inline-block;
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  background-color: rgba(255, 255, 255, 0.18);
  color: #dbeafe;
  font-size: 22rpx;
  letter-spacing: 2rpx;
}

.hero-title {
  margin-top: 22rpx;
  font-size: 52rpx;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 4rpx;
}

.hero-sub {
  margin-top: 10rpx;
  font-size: 25rpx;
  color: rgba(255, 255, 255, 0.85);
}

/* 分组 */
.sec {
  margin-top: 34rpx;
}

.sec-title {
  display: flex;
  align-items: baseline;
  font-size: 30rpx;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 18rpx;
}

.sec-no {
  font-size: 22rpx;
  font-weight: 800;
  color: #93c5fd;
  margin-right: 12rpx;
}

/* 题型卡片：一行两个，综合全宽跨列 */
.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.type-card {
  min-width: 0;
  box-sizing: border-box;
  background-color: #ffffff;
  border: 2rpx solid #eef1f6;
  border-radius: 24rpx;
  padding: 22rpx 20rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 4rpx 14rpx rgba(15, 23, 42, 0.04);
}

.type-card.active {
  border-color: #2563eb;
  box-shadow: 0 6rpx 18rpx rgba(37, 99, 235, 0.14);
}

.type-card.wide {
  grid-column: 1 / -1;
}

.tc-icon {
  width: 68rpx;
  height: 68rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 18rpx;
}

.tc-symbol {
  font-size: 34rpx;
  font-weight: 800;
}

.tc-left {
  min-width: 0;
  flex: 1;
}

.tc-name {
  font-size: 27rpx;
  font-weight: 700;
  color: #1f2937;
}

.tc-desc {
  font-size: 20rpx;
  color: #9ca3af;
  margin-top: 4rpx;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.type-card.wide .tc-desc {
  white-space: normal;
}

.tc-check {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background-color: #2563eb;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 12rpx;
}

.tc-tick {
  width: 12rpx;
  height: 20rpx;
  border-right: 4rpx solid #ffffff;
  border-bottom: 4rpx solid #ffffff;
  transform: rotate(45deg) translate(-2rpx, -2rpx);
}

/* chips */
.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.chip {
  min-height: 68rpx;
  padding: 12rpx 34rpx;
  border-radius: 999rpx;
  background-color: #ffffff;
  border: 2rpx solid #eef1f6;
  font-size: 27rpx;
  color: #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 8rpx rgba(15, 23, 42, 0.04);
}

.chip.active {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  border-color: transparent;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 6rpx 16rpx rgba(37, 99, 235, 0.25);
}

.hint {
  font-size: 24rpx;
  color: #9ca3af;
  line-height: 1.5;
  margin: 30rpx 4rpx 24rpx;
}

.btn-primary {
  width: 100%;
  height: 100rpx;
  line-height: 100rpx;
  border-radius: 28rpx;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  font-size: 34rpx;
  font-weight: 700;
  border: none;
  box-shadow: 0 12rpx 24rpx rgba(37, 99, 235, 0.3);
  letter-spacing: 2rpx;
}

.btn-primary::after {
  border: none;
}

/* 入口 */
.entry-row {
  display: flex;
  gap: 20rpx;
  margin-top: 28rpx;
}

.entry-card {
  flex: 1;
  background-color: #ffffff;
  border: 2rpx solid #eef1f6;
  border-radius: 24rpx;
  padding: 22rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  box-shadow: 0 4rpx 14rpx rgba(15, 23, 42, 0.04);
}

.entry-ic {
  width: 60rpx;
  height: 60rpx;
  border-radius: 18rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.entry-ic.blue {
  background-color: #e8f0fe;
}

.entry-ic.amber {
  background-color: #fef3e2;
}

.entry-text {
  min-width: 0;
  flex: 1;
}

.entry-name {
  font-size: 26rpx;
  font-weight: 600;
  color: #1f2937;
}

.entry-sub {
  font-size: 20rpx;
  color: #9ca3af;
  margin-top: 2rpx;
}

.entry-arrow {
  width: 14rpx;
  height: 14rpx;
  border-top: 4rpx solid #cbd5e1;
  border-right: 4rpx solid #cbd5e1;
  transform: rotate(45deg);
  flex-shrink: 0;
}

/* 内联小图标（CSS 绘制） */
.ic-line3 {
  width: 28rpx;
  height: 28rpx;
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
  width: 28rpx;
  height: 28rpx;
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
