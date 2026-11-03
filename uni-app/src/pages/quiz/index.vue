<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">专项题库 · {{ loadedCount }} 题</view>
      <view class="hero-title">题库练习</view>
      <view class="hero-sub">按大类分类浏览 · 顺序或随机抽题</view>
    </view>

    <!-- 题量选择 -->
    <view class="sec">
      <view class="sec-title"><text class="sec-no">01</text>抽题数量</view>
      <view class="chip-row">
        <view
          v-for="c in counts"
          :key="c.value"
          class="chip"
          :class="{ active: curCount === c.value }"
          @tap="curCount = c.value"
        >
          {{ c.label }}
        </view>
      </view>
    </view>

    <!-- 题库列表（按大类分组） -->
    <view v-if="grouped.length" class="sec" v-for="g in grouped" :key="g.catName">
      <view class="sec-title">
        <text class="sec-no">{{ g.catName }}</text>
        <text class="sec-count">{{ g.banks.length }} 个题库</text>
      </view>
      <view
        v-for="b in g.banks"
        :key="b.id"
        class="bank-card"
        :class="{ disabled: b.count === 0 }"
        @tap="onTapBank(b)"
      >
        <view class="bank-main">
          <view class="bank-name">{{ b.name }}</view>
          <view class="bank-desc" v-if="b.description">{{ b.description }}</view>
          <view class="bank-tags">
            <text v-if="b.subName" class="bank-tag">{{ b.subName }}</text>
            <text class="bank-tag count">{{ b.count }} 题</text>
            <text v-if="b.count === 0" class="bank-tag empty">暂无题目</text>
          </view>
        </view>
        <view v-if="b.count > 0" class="entry-arrow"></view>
      </view>
    </view>

    <view v-else class="empty-box">
      <view class="empty-title">暂无题库</view>
      <view class="empty-text">请在网页端「题库管理」中创建题库并录入题目</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 题库页：题数选择 + 按大类分组的题库列表；点题库选顺序/随机进入练习
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchBanks } from '@/api/practice'
import type { PracticeBank } from '@/types/practice'

const counts = ref([
  { value: 10, label: '10 题' },
  { value: 20, label: '20 题' },
  { value: 50, label: '50 题' },
])
const curCount = ref(10)
const banks = ref<PracticeBank[]>([])
const loaded = ref(false)

const loadedCount = computed(() => banks.value.reduce((s, b) => s + b.count, 0))

/** 按大类名分组（保持大类出现顺序） */
const grouped = computed(() => {
  const map = new Map<string, PracticeBank[]>()
  for (const b of banks.value) {
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
  } finally {
    loaded.value = true
  }
}

function onTapBank(b: PracticeBank): void {
  if (b.count === 0) {
    uni.showToast({ title: '该题库暂无题目', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: ['顺序练习', '随机练习'],
    success: (res) => {
      const mode = res.tapIndex === 0 ? 'order' : 'random'
      uni.navigateTo({
        url: `/pages/quiz/practice?bankId=${b.id}&mode=${mode}&count=${curCount.value}`,
      })
    },
  })
}

onShow(() => {
  void loadBanks()
})
</script>

<style scoped lang="scss">
.sec-count {
  font-size: 22rpx;
  color: $text-weak;
  font-weight: 400;
  margin-left: 12rpx;
}

.bank-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx;
  margin-bottom: $gap-item;
  box-shadow: $shadow-card-sm;
}

.bank-card.disabled {
  opacity: 0.6;
}

.bank-main {
  flex: 1;
  min-width: 0;
}

.bank-name {
  font-size: 29rpx;
  font-weight: 700;
  color: $text-main;
}

.bank-desc {
  font-size: 23rpx;
  color: $text-weak;
  margin-top: 6rpx;
  line-height: 1.5;
}

.bank-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 12rpx;
}

.bank-tag {
  font-size: 21rpx;
  color: $brand-600;
  background-color: $brand-50;
  border-radius: $radius-full;
  padding: 4rpx 16rpx;
}

.bank-tag.count {
  color: $text-sub;
  background-color: #f1f5f9;
}

.bank-tag.empty {
  color: $warning;
  background-color: $warning-bg;
}
</style>
