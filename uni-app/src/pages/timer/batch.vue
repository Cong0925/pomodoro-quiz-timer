<template>
  <view class="page">
    <view class="hero">
      <view class="hero-badge">整组计时 · 结束标记错题</view>
      <view class="hero-title">整组计时</view>
      <view class="hero-sub">定题数整组计时，完成后逐题标记对错并归档</view>
    </view>

    <!-- 设置态 -->
    <template v-if="state === 'setup'">
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

      <view class="sec">
        <view class="sec-title"><text class="sec-no">题量</text>本组题量</view>
        <view class="count-grid">
          <view
            v-for="c in counts"
            :key="c"
            class="count-card"
            :class="{ active: count === c }"
            @tap="count = c"
          >
            <text class="count-num">{{ c }}</text>
            <text class="count-unit">题</text>
          </view>
        </view>
      </view>

      <view class="setup-summary">
        <view class="ss-left">
          <text class="ss-label">本组配置</text>
          <text class="ss-value">{{ curSubName || curCatName || '未选择分类' }} · {{ count }} 题</text>
        </view>
        <text class="ss-tip">计时中不能暂停</text>
      </view>

      <button class="btn-primary start-btn" @tap="startGroup">开始整组计时</button>
    </template>

    <!-- 计时态 -->
    <template v-else-if="state === 'running'">
      <view class="timer-card running">
        <view class="timer-top">
          <view class="status running">
            <view class="status-dot"></view>
            <text>计时中</text>
          </view>
          <text class="timer-no">第 {{ curNo }}/{{ count }} 题</text>
        </view>

        <view class="timer-display running">{{ display }}</view>

        <view class="run-progress">
          <view class="run-progress-inner" :style="{ width: progressPct + '%' }"></view>
        </view>

        <view class="timer-meta">
          <view class="tm-item">
            <text class="tm-num">{{ items.length }}</text>
            <text class="tm-label">已完成</text>
          </view>
          <view class="tm-line"></view>
          <view class="tm-item">
            <text class="tm-num">{{ fmtMs(totalMs + curMs) }}</text>
            <text class="tm-label">本组累计</text>
          </view>
        </view>

        <view class="timer-actions">
          <button class="btn-ghost big" @tap="endEarly">提前结束</button>
          <button class="btn-primary big" @tap="completeItem">完成本题</button>
        </view>
      </view>

      <view v-if="items.length" class="done-wrap">
        <view class="done-title">已完成 {{ items.length }}/{{ count }} 题</view>
        <view class="done-list">
          <view v-for="it in items" :key="it.no" class="done-item">
            <text class="done-no">{{ it.no }}</text>
            <text class="done-ms">{{ fmtMs(it.ms) }}</text>
          </view>
        </view>
      </view>
    </template>

    <!-- 标记态 -->
    <template v-else-if="state === 'marking'">
      <view class="mark-head">
        <view class="mark-title">整组完成</view>
        <view class="mark-sub">共 {{ items.length }} 题 · 累计 {{ fmtMs(totalMs) }} · 正确率 {{ markRate }}%</view>
        <view class="mark-stats">
          <view class="ms-item ok"><text class="ms-num">{{ markCount.ok }}</text><text class="ms-label">答对</text></view>
          <view class="ms-item ng"><text class="ms-num">{{ markCount.ng }}</text><text class="ms-label">答错</text></view>
          <view class="ms-item skip"><text class="ms-num">{{ markCount.skip }}</text><text class="ms-label">跳过</text></view>
        </view>
      </view>

      <view class="mark-card">
        <view class="mark-tip">点击格子循环标记：答对 → 答错 → 跳过</view>
        <view class="mark-grid">
          <view
            v-for="it in items"
            :key="it.no"
            class="mark-cell"
            :class="it.result"
            hover-class="press"
            @tap="cycleResult(it)"
          >
            <text class="cell-no">第 {{ it.no }} 题</text>
            <text class="cell-ms">{{ fmtMs(it.ms) }}</text>
            <text class="cell-mark">{{ markShort(it.result) }}</text>
          </view>
        </view>
      </view>

      <view class="mark-actions">
        <button class="btn-ghost big" @tap="allOk">全部答对</button>
        <button class="btn-primary big" @tap="archive">归档本组</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
