<template>
  <view class="page">
    <view v-if="loading" class="load-tip">加载中…</view>

    <template v-else-if="detail">
      <!-- 会话概览 -->
      <view class="overview">
        <view class="ov-top">
          <text class="tag brand">{{ modeLabel }}</text>
          <text class="ov-time">{{ fmtTime(detail.session.finished_at || detail.session.started_at) }}</text>
        </view>
        <text class="ov-name">{{ detail.session.bank_name }}</text>
        <view class="ov-tags">
          <text v-if="detail.session.cat_name" class="tag">{{ detail.session.cat_name }}</text>
          <text v-if="detail.session.sub_name" class="tag">{{ detail.session.sub_name }}</text>
        </view>

        <view class="ov-main">
          <view class="ring ov-ring" :style="{ background: ringBg(detail.session.rate) }">
            <view class="ring-inner ov-ring-inner">
              <text class="ov-rate">{{ detail.session.rate }}<text class="ov-pct">%</text></text>
              <text class="ov-label">正确率</text>
            </view>
          </view>

          <view class="ov-grid">
            <view class="ov-cell">
              <text class="ov-num">{{ detail.session.total_count }}</text>
              <text class="ov-cell-label">题量</text>
            </view>
            <view class="ov-cell">
              <text class="ov-num ok">{{ detail.session.correct_count }}</text>
              <text class="ov-cell-label">答对</text>
            </view>
            <view class="ov-cell">
              <text class="ov-num ng">{{ detail.session.wrong_count }}</text>
              <text class="ov-cell-label">答错</text>
            </view>
            <view class="ov-cell">
              <text class="ov-num sk">{{ detail.session.skipped_count }}</text>
              <text class="ov-cell-label">跳过</text>
            </view>
          </view>
        </view>

        <text class="ov-foot">用时 {{ fmtMs(detail.session.total_ms) }}</text>
      </view>

      <button v-if="wrongCount > 0" class="btn-primary replay-btn" @tap="doReplay">
        错题重练（{{ wrongCount }} 题）
      </button>

      <!-- 题目明细 -->
      <view class="sec">
        <view class="sec-title"><text class="sec-no">明细</text>逐题回顾</view>
        <view v-for="r in detail.records" :key="r.no" class="q-card" :class="'s-' + r.result">
          <view class="q-head">
            <text class="q-no">第 {{ r.no }} 题</text>
            <text class="q-mark" :class="r.result">{{ markText(r.result) }}</text>
          </view>
          <view class="q-stem">{{ r.stem }}</view>
          <image
            v-for="(img, i) in parseImgs(r.stemImg)"
            :key="i"
            class="q-img"
            :src="img"
            mode="widthFix"
          />
          <view v-if="r.options && r.options.length" class="q-opts">
            <view v-for="(o, i) in r.options" :key="i" class="q-opt">
              <text class="q-opt-label">{{ letter(i) }}</text>
              <text class="q-opt-text">{{ optText(o) }}</text>
              <image v-if="optImg(o)" class="q-opt-img" :src="optImg(o)" mode="widthFix" />
            </view>
          </view>
          <view class="q-ans">
            <view
              v-if="r.result !== 'skip'"
              class="qa-line"
              :class="r.result === 'ok' ? 'qa-ok' : 'qa-ng'"
            >你的答案：{{ r.userAnswer || '—' }}</view>
            <view class="qa-line qa-correct">正确答案：{{ r.correctAnswer }}</view>
          </view>
          <view v-if="r.analysis" class="q-tip">{{ r.analysis }}</view>
        </view>
      </view>
    </template>

    <view v-else class="empty-box">
      <view class="empty-title">记录不存在或已删除</view>
      <view class="empty-text">返回记录列表查看其他场次</view>
    </view>
  </view>
</template>

<script setup lang="ts">
/**
 * 练习记录详情：会话概览（环形正确率）+ 逐题回顾（题干/选项/你的答案/解析）+ 错题重练
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { fetchPracticeHistoryDetail, replayErrors } from '@/api/practice'
import type { PracticeHistoryDetail } from '@/types/practice'

const loading = ref(true)
const detail = ref<PracticeHistoryDetail | null>(null)

const modeLabel = computed(() => {
  const m = detail.value?.session.mode
  return m === 'random' ? '随机练习' : m === 'review' ? '错题重练' : '顺序练习'
})
const wrongCount = computed(
  () => detail.value?.session.wrong_count || 0
)

/** 正确率环 */
function ringBg(rate: number): string {
  const r = Math.max(0, Math.min(100, rate))
  const deg = r * 3.6
  return `conic-gradient(from -90deg, #4f86ff 0deg, #2f6bff ${deg}deg, #e8eef7 ${deg}deg 360deg)`
}

function letter(i: number): string {
  return String.fromCharCode(65 + i)
}

function optText(o: string | { text?: string; img?: string }): string {
  return typeof o === 'string' ? o : o.text || ''
}

function optImg(o: string | { text?: string; img?: string }): string {
  return typeof o === 'string' ? '' : o.img || ''
}

function markText(r: string): string {
  return r === 'ok' ? '正确' : r === 'ng' ? '错误' : '跳过'
}

function parseImgs(raw: string[] | null): string[] {
  return raw || []
}

