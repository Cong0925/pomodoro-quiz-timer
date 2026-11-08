<template>
  <view class="page practice-page">
    <!-- 加载态 -->
    <view v-if="phase === 'load'" class="load-wrap">
      <view class="sk-card"></view>
      <view class="sk-line w80"></view>
      <view class="sk-line w60"></view>
      <view class="sk-opt"></view>
      <view class="sk-opt"></view>
      <view class="sk-opt"></view>
    </view>

    <!-- 加载失败态 -->
    <view v-else-if="phase === 'error'" class="error-wrap">
      <view class="error-icon">!</view>
      <view class="error-title">题目加载失败</view>
      <view class="error-text">请检查网络连接后重试，或返回题库重新选择</view>
      <button class="btn-primary retry-btn" @tap="startNew">重试</button>
      <button class="btn-ghost back-btn" @tap="goBack">返回题库</button>
    </view>

    <!-- 答题态 -->
    <template v-else-if="phase === 'run'">
      <view class="run-head">
        <view class="run-top">
          <view class="run-title-wrap">
            <text class="run-title">{{ bankName }}</text>
            <text class="run-meta">{{ modeLabel }} · {{ typeLabel }}</text>
          </view>
          <text class="run-pill">{{ curNo }}/{{ questions.length }}</text>
        </view>
        <view class="run-bar">
          <view class="run-bar-inner" :style="{ width: progress + '%' }"></view>
        </view>
        <view class="run-bottom">
          <view class="run-stat"><text class="rs-num ok">{{ okCount }}</text><text class="rs-label">对</text></view>
          <view class="run-stat"><text class="rs-num ng">{{ ngCount }}</text><text class="rs-label">错</text></view>
          <view class="run-stat"><text class="rs-num sk">{{ skCount }}</text><text class="rs-label">跳</text></view>
          <view class="end-btn" @tap="confirmFinish">结束</view>
        </view>
      </view>

      <view class="q-card">
        <view class="q-head">
          <text class="q-no">第 {{ curNo }} 题</text>
          <text class="q-type">{{ typeLabel }}</text>
        </view>
        <view class="q-stem">{{ current.stem }}</view>
        <image
          v-for="(img, i) in stemImgs"
          :key="i"
          class="q-img"
          :src="img"
          mode="widthFix"
          show-menu-by-longpress
        />
      </view>

      <!-- 选项：答前可选择，答后保留并标色 -->
      <view class="opt-list">
        <view
          v-for="(opt, i) in optionTexts"
          :key="i"
          class="opt-item"
          :class="optState(i)"
          hover-class="opt-press"
          @tap="onTapOption(i)"
        >
          <view class="opt-label">
            <text v-if="optState(i) === 'correct'">✓</text>
            <text v-else-if="optState(i) === 'wrong'">✕</text>
            <text v-else>{{ letter(i) }}</text>
          </view>
          <view class="opt-body">
            <text class="opt-text">{{ opt }}</text>
            <image v-if="optionImg(i)" class="opt-img" :src="optionImg(i)" mode="widthFix" />
          </view>
        </view>
      </view>

      <button v-if="isMulti && !answered" class="btn-primary submit-btn" :disabled="multiSel.length === 0" @tap="submitMulti">
        提交（已选 {{ multiSel.length }} 项）
      </button>
      <view v-if="!answered && !isMulti" class="skip-btn" @tap="doSkip">跳过本题</view>

      <!-- 已答：判题结果 + 解析 -->
      <view v-if="answered" class="analysis" :class="recClass">
        <view class="ans-row">
          <view class="ans-mark" :class="recMark">{{ recResult === 'ok' ? '✓' : recResult === 'ng' ? '✕' : '○' }}</view>
          <view class="ans-main">
            <view class="ans-title">{{ recTitle }}</view>
            <view
              v-if="recResult !== 'skip'"
              class="ans-detail"
              :class="recResult === 'ok' ? 'ans-ok' : 'ans-ng'"
            >你的答案：{{ myAnswerText }}</view>
            <view class="ans-detail ans-correct">正确答案：{{ rec?.correctAnswer }}</view>
          </view>
        </view>
        <view v-if="rec?.analysis" class="analysis-body">
          <text class="analysis-label">解析</text>
          <text class="analysis-text">{{ rec.analysis }}</text>
        </view>
        <button class="btn-primary next-btn" @tap="goNext">下一题</button>
      </view>
    </template>

    <!-- 结算态 -->
    <MentalResultPanel
      v-else-if="phase === 'done' && finishRes"
      :finish-res="finishRes"
      :wrong-items="wrongItems"
      @again="again"
      @back="goBack"
    />
  </view>

  <!-- 底部题号导航 -->
  <view v-if="phase === 'run'" class="nav-bar glass">
    <scroll-view scroll-x class="nav-scroll" :show-scrollbar="false">
      <view
        v-for="n in questions.length"
        :key="n"
        class="nav-dot"
        :class="dotClass(n)"
        @tap="jumpTo(n)"
      >
        {{ n }}
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
/**
 * 题库练习答题页：单选/多选/判断 + 图片题 + 题号导航 + 判题解析 + 结算（复用速算结算组件）
 * 进入方式：?bankId=&mode=&count=（新建会话）；?sessionId=（错题重练直达）
 */
