<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">专项题库 · {{ loadedCount }} 题</view>
      <view class="hero-title">题库练习</view>
      <view class="hero-sub">按大类筛选 · 顺序或随机抽题 · 答后即时解析</view>
    </view>

    <!-- 分类筛选 -->
    <view class="filter-wrap">
      <scroll-view scroll-x class="filter-scroll" :show-scrollbar="false">
        <view class="chip-row nowrap">
          <view class="chip" :class="{ active: curCat === '' }" @tap="curCat = ''">全部</view>
          <view
            v-for="c in catNames"
            :key="c"
            class="chip"
            :class="{ active: curCat === c }"
            @tap="curCat = c"
          >
            {{ c }}
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 抽题数量 -->
    <view class="setup-card bento">
      <view class="setup-label">抽题数量</view>
      <view class="chip-row">
        <view
          v-for="c in counts"
          :key="c.value"
          class="chip small"
          :class="{ active: curCount === c.value }"
          @tap="curCount = c.value"
        >
          {{ c.label }}
        </view>
      </view>
    </view>

    <!-- 题库列表（按大类分组） -->
    <template v-if="grouped.length">
      <view v-for="(g, gi) in grouped" :key="g.catName" class="sec">
        <view class="sec-title">
          <text class="sec-no">{{ gi + 1 }}</text>
          {{ g.catName }}
          <text class="sec-count">{{ g.banks.length }} 个题库</text>
        </view>

        <view
          v-for="b in g.banks"
          :key="b.id"
          class="bank-card"
          :class="{ disabled: b.count === 0 }"
          hover-class="press"
          @tap="onTapBank(b)"
        >
          <view class="bank-accent"></view>
          <view class="bank-main">
            <view class="bank-name">{{ b.name }}</view>
            <view v-if="b.description" class="bank-desc">{{ b.description }}</view>
            <view class="bank-tags">
              <text v-if="b.subName" class="tag brand">{{ b.subName }}</text>
              <text v-if="b.count === 0" class="tag danger">暂无题目</text>
            </view>
          </view>
          <view class="bank-right">
            <text class="bank-count">{{ b.count }}<text class="bank-unit">题</text></text>
            <view v-if="b.count > 0" class="entry-arrow"></view>
          </view>
        </view>
      </view>
    </template>

    <view v-else class="empty-box">
      <view class="empty-title">暂无题库</view>
      <view class="empty-text">请在网页端「题库管理」中创建题库并录入题目</view>
    </view>

    <!-- 练习方式抽屉 -->
    <AppSheet
      :show="showSheet"
      :title="activeBank ? activeBank.name : ''"
      :subtitle="activeBank ? `抽 ${Math.min(curCount, activeBank.count)} 题 · 选择练习方式` : ''"
      @close="closeSheet"
    >
      <view class="sheet-options">
        <view class="sheet-row" hover-class="sheet-row-press" @tap="startBank('order')">
          <view class="sheet-ic blue">顺</view>
          <view class="sheet-info">
            <text class="sheet-name">顺序练习</text>
            <text class="sheet-desc">按题库顺序逐题作答，适合系统过一遍</text>
          </view>
          <view class="entry-arrow"></view>
        </view>
        <view class="sheet-row" hover-class="sheet-row-press" @tap="startBank('random')">
          <view class="sheet-ic mint">随</view>
          <view class="sheet-info">
            <text class="sheet-name">随机练习</text>
            <text class="sheet-desc">随机抽题，适合快速检验掌握程度</text>
          </view>
          <view class="entry-arrow"></view>
        </view>
      </view>
    </AppSheet>
    <AppTabBarH5 active="quiz" />
  </view>
</template>

<script setup lang="ts">
/**
 * 题库页：分类筛选 + 题数选择 + 按大类分组的题库列表；点题库弹底部抽屉选顺序/随机
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppSheet from '@/components/AppSheet.vue'
import AppTabBarH5 from '@/components/AppTabBarH5.vue'
import { fetchBanks } from '@/api/practice'
import type { PracticeBank, PracticeMode } from '@/types/practice'

const counts = ref([
  { value: 10, label: '10 题' },
  { value: 20, label: '20 题' },
  { value: 50, label: '50 题' },
])
const curCount = ref(10)
const curCat = ref('')
const banks = ref<PracticeBank[]>([])
const showSheet = ref(false)
const activeBank = ref<PracticeBank | null>(null)

const loadedCount = computed(() => banks.value.reduce((s, b) => s + b.count, 0))

/** 大类名去重（保持出现顺序） */
const catNames = computed(() => {
  const names: string[] = []
  for (const b of banks.value) {
    const key = b.catName || '未分类'
    if (!names.includes(key)) names.push(key)
  }
  return names
})

