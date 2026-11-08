<template>
  <view class="page">
    <!-- 主视觉 -->
    <view class="hero hero-strong">
      <view class="hero-badge">资料分析 · 专项技巧</view>
      <view class="hero-title">速算练习</view>
      <view class="hero-sub">答完即时给技巧提示 · 自动归档历史</view>
      <view class="hero-foot">
        <view class="hero-pill">4 大题型</view>
        <view class="hero-pill">即时判题</view>
        <view class="hero-pill">技巧随答随看</view>
      </view>
    </view>

    <!-- 题型 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">01</text>选择题型</view>
      <view class="type-grid">
        <view
          v-for="t in types"
          :key="t.key"
          class="type-card"
          :class="{ active: curType === t.key, wide: t.key === 'mixed' }"
          hover-class="type-press"
          @tap="selectType(t.key)"
        >
          <view class="tc-icon" :style="{ backgroundColor: t.bg }">
            <text class="tc-symbol" :style="{ color: t.fg }">{{ t.symbol }}</text>
          </view>
          <view class="tc-left">
            <view class="tc-name">{{ t.name }}</view>
            <view class="tc-desc">{{ t.desc }}</view>
          </view>
          <view v-if="curType === t.key" class="tc-check">
            <view class="tc-tick"></view>
          </view>
        </view>
      </view>
    </view>

    <!-- 难度 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">02</text>难度</view>
      <view class="seg">
        <view
          v-for="d in diffs"
          :key="d.value"
          class="seg-item"
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
      <view class="seg">
        <view
          v-for="c in counts"
          :key="c.value"
          class="seg-item"
          :class="{ active: curCount === c.value }"
          @tap="selectCount(c.value)"
        >
          {{ c.label }}
        </view>
      </view>
    </view>

    <view class="hint-card">
      <text class="hint-label">本次配置</text>
      <text class="hint-text">{{ setupHint }}</text>
    </view>

    <button class="btn-primary start-btn" @tap="startPractice">开始练习</button>

    <!-- 入口 -->
    <view class="entry-row">
      <view class="entry-card" hover-class="press" @tap="goRecords">
        <view class="entry-ic blue">记</view>
        <view class="entry-text">
          <view class="entry-name">练习记录</view>
          <view class="entry-sub">历史会话与明细</view>
        </view>
        <view class="entry-arrow"></view>
      </view>
      <view class="entry-card" hover-class="press" @tap="goManual">
        <view class="entry-ic amber">册</view>
        <view class="entry-text">
          <view class="entry-name">技巧手册</view>
          <view class="entry-sub">百化分 · 平方 · 幂次速查</view>
        </view>
        <view class="entry-arrow"></view>
      </view>
    </view>
    <AppTabBarH5 active="mental" />
  </view>
</template>

<script setup lang="ts">
/**
 * 速算入口页：主视觉 + 题型/难度/题量配置 + 开始练习 + 记录/手册入口
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTabBarH5 from '@/components/AppTabBarH5.vue'
import type { MentalQtype } from '@/types/mental'
import { MENTAL_TYPE_NAMES } from '@/types/mental'

/** 题型配置（5 项：4 专项 + 综合全宽），带彩色图标 */
const types = ref([
  { key: 'percent' as MentalQtype, name: '百化分', desc: '分数与百分数互化', symbol: '%', bg: '#eaf1ff', fg: '#2f6bff' },
  { key: 'compare' as MentalQtype, name: '分数比大小', desc: '交叉相乘，一秒判断谁大', symbol: '½', bg: '#fff5e2', fg: '#f79009' },
  { key: 'estimate' as MentalQtype, name: '估算值', desc: '取整估算，先数量级再微调', symbol: '≈', bg: '#ffedec', fg: '#ff6b6b' },
  { key: 'square' as MentalQtype, name: '平方数', desc: '10-20 平方秒回，基本功', symbol: 'x²', bg: '#e6faf6', fg: '#14b8a6' },
  { key: 'mixed' as MentalQtype, name: '综合练习', desc: '多类题型混合，全面检验', symbol: '∞', bg: '#eef4ff', fg: '#1d4ed8' },
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

/** 同步自定义 tabBar 选中态（index=2 速算） */
function syncTab(index: number): void {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as unknown as {
    getTabBar?: () => { setData: (d: { selected: number }) => void }
  }
  const tb = page?.getTabBar?.()
  if (tb) tb.setData({ selected: index })
}

onShow(() => {
  syncTab(2)
})
</script>

<style scoped lang="scss">
.page {
  padding-bottom: 190rpx;
}

.hero-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 22rpx;
}

.hero-pill {
  padding: 6rpx 18rpx;
  border-radius: $radius-full;
  background-color: rgba(255, 255, 255, 0.18);
  color: rgba(255, 255, 255, 0.9);
  font-size: 21rpx;
}

/* ---- 题型卡 ---- */
.type-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.type-card {
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 22rpx 20rpx;
  border-radius: $radius-md;
  background-color: $bg-card;
  border: 2rpx solid transparent;
  box-shadow: $shadow-l1;
}

.type-card.active {
  border-color: $brand-600;
  background: linear-gradient(160deg, #ffffff 0%, #f3f8ff 100%);
  box-shadow: 0 10rpx 26rpx rgba(47, 107, 255, 0.16);
}

.type-card.wide {
  grid-column: 1 / -1;
}

.type-press {
  background-color: $bg-soft;
}

.tc-icon {
  width: 68rpx;
  height: 68rpx;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tc-symbol {
  font-size: 32rpx;
  font-weight: 800;
}

.tc-left {
  flex: 1;
  min-width: 0;
}

.tc-name {
  font-size: 27rpx;
  font-weight: 700;
  color: $ink;
}

.tc-desc {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: $ink-3;
  line-height: 1.35;
  white-space: normal;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.type-card.wide .tc-desc {
  white-space: normal;
}

.tc-check {
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background-color: $brand-600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 8rpx;
}

.tc-tick {
  width: 12rpx;
  height: 20rpx;
  border-right: 4rpx solid #ffffff;
  border-bottom: 4rpx solid #ffffff;
  transform: rotate(45deg) translate(-1rpx, -1rpx);
}

/* ---- 配置提示 ---- */
.hint-card {
  margin-top: 32rpx;
  padding: 22rpx 24rpx;
  border-radius: $radius-md;
  background-color: $bg-card;
  border-left: 8rpx solid $brand-500;
  box-shadow: $shadow-l1;
}

.hint-label {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  color: $brand-600;
  letter-spacing: 2rpx;
  margin-bottom: 6rpx;
}

.hint-text {
  font-size: 23rpx;
  color: $ink-2;
  line-height: 1.6;
}

.start-btn {
  margin-top: 24rpx;
}

/* ---- 入口 ---- */
.entry-row {
  display: flex;
  gap: 16rpx;
  margin-top: 24rpx;
}

.entry-card {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 14rpx;
  padding: 22rpx;
  border-radius: $radius-md;
  background-color: $bg-card;
  box-shadow: $shadow-l1;
}

.entry-ic {
  width: 60rpx;
  height: 60rpx;
  line-height: 60rpx;
  text-align: center;
  border-radius: 18rpx;
  font-size: 24rpx;
  font-weight: 800;
  flex-shrink: 0;
}

.entry-ic.blue {
  background-color: $brand-50;
  color: $brand-600;
}

.entry-ic.amber {
  background-color: $amber-bg;
  color: $amber;
}

.entry-text {
  flex: 1;
  min-width: 0;
}

.entry-name {
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
}

.entry-sub {
  margin-top: 2rpx;
  font-size: 20rpx;
  color: $ink-3;
}
</style>
