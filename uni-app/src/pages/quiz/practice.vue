<template>
  <view class="page">
    <!-- 加载态 -->
    <view v-if="phase === 'load'" class="center-box">
      <text class="center-text">题目加载中…</text>
    </view>

    <!-- 答题态 -->
    <template v-else-if="phase === 'run'">
      <view class="run-head">
        <view>
          <view class="run-title">{{ bankName }}</view>
          <view class="run-meta">{{ modeLabel }} · 第 {{ curNo }}/{{ questions.length }} 题</view>
        </view>
        <view class="run-right">
          <view class="run-counts">
            对 <text class="ok">{{ okCount }}</text> · 错 <text class="ng">{{ ngCount }}</text> · 跳 <text class="sk">{{ skCount }}</text>
          </view>
          <view class="end-btn" @tap="confirmFinish">结束</view>
        </view>
      </view>
      <view class="run-bar"><view class="run-bar-inner" :style="{ width: progress + '%' }"></view></view>

      <view class="q-no">第 {{ curNo }} 题 · {{ typeLabel }}</view>
      <view class="q-stem">{{ current.stem }}</view>
      <image
        v-for="(img, i) in stemImgs"
        :key="i"
        class="q-img"
        :src="img"
        mode="widthFix"
        show-menu-by-longpress
      />

      <!-- 选项作答（单选/判断点选即答；多选点选后提交） -->
      <view v-if="!answered" class="opt-list">
        <view
          v-for="(opt, i) in optionTexts"
          :key="i"
          class="opt-item"
          :class="{ multiSel: isMulti && multiSel.includes(i) }"
          @tap="onTapOption(i)"
        >
          <view class="opt-label">{{ letter(i) }}</view>
          <text class="opt-text">{{ opt }}</text>
          <image v-if="optionImg(i)" class="opt-img" :src="optionImg(i)" mode="widthFix" />
        </view>
        <button v-if="isMulti" class="btn-primary submit-btn" :disabled="multiSel.length === 0" @tap="submitMulti">
          提交（已选 {{ multiSel.length }} 项）
        </button>
        <view v-else class="skip-btn" @tap="doSkip">跳过本题</view>
      </view>

      <!-- 已答回看（判题结果 + 解析） -->
      <view v-else class="analysis" :class="recClass">
        <view class="ans-row">
          <view class="ans-mark" :class="recMark">{{ recResult === 'ok' ? '✓' : recResult === 'ng' ? '✗' : '○' }}</view>
          <view class="ans-main">
            <view class="ans-title">{{ recTitle }}</view>
            <view class="ans-detail" v-if="recResult !== 'skip'">你的答案：{{ myAnswerText }}</view>
            <view class="ans-detail">正确答案：{{ rec?.correctAnswer }}</view>
          </view>
        </view>
        <view v-if="rec?.analysis" class="tip">解析：{{ rec.analysis }}</view>
        <button class="next-btn" @tap="goNext">下一题</button>
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
  <view v-if="phase === 'run'" class="nav-bar">
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

