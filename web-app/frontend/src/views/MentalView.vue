<!-- 速算练习：4 题型 + 填空/选择 + 无限流 + 结算错题回顾 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import MentalManage from '../components/MentalManage.vue'
import MentalRecords from '../components/MentalRecords.vue'
import MentalManual from '../components/MentalManual.vue'
import MentalSetupPane from '../components/MentalSetupPane.vue'
import MentalReviewList from '../components/MentalReviewList.vue'
import MentalCompareCards from '../components/MentalCompareCards.vue'
import MentalAnalysisPanel from '../components/MentalAnalysisPanel.vue'
import MentalRunHeader from '../components/MentalRunHeader.vue'
import MentalFillInput from '../components/MentalFillInput.vue'
import * as mentalApi from '../api/mental'
import type { MentalStartQuestion } from '../api/mental'
import { useHistoryStore } from '../stores/historyStore'
import { useStudyStore } from '../stores/studyStore'
import { reportStudyDelta } from '../api/stats'
import { formatMs, todayKey } from '../utils/format'

const historyStore = useHistoryStore()
const studyStore = useStudyStore()

const TYPE_NAMES: Record<string, string> = {
  percent: '百化分',
  compare: '分数比大小',
  estimate: '估算值',
  square: '平方数',
  mixed: '综合练习',
}
const BATCH_SIZE = 10

/** 做题类型固定：百化分、平方数=填空；其余=选择（与后端口径一致） */
function answerModeFor(t: string): 'choice' | 'fill' {
  return t === 'percent' || t === 'square' ? 'fill' : 'choice'
}

const tab = ref<'start' | 'records' | 'manage' | 'manual'>('start')
const recordsRef = ref<InstanceType<typeof MentalRecords> | null>(null)

/* 切到速算记录 tab 时刷新（v-show 常驻组件不会自动重新挂载，否则新完成记录要刷新页面才出现） */
watch(tab, (v) => {
  if (v === 'records') recordsRef.value?.refresh()
})
const type = ref<string>('percent')
const count = ref(10)
const diff = ref(0)

const startTip = computed(() => {
  const name = TYPE_NAMES[type.value] || type.value
  const diffNote = diff.value >= 1 && diff.value <= 3 ? ` · 难度${['', '简单', '中等', '困难'][diff.value]}` : ''
  const fillNote = answerModeFor(type.value) === 'fill' ? '（填空题：直接填数字）' : ''
  return count.value === 0
    ? `「${name}」${diffNote}不限题量 · 循环随机抽题，答完自动续题，随时可结束${fillNote}`
    : `将抽取 ${count.value} 道「${name}」${diffNote}题，答完即时判对错并给出技巧${fillNote}`
})

/** 结算错题回顾数据（答错+跳过） */
const wrongItems = computed(() =>
  wrongReview.value.map((a) => ({
    stem: a.q.stem,
    correctAnswer: a.correctAnswer,
    tip: a.tip,
    skipped: a.result === 'skip',
  }))
)

/* ---- 运行会话 ---- */
type Phase = 'setup' | 'run' | 'result'
const phase = ref<Phase>('setup')

interface RunAnswer {
  my: string | null
  correctAnswer: string
  correctIndex: number | null
  tip: string
  result: 'ok' | 'ng' | 'skip'
  q: MentalStartQuestion
}

const run = ref<{
  sessionId: number
  qtypeName: string
  answerMode: 'choice' | 'fill'
  infinite: boolean
  total: number
  questions: MentalStartQuestion[]
  idx: number
  ok: number
  ng: number
  skip: number
  answers: (RunAnswer | undefined)[]
  startTs: number
  itemStartTs: number
  finished: boolean
  review: boolean
} | null>(null)
const finishInfo = ref<mentalApi.MentalFinishResult | null>(null)
const wrongReview = ref<RunAnswer[]>([])
const clockText = ref('00:00')
const fillInput = ref('')
let clockTimer: number | null = null

