<template>
  <view class="page practice-page">
    <!-- 加载/错误态 -->
    <view v-if="phase === 'loading'" class="center-box">
      <view class="loader"></view>
      <text class="center-text">正在抽题…</text>
    </view>
    <view v-else-if="phase === 'error'" class="center-box">
      <view class="err-badge">!</view>
      <text class="center-text">题目加载失败，请检查网络后重试</text>
      <button class="btn-primary retry" @tap="startSession">重试</button>
      <button class="btn-ghost retry" @tap="goBack">返回选题</button>
    </view>

    <!-- 答题态 -->
    <view v-else-if="phase === 'run' && session">
      <view class="run-head">
        <view class="run-top">
          <view class="run-title-wrap">
            <text class="run-title">{{ session.qtypeName }}</text>
            <text class="run-meta">{{ runMetaText }}</text>
          </view>
          <text class="run-pill">
            {{ session.infinite ? '∞' : `${no}/${session.total}` }}
          </text>
        </view>
        <view v-if="!session.infinite" class="run-bar">
          <view class="run-bar-inner" :style="{ width: progress + '%' }"></view>
        </view>
        <view class="run-bottom">
          <view class="run-stat"><text class="rs-num ok">{{ okCount }}</text><text class="rs-label">对</text></view>
          <view class="run-stat"><text class="rs-num ng">{{ ngCount }}</text><text class="rs-label">错</text></view>
          <view class="run-stat"><text class="rs-num sk">{{ skCount }}</text><text class="rs-label">跳</text></view>
          <view class="end-btn" @tap="onEnd">结束</view>
        </view>
      </view>

      <!-- 题干卡 -->
      <view class="q-card">
        <view class="q-head">
          <text class="q-no">第 {{ no }} 题</text>
          <text class="q-type">{{ current ? typeName(current.qtype) : '' }} · {{ isFill ? '填空' : '选择' }}</text>
        </view>
        <view class="q-stem">{{ current ? current.stem : '' }}</view>
        <view v-if="isFill && fillHint" class="q-hint">{{ fillHint }}</view>
      </view>

      <!-- 作答区 -->
      <view class="answer-wrap">
        <MentalChoiceList
          v-if="current && !isFill"
          :options="current.options"
          :result="result"
          :selected-index="selectedIndex"
          @choose="submitChoice"
        />
        <MentalFillInput
          v-if="current && isFill && !answered"
          v-model="fillValue"
          :focus="fillFocused"
          :fill-dir="current.fillDir"
          @submit="submitFill"
        />
      </view>

      <view v-if="current && !isFill && !answered" class="skip-row">
        <text class="skip-btn" @tap="skip">跳过本题</text>
      </view>

      <MentalAnalysisPanel
        v-if="result"
        :result="result"
        :my-answer-text="answerText"
        :is-last="isLast"
        @next="nextQ"
      />
    </view>

    <MentalResultPanel
      v-else-if="phase === 'result' && finishRes"
      :finish-res="finishRes"
      :wrong-items="wrongItems"
      @again="again"
      @back="goBack"
    />
  </view>
</template>

<script setup lang="ts">
/**
 * 速算答题页：抽题 → 选择/填空作答 → 即时判题与技巧 → 自动追加（无限流）→ 结算
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import MentalAnalysisPanel from '@/components/MentalAnalysisPanel.vue'
import MentalChoiceList from '@/components/MentalChoiceList.vue'
import MentalFillInput from '@/components/MentalFillInput.vue'
import MentalResultPanel from '@/components/MentalResultPanel.vue'
import { answerMental, finishMental, moreMental, skipMental, startMental } from '@/api/mental'
import { useElapsedTimer } from '@/composables/useElapsedTimer'
import type {
  MentalAnswerMode,
  MentalAnswerResult,
  MentalFillDir,
  MentalFinishResult,
  MentalQtype,
  MentalStartQuestion,
  MentalStartResult,
  MentalWrongItem,
} from '@/types/mental'
import { MENTAL_TYPE_NAMES } from '@/types/mental'

/** 页面阶段：loading 加载中 / error 加载失败 / run 答题中 / result 已结算 */
const phase = ref<'loading' | 'error' | 'run' | 'result'>('loading')

