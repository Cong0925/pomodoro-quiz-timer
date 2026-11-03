<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">每题独立计时 · 手动标记对错</view>
      <view class="hero-title">单题计时</view>
      <view class="hero-sub">一题一计时，练完归档到计时记录</view>
    </view>

    <!-- 分类选择 -->
    <view class="sec" v-if="cats.length">
      <view class="sec-title"><text class="sec-no">分类</text>选择练习分类</view>
      <scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
        <view class="chip-row">
          <view
            v-for="c in cats"
            :key="c.id"
            class="chip"
            :class="{ active: curCat === c.id }"
            @tap="pickCat(c)"
          >
            {{ c.name }}
          </view>
        </view>
      </scroll-view>
      <scroll-view v-if="curSubs.length" scroll-x class="chip-scroll" :show-scrollbar="false">
        <view class="chip-row">
          <view
            v-for="s in curSubs"
            :key="s.id"
            class="chip sub"
            :class="{ active: curSub === s.id }"
            @tap="curSub = s.id"
          >
            {{ s.name }}
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 计时器 -->
    <view class="timer-card">
      <view class="timer-no">第 {{ curNo }} 题</view>
      <view class="timer-display">{{ display }}</view>
      <view class="timer-total">本轮累计 {{ fmtMs(totalMs) }} · {{ items.length }} 题</view>
      <view class="timer-actions">
        <button v-if="state === 'idle'" class="btn-primary big" @tap="startTick">开始计时</button>
        <template v-else-if="state === 'running'">
          <button class="btn-ghost big" @tap="pauseTick">暂停</button>
          <button class="btn-primary big" @tap="finishItem">完成本题</button>
        </template>
        <template v-else>
          <button class="btn-primary big" @tap="resumeTick">继续</button>
        </template>
      </view>
      <button class="end-round-btn" :disabled="items.length === 0" @tap="endRound">结束本轮并归档</button>
    </view>

    <!-- 本轮记录 -->
    <view v-if="items.length" class="sec">
      <view class="sec-title"><text class="sec-no">本轮</text>逐题记录（点击修正结果）</view>
      <view class="item-list">
        <view v-for="(it, i) in items" :key="i" class="item" @tap="fixItem(i)">
          <text class="item-no">{{ it.no }}</text>
          <text class="item-ms">{{ fmtMs(it.ms) }}</text>
          <view class="item-mark" :class="it.result">{{ markText(it.result) }}</view>
        </view>
      </view>
    </view>

    <view v-if="items.length === 0 && state === 'idle'" class="empty-box slim">
      <view class="empty-title">开始第 1 题</view>
      <view class="empty-text">计时作答，完成后标记对错；可连续多题，最后统一归档</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 单题计时：每题独立计时 → 完成标记对错 → 连续下一题 → 结束统一归档
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { fetchCategories } from '@/api/categories'
import { finishTimer } from '@/api/timer'
import type { Category, SubCategory } from '@/types/category'
import type { TimerResult } from '@/types/timer'

type State = 'idle' | 'running' | 'paused'

interface Item {
  no: number
  ms: number
  result: TimerResult
}

const state = ref<State>('idle')
const curNo = ref(1)
const curMs = ref(0)
const totalMs = ref(0)
const items = ref<Item[]>([])
const cats = ref<Category[]>([])
const curCat = ref('')
const curCatName = ref('')
const curSub = ref('')
const curSubName = ref('')
let timer: ReturnType<typeof setInterval> | null = null
let baseTs = 0

const curSubs = computed<SubCategory[]>(() => {
  const c = cats.value.find((x) => x.id === curCat.value)
  return c ? c.subs : []
})
const display = computed(() => fmtMs(curMs.value))

function fmtMs(ms: number): string {
  const cs = Math.floor(ms / 10) % 100
  const totalSec = Math.floor(ms / 1000)
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return `${m}:${s}.${String(cs).padStart(2, '0')}`
}

function markText(r: TimerResult): string {
  return r === 'ok' ? '答对' : r === 'ng' ? '答错' : '跳过'
}

function startTick(): void {
  baseTs = Date.now()
  state.value = 'running'
  timer = setInterval(() => {
    curMs.value = Date.now() - baseTs
  }, 100)
}

function pauseTick(): void {
  if (timer) clearInterval(timer)
  timer = null
  state.value = 'paused'
}

function resumeTick(): void {
  baseTs = Date.now() - curMs.value
  state.value = 'running'
  timer = setInterval(() => {
    curMs.value = Date.now() - baseTs
  }, 100)
}

function stopTick(): void {
  if (timer) clearInterval(timer)
  timer = null
}