import { computed, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import MentalResultPanel from '@/components/MentalResultPanel.vue'
import { answerPracticeQuestion, finishPractice, skipPracticeQuestion, startPractice } from '@/api/practice'
import type { MentalFinishResult, MentalWrongItem } from '@/types/mental'
import type { PracticeAnswerRes, PracticeMode, PracticeQuestion, PracticeStartRes } from '@/types/practice'

type Phase = 'load' | 'run' | 'done' | 'error'

interface LocalRecord {
  userAnswer: string | null
  result: 'ok' | 'ng' | 'skip'
  ms: number
  correctAnswer: string
  analysis: string
}

const phase = ref<Phase>('load')
const sessionId = ref(0)
const bankName = ref('')
const mode = ref<PracticeMode>('order')
const questions = ref<PracticeQuestion[]>([])
const curNo = ref(1)
const records = ref(new Map<number, LocalRecord>())
const multiSel = ref<number[]>([])
const finishRes = ref<MentalFinishResult | null>(null)
const wrongItems = ref<MentalWrongItem[]>([])
const totalMs = ref(0)
const startTs = ref(0)
const answering = ref(false)
const finishing = ref(false)

const modeLabel = computed(() => (mode.value === 'random' ? '随机' : mode.value === 'review' ? '错题重练' : '顺序'))
const typeLabel = computed(() =>
  current.value.type === 'multi' ? '多选题' : current.value.type === 'judge' ? '判断题' : '单选题'
)
const current = computed(() => questions.value[curNo.value - 1] || questions.value[0])
const stemImgs = computed(() => current.value.stemImg || [])
const isMulti = computed(() => current.value.type === 'multi')
const answered = computed(() => records.value.has(curNo.value))
const rec = computed(() => records.value.get(curNo.value))
const okCount = computed(() => [...records.value.values()].filter((r) => r.result === 'ok').length)
const ngCount = computed(() => [...records.value.values()].filter((r) => r.result === 'ng').length)
const skCount = computed(() => [...records.value.values()].filter((r) => r.result === 'skip').length)
const progress = computed(() =>
  questions.value.length ? (records.value.size / questions.value.length) * 100 : 0
)

/** 选项文本：兼容字符串数组与 {text,img} 对象 */
const optionTexts = computed(() => {
  const opts = current.value.options || []
  return opts.map((o) => (typeof o === 'string' ? o : (o as { text?: string }).text || ''))
})

/** 选项文本中的图片（对象选项 img） */
function optionImg(i: number): string {
  const o = current.value.options[i]
  return o && typeof o === 'object' ? ((o as { img?: string }).img || '') : ''
}

function letter(i: number): string {
  return String.fromCharCode(65 + i)
}

const recResult = computed(() => rec.value?.result || 'ok')
const recClass = computed(() => `r-${recResult.value}`)
const recMark = computed(() => recResult.value)
const recTitle = computed(() =>
  recResult.value === 'ok' ? '回答正确' : recResult.value === 'ng' ? '回答错误' : '本题跳过'
)
const myAnswerText = computed(() => {
  const a = rec.value?.userAnswer
  if (!a) return '—'
  return [...a].map((ch) => ch + ' (' + optionTextAt(ch) + ')').join('、')
})

/** 按选项字母取文本（用于展示我的答案） */
function optionTextAt(ch: string): string {
  const idx = ch.charCodeAt(0) - 65
  return optionTexts.value[idx] !== undefined ? optionTexts.value[idx] : ch
}

/** 选项状态：selected / correct / wrong / dim */
function optState(i: number): string {
  const l = letter(i)
  if (!answered.value) {
    return isMulti.value && multiSel.value.includes(i) ? 'selected' : ''
  }
  const r = rec.value
  if (!r) return ''
  const correct = String(r.correctAnswer || '').toUpperCase()
  const mine = String(r.userAnswer || '').toUpperCase()
  if (correct.includes(l)) return 'correct'
  if (mine.includes(l)) return 'wrong'
  return 'dim'
}

function dotClass(n: number): string {
  const r = records.value.get(n)
  if (n === curNo.value) return 'cur'
  if (r) return r.result === 'ok' ? 'ok' : r.result === 'ng' ? 'ng' : 'sk'
  return ''
}

function jumpTo(n: number): void {
  curNo.value = n
  multiSel.value = []
}

function onTapOption(i: number): void {
  if (answered.value) return
  if (answering.value) return
  if (isMulti.value) {
    const idx = multiSel.value.indexOf(i)
    if (idx >= 0) multiSel.value.splice(idx, 1)
    else multiSel.value.push(i)
    return
  }
  void submit(letter(i))
}

function submitMulti(): void {
  if (multiSel.value.length === 0) {
    uni.showToast({ title: '请至少选择一项', icon: 'none' })
    return
  }
  const ans = multiSel.value.map((i) => letter(i)).sort().join('')
  void submit(ans)
}

async function submit(answer: string): Promise<void> {
  const q = current.value
  const no = curNo.value
  if (answering.value || records.value.has(no)) return
  answering.value = true
  try {
    const res = await answerPracticeQuestion(sessionId.value, {
      no,
      questionId: q.id,
      answer,
      ms: Date.now() - startTs.value,
    })
    saveRecord(no, answer, res, res.result)
  } catch (err) {
    console.error('【题库判题接口请求失败】', err)
  } finally {
    answering.value = false
  }
  if (records.value.size >= questions.value.length) void tryFinish()
}

async function doSkip(): Promise<void> {
  const q = current.value
  const no = curNo.value
  if (answering.value || records.value.has(no)) return
  answering.value = true
  try {
    const res = await skipPracticeQuestion(sessionId.value, {
      no,
      questionId: q.id,
      ms: Date.now() - startTs.value,
    })
    saveRecord(no, null, res, res.result)
  } catch (err) {
    console.error('【题库跳过接口请求失败】', err)
  } finally {
    answering.value = false
  }
  if (records.value.size >= questions.value.length) void tryFinish()
}

function saveRecord(no: number, userAnswer: string | null, res: PracticeAnswerRes, result: 'ok' | 'ng' | 'skip'): void {
  records.value.set(no, {
    userAnswer,
    result,
    ms: 0,
    correctAnswer: res.correctAnswer,
    analysis: res.analysis,
  })
  if (result !== 'ok') {
    wrongItems.value.push({
      stem: res.stem || current.value.stem,
      correctAnswer: res.correctAnswer,
      tip: res.analysis,
      skipped: result === 'skip',
    })
  }
}

/** 下一题：先向后找未答，再从开头补漏，全部答完自动结算 */
function goNext(): void {
  for (let n = curNo.value + 1; n <= questions.value.length; n++) {
    if (!records.value.has(n)) {
      curNo.value = n
      multiSel.value = []
      return
    }
  }
  for (let n = 1; n < curNo.value; n++) {
    if (!records.value.has(n)) {
      curNo.value = n
      multiSel.value = []
      return
    }
  }
  void tryFinish()
}

function confirmFinish(): void {
  const left = questions.value.length - records.value.size
  uni.showModal({
    title: '结束练习',
    content: left > 0 ? `还有 ${left} 题未作答，结束将不计入成绩，确定结束？` : '确定结束本次练习？',
    success: (r) => {
      if (r.confirm) void tryFinish()
    },
  })
}

async function tryFinish(): Promise<void> {
  if (finishing.value || phase.value !== 'run') return
  finishing.value = true
  try {
    const res = await finishPractice(sessionId.value, Date.now() - startTs.value)
    finishRes.value = res
    phase.value = 'done'
  } catch (err) {
    console.error('【题库结算接口请求失败】', err)
  } finally {
    finishing.value = false
  }
}

async function again(): Promise<void> {
  phase.value = 'load'
  uni.redirectTo({ url: `/pages/quiz/practice?bankId=${lastBankId.value}&mode=${mode.value}&count=${lastCount.value}` })
}

const lastBankId = ref(0)
const lastCount = ref(10)

function goBack(): void {
  uni.navigateBack()
}

onLoad((query) => {
  const sid = Number(query?.sessionId)
  if (sid > 0) {
    // 错题重练直达：会话已在 replay-errors 创建，重新拉题目
    void loadReplay(sid)
    return
  }
  lastBankId.value = Number(query?.bankId) || 0
  lastCount.value = Number(query?.count) || 10
  mode.value = (query?.mode as PracticeMode) || 'order'
  void startNew()
})

async function startNew(): Promise<void> {
  phase.value = 'load'
  try {
    const res = await startPractice({
      bankId: lastBankId.value,
      mode: mode.value,
      count: lastCount.value,
    })
    applyStart(res)
  } catch (err) {
    console.error('【题库开始接口请求失败】', err)
    phase.value = 'error'
  }
}

async function loadReplay(sid: number): Promise<void> {
  phase.value = 'load'
  // 错题重练：题目数据由记录页经本地缓存中转（sessionId + questions + bank）
  const saved = uni.getStorageSync('quiz_replay') as
    | { sessionId: number; questions: PracticeQuestion[]; bank: { id: number; name: string; catName: string; subName: string }; mode: PracticeMode }
    | ''
  if (!saved || saved.sessionId !== sid || !saved.questions.length) {
    uni.showToast({ title: '重练会话已失效，请重新进入', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  lastBankId.value = saved.bank.id
  lastCount.value = saved.questions.length
  mode.value = saved.mode
  applyStart({
    sessionId: saved.sessionId,
    bank: saved.bank,
    mode: saved.mode,
    questions: saved.questions,
    total: saved.questions.length,
  })
}

function applyStart(res: PracticeStartRes): void {
  if (!res.questions.length) {
    uni.showToast({ title: '该题库暂无可用题目', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }
  sessionId.value = res.sessionId
  bankName.value = res.bank.name
  mode.value = res.mode
  lastBankId.value = res.bank.id
  questions.value = res.questions
  lastCount.value = res.questions.length
  curNo.value = 1
  records.value = new Map()
  wrongItems.value = []
  startTs.value = Date.now()
  totalMs.value = 0
  phase.value = 'run'
}

onUnload(() => {
  // 答题中退出：已答过则静默结算（避免遗留进行中会话）
  if (phase.value === 'run' && records.value.size > 0 && !finishing.value) {
    finishPractice(sessionId.value, Date.now() - startTs.value).catch((err) => {
      console.error('【题库会话退出自动结算失败】', err)
    })
  }
})
</script>

<style scoped lang="scss">
.practice-page {
  padding-bottom: 170rpx;
}

/* ---- 骨架屏 ---- */
.load-wrap {
  padding-top: 10rpx;
}

.sk-card {
  height: 190rpx;
  border-radius: $radius-lg;
  background: linear-gradient(90deg, #eef2f7 25%, #f8fafd 37%, #eef2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.sk-line {
  height: 28rpx;
  border-radius: $radius-full;
  margin-top: 22rpx;
  background: linear-gradient(90deg, #eef2f7 25%, #f8fafd 37%, #eef2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.sk-line.w80 {
  width: 80%;
}

.sk-line.w60 {
  width: 60%;
}

.sk-opt {
  height: 96rpx;
  border-radius: $radius-md;
  margin-top: 18rpx;
  background: linear-gradient(90deg, #eef2f7 25%, #f8fafd 37%, #eef2f7 63%);
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

/* ---- 加载失败 ---- */
.error-wrap {
  padding-top: 90rpx;
  text-align: center;
}

.error-icon {
  width: 96rpx;
  height: 96rpx;
  line-height: 96rpx;
  margin: 0 auto 20rpx;
  border-radius: 50%;
  background-color: $danger-bg;
  color: $danger;
  font-size: 48rpx;
  font-weight: 800;
}

.error-title {
  font-size: 34rpx;
  font-weight: 800;
  color: $ink;
}

.error-text {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.6;
  color: $ink-3;
}

.retry-btn {
  margin-top: 40rpx;
}

.back-btn {
  margin-top: 16rpx;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: 0 0;
  }
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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

/* ---- 题干 ---- */
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
  font-size: 32rpx;
  font-weight: 600;
  line-height: 1.6;
  color: $ink;
}

.q-img {
  width: 100%;
  border-radius: $radius-md;
  margin-top: 18rpx;
  display: block;
}

/* ---- 选项 ---- */
.opt-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 24rpx;
}

.opt-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  min-height: 100rpx;
  padding: 18rpx 22rpx;
  border: 2rpx solid $line;
  border-radius: $radius-md;
  background-color: $bg-card;
  box-sizing: border-box;
  transition: background 0.16s ease, border-color 0.16s ease, opacity 0.16s ease;
}

.opt-item.selected {
  border-color: $brand-600;
  background-color: $brand-50;
}

.opt-item.correct {
  border-color: $success;
  background-color: $success-bg;
}

.opt-item.wrong {
  border-color: $danger;
  background-color: $danger-bg;
}

.opt-item.dim {
  opacity: 0.45;
}

.opt-press {
  background-color: $bg-soft;
}

.opt-label {
  width: 56rpx;
  height: 56rpx;
  line-height: 56rpx;
  text-align: center;
  border-radius: 50%;
  background-color: $bg-soft;
  color: $ink-2;
  font-size: 25rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.opt-item.selected .opt-label {
  background-color: $brand-600;
  color: #ffffff;
}

.opt-item.correct .opt-label {
  background-color: $success;
  color: #ffffff;
}

.opt-item.wrong .opt-label {
  background-color: $danger;
  color: #ffffff;
}

.opt-body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.opt-text {
  font-size: 28rpx;
  line-height: 1.5;
  color: $ink;
  word-break: break-all;
}

.opt-img {
  width: 180rpx;
  border-radius: $radius-sm;
  flex-shrink: 0;
}

.submit-btn {
  margin-top: 24rpx;
}

.skip-btn {
  margin-top: 20rpx;
  height: 84rpx;
  line-height: 84rpx;
  text-align: center;
  border-radius: $radius-md;
  border: 1rpx solid $line-strong;
  background-color: $bg-card;
  color: $ink-2;
  font-size: 28rpx;
}

/* ---- 判题与解析 ---- */
.analysis {
  margin-top: 24rpx;
  background-color: $bg-card;
  border-radius: $radius-lg;
  padding: 28rpx;
  box-shadow: $shadow-l2;
}

.ans-row {
  display: flex;
  align-items: flex-start;
  gap: 18rpx;
}

.ans-mark {
  width: 52rpx;
  height: 52rpx;
  line-height: 52rpx;
  text-align: center;
  border-radius: 50%;
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 700;
  flex-shrink: 0;
}

.ans-mark.ok {
  background-color: $success;
}

.ans-mark.ng {
  background-color: $danger;
}

.ans-mark.skip {
  background-color: $warning;
}

.ans-main {
  flex: 1;
  min-width: 0;
}

.ans-title {
  font-size: 32rpx;
  font-weight: 800;
  color: $ink;
}

.analysis.r-ok .ans-title {
  color: $success;
}

.analysis.r-ng .ans-title {
  color: $danger;
}

.analysis.r-skip .ans-title {
  color: $warning;
}

.ans-detail {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: $ink-2;
  line-height: 1.5;
}

.ans-ok {
  color: $success;
}

.ans-ng {
  color: $danger;
}

.ans-correct {
  color: $success;
  font-weight: 600;
}

.analysis-body {
  margin-top: 22rpx;
  padding: 20rpx;
  border-radius: $radius-md;
  background-color: $bg-soft;
}

.analysis-label {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  color: $brand-600;
  letter-spacing: 2rpx;
  margin-bottom: 8rpx;
}

.analysis-text {
  font-size: 26rpx;
  line-height: 1.65;
  color: $ink-2;
}

.next-btn {
  margin-top: 26rpx;
}

/* ---- 底部题号导航 ---- */
.nav-bar {
  position: fixed;
  left: 24rpx;
  right: 24rpx;
  bottom: calc(16rpx + env(safe-area-inset-bottom));
  z-index: 10;
  border-radius: 32rpx;
  padding: 12rpx 16rpx;
}

.nav-scroll {
  width: 100%;
  white-space: nowrap;
}

.nav-dot {
  display: inline-block;
  width: 54rpx;
  height: 54rpx;
  line-height: 54rpx;
  text-align: center;
  border-radius: 50%;
  font-size: 23rpx;
  color: $ink-2;
  background-color: $bg-soft;
  margin: 0 8rpx;
  font-variant-numeric: tabular-nums;
}

.nav-dot.cur {
  background-color: $brand-600;
  color: #ffffff;
  font-weight: 700;
}

.nav-dot.ok {
  background-color: $success;
  color: #ffffff;
}

.nav-dot.ng {
  background-color: $danger;
  color: #ffffff;
}

.nav-dot.sk {
  background-color: $warning;
  color: #ffffff;
}
</style>