async function startRun(): Promise<void> {
  try {
    const r = await mentalApi.startMental(type.value, diff.value, count.value, answerModeFor(type.value))
    run.value = {
      sessionId: r.sessionId,
      qtypeName: r.qtypeName,
      answerMode: r.answerMode,
      infinite: !!r.infinite,
      total: r.total,
      questions: r.questions,
      idx: 0,
      ok: 0,
      ng: 0,
      skip: 0,
      answers: [],
      startTs: Date.now(),
      itemStartTs: Date.now(),
      finished: false,
      review: false,
    }
    phase.value = 'run'
    fillInput.value = ''
    startClock()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '开始练习失败')
  }
}

function startClock(): void {
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = window.setInterval(() => {
    if (run.value && !run.value.finished) clockText.value = formatMs(Date.now() - run.value.startTs)
  }, 500)
}

const curQ = computed(() => run.value?.questions[run.value.idx] || null)
const curAnswer = computed<RunAnswer | null>(() => run.value?.answers[run.value.idx] || null)
const isFill = computed(() => run.value?.answerMode === 'fill')

/** 比大小题的两个分数（视觉辅助卡） */
const compareParts = computed(() => {
  const q = curQ.value
  if (!q || q.qtype !== 'compare') return null
  const parts = String(q.stem).split(' 与 ')
  return { a: parts[0] || '', b: parts[1] || '' }
})

function optLabel(i: number): string {
  return String.fromCharCode(65 + i)
}

async function answerChoice(idx: number): Promise<void> {
  await doAnswer(String(idx))
}

async function answerFillSubmit(): Promise<void> {
  const val = fillInput.value.trim()
  const q = curQ.value
  const fracMode = q?.fillDir === 'frac'
  const okNum = /^\d+(\.\d+)?$/.test(val)
  if (!okNum) {
    ElMessage.error(fracMode ? '请输入分母数字（如 11.1% 填 9）' : '请输入数字（如 8 或 11.1）')
    return
  }
  // frac 模式：前端已显示"1/"前缀，用户只输分母，拼成"1/分母"提交
  const ansText = fracMode ? `1/${val}` : val
  await doAnswer(ansText)
}

async function doAnswer(ans: string): Promise<void> {
  const r = run.value
  const q = curQ.value
  if (!r || !q || r.answers[r.idx]) return
  const ms = Date.now() - r.itemStartTs
  try {
    const res = await mentalApi.answerMental(r.sessionId, r.idx + 1, q.id, ans, ms)
    r.answers[r.idx] = {
      my: ans,
      correctAnswer: res.correctAnswer,
      correctIndex: res.correctIndex ?? null,
      tip: res.tip || '',
      result: res.result,
      q,
    }
    if (res.result === 'ok') r.ok++
    else r.ng++
    fillInput.value = ''
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '作答失败')
  }
}

async function skipQ(): Promise<void> {
  const r = run.value
  const q = curQ.value
  if (!r || !q || r.answers[r.idx]) return
  const ms = Date.now() - r.itemStartTs
  try {
    const res = await mentalApi.skipMental(r.sessionId, r.idx + 1, q.id, ms)
    r.answers[r.idx] = {
      my: null,
      correctAnswer: res.correctAnswer,
      correctIndex: res.correctIndex ?? null,
      tip: res.tip || '',
      result: 'skip',
      q,
    }
    r.skip++
    fillInput.value = ''
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '跳过失败')
  }
}

async function nextQ(): Promise<void> {
  const r = run.value
  if (!r) return
  r.idx++
  if (r.idx >= r.questions.length) {
    if (r.infinite) {
      await loadMoreQ()
      return
    }
    await finish()
    return
  }
  fillInput.value = ''
}

async function loadMoreQ(): Promise<void> {
  const r = run.value
  if (!r) return
  try {
    const res = await mentalApi.moreMental(r.sessionId)
    if (res.questions && res.questions.length) {
      r.questions = r.questions.concat(res.questions)
      return
    }
  } catch (e) {
    ElMessage.error('加载下一批题目失败：' + (e instanceof Error ? e.message : String(e)))
  }
  await finish()
}

