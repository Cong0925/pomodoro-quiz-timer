<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">每题独立计时 · 手动标记对错</view>
      <view class="hero-title">单题计时</view>
      <view class="hero-sub">一题一计时，练完统一归档到计时记录</view>
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
      <scroll-view v-if="curSubs.length" scroll-x class="chip-scroll sub-scroll" :show-scrollbar="false">
        <view class="chip-row">
          <view
            v-for="s in curSubs"
            :key="s.id"
            class="chip sub"
            :class="{ active: curSub === s.id }"
            @tap="pickSub(s)"
          >
            {{ s.name }}
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 计时器 -->
    <view class="timer-card" :class="state">
      <view class="timer-top">
        <view class="status" :class="state">
          <view class="status-dot"></view>
          <text>{{ statusText }}</text>
        </view>
        <text class="timer-no">第 {{ curNo }} 题</text>
      </view>

      <view class="timer-display" :class="state">{{ display }}</view>

      <view class="timer-meta">
        <view class="tm-item">
          <text class="tm-num">{{ items.length }}</text>
          <text class="tm-label">本轮题数</text>
        </view>
        <view class="tm-line"></view>
        <view class="tm-item">
          <text class="tm-num">{{ fmtMs(totalMs) }}</text>
          <text class="tm-label">本轮累计</text>
        </view>
      </view>

      <view class="timer-actions">
        <button v-if="state === 'idle'" class="btn-primary big" @tap="startTick">开始计时</button>
        <template v-else-if="state === 'running'">
          <button class="btn-ghost big" @tap="pauseTick">暂停</button>
          <button class="btn-primary big" @tap="finishItem">完成本题</button>
        </template>
        <template v-else>
          <button class="btn-primary big" @tap="resumeTick">继续计时</button>
        </template>
      </view>
      <view class="end-round-btn" :class="{ disabled: items.length === 0 }" @tap="endRound">结束本轮并归档</view>
    </view>

    <!-- 本轮记录 -->
    <view v-if="items.length" class="sec">
      <view class="sec-title">
        <text class="sec-no">本轮</text>逐题记录
        <text class="sec-link">点击可修正</text>
      </view>
      <view class="item-grid">
        <view
          v-for="(it, i) in items"
          :key="i"
          class="item"
          :class="it.result"
          hover-class="press"
          @tap="fixItem(i)"
        >
          <view class="item-top">
            <text class="item-no">第 {{ it.no }} 题</text>
            <text class="item-mark" :class="it.result">{{ markText(it.result) }}</text>
          </view>
          <text class="item-ms">{{ fmtMs(it.ms) }}</text>
        </view>
      </view>
    </view>

    <view v-if="items.length === 0 && state === 'idle'" class="empty-box slim">
      <view class="empty-title">还没有计时记录</view>
      <view class="empty-text">点击上方「开始计时」，答完一题标记对错；可连续多题，最后统一归档</view>
    </view>

    <!-- 结果选择抽屉 -->
    <AppSheet :show="showSheet" :title="sheetTitle" :subtitle="sheetSub" @close="closeSheet">
      <view class="sheet-options">
        <view class="sheet-row" hover-class="sheet-row-press" @tap="chooseResult('ok')">
          <view class="sheet-ic ok">✓</view>
          <view class="sheet-info">
            <text class="sheet-name">答对</text>
            <text class="sheet-desc">计入本轮正确率</text>
          </view>
          <view class="entry-arrow"></view>
        </view>
        <view class="sheet-row" hover-class="sheet-row-press" @tap="chooseResult('ng')">
          <view class="sheet-ic ng">✕</view>
          <view class="sheet-info">
            <text class="sheet-name">答错</text>
            <text class="sheet-desc">标记为错题，归档后影响正确率</text>
          </view>
          <view class="entry-arrow"></view>
        </view>
        <view class="sheet-row" hover-class="sheet-row-press" @tap="chooseResult('skip')">
          <view class="sheet-ic skip">○</view>
          <view class="sheet-info">
            <text class="sheet-name">跳过</text>
            <text class="sheet-desc">本题不计对错，仅记录用时</text>
          </view>
          <view class="entry-arrow"></view>
        </view>
      </view>
    </AppSheet>
  </view>
</template>

<script setup lang="ts">
/**
 * 单题计时：每题独立计时 → 完成标记对错 → 连续下一题 → 结束统一归档
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import AppSheet from '@/components/AppSheet.vue'
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

/* ---- 结果抽屉 ---- */
const showSheet = ref(false)
const sheetMode = ref<'finish' | 'fix'>('finish')
const fixIndex = ref<number | null>(null)
const pendingMs = ref(0)

const curSubs = computed<SubCategory[]>(() => {
  const c = cats.value.find((x) => x.id === curCat.value)
  return c ? c.subs : []
})
const display = computed(() => fmtMs(curMs.value))

const statusText = computed(() =>
  state.value === 'running' ? '计时中' : state.value === 'paused' ? '已暂停' : '待开始'
)

const sheetTitle = computed(() =>
  sheetMode.value === 'finish' ? `第 ${curNo.value} 题 · ${fmtMs(pendingMs.value)}` : '修正本题结果'
)
const sheetSub = computed(() =>
  sheetMode.value === 'finish' ? '选择本题作答结果' : '重新标记后立即生效'
)

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

/** 完成本题：先暂停计时，弹结果抽屉；抽屉关闭未选则保持暂停，可继续计时重新完成 */
function finishItem(): void {
  stopTick()
  pendingMs.value = curMs.value
  state.value = 'paused'
  sheetMode.value = 'finish'
  fixIndex.value = null
  showSheet.value = true
}