/* ---- 会话配置（上一页透传） ---- */
const qtype = ref<MentalQtype>('percent')
const diff = ref(0)
const count = ref(10)
const mode = ref<MentalAnswerMode>('choice')

/* ---- 会话状态 ---- */
const session = ref<MentalStartResult | null>(null)
const list = ref<MentalStartQuestion[]>([])
const idx = ref(0)
const okCount = ref(0)
const ngCount = ref(0)
const skCount = ref(0)
const answered = ref(false)
const answering = ref(false)
const finishing = ref(false)
const result = ref<MentalAnswerResult | null>(null)
const selectedIndex = ref<number | null>(null)
const wrongItems = ref<MentalWrongItem[]>([])
const finishRes = ref<MentalFinishResult | null>(null)

/* ---- 填空 ---- */
const fillValue = ref('')
const fillFocused = ref(true)
const myAnswerText = ref('')

const { startTs, qStartMs, timerText, formatTime, startTimer, stopTimer } = useElapsedTimer()

const current = computed<MentalStartQuestion | null>(() => list.value[idx.value] ?? null)
const isFill = computed(() => session.value?.answerMode === 'fill')
const no = computed(() => idx.value + 1)
const isLast = computed(() => {
  if (session.value?.infinite) return false
  return idx.value + 1 >= (session.value?.total ?? list.value.length)
})
const progress = computed(() => {
  const total = session.value?.total ?? 1
  return total ? Math.min(100, Math.round(((idx.value + 1) / total) * 100)) : 0
})

const fillDir = computed<MentalFillDir | undefined>(() => current.value?.fillDir)
const fillPrefix = computed(() => (fillDir.value === 'den' || fillDir.value === 'frac' ? '1/' : ''))

/** 填空提示语（按填写方向） */
const fillHint = computed(() => {
  switch (fillDir.value) {
    case 'den':
    case 'frac':
      return '在「1/」后面填写分母'
    case 'pct':
      return '填写百分数数值，不需要输入 %'
    case 'dec':
      return '填写小数结果'
    case 'val':
      return '填写数值结果'
    default:
      return ''
  }
})

/** 我的答案文本（选择题取所选项，填空取输入值） */
const answerText = computed(() => {
  if (selectedIndex.value !== null && current.value) {
    return current.value.options[selectedIndex.value] || ''
  }
  return myAnswerText.value
})

const fillPattern = computed(() =>
  fillDir.value === 'den' || fillDir.value === 'frac' || fillDir.value === 'val'
    ? /^\d+$/
    : /^\d+(\.\d+)?$/
)

const runMetaText = computed(() => {
  if (!session.value) return ''
  const done = okCount.value + ngCount.value + skCount.value
  const modeTxt = session.value.infinite ? `无限流 · 已答 ${done} 题` : `共 ${session.value.total} 题`
  return `速算练习 · ${modeTxt} · 用时 ${timerText.value}`
})

function typeName(t: MentalQtype): string {
  return MENTAL_TYPE_NAMES[t] || t
}

async function startSession(): Promise<void> {
  phase.value = 'loading'
  try {
    const res = await startMental(qtype.value, diff.value, count.value, mode.value)
    if (!res.questions.length) {
      phase.value = 'error'
      uni.showToast({ title: '当前配置暂无可用题目', icon: 'none' })
      return
    }
    session.value = res
    list.value = res.questions
    idx.value = 0
    okCount.value = 0
    ngCount.value = 0
    skCount.value = 0
    wrongItems.value = []
    finishRes.value = null
    startTs.value = Date.now()
    startTimer()
    resetQ()
    phase.value = 'run'
  } catch (err) {
    console.error('【速算开始练习接口请求失败】', err)
    phase.value = 'error'
  }
}

function resetQ(): void {
  answered.value = false
  answering.value = false
  result.value = null
  selectedIndex.value = null
  myAnswerText.value = ''
  fillValue.value = ''
  qStartMs.value = Date.now()
  fillFocused.value = true
}

function applyAnswer(res: MentalAnswerResult, chosenIndex: number | null): void {
  result.value = res
  if (chosenIndex !== null) selectedIndex.value = chosenIndex
  answered.value = true
  fillFocused.value = false
  if (res.result === 'ok') {
    okCount.value += 1
  } else if (res.result === 'ng') {
    ngCount.value += 1
    collectWrong(res, false)
  } else {
    skCount.value += 1
    collectWrong(res, true)
  }
}