async function endRun(): Promise<void> {
  if (!run.value?.infinite) return
  try {
    await ElMessageBox.confirm('结束本轮无限流练习？已答题目将计入本次结算。', '结束练习', {
      type: 'warning',
      confirmButtonText: '结束',
      cancelButtonText: '继续练习',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【结束练习确认弹窗异常】', e)
    return
  }
  await finish()
}

async function finish(): Promise<void> {
  const r = run.value
  if (!r) return
  r.finished = true
  if (clockTimer) clearInterval(clockTimer)
  const ms = Date.now() - r.startTs
  try {
    const res = await mentalApi.finishMental(r.sessionId, ms)
    finishInfo.value = res
    wrongReview.value = r.answers.filter((a): a is RunAnswer => !!a && a.result !== 'ok')
    phase.value = 'result'
    historyStore.loadPage({ page: 1 }).catch(() => {})
    reportStudyDelta(todayKey(), ms).catch(() => {})
    studyStore.loadTodayBase().catch(() => {})
  } catch (e) {
    ElMessage.error('结束练习失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

function backToStart(): void {
  if (clockTimer) clearInterval(clockTimer)
  run.value = null
  finishInfo.value = null
  phase.value = 'setup'
}

/* 选项样式（选择题作答后） */
function optClass(idx: number): string {
  const a = curAnswer.value
  if (!a || isFill.value) return ''
  if (idx === Number(a.correctIndex)) return 'correct'
  if (idx === Number(a.my)) return 'wrong'
  return 'dim'
}

/** 作答结果展示：我的答案文本（选择题转选项文本） */
function myAnswerText(a: RunAnswer): string {
  if (a.my == null) return '—'
  if (!isFill.value) {
    const opt = a.q.options[Number(a.my)]
    if (opt !== undefined) return String(opt)
  }
  return String(a.my)
}

/* Enter 快捷键：作答后下一题 / 填空提交 */
function onKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter' || phase.value !== 'run') return
  if (curAnswer.value) {
    e.preventDefault()
    nextQ()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="mental-view">
    <div class="view-header">
      <div>
        <h2>速算练习</h2>
        <p class="mode-desc">资料分析专项技巧训练：百化分 · 分数比大小 · 估算值 · 答完即时给技巧提示 · 自动归档历史</p>
      </div>
    </div>

    <!-- 胶囊 tab 按钮组（原版顺序：开始/题库管理/练习记录/技巧手册） -->
    <div class="m-tabs">
      <button class="m-tab" :class="{ active: tab === 'start' }" @click="tab = 'start'">开始练习</button>
      <button class="m-tab" :class="{ active: tab === 'manage' }" @click="tab = 'manage'">题库管理</button>
      <button class="m-tab" :class="{ active: tab === 'records' }" @click="tab = 'records'">练习记录</button>
      <button class="m-tab" :class="{ active: tab === 'manual' }" @click="tab = 'manual'">技巧手册</button>
    </div>

    <!-- ========== 开始练习 ========== -->
    <div v-show="tab === 'start'">
        <MentalSetupPane
          v-if="phase === 'setup'"
          :type="type"
          :diff="diff"
          :count="count"
          :tip="startTip"
          @update:type="type = $event"
          @update:diff="diff = $event"
          @update:count="count = $event"
          @start="startRun"
        />

        <!-- ========== 做题中 ========== -->
        <template v-else-if="phase === 'run' && run">
          <MentalRunHeader
            :title="run.qtypeName + (run.answerMode === 'fill' ? ' · 填空题' : '')"
            :meta="`速算练习 · ${run.infinite ? '无限流（循环抽题）' : `共 ${run.total} 题`} · 用时 ${clockText}`"
            :ok="run.ok"
            :ng="run.ng"
            :skip="run.skip"
            :infinite="run.infinite"
            @end="endRun"
          />
          <el-progress
            :percentage="run.infinite ? ((run.idx % BATCH_SIZE) / BATCH_SIZE) * 100 : run.questions.length ? (run.idx / run.questions.length) * 100 : 0"
            :show-text="false"
            :stroke-width="8"
            class="run-bar"
          />

          <template v-if="curQ">
            <div class="q-no">
              {{ run.infinite ? `第 ${run.idx + 1} 题 · 无限流` : `第 ${run.idx + 1} / ${run.questions.length} 题` }} · {{ TYPE_NAMES[curQ.qtype] || curQ.qtype }}
            </div>

            <!-- 比大小：两个分数卡 -->
            <MentalCompareCards v-if="compareParts" :a="compareParts.a" :b="compareParts.b" />
            <div v-else class="q-stem">{{ curQ.stem }}</div>

            <!-- 选择题选项 -->
            <div v-if="!isFill" class="opt-list">
              <div
                v-for="(t, i) in curQ.options || []"
                :key="i"
                class="opt-item"
                :class="optClass(i)"
                @click="answerChoice(i)"
              >
                <span class="opt-label">{{ optLabel(i) }}</span>
                <span class="opt-text">{{ t }}</span>
              </div>
            </div>

            <!-- 填空题 -->
            <MentalFillInput v-if="isFill && !curAnswer" v-model="fillInput" :fill-dir="curQ.fillDir" @submit="answerFillSubmit" />

            <!-- 结果面板 -->
            <MentalAnalysisPanel
              v-if="curAnswer"
              :result="curAnswer.result"
              :my-text="myAnswerText(curAnswer)"
              :correct-answer="curAnswer.correctAnswer"
              :tip="curAnswer.tip"
              :next-label="run.idx + 1 >= run.questions.length && !run.infinite ? '完成' : '下一题（Enter）'"
              @next="nextQ"
            />
            <div v-else class="run-actions">
              <el-button @click="skipQ">跳过</el-button>
            </div>
          </template>
        </template>

        <!-- ========== 结算 ========== -->
        <template v-else-if="phase === 'result' && finishInfo">
          <el-result :score="finishInfo.rate" :subtitle="`共 ${finishInfo.total} 题`">
            <template #extra>
              <div class="finish-meta">
                对 {{ finishInfo.correct }} · 错 {{ finishInfo.wrong }} · 跳 {{ finishInfo.skipped }} · 用时 {{ formatMs(finishInfo.totalMs) }}
              </div>
              <div class="finish-btns">
                <el-button type="primary" @click="startRun">再练一次</el-button>
                <el-button @click="backToStart">返回选题</el-button>
              </div>
            </template>
          </el-result>

          <!-- 错题回顾 -->
          <MentalReviewList :items="wrongItems" />
        </template>
    </div>

    <!-- ========== 题库管理 ========== -->
    <div v-show="tab === 'manage'">
      <MentalManage />
    </div>

    <!-- ========== 练习记录 ========== -->
    <div v-show="tab === 'records'">
      <MentalRecords ref="recordsRef" />
    </div>

    <!-- ========== 技巧手册 ========== -->
    <div v-show="tab === 'manual'">
      <MentalManual />
    </div>
  </div>
</template>

<style scoped>
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.view-header h2 {
  margin: 0 0 4px;
}
.mode-desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.m-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.m-tab {
  padding: 7px 18px;
  border: 1px solid var(--el-border-color);
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.m-tab.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.m-tab:hover:not(.active) {
  background: #f3f4f6;
}
.run-bar {
  margin: 8px 0 14px;
}
.q-no {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.q-stem {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 14px;
  font-variant-numeric: tabular-nums;
}
.opt-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opt-item {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  background: var(--el-bg-color);
}
.opt-item:hover {
  border-color: var(--el-color-primary);
}
.opt-item.correct {
  border-color: var(--el-color-success);
  background: var(--el-color-success-light-9);
  cursor: default;
}
.opt-item.wrong {
  border-color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
  cursor: default;
}
.opt-item.dim {
  opacity: 0.5;
  cursor: default;
}
.opt-label {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--el-fill-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.run-actions {
  margin-top: 14px;
}
.finish-meta {
  margin-bottom: 14px;
  color: var(--el-text-color-secondary);
}
.finish-btns {
  display: flex;
  justify-content: center;
  gap: 10px;
}
</style>