function fixItem(i: number): void {
  sheetMode.value = 'fix'
  fixIndex.value = i
  pendingMs.value = items.value[i].ms
  showSheet.value = true
}

function closeSheet(): void {
  showSheet.value = false
}

/** 抽屉选择结果：完成本题 / 修正历史记录 */
function chooseResult(result: TimerResult): void {
  if (sheetMode.value === 'fix') {
    const i = fixIndex.value
    if (i !== null && items.value[i]) items.value[i].result = result
    showSheet.value = false
    return
  }
  items.value.push({ no: curNo.value, ms: pendingMs.value, result })
  totalMs.value += pendingMs.value
  const no = curNo.value
  curNo.value += 1
  curMs.value = 0
  state.value = 'idle'
  showSheet.value = false
  uni.showToast({ title: `第 ${no} 题已记录`, icon: 'none' })
}

function pickCat(c: Category): void {
  curCat.value = c.id
  curCatName.value = c.name
  curSub.value = ''
  curSubName.value = ''
}

function pickSub(s: SubCategory): void {
  curSub.value = s.id
  curSubName.value = s.name
}

function endRound(): void {
  if (items.value.length === 0) {
    uni.showToast({ title: '还没有记录任何题目', icon: 'none' })
    return
  }
  const wasRunning = state.value === 'running'
  if (state.value !== 'idle') stopTick()
  uni.showModal({
    title: '归档本轮',
    content: `共 ${items.value.length} 题，累计 ${fmtMs(totalMs.value)}，确认结束并归档？`,
    success: async (r) => {
      if (!r.confirm) {
        // 取消归档：原本计时中的话转为暂停，等用户手动继续，避免出现“计时中但数字不动”
        if (wasRunning) state.value = 'paused'
        return
      }
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
.page {
  padding-bottom: 80rpx;
}

.chip-scroll {
  width: 100%;
}

.chip-scroll .chip-row {
  display: inline-flex;
  flex-wrap: nowrap;
  padding-right: 96rpx;
}

.chip {
  flex-shrink: 0;
}

.chip.sub {
  font-size: 22rpx;
}

.sub-scroll {
  margin-top: 12rpx;
}

/* ---- 计时卡 ---- */
.timer-card {
  position: relative;
  margin-top: 24rpx;
  background-color: $bg-card;
  border-radius: $radius-xl;
  padding: 32rpx 28rpx 26rpx;
  box-shadow: $shadow-l2;
  overflow: hidden;
}

.timer-card.running::before,
.timer-card.paused::before {
  content: '';
  position: absolute;
  top: -140rpx;
  right: -120rpx;
  width: 380rpx;
  height: 380rpx;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(47, 107, 255, 0.16) 0%, rgba(47, 107, 255, 0) 68%);
  pointer-events: none;
}

.timer-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 18rpx;
  border-radius: $radius-full;
  background-color: $bg-soft;
  font-size: 21rpx;
  color: $ink-3;
}

.status.running {
  background-color: $brand-50;
  color: $brand-600;
  font-weight: 600;
}

.status.paused {
  background-color: $amber-bg;
  color: $amber;
  font-weight: 600;
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: $ink-3;
}

.status.running .status-dot {
  background-color: $brand-600;
  animation: breathe 1.4s ease-in-out infinite;
}

.status.paused .status-dot {
  background-color: $amber;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}

.timer-no {
  font-size: 22rpx;
  color: $ink-3;
}

.timer-display {
  margin-top: 26rpx;
  text-align: center;
  font-size: 100rpx;
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: 2rpx;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.timer-display.running {
  color: $brand-600;
}

.timer-meta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 36rpx;
  margin-top: 20rpx;
}

.tm-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2rpx;
}

.tm-num {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.tm-label {
  font-size: 20rpx;
  color: $ink-3;
}

.tm-line {
  width: 1rpx;
  height: 40rpx;
  background-color: $line;
}

.timer-actions {
  display: flex;
  gap: 18rpx;
  margin-top: 30rpx;
}

.timer-actions .big {
  flex: 1;
}

.end-round-btn {
  margin-top: 18rpx;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  border-radius: $radius-md;
  background-color: $bg-soft;
  color: $ink-2;
  font-size: 27rpx;
  font-weight: 600;
}

.end-round-btn.disabled {
  opacity: 0.45;
}

/* ---- 逐题记录 ---- */
.item-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.item {
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 18rpx 20rpx;
  box-shadow: $shadow-l1;
  border-left: 8rpx solid $line;
}

.item.ok {
  border-left-color: $success;
}

.item.ng {
  border-left-color: $danger;
}

.item.skip {
  border-left-color: $warning;
}

.item-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10rpx;
}

.item-no {
  font-size: 22rpx;
  color: $ink-3;
}

.item-mark {
  font-size: 20rpx;
  border-radius: $radius-full;
  padding: 3rpx 14rpx;
  color: #ffffff;
}

.item-mark.ok {
  background-color: $success;
}

.item-mark.ng {
  background-color: $danger;
}

.item-mark.skip {
  background-color: $warning;
}

.item-ms {
  display: block;
  margin-top: 8rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.empty-box.slim {
  padding: 60rpx 32rpx;
}

/* ---- 抽屉 ---- */
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
  font-size: 28rpx;
  font-weight: 800;
  color: #ffffff;
  flex-shrink: 0;
}

.sheet-ic.ok {
  background-color: $success;
}

.sheet-ic.ng {
  background-color: $danger;
}

.sheet-ic.skip {
  background-color: $warning;
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
}
</style>