/**
 * 整组计时：定题数整组计时 → 逐题完成 → 错题网格标记 → 归档
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { fetchCategories } from '@/api/categories'
import { finishTimer } from '@/api/timer'
import type { Category, SubCategory } from '@/types/category'
import type { TimerResult } from '@/types/timer'

type State = 'setup' | 'running' | 'marking'

interface Item {
  no: number
  ms: number
  result: TimerResult
}

const counts = ref([10, 15, 20])
const count = ref(10)
const state = ref<State>('setup')
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
const progressPct = computed(() => Math.min(100, Math.round((items.value.length / count.value) * 100)))

/** 标记态实时统计 */
const markCount = computed(() => ({
  ok: items.value.filter((it) => it.result === 'ok').length,
  ng: items.value.filter((it) => it.result === 'ng').length,
  skip: items.value.filter((it) => it.result === 'skip').length,
}))
const markRate = computed(() =>
  items.value.length ? Math.round((markCount.value.ok / items.value.length) * 100) : 0
)

function fmtMs(ms: number): string {
  const cs = Math.floor(ms / 10) % 100
  const totalSec = Math.floor(ms / 1000)
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return `${m}:${s}.${String(cs).padStart(2, '0')}`
}

function markShort(r: TimerResult): string {
  return r === 'ok' ? '对' : r === 'ng' ? '错' : '跳'
}

function startGroup(): void {
  items.value = []
  totalMs.value = 0
  curNo.value = 1
  curMs.value = 0
  baseTs = Date.now()
  state.value = 'running'
  timer = setInterval(() => {
    curMs.value = Date.now() - baseTs
  }, 100)
}

function completeItem(): void {
  const ms = curMs.value
  items.value.push({ no: curNo.value, ms, result: 'ok' })
  totalMs.value += ms
  if (curNo.value >= count.value) {
    stopTick()
    state.value = 'marking'
    return
  }
  curNo.value += 1
  curMs.value = 0
  baseTs = Date.now()
}

function endEarly(): void {
  if (items.value.length === 0) {
    uni.showToast({ title: '还没有完成任何题目', icon: 'none' })
    return
  }
  stopTick()
  state.value = 'marking'
}

function stopTick(): void {
  if (timer) clearInterval(timer)
  timer = null
}

function cycleResult(it: Item): void {
  it.result = it.result === 'ok' ? 'ng' : it.result === 'ng' ? 'skip' : 'ok'
}

function allOk(): void {
  items.value.forEach((it) => (it.result = 'ok'))
}

async function archive(): Promise<void> {
  if (items.value.length === 0) return
  const correct = items.value.filter((it) => it.result === 'ok').length
  uni.showModal({
    title: '归档本组',
    content: `共 ${items.value.length} 题，答对 ${correct} 题，累计 ${fmtMs(totalMs.value)}，确认归档？`,
    success: async (r) => {
      if (!r.confirm) return
      try {
        const res = await finishTimer({
          mode: 'batch',
          title: curSubName.value ? `整组计时·${curSubName.value}` : curCatName.value ? `整组计时·${curCatName.value}` : '整组计时',
          maxCount: count.value,
          totalMs: totalMs.value,
          catId: curCat.value || undefined,
          catName: curCatName.value || undefined,
          subId: curSub.value || undefined,
          subName: curSubName.value || undefined,
          records: items.value,
        })
        uni.showToast({ title: `已归档 · 正确率 ${res.rate}%`, icon: 'none' })
        state.value = 'setup'
      } catch (err) {
        console.error('【计时归档接口请求失败】', err)
        uni.showToast({ title: '归档失败', icon: 'none' })
      }
    },
  })
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

/* ---- 题量选择 ---- */
.count-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16rpx;
}

.count-card {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4rpx;
  padding: 22rpx 0;
  border-radius: $radius-md;
  background-color: $bg-card;
  border: 2rpx solid transparent;
  box-shadow: $shadow-l1;
}