/** 按大类名分组（保持大类出现顺序，支持分类筛选） */
const grouped = computed(() => {
  const filtered = curCat.value
    ? banks.value.filter((b) => (b.catName || '未分类') === curCat.value)
    : banks.value
  const map = new Map<string, PracticeBank[]>()
  for (const b of filtered) {
    const key = b.catName || '未分类'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(b)
  }
  return [...map.entries()].map(([catName, list]) => ({ catName, banks: list }))
})

async function loadBanks(): Promise<void> {
  try {
    banks.value = await fetchBanks()
  } catch (err) {
    console.error('【题库列表接口请求失败】', err)
  }
}

function onTapBank(b: PracticeBank): void {
  if (b.count === 0) {
    uni.showToast({ title: '该题库暂无题目', icon: 'none' })
    return
  }
  activeBank.value = b
  showSheet.value = true
}

function closeSheet(): void {
  showSheet.value = false
}

/** 从抽屉选择模式后进入练习 */
function startBank(mode: PracticeMode): void {
  const b = activeBank.value
  if (!b) return
  showSheet.value = false
  uni.navigateTo({
    url: `/pages/quiz/practice?bankId=${b.id}&mode=${mode}&count=${curCount.value}`,
  })
}

/** 同步自定义 tabBar 选中态（index=1 题库） */
function syncTab(index: number): void {
  const pages = getCurrentPages()
  const page = pages[pages.length - 1] as unknown as {
    getTabBar?: () => { setData: (d: { selected: number }) => void }
  }
  const tb = page?.getTabBar?.()
  if (tb) tb.setData({ selected: index })
}

onShow(() => {
  syncTab(1)
  void loadBanks()
})
</script>

<style scoped lang="scss">
.page {
  padding-bottom: 190rpx;
}

.filter-wrap {
  margin-top: 28rpx;
  margin-left: -40rpx;
  margin-right: -40rpx;
  padding-left: 40rpx;
}

.filter-scroll {
  width: 100%;
  white-space: nowrap;
}

.chip-row.nowrap {
  display: inline-flex;
  flex-wrap: nowrap;
  padding-right: 40rpx;
}

.chip-row.nowrap .chip {
  flex-shrink: 0;
}

.setup-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 24rpx;
  padding: 22rpx 26rpx;
}

.setup-label {
  font-size: 25rpx;
  font-weight: 600;
  color: $ink;
  flex-shrink: 0;
}

.chip.small {
  min-height: 56rpx;
  padding: 0 22rpx;
  font-size: 23rpx;
}

/* ---- 题库卡 ---- */
.bank-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 18rpx;
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx 24rpx 24rpx 30rpx;
  margin-bottom: 16rpx;
  box-shadow: $shadow-l1;
  overflow: hidden;
}

.bank-card.disabled {
  opacity: 0.58;
}

.bank-accent {
  position: absolute;
  left: 0;
  top: 24rpx;
  bottom: 24rpx;
  width: 8rpx;
  border-radius: 0 8rpx 8rpx 0;
  background: $brand-gradient;
}

.bank-main {
  flex: 1;
  min-width: 0;
}

.bank-name {
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
}

.bank-desc {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: $ink-3;
  line-height: 1.5;
}

.bank-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 12rpx;
}

.bank-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.bank-count {
  font-size: 34rpx;
  font-weight: 800;
  color: $brand-600;
  font-variant-numeric: tabular-nums;
}

.bank-unit {
  font-size: 20rpx;
  font-weight: 600;
  color: $ink-3;
  margin-left: 2rpx;
}

/* ---- 抽屉内容 ---- */
.sheet-options {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding-bottom: 12rpx;
}

.sheet-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 22rpx 20rpx;
  border-radius: $radius-md;
  background-color: $bg-soft;
}

.sheet-row-press {
  background-color: $brand-50;
}

.sheet-ic {
  width: 64rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  border-radius: 20rpx;
  font-size: 26rpx;
  font-weight: 800;
  color: #ffffff;
  flex-shrink: 0;
}

.sheet-ic.blue {
  background: $brand-gradient;
}

.sheet-ic.mint {
  background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%);
}

.sheet-info {
  flex: 1;
  min-width: 0;
}

.sheet-name {
  display: block;
  font-size: 29rpx;
  font-weight: 700;
  color: $ink;
}

.sheet-desc {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
  line-height: 1.45;
}
</style>