function fmtTime(s: string): string {
  if (!s) return ''
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = String(Math.floor(totalSec / 60)).padStart(2, '0')
  const s = String(totalSec % 60).padStart(2, '0')
  return `${m}:${s}`
}

async function doReplay(): Promise<void> {
  const id = detail.value?.session.id
  if (!id) return
  uni.showLoading({ title: '生成错题重练…' })
  try {
    const res = await replayErrors(id)
    // 题目经本地缓存中转给练习页
    uni.setStorageSync('quiz_replay', {
      sessionId: res.sessionId,
      questions: res.questions,
      bank: res.bank,
      mode: res.mode,
    })
    uni.hideLoading()
    uni.navigateTo({ url: `/pages/quiz/practice?sessionId=${res.sessionId}` })
  } catch (err) {
    uni.hideLoading()
    console.error('【错题重练接口请求失败】', err)
    uni.showToast({ title: '重练生成失败', icon: 'none' })
  }
}

onLoad((query) => {
  const id = Number(query?.id)
  if (!id) {
    loading.value = false
    return
  }
  fetchPracticeHistoryDetail(id)
    .then((res) => {
      detail.value = res
    })
    .catch((err) => {
      console.error('【练习记录详情接口请求失败】', err)
    })
    .finally(() => {
      loading.value = false
    })
})
</script>

<style scoped lang="scss">
.load-tip {
  padding: 160rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: $ink-3;
}

/* ---- 概览 ---- */
.overview {
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  box-shadow: $shadow-l2;
}

.ov-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.ov-time {
  font-size: 21rpx;
  color: $ink-3;
}

.ov-name {
  display: block;
  margin-top: 14rpx;
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
  letter-spacing: -0.3rpx;
}

.ov-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 10rpx;
}

.ov-main {
  display: flex;
  align-items: center;
  gap: 26rpx;
  margin-top: 24rpx;
}

.ov-ring {
  width: 176rpx;
  height: 176rpx;
  padding: 14rpx;
  box-sizing: border-box;
}

.ov-ring-inner {
  width: 100%;
  height: 100%;
}

.ov-rate {
  font-size: 48rpx;
  font-weight: 800;
  line-height: 1;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.ov-pct {
  font-size: 22rpx;
  font-weight: 700;
  color: $brand-600;
}

.ov-label {
  margin-top: 6rpx;
  font-size: 20rpx;
  color: $ink-3;
}

.ov-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.ov-cell {
  background-color: $bg-soft;
  border-radius: $radius-sm;
  padding: 14rpx 18rpx;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.ov-num {
  font-size: 30rpx;
  font-weight: 800;
  color: $ink;
  font-variant-numeric: tabular-nums;
}

.ov-num.ok {
  color: $success;
}

.ov-num.ng {
  color: $danger;
}

.ov-num.sk {
  color: $warning;
}

.ov-cell-label {
  font-size: 20rpx;
  color: $ink-3;
}

.ov-foot {
  display: block;
  margin-top: 18rpx;
  text-align: center;
  font-size: 22rpx;
  color: $ink-3;
}

.replay-btn {
  margin-top: 20rpx;
}

/* ---- 逐题回顾 ---- */
.q-card {
  background-color: $bg-card;
  border-radius: $radius-md;
  padding: 24rpx 26rpx;
  margin-bottom: 18rpx;
  box-shadow: $shadow-l1;
  border-left: 8rpx solid transparent;
}

.q-card.s-ok {
  border-left-color: $success;
}

.q-card.s-ng {
  border-left-color: $danger;
}

.q-card.s-skip {
  border-left-color: $warning;
}

.q-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.q-no {
  font-size: 24rpx;
  color: $ink-2;
  font-weight: 600;
}

.q-mark {
  font-size: 20rpx;
  border-radius: $radius-full;
  padding: 4rpx 16rpx;
  color: #ffffff;
}

.q-mark.ok {
  background-color: $success;
}

.q-mark.ng {
  background-color: $danger;
}

.q-mark.skip {
  background-color: $warning;
}

.q-stem {
  font-size: 27rpx;
  line-height: 1.6;
  color: $ink;
  margin-bottom: 14rpx;
}

.q-img {
  width: 100%;
  border-radius: $radius-sm;
  margin-bottom: 14rpx;
  display: block;
}

.q-opts {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  margin-bottom: 14rpx;
}

.q-opt {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.q-opt-label {
  width: 44rpx;
  height: 44rpx;
  line-height: 44rpx;
  text-align: center;
  border-radius: 50%;
  background-color: $brand-50;
  color: $brand-600;
  font-size: 20rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.q-opt-text {
  font-size: 25rpx;
  color: $ink-2;
  min-width: 0;
}

.q-opt-img {
  width: 160rpx;
  border-radius: $radius-xs;
  flex-shrink: 0;
}

.q-ans {
  background-color: $bg-soft;
  border-radius: $radius-sm;
  padding: 14rpx 18rpx;
  margin-bottom: 12rpx;
}

.qa-line {
  font-size: 22rpx;
  color: $ink-2;
  line-height: 1.6;
}

.qa-ok {
  color: $success;
}

.qa-ng {
  color: $danger;
}

.qa-correct {
  color: $success;
  font-weight: 600;
}

.q-tip {
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.6;
  background-color: $brand-50;
  border-radius: $radius-sm;
  padding: 14rpx 18rpx;
}
</style>
