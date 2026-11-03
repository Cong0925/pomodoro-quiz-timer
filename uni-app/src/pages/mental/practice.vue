<template>
  <view class="page">
    <!-- 加载/错误态 -->
    <view v-if="phase === 'loading'" class="center-box">
      <text class="center-text">正在抽题…</text>
    </view>
    <view v-else-if="phase === 'error'" class="center-box">
      <text class="center-text">题目加载失败，请检查网络后重试</text>
      <button class="btn-primary retry" @tap="startSession">重试</button>
      <button class="btn-ghost retry" @tap="goBack">返回选题</button>
    </view>

    <!-- 答题态 -->
    <view v-else-if="phase === 'run' && session">
      <view class="run-head">
        <view class="run-left">
          <view class="run-title">{{ session.qtypeName }} · {{ isFill ? '填空题' : '选择题' }}</view>
          <view class="run-meta">{{ runMetaText }}</view>
        </view>
        <view class="run-right">
          <view class="run-counts">
            对 <text class="ok">{{ okCount }}</text> · 错 <text class="ng">{{ ngCount }}</text> · 跳
            <text class="sk">{{ skCount }}</text>
          </view>
          <view class="end-btn" @tap="onEnd">结束</view>
        </view>
      </view>

      <view v-if="!session.infinite" class="run-bar">
        <view class="run-bar-inner" :style="{ width: progress + '%' }"></view>
      </view>

      <view class="q-no">第 {{ no }} 题 · {{ current ? typeName(current.qtype) : '' }}</view>
      <view class="q-stem">{{ current ? current.stem : '' }}</view>

      <MentalChoiceList
        v-if="current && !isFill"
        :options="current.options"
        :result="result"
        :selected-index="selectedIndex"
        @choose="submitChoice"
      />

      <!-- 填空题：自动聚焦 + 完成键提交 -->
      <MentalFillInput
        v-if="current && isFill"
        v-model="fillValue"
        :focus="fillFocused"
        :fill-dir="current.fillDir"
        @submit="submitFill"
      />

      <MentalAnalysisPanel
        v-if="result"
        :result="result"
        :my-answer-text="myAnswerText"
        :is-last="isLast"
        @next="nextQ"
      />

      <button v-if="current && !isFill && !answered" class="skip-btn" @tap="skip">跳过本题</button>
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
const fillSuffix = computed(() => (fillDir.value === 'pct' ? '%' : ''))

const fillPattern = computed(() =>
  fillDir.value === 'den' || fillDir.value === 'frac' || fillDir.value === 'val'
    ? /^\d+$/
    : /^\d+(\.\d+)?$/
)

const runMetaText = computed(() => {
  if (!session.value) return ''
  const done = okCount.value + ngCount.value + skCount.value
  const modeTxt = session.value.infinite ? '无限流 · 已答 ' + done + ' 题' : '共 ' + session.value.total + ' 题'
  return '速算练习 · ' + modeTxt + ' · 用时 ' + timerText.value
})

function typeName(t: MentalQtype): string {
  return MENTAL_TYPE_NAMES[t] || t
}

async function startSession(): Promise<void> {
  phase.value = 'loading'
  try {
    const res = await startMental(qtype.value, diff.value, count.value, mode.value)
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
  const answerText = fillPrefix.value ? `1/${raw}` : raw
  myAnswerText.value = answerText
  try {
    const res = await answerMental(
      session.value.sessionId,
      no.value,
      q.id,
      answerText,
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
  qtype.value = (query.qtype as MentalQtype) || 'percent'
  diff.value = Number(query.diff) || 0
  count.value = Number(query.count) || 10
  mode.value = (query.mode as MentalAnswerMode) || 'choice'
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

<style scoped>
.page {
  padding: 32rpx;
}

.center-box { padding: 200rpx 32rpx; display: flex; flex-direction: column; align-items: center; }

.center-text { font-size: 28rpx; color: #6b7280; }

.retry { margin-top: 24rpx; width: 400rpx; }

.btn-primary {
  height: 96rpx;
  line-height: 96rpx;
  border-radius: 24rpx;
  background-color: #2563eb;
  color: #ffffff;
  font-size: 31rpx;
  font-weight: 700;
  border: none;
}

.btn-primary::after {
  border: none;
}

.btn-ghost {
  height: 96rpx;
  line-height: 96rpx;
  border: 3rpx solid #e3e8f0;
  border-radius: 24rpx;
  background-color: #ffffff;
  color: #1f2937;
  font-size: 31rpx;
  font-weight: 600;
}

.btn-ghost::after {
  border: none;
}

/* 顶部状态 */
.run-head {  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.run-title { font-size: 32rpx; font-weight: 700; }

.run-meta { font-size: 23rpx; color: #6b7280; margin-top: 4rpx; }

.run-right { text-align: right; }

.run-counts { font-size: 25rpx; }

.run-counts .ok {
  color: #16a34a;
}

.run-counts .ng {
  color: #dc2626;
}

.run-counts .sk {
  color: #d97706;
}

.end-btn {
  margin-top: 10rpx;
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  border: 1rpx solid #d97706;
  color: #d97706;
  font-size: 24rpx;
  background-color: #ffffff;
  text-align: center;
}

/* 进度条 */
.run-bar {
  height: 8rpx;
  background-color: #e3e8f0;
  border-radius: 4rpx;
  margin: 20rpx 0 24rpx;
  overflow: hidden;
}

.run-bar-inner {
  height: 100%;
  background-color: #2563eb;
  border-radius: 4rpx;
}

/* 题目 */
.q-no { font-size: 25rpx; color: #6b7280; margin-bottom: 20rpx; }

.q-stem { font-size: 44rpx; font-weight: 700; line-height: 1.5; margin-bottom: 28rpx; font-variant-numeric: tabular-nums; }

.skip-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border: 3rpx solid #e3e8f0;
  border-radius: 24rpx;
  background-color: #ffffff;
  color: #6b7280;
  font-size: 30rpx;
  margin-top: 20rpx;
}

.skip-btn::after {
  border: none;
}
</style>
