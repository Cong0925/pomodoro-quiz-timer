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

<style scoped lang="scss">
/* 渐变主视觉：使用 App.vue 全局 .hero/.hero-badge/.hero-title/.hero-sub */

/* 题型卡片：一行两个，综合全宽跨列 */
.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.type-card {
  min-width: 0;
  box-sizing: border-box;
  background-color: $bg-card;
  border: 2rpx solid transparent;
  border-radius: $radius-md;
  padding: 22rpx 20rpx;
  display: flex;
  align-items: center;
  box-shadow: $shadow-card-sm;
}

.type-card.active {
  border-color: $brand-600;
  box-shadow: $shadow-primary;
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
  color: $text-main;
}

.tc-desc {
  font-size: 20rpx;
  color: $text-weak;
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
  background-color: $brand-600;
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

.hint {
  font-size: 24rpx;
  color: $text-weak;
  line-height: 1.5;
  margin: 30rpx 4rpx 24rpx;
}

/* 入口 */
.entry-row {
  display: flex;
  gap: $gap-item;
  margin-top: 28rpx;
}

.entry-card {
  flex: 1;
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 22rpx;
  display: flex;
  align-items: center;
  gap: 14rpx;
  box-shadow: $shadow-card-sm;
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
  background-color: $brand-50;
}

.entry-ic.amber {
  background-color: $warning-bg;
}

.entry-text {
  min-width: 0;
  flex: 1;
}

.entry-name {
  font-size: 26rpx;
  font-weight: 600;
  color: $text-main;
}

.entry-sub {
  font-size: 20rpx;
  color: $text-weak;
  margin-top: 2rpx;
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
  background-color: $brand-600;
}

.ic-line3::after {
  background-color: $brand-400;
}

.ic-book {
  width: 28rpx;
  height: 28rpx;
  border: 4rpx solid $warning;
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
  background-color: $warning;
}
</style>
