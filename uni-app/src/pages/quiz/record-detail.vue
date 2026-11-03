<template>
  <view class="page">
    <view v-if="loading" class="center-box"><text class="center-text">加载中…</text></view>

    <template v-else-if="detail">
      <!-- 会话概览 -->
      <view class="overview">
        <view class="ov-badge">{{ modeLabel }}</view>
        <view class="ov-name">{{ detail.session.bank_name }}</view>
        <view class="ov-tags">
          <text v-if="detail.session.cat_name" class="ov-tag">{{ detail.session.cat_name }}</text>
          <text v-if="detail.session.sub_name" class="ov-tag">{{ detail.session.sub_name }}</text>
        </view>
        <view class="ov-stats">
          <view class="ov-cell">
            <view class="ov-num">{{ detail.session.rate }}%</view>
            <view class="ov-label">正确率</view>
          </view>
          <view class="ov-cell">
            <view class="ov-num">{{ detail.session.total_count }}</view>
            <view class="ov-label">题量</view>
          </view>
          <view class="ov-cell">
            <view class="ov-num ok">{{ detail.session.correct_count }}</view>
            <view class="ov-label">答对</view>
          </view>
          <view class="ov-cell">
            <view class="ov-num ng">{{ detail.session.wrong_count }}</view>
            <view class="ov-label">答错</view>
          </view>
          <view class="ov-cell">
            <view class="ov-num sk">{{ detail.session.skipped_count }}</view>
            <view class="ov-label">跳过</view>
          </view>
        </view>
        <view class="ov-time">{{ fmtTime(detail.session.finished_at || detail.session.started_at) }} · 用时 {{ fmtMs(detail.session.total_ms) }}</view>
      </view>

      <button
        v-if="wrongCount > 0"
        class="btn-primary replay-btn"
        @tap="doReplay"
      >
        错题重练（{{ wrongCount }} 题）
      </button>

      <!-- 题目明细 -->
      <view class="sec">
        <view class="sec-title"><text class="sec-no">明细</text>逐题回顾</view>
        <view v-for="r in detail.records" :key="r.no" class="q-card" :class="'s-' + r.result">
          <view class="q-head">
            <text class="q-no">第 {{ r.no }} 题</text>
            <view class="q-mark" :class="r.result">{{ markText(r.result) }}</view>
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
            </view>
          </view>
          <view class="q-ans">
            <view v-if="r.result !== 'skip'" class="qa-line">你的答案：{{ r.userAnswer || '—' }}</view>
            <view class="qa-line">正确答案：{{ r.correctAnswer }}</view>
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
 * 练习记录详情：会话概览 + 逐题回顾（题干/选项/你的答案/解析）+ 错题重练
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

function letter(i: number): string {
  return String.fromCharCode(65 + i)
}

function optText(o: string | { text?: string }): string {
  return typeof o === 'string' ? o : o.text || ''
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
.center-box { padding: 200rpx 32rpx; display: flex; flex-direction: column; align-items: center; }
.center-text { font-size: 27rpx; color: $text-sub; }

.overview {
  background: $brand-gradient; border-radius: $radius-lg; padding: 30rpx 28rpx;
  color: #ffffff; box-shadow: $shadow-btn; margin-bottom: 20rpx;
}
.ov-badge {
  display: inline-block; font-size: 21rpx; background-color: rgba(255, 255, 255, 0.18);
  border-radius: $radius-full; padding: 4rpx 18rpx; margin-bottom: 10rpx;
}
.ov-name { font-size: 33rpx; font-weight: 800; }
.ov-tags { display: flex; gap: 12rpx; margin-top: 8rpx; }
.ov-tag { font-size: 21rpx; background-color: rgba(255, 255, 255, 0.14); border-radius: $radius-full; padding: 2rpx 14rpx; }
.ov-stats { display: flex; justify-content: space-between; margin-top: 26rpx; }
.ov-cell { text-align: center; flex: 1; }
.ov-num { font-size: 34rpx; font-weight: 800; }
.ov-num.ok { color: #bbf7d0; }
.ov-num.ng { color: #fecaca; }
.ov-num.sk { color: #fde68a; }
.ov-label { font-size: 21rpx; opacity: 0.75; margin-top: 4rpx; }
.ov-time { font-size: 22rpx; opacity: 0.8; margin-top: 20rpx; text-align: center; }

.replay-btn { margin-bottom: 24rpx; }

.q-card {
  background-color: $bg-card; border-radius: $radius-md; padding: 24rpx 26rpx; margin-bottom: $gap-item;
  box-shadow: $shadow-card-sm; border-left: 8rpx solid transparent;
}
.q-card.s-ok { border-left-color: $success; }
.q-card.s-ng { border-left-color: $danger; }
.q-card.s-skip { border-left-color: $warning; }
.q-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.q-no { font-size: 25rpx; color: $text-sub; font-weight: 600; }
.q-mark { font-size: 22rpx; border-radius: $radius-full; padding: 4rpx 18rpx; color: #ffffff; }
.q-mark.ok { background-color: $success; }
.q-mark.ng { background-color: $danger; }
.q-mark.skip { background-color: $warning; }
.q-stem { font-size: 28rpx; line-height: 1.55; color: $text-main; margin-bottom: 14rpx; }
.q-img { width: 100%; border-radius: $radius-sm; margin-bottom: 14rpx; display: block; }
.q-opts { display: flex; flex-direction: column; gap: 10rpx; margin-bottom: 14rpx; }
.q-opt { display: flex; align-items: center; gap: 14rpx; }
.q-opt-label { font-size: 21rpx; color: $brand-600; background-color: $brand-50; width: 44rpx; height: 44rpx; line-height: 44rpx; text-align: center; border-radius: 50%; flex-shrink: 0; }
.q-opt-text { font-size: 26rpx; color: $text-sub; min-width: 0; }
.q-ans { background-color: $bg-page; border-radius: $radius-sm; padding: 12rpx 16rpx; margin-bottom: 12rpx; }
.qa-line { font-size: 23rpx; color: $text-sub; line-height: 1.6; }
.q-tip { font-size: 25rpx; color: $text-main; line-height: 1.55; background-color: $brand-50; border-radius: $radius-sm; padding: 14rpx 18rpx; }
</style>