function collectWrong(res: MentalAnswerResult, skipped: boolean): void {
  const q = current.value
  if (!q) return
  wrongItems.value.push({
    stem: q.stem,
    correctAnswer: res.correctAnswer,
    tip: res.tip,
    skipped,
  })
}

async function submitChoice(i: number): Promise<void> {
  if (answered.value || answering.value || !session.value || !current.value) return
  answering.value = true
  const q = current.value
  try {
    const res = await answerMental(
      session.value.sessionId,
      no.value,
      q.id,
      String(i),
      Date.now() - qStartMs.value
    )
    applyAnswer(res, i)
  } catch (err) {
    console.error('【速算选择题作答接口请求失败】', err)
  } finally {
    answering.value = false
  }
}

async function submitFill(): Promise<void> {
  if (answered.value) {
    nextQ()
    return
  }
  if (answering.value || !session.value || !current.value) return
  const raw = fillValue.value.trim()
  if (!fillPattern.value.test(raw)) {
    uni.showToast({ title: '请输入数字（如 8 或 11.1）', icon: 'none' })
    return
  }
  answering.value = true
  const q = current.value
  /* den/frac：界面显示 1/ 前缀，提交拼成 1/分母 */
  const answerTextVal = fillPrefix.value ? `1/${raw}` : raw
  myAnswerText.value = answerTextVal
  try {
    const res = await answerMental(
      session.value.sessionId,
      no.value,
      q.id,
      answerTextVal,
      Date.now() - qStartMs.value
    )
    applyAnswer(res, null)
  } catch (err) {
    console.error('【速算填空题作答接口请求失败】', err)
  } finally {
    answering.value = false
  }
}

async function skip(): Promise<void> {
  if (answered.value || answering.value || !session.value || !current.value || isFill.value) return
  answering.value = true
  const q = current.value
  try {
    const res = await skipMental(
      session.value.sessionId,
      no.value,
      q.id,
      Date.now() - qStartMs.value
    )
    applyAnswer(res, null)
  } catch (err) {
    console.error('【速算跳过接口请求失败】', err)
  } finally {
    answering.value = false
  }
}

async function nextQ(): Promise<void> {
  if (!answered.value || finishing.value) return
  if (idx.value + 1 >= list.value.length) {
    if (session.value?.infinite) {
      await appendMore()
      return
    }
    await finishRun()
    return
  }
  idx.value += 1
  resetQ()
}

async function appendMore(): Promise<void> {
  if (!session.value) return
  answering.value = true
  try {
    const res = await moreMental(session.value.sessionId)
    if (!res.questions.length) {
      await finishRun()
      return
    }
    list.value = list.value.concat(res.questions)
    idx.value += 1
    resetQ()
  } catch (err) {
    console.error('【速算无限流追加题目接口请求失败】', err)
    uni.showToast({ title: '获取更多题目失败，将按当前进度结算', icon: 'none' })
    await finishRun()
  } finally {
    answering.value = false
  }
}

async function finishRun(): Promise<void> {
  if (finishing.value || !session.value) return
  finishing.value = true
  try {
    const res = await finishMental(session.value.sessionId, Date.now() - startTs.value)
    finishRes.value = res
    timerText.value = formatTime(res.totalMs)
    phase.value = 'result'
  } catch (err) {
    console.error('【速算会话结算接口请求失败】', err)
    uni.showToast({ title: '结算失败，请重试', icon: 'none' })
  } finally {
    finishing.value = false
  }
}

function onEnd(): void {
  uni.showModal({
    title: '结束本次练习？',
    content: '将按已答题目结算成绩并归档到练习记录。',
    confirmText: '结束练习',
    cancelText: '继续练习',
    success: (r) => {
      if (r.confirm) {
        void finishRun()
      }
    },
  })
}

function again(): void {
  void startSession()
}

function goBack(): void {
  uni.navigateBack()
}

onLoad((query) => {
  qtype.value = (query?.qtype as MentalQtype) || 'percent'
  diff.value = Number(query?.diff) || 0
  count.value = Number(query?.count) || 10
  mode.value = (query?.mode as MentalAnswerMode) || 'choice'
  void startSession()
})