function finishItem(): void {
  stopTick()
  const ms = curMs.value
  uni.showActionSheet({
    itemList: ['答对', '答错', '跳过'],
    success: (res) => {
      const result: TimerResult = res.tapIndex === 0 ? 'ok' : res.tapIndex === 1 ? 'ng' : 'skip'
      items.value.push({ no: curNo.value, ms, result })
      totalMs.value += ms
      curNo.value += 1
      curMs.value = 0
      state.value = 'idle'
      uni.showToast({ title: `第 ${curNo.value - 1} 题已记录`, icon: 'none' })
    },
  })
}

function fixItem(i: number): void {
  const it = items.value[i]
  uni.showActionSheet({
    itemList: ['答对', '答错', '跳过'],
    success: (res) => {
      it.result = res.tapIndex === 0 ? 'ok' : res.tapIndex === 1 ? 'ng' : 'skip'
    },
  })
}

function pickCat(c: Category): void {
  curCat.value = c.id
  curCatName.value = c.name
  curSub.value = ''
  curSubName.value = ''
}

function endRound(): void {
  if (items.value.length === 0) {
    uni.showToast({ title: '还没有记录任何题目', icon: 'none' })
    return
  }
  if (state.value !== 'idle') stopTick()
  uni.showModal({
    title: '归档本轮',
    content: `共 ${items.value.length} 题，累计 ${fmtMs(totalMs.value)}，确认结束并归档？`,
    success: async (r) => {
      if (!r.confirm) return
      try {
        const res = await finishTimer({
          mode: 'single',
          title: curSubName.value ? `单题计时·${curSubName.value}` : curCatName.value ? `单题计时·${curCatName.value}` : '单题计时',
          maxCount: items.value.length,
          totalMs: totalMs.value,
          catId: curCat.value || undefined,
          catName: curCatName.value || undefined,
          subId: curSub.value || undefined,
          subName: curSubName.value || undefined,
          records: items.value,
        })
        uni.showToast({ title: `已归档 · 正确率 ${res.rate}%`, icon: 'none' })
        items.value = []
        totalMs.value = 0
        curNo.value = 1
        curMs.value = 0
        state.value = 'idle'
      } catch (err) {
        console.error('【计时归档接口请求失败】', err)
        uni.showToast({ title: '归档失败', icon: 'none' })
      }
    },
  })
}

onLoad(() => {
  fetchCategories()
    .then((res) => {
      cats.value = res
      if (res.length) pickCat(res[0])
    })
    .catch((err) => {
      console.error('【分类接口请求失败】', err)
    })
})

onUnload(() => {
  stopTick()
})
</script>

<style scoped lang="scss">
.chip-scroll { width: 100%; }
.chip-scroll .chip-row { display: inline-flex; flex-wrap: nowrap; padding-right: 24rpx; }
.chip { flex-shrink: 0; }
.chip.sub { font-size: 22rpx; padding: 6rpx 22rpx; }

.timer-card {
  background: $brand-gradient; border-radius: $radius-lg; padding: 40rpx 28rpx 32rpx;
  color: #ffffff; text-align: center; box-shadow: $shadow-btn; margin-bottom: 24rpx;
}
.timer-no { font-size: 26rpx; opacity: 0.85; }
.timer-display {
  font-size: 96rpx; font-weight: 800; font-variant-numeric: tabular-nums;
  letter-spacing: 2rpx; margin: 16rpx 0 8rpx;
}
.timer-total { font-size: 22rpx; opacity: 0.8; }
.timer-actions { display: flex; gap: 20rpx; margin-top: 32rpx; }
.timer-actions .big { flex: 1; }
.end-round-btn {
  width: 100%; height: 88rpx; line-height: 88rpx; margin-top: 22rpx; border-radius: $radius-md;
  background-color: rgba(255, 255, 255, 0.16); border: 2rpx solid rgba(255, 255, 255, 0.5);
  color: #ffffff; font-size: 29rpx; font-weight: 600;
}
.end-round-btn::after { border: none; }
.end-round-btn[disabled] { opacity: 0.45; }

.item-list { display: flex; flex-direction: column; gap: $gap-item; }
.item {
  display: flex; align-items: center; gap: 20rpx; background-color: $bg-card;
  border-radius: $radius-md; padding: 18rpx 24rpx; box-shadow: $shadow-card-sm;
}
.item-no { width: 64rpx; height: 64rpx; line-height: 64rpx; text-align: center; background-color: $brand-50; color: $brand-600; font-weight: 700; border-radius: $radius-sm; flex-shrink: 0; }
.item-ms { flex: 1; font-size: 28rpx; font-weight: 600; color: $text-main; font-variant-numeric: tabular-nums; }
.item-mark { font-size: 23rpx; color: #ffffff; border-radius: $radius-full; padding: 6rpx 22rpx; }
.item-mark.ok { background-color: $success; }
.item-mark.ng { background-color: $danger; }
.item-mark.skip { background-color: $warning; }
.empty-box.slim { padding: 60rpx 32rpx; }
</style>