type Phase = 'load' | 'run' | 'done'

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
const progress = computed(() => (records.value.size / questions.value.length) * 100)

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
  if (answering.value || isMulti.value) {
    if (isMulti.value) {
      const idx = multiSel.value.indexOf(i)
      if (idx >= 0) multiSel.value.splice(idx, 1)
      else multiSel.value.push(i)
    }
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

/** 下一题：优先跳到下一未答题，全部答完自动结算 */
function goNext(): void {
  for (let n = curNo.value + 1; n <= questions.value.length; n++) {
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
  applyStart({
    sessionId: saved.sessionId,
    bank: saved.bank,
    mode: saved.mode,
    questions: saved.questions,
    total: saved.questions.length,
  })
}

function applyStart(res: PracticeStartRes): void {
  sessionId.value = res.sessionId
  bankName.value = res.bank.name
  mode.value = res.mode
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
.center-box { padding: 200rpx 32rpx; display: flex; flex-direction: column; align-items: center; }
.center-text { font-size: 28rpx; color: $text-sub; }

.run-head {
  display: flex; justify-content: space-between; align-items: flex-start;
  background: $brand-gradient; border-radius: $radius-lg; padding: 26rpx 28rpx; box-shadow: $shadow-btn;
}
.run-title { font-size: 31rpx; font-weight: 700; color: #ffffff; }
.run-meta { font-size: 22rpx; color: rgba(255, 255, 255, 0.8); margin-top: 6rpx; }
.run-right { text-align: right; }
.run-counts { font-size: 24rpx; color: #ffffff; }
.run-counts .ok { color: #bbf7d0; font-weight: 700; }
.run-counts .ng { color: #fecaca; font-weight: 700; }
.run-counts .sk { color: #fde68a; font-weight: 700; }
.end-btn {
  margin-top: 12rpx; padding: 8rpx 24rpx; border-radius: $radius-full;
  background-color: rgba(255, 255, 255, 0.18); border: 2rpx solid rgba(255, 255, 255, 0.5);
  color: #ffffff; font-size: 23rpx; text-align: center; display: inline-block;
}
.run-bar { height: 8rpx; background-color: rgba(255, 255, 255, 0.28); border-radius: 4rpx; margin: 20rpx 0 0; overflow: hidden; }
.run-bar-inner { height: 100%; background-color: #ffffff; border-radius: 4rpx; }

.q-no {
  display: inline-block; font-size: 23rpx; color: $brand-600; background-color: $brand-50;
  border-radius: $radius-full; padding: 6rpx 20rpx; font-weight: 600; margin-bottom: 20rpx; margin-top: 32rpx;
}
.q-stem { font-size: 33rpx; font-weight: 600; line-height: 1.55; margin-bottom: 20rpx; color: $text-main; }
.q-img { width: 100%; border-radius: $radius-md; margin-bottom: 20rpx; display: block; }

.opt-list { display: flex; flex-direction: column; gap: $gap-item; }
.opt-item {
  min-height: 100rpx; display: flex; align-items: center; gap: 24rpx;
  background-color: $bg-card; border: 2rpx solid transparent; border-radius: $radius-md;
  padding: 14rpx 26rpx; box-shadow: $shadow-card-sm;
}
.opt-item.multiSel { border-color: $brand-600; background-color: $brand-50; box-shadow: $shadow-primary; }
.opt-label {
  width: 54rpx; height: 54rpx; border-radius: 50%; background-color: $brand-50; color: $brand-600;
  display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 26rpx; flex-shrink: 0;
}
.opt-item.multiSel .opt-label { background-color: $brand-600; color: #ffffff; }
.opt-text { font-size: 28rpx; min-width: 0; word-break: break-all; color: $text-main; }
.opt-img { width: 200rpx; border-radius: $radius-sm; margin-left: 8rpx; }

.submit-btn { margin-top: 8rpx; }
.skip-btn {
  width: 100%; height: 88rpx; line-height: 88rpx; border: 3rpx solid $line; border-radius: $radius-md;
  background-color: $bg-card; color: $text-sub; font-size: 30rpx; margin-top: $gap-item; box-shadow: $shadow-card-sm;
}
.skip-btn::after { border: none; }

.analysis {
  margin-top: 28rpx; background-color: $bg-card; border-radius: $radius-lg; padding: 28rpx;
  box-shadow: $shadow-card; border-top: 6rpx solid transparent;
}
.analysis.r-ok { border-top-color: $success; }
.analysis.r-ng { border-top-color: $danger; }
.analysis.r-skip { border-top-color: $warning; }
.ans-row { display: flex; align-items: flex-start; gap: 18rpx; }
.ans-mark {
  width: 48rpx; height: 48rpx; border-radius: 50%; color: #ffffff; font-size: 28rpx; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.ans-mark.ok { background-color: $success; }
.ans-mark.ng { background-color: $danger; }
.ans-mark.skip { background-color: $warning; }
.ans-main { flex: 1; min-width: 0; }
.ans-title { font-size: 30rpx; font-weight: 700; }
.analysis.r-ok .ans-title { color: $success; }
.analysis.r-ng .ans-title { color: $danger; }
.analysis.r-skip .ans-title { color: $warning; }
.ans-detail { font-size: 25rpx; color: $text-sub; margin-top: 6rpx; line-height: 1.5; }
.tip { font-size: 26rpx; color: $text-main; line-height: 1.55; margin: 18rpx 0 20rpx; background-color: $brand-50; border-radius: $radius-sm; padding: 16rpx 20rpx; }
.next-btn {
  width: 100%; height: 92rpx; line-height: 92rpx; border-radius: $radius-md; background: $brand-gradient;
  color: #ffffff; font-size: 31rpx; font-weight: 700; border: none; box-shadow: $shadow-primary;
}
.next-btn::after { border: none; }

.nav-bar {
  position: fixed; left: 0; right: 0; bottom: 0; background-color: $bg-card;
  border-top: 1rpx solid $line; padding: 14rpx 0 calc(14rpx + env(safe-area-inset-bottom));
  box-shadow: 0 -8rpx 24rpx rgba(30, 41, 59, 0.06); z-index: 10;
}
.nav-scroll { white-space: nowrap; width: 100%; }
.nav-dot {
  display: inline-block; width: 56rpx; height: 56rpx; line-height: 56rpx; text-align: center;
  border-radius: 50%; font-size: 24rpx; color: $text-sub; background-color: $bg-page; margin: 0 10rpx;
  font-variant-numeric: tabular-nums;
}
.nav-dot.cur { background-color: $brand-600; color: #ffffff; font-weight: 700; }
.nav-dot.ok { background-color: $success; color: #ffffff; }
.nav-dot.ng { background-color: $danger; color: #ffffff; }
.nav-dot.sk { background-color: $warning; color: #ffffff; }

.page { padding-bottom: 140rpx; }
</style>