/** 页面卸载：清理计时器；已答过题则静默结算，避免遗留进行中会话 */
onUnload(() => {
  stopTimer()
  const doneCount = okCount.value + ngCount.value + skCount.value
  if (phase.value === 'run' && session.value && doneCount > 0 && !finishing.value) {
    finishMental(session.value.sessionId, Date.now() - startTs.value).catch((err) => {
      console.error('【速算会话退出时自动结算失败】', err)
    })
  }
})
</script>

<style scoped lang="scss">
.practice-page {
  padding-bottom: 80rpx;
}

/* ---- 加载/错误 ---- */
.center-box {
  padding: 200rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.loader {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  border: 5rpx solid $line;
  border-top-color: $brand-600;
  animation: spin 0.8s linear infinite;
  margin-bottom: 24rpx;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.err-badge {
  width: 88rpx;
  height: 88rpx;
  line-height: 88rpx;
  text-align: center;
  border-radius: 50%;
  background-color: $danger-bg;
  color: $danger;
  font-size: 44rpx;
  font-weight: 800;
  margin-bottom: 20rpx;
}

.center-text {
  font-size: 27rpx;
  color: $ink-2;
  text-align: center;
}

.retry {
  margin-top: 24rpx;
  width: 420rpx;
}

/* ---- 顶部状态卡 ---- */
.run-head {
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 26rpx 28rpx 22rpx;
  box-shadow: $shadow-l2;
}

.run-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.run-title-wrap {
  flex: 1;
  min-width: 0;
}

.run-title {
  display: block;
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
}

.run-meta {
  display: block;
  margin-top: 4rpx;
  font-size: 21rpx;
  color: $ink-3;
}

.run-pill {
  flex-shrink: 0;
  padding: 6rpx 18rpx;
  border-radius: $radius-full;
  background-color: $brand-50;
  color: $brand-600;
  font-size: 22rpx;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.run-bar {
  height: 10rpx;
  margin-top: 18rpx;
  border-radius: $radius-full;
  background-color: $line;
  overflow: hidden;
}

.run-bar-inner {
  height: 100%;
  border-radius: $radius-full;
  background: $brand-gradient;
  transition: width 0.25s ease;
}

.run-bottom {
  display: flex;
  align-items: center;
  gap: 18rpx;
  margin-top: 16rpx;
}

.run-stat {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}

.rs-num {
  font-size: 26rpx;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: $ink;
}

.rs-num.ok {
  color: $success;
}

.rs-num.ng {
  color: $danger;
}

.rs-num.sk {
  color: $warning;
}

.rs-label {
  font-size: 20rpx;
  color: $ink-3;
}

.end-btn {
  margin-left: auto;
  padding: 8rpx 26rpx;
  border-radius: $radius-full;
  background-color: $bg-soft;
  color: $ink-2;
  font-size: 22rpx;
  font-weight: 600;
}

/* ---- 题干卡 ---- */
.q-card {
  margin-top: 24rpx;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  box-shadow: $shadow-l2;
}

.q-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.q-no {
  font-size: 22rpx;
  font-weight: 700;
  color: $brand-600;
  background-color: $brand-50;
  padding: 5rpx 16rpx;
  border-radius: $radius-full;
}

.q-type {
  font-size: 20rpx;
  color: $ink-3;
}

.q-stem {
  font-size: 42rpx;
  font-weight: 700;
  line-height: 1.6;
  color: $ink;
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}

.q-hint {
  margin-top: 14rpx;
  font-size: 22rpx;
  color: $ink-3;
  background-color: $bg-soft;
  border-radius: $radius-sm;
  padding: 10rpx 16rpx;
}

/* ---- 作答区 ---- */
.answer-wrap {
  margin-top: 24rpx;
}

.skip-row {
  display: flex;
  justify-content: center;
  margin-top: 20rpx;
}

.skip-btn {
  padding: 16rpx 48rpx;
  border-radius: $radius-full;
  border: 1rpx solid $line-strong;
  background-color: rgba(255, 255, 255, 0.7);
  color: $ink-2;
  font-size: 25rpx;
}
</style>