.count-card.active {
  border-color: $brand-600;
  background: linear-gradient(160deg, #ffffff 0%, #f2f8ff 100%);
  box-shadow: 0 10rpx 24rpx rgba(47, 107, 255, 0.16);
}

.count-num {
  font-size: 40rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.count-card.active .count-num {
  color: $brand-600;
}

.count-unit {
  font-size: 21rpx;
  color: $ink-3;
}

/* ---- 配置摘要 ---- */
.setup-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-top: 28rpx;
  padding: 20rpx 24rpx;
  border-radius: $radius-md;
  background-color: $bg-card;
  border-left: 8rpx solid $brand-500;
  box-shadow: $shadow-l1;
}

.ss-label {
  display: block;
  font-size: 20rpx;
  color: $ink-3;
  margin-bottom: 4rpx;
}

.ss-value {
  font-size: 26rpx;
  font-weight: 700;
  color: $ink;
}

.ss-tip {
  font-size: 20rpx;
  color: $ink-3;
  flex-shrink: 0;
}

.start-btn {
  margin-top: 22rpx;
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

.timer-card.running::before {
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
  background-color: $brand-50;
  color: $brand-600;
  font-size: 21rpx;
  font-weight: 600;
}

.status-dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: $brand-600;
  animation: breathe 1.4s ease-in-out infinite;
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
  color: $brand-600;
  font-variant-numeric: tabular-nums;
}

.run-progress {
  height: 10rpx;
  margin-top: 22rpx;
  border-radius: $radius-full;
  background-color: $line;
  overflow: hidden;
}

.run-progress-inner {
  height: 100%;
  border-radius: $radius-full;
  background: $brand-gradient;
  transition: width 0.2s ease;
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

/* ---- 已完成列表 ---- */
.done-wrap {
  margin-top: 24rpx;
}

.done-title {
  font-size: 24rpx;
  color: $ink-2;
  font-weight: 600;
  margin-bottom: 12rpx;
}

.done-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.done-item {
  display: flex;
  align-items: center;
  gap: 10rpx;
  background-color: $bg-card;
  border-radius: $radius-full;
  padding: 8rpx 18rpx 8rpx 8rpx;
  box-shadow: $shadow-l1;
}

.done-no {
  width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  border-radius: 50%;
  background-color: $brand-50;
  color: $brand-600;
  font-size: 21rpx;
  font-weight: 700;
}

.done-ms {
  font-size: 22rpx;
  color: $ink-2;
  font-variant-numeric: tabular-nums;
}

/* ---- 标记态 ---- */
.mark-head {
  background: $brand-gradient;
  border-radius: $radius-lg;
  padding: 30rpx 28rpx;
  box-shadow: $shadow-glow;
}

.mark-title {
  font-size: 38rpx;
  font-weight: 800;
  color: #ffffff;
}

.mark-sub {
  margin-top: 6rpx;
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.84);
}

.mark-stats {
  display: flex;
  gap: 14rpx;
  margin-top: 20rpx;
}

.ms-item {
  flex: 1;
  background-color: rgba(255, 255, 255, 0.16);
  border-radius: $radius-sm;
  padding: 14rpx 0;
  text-align: center;
}

.ms-num {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
}

.ms-label {
  font-size: 20rpx;
  color: rgba(255, 255, 255, 0.8);
}

.mark-card {
  margin-top: 24rpx;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 26rpx;
  box-shadow: $shadow-l2;
}

.mark-tip {
  font-size: 21rpx;
  color: $ink-3;
  margin-bottom: 18rpx;
}

.mark-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12rpx;
}

.mark-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  border-radius: $radius-sm;
  padding: 14rpx 6rpx;
  background-color: $bg-soft;
  border: 2rpx solid transparent;
}

.mark-cell.ok {
  background-color: $success-bg;
  border-color: $success;
}

.mark-cell.ng {
  background-color: $danger-bg;
  border-color: $danger;
}

.mark-cell.skip {
  background-color: $warning-bg;
  border-color: $warning;
}

.cell-no {
  font-size: 21rpx;
  color: $ink-2;
}

.cell-ms {
  font-size: 19rpx;
  color: $ink-3;
  font-variant-numeric: tabular-nums;
}

.cell-mark {
  font-size: 24rpx;
  font-weight: 800;
  color: $ink;
}

.mark-cell.ok .cell-mark {
  color: $success;
}

.mark-cell.ng .cell-mark {
  color: $danger;
}

.mark-cell.skip .cell-mark {
  color: $warning;
}

.mark-actions {
  display: flex;
  gap: 18rpx;
  margin-top: 24rpx;
}

.mark-actions .big {
  flex: 1;
}
</style>
