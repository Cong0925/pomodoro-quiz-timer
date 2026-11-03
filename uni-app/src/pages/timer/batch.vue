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

      <view class="sec">
        <view class="sec-title"><text class="sec-no">题数</text>本组题量</view>
        <view class="chip-row">
          <view
            v-for="c in counts"
            :key="c"
            class="chip"
            :class="{ active: count === c }"
            @tap="count = c"
          >
            {{ c }} 题
          </view>
        </view>
      </view>

      <button class="btn-primary start-btn" @tap="startGroup">开始整组计时</button>
    </template>

    <!-- 计时态 -->
    <template v-else-if="state === 'running'">
      <view class="timer-card">
        <view class="timer-no">第 {{ curNo }}/{{ count }} 题</view>
        <view class="timer-display">{{ display }}</view>
        <view class="timer-total">本组累计 {{ fmtMs(totalMs) }}</view>
        <view class="timer-actions">
          <button class="btn-ghost big" @tap="endEarly">提前结束</button>
          <button class="btn-primary big" @tap="completeItem">完成本题</button>
        </view>
      </view>
      <view class="done-list">
        <view v-for="it in items" :key="it.no" class="done-item">
          <text class="done-no">{{ it.no }}</text>
          <text class="done-ms">{{ fmtMs(it.ms) }}</text>
        </view>
      </view>
    </template>

    <!-- 标记态 -->
    <template v-else-if="state === 'marking'">
      <view class="mark-card">
        <view class="mark-title">整组完成 · {{ items.length }} 题</view>
        <view class="mark-sub">点击格子循环标记：默认答对 → 答错 → 跳过</view>
        <view class="mark-grid">
          <view
            v-for="it in items"
            :key="it.no"
            class="mark-cell"
            :class="it.result"
            @tap="cycleResult(it)"
          >
            <text class="cell-no">{{ it.no }}</text>
            <text class="cell-ms">{{ fmtMs(it.ms) }}</text>
          </view>
        </view>
        <view class="mark-actions">
          <button class="btn-ghost big" @tap="allOk">全部答对</button>
          <button class="btn-primary big" @tap="archive">归档本组</button>
        </view>
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

function fmtMs(ms: number): string {
  const cs = Math.floor(ms / 10) % 100
  const totalSec = Math.floor(ms / 1000)
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return `${m}:${s}.${String(cs).padStart(2, '0')}`
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
.start-btn { margin-top: 12rpx; }

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

.done-list { display: flex; flex-wrap: wrap; gap: 14rpx; }
.done-item {
  display: flex; align-items: center; gap: 12rpx; background-color: $bg-card;
  border-radius: $radius-sm; padding: 10rpx 18rpx; box-shadow: $shadow-card-sm;
}
.done-no { width: 48rpx; height: 48rpx; line-height: 48rpx; text-align: center; background-color: $brand-50; color: $brand-600; font-weight: 700; border-radius: $radius-sm; font-size: 23rpx; }
.done-ms { font-size: 24rpx; color: $text-sub; font-variant-numeric: tabular-nums; }

.mark-card { background-color: $bg-card; border-radius: $radius-lg; padding: 30rpx 26rpx; box-shadow: $shadow-card; }
.mark-title { font-size: 32rpx; font-weight: 800; color: $text-main; }
.mark-sub { font-size: 23rpx; color: $text-weak; margin: 8rpx 0 22rpx; }
.mark-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14rpx; }
.mark-cell {
  background-color: $bg-page; border-radius: $radius-sm; padding: 14rpx 0; text-align: center;
  border: 2rpx solid transparent;
}
.mark-cell.ok { background-color: $success-bg; border-color: $success; }
.mark-cell.ng { background-color: $danger-bg; border-color: $danger; }
.mark-cell.skip { background-color: $warning-bg; border-color: $warning; }
.cell-no { display: block; font-size: 26rpx; font-weight: 700; color: $text-main; }
.cell-ms { display: block; font-size: 20rpx; color: $text-weak; margin-top: 4rpx; font-variant-numeric: tabular-nums; }
.mark-actions { display: flex; gap: 20rpx; margin-top: 30rpx; }
.mark-actions .big { flex: 1; }
</style>
