<!-- 题库练习：开始练习（大类→小类→题库→方式→题量）+ 答题 + 结算回看 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PracticeManage from '../components/PracticeManage.vue'
import PracticeRecords from '../components/PracticeRecords.vue'
import PracticeSetupPane from '../components/PracticeSetupPane.vue'
import { useCategoriesStore } from '../stores/categoriesStore'
import { useHistoryStore } from '../stores/historyStore'
import { useStudyStore } from '../stores/studyStore'
import * as practiceApi from '../api/practice'
import { reportStudyDelta } from '../api/stats'
import { formatMs, todayKey } from '../utils/format'

const catStore = useCategoriesStore()
const historyStore = useHistoryStore()
const studyStore = useStudyStore()

const MODE_NAMES: Record<string, string> = { order: '顺序', random: '随机', review: '错题重练' }
const COUNT_OPTIONS = [5, 10, 15, 20, 25, 30]

const tab = ref<'start' | 'manage' | 'records'>('start')
const banks = ref<practiceApi.Bank[]>([])

async function loadBanks(): Promise<void> {
  try {
    banks.value = await practiceApi.fetchBanks()
  } catch (e) {
    ElMessage.error('题库加载失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

/* ---- 选择状态 ---- */
const selCat = ref('')
const selSub = ref<string | null>(null)
const selBank = ref<number | null>(null)
const mode = ref<string>('order')
const count = ref(5)

const catBanks = computed(() =>
  selSub.value === null ? [] : banks.value.filter((b) => b.catId === selCat.value && (b.subId || '') === selSub.value)
)

const subOptions = computed(() => {
  const cat = catStore.findCat(selCat.value)
  const subs = (cat?.subs || []).map((s) => ({ id: s.id as string | '', name: s.name }))
  if (banks.value.some((b) => b.catId === selCat.value && !b.subId)) subs.push({ id: '', name: '未分类' })
  return subs
})

const countOptions = computed(() => {
  const bank = banks.value.find((b) => b.id === selBank.value)
  const max = bank ? Math.max(bank.count, 1) : 5
  const counts = COUNT_OPTIONS.filter((c) => c <= max)
  if (counts.length === 0) counts.push(Math.max(1, max))
  return counts
})

const startTip = computed(() => {
  if (!selCat.value) return '请先选择考试大类'
  if (selSub.value === null) return '请先选择二级分类'
  if (!selBank.value) return '请选择题库'
  return mode.value === 'review' ? '将从练习历史中抽取错题，不足部分补随机题' : `将抽取 ${count.value} 道题`
})

function pickCat(id: string): void {
  selCat.value = id
  selSub.value = null
  selBank.value = null
}

function pickSub(id: string): void {
  selSub.value = id
  selBank.value = null
}

function pickBank(id: number): void {
  selBank.value = id
  if (!countOptions.value.includes(count.value)) count.value = countOptions.value[0]
}

/* ---- 运行会话 ---- */
interface RunAnswer {
  my: string | null
  correctAnswer: string
  analysis: string
  result: 'ok' | 'ng' | 'skip'
}

type Phase = 'setup' | 'run' | 'result'
const phase = ref<Phase>('setup')
const run = ref<{
  sessionId: number
  bank: { id: number; name: string; catName: string; subName: string }
  mode: string
  questions: practiceApi.StartResult['questions']
  idx: number
  ok: number
  ng: number
  skip: number
  answers: (RunAnswer | undefined)[]
  startTs: number
  review: boolean
  finished: boolean
} | null>(null)
const finishInfo = ref<practiceApi.FinishResult | null>(null)
const clockText = ref('00:00')
let clockTimer: number | null = null

function startClock(): void {
  if (clockTimer) clearInterval(clockTimer)
  clockTimer = window.setInterval(() => {
    if (run.value && !run.value.finished) clockText.value = formatMs(Date.now() - run.value.startTs)
  }, 500)
}

async function startPractice(): Promise<void> {
  if (!selCat.value) return void ElMessage.warning('请先选择考试大类')
  if (selSub.value === null) return void ElMessage.warning('请先选择二级分类')
  if (!selBank.value) return void ElMessage.warning('请选择题库')
  try {
    const r = await practiceApi.startPractice(selBank.value, mode.value, count.value)
    run.value = {
      sessionId: r.sessionId,
      bank: r.bank,
      mode: r.mode,
      questions: r.questions,
      idx: 0,
      ok: 0,
      ng: 0,
      skip: 0,
      answers: [],
      startTs: Date.now(),
      review: false,
      finished: false,
    }
    phase.value = 'run'
    startClock()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '开始练习失败')
  }
}

const curQ = computed(() => run.value?.questions[run.value.idx] || null)
const curAnswer = computed<RunAnswer | null>(() => {
  const r = run.value
  if (!r) return null
  return r.answers[r.idx] || null
})

function optLabel(i: number): string {
  return String.fromCharCode(65 + i)
}

/* 图片选项（方案C）：options 元素可为 string（文字）或 { text, img }（图片混合） */
function optText(i: number): string {
  const o = curQ.value?.options?.[i]
  return typeof o === 'string' ? o : (o?.text || '')
}
function optImg(i: number): string {
  const o = curQ.value?.options?.[i]
  return typeof o === 'object' && o?.img ? o.img : ''
}

async function answer(label: string): Promise<void> {
  const r = run.value
  const q = curQ.value
  if (!r || !q || r.review || r.answers[r.idx]) return
  try {
    const res = await practiceApi.answerQuestion(r.sessionId, r.idx + 1, q.id, label)
    r.answers[r.idx] = { my: label, correctAnswer: res.correctAnswer, analysis: res.analysis || '', result: res.result }
    if (res.result === 'ok') r.ok++
    else r.ng++
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '作答失败')
  }
}

async function skipQ(): Promise<void> {
  const r = run.value
  const q = curQ.value
  if (!r || !q || r.review || r.answers[r.idx]) return
  try {
    const res = await practiceApi.skipQuestion(r.sessionId, r.idx + 1, q.id)
    r.answers[r.idx] = { my: null, correctAnswer: res.correctAnswer, analysis: res.analysis || '', result: 'skip' }
    r.skip++
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '跳过失败')
  }
}

async function nextQ(): Promise<void> {
  const r = run.value
  if (!r) return
  r.idx++
  if (r.idx >= r.questions.length) {
    if (r.review) {
      r.review = false
      phase.value = 'result'
      return
    }
    await finish()
  }
}

async function finish(): Promise<void> {
  const r = run.value
  if (!r) return
  r.finished = true
  if (clockTimer) clearInterval(clockTimer)
  const ms = Date.now() - r.startTs
  try {
    const res = await practiceApi.finishPractice(r.sessionId, ms)
    finishInfo.value = res
    phase.value = 'result'
    /* 联动：历史徽标刷新 + 练习时长并入今日学习时长（失败不阻塞结算） */
    historyStore.loadPage({ page: 1 }).catch(() => {})
    reportStudyDelta(todayKey(), ms).catch(() => {})
    studyStore.loadTodayBase().catch(() => {})
  } catch (e) {
    ElMessage.error('结束练习失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

function enterReview(): void {
  const r = run.value
  if (!r || !r.answers.filter(Boolean).length) {
    ElMessage.warning('没有可回看的题目')
    return
  }
  r.review = true
  r.idx = 0
  phase.value = 'run'
}

function backToSetup(): void {
  if (clockTimer) clearInterval(clockTimer)
  run.value = null
  finishInfo.value = null
  phase.value = 'setup'
}

async function replay(): Promise<void> {
  backToSetup()
  await startPractice()
}

/* 选项样式：作答后 正确=绿 / 我的错误=红 / 其余淡化 */
function optClass(label: string): string {
  const a = curAnswer.value
  if (!a) return ''
  if (label === a.correctAnswer) return 'correct'
  if (label === a.my) return 'wrong'
  return 'dim'
}

onMounted(async () => {
  if (!catStore.categories.length) await catStore.load().catch(() => {})
  await loadBanks()
  /* 默认选中第一个大类→小类→题库（与主版本一致） */
  if (!selCat.value && catStore.categories.length) {
    const c = catStore.categories[0]
    selCat.value = c.id
    selSub.value = c.subs.length ? c.subs[0].id : ''
    const b = banks.value.find((x) => x.catId === c.id && (x.subId || '') === selSub.value)
    if (b) selBank.value = b.id
  }
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})
</script>

<template>
  <div class="practice-view">
    <div class="view-header">
      <div>
        <h2>练习模式</h2>
        <p class="mode-desc">题库练习 · 即答即判 · 答案解析 · 错题重练</p>
      </div>
    </div>

    <!-- 胶囊 tab 按钮组（原版风格） -->
    <div class="p-tabs">
      <button class="p-tab" :class="{ active: tab === 'start' }" @click="tab = 'start'">开始练习</button>
      <button class="p-tab" :class="{ active: tab === 'manage' }" @click="tab = 'manage'">题库管理</button>
      <button class="p-tab" :class="{ active: tab === 'records' }" @click="tab = 'records'">练习记录</button>
    </div>

    <!-- ========== 开始练习 ========== -->
    <div v-show="tab === 'start'">
        <PracticeSetupPane
          v-if="phase === 'setup'"
          :categories="catStore.categories"
          :banks="banks"
          :cat-banks="catBanks"
          :sub-options="subOptions"
          :sel-cat="selCat"
          :sel-sub="selSub"
          :sel-bank="selBank"
          :mode="mode"
          :count="count"
          :count-options="countOptions"
          :start-tip="startTip"
          @pick-cat="pickCat"
          @pick-sub="pickSub"
          @pick-bank="pickBank"
          @update:mode="mode = $event"
          @update:count="count = $event"
          @start="startPractice"
        />

        <!-- ========== 做题中 ========== -->
        <template v-else-if="phase === 'run' && run">
          <div class="run-head">
            <div>
              <div class="run-title">{{ run.bank.name }}</div>
              <div class="run-meta">
                {{ run.bank.catName }}{{ run.bank.subName ? ' / ' + run.bank.subName : '' }} · {{ MODE_NAMES[run.mode] || run.mode }} · 用时 {{ clockText }}
              </div>
            </div>
            <div class="run-counts">
              对 <b class="ok">{{ run.ok }}</b> · 错 <b class="ng">{{ run.ng }}</b> · 跳 <b class="skip">{{ run.skip }}</b>
            </div>
          </div>
          <el-progress :percentage="run.questions.length ? (run.idx / run.questions.length) * 100 : 0" :show-text="false" :stroke-width="8" class="run-bar" />

          <template v-if="curQ">
            <div class="q-no">第 {{ run.idx + 1 }} / {{ run.questions.length }} 题</div>
            <div class="q-stem" v-html="curQ.stem"></div>
            <div v-if="curQ.stemImg && curQ.stemImg.length" class="stem-imgs">
              <el-image
                v-for="(src, i) in curQ.stemImg"
                :key="i"
                :src="src"
                :preview-src-list="curQ.stemImg"
                :initial-index="i"
                fit="contain"
                class="stem-img"
              />
            </div>
            <div class="opt-list">
              <div
                v-for="(_, i) in curQ.options || []"
                :key="i"
                class="opt-item"
                :class="optClass(optLabel(i))"
                @click="answer(optLabel(i))"
              >
                <span class="opt-label">{{ optLabel(i) }}</span>
                <el-image v-if="optImg(i)" :src="optImg(i)" :preview-src-list="[optImg(i)]" fit="contain" class="opt-img" />
                <span v-else class="opt-text">{{ optText(i) }}</span>
              </div>
            </div>

            <div v-if="curAnswer" class="analysis-box">
              <div class="ab-title">
                解析 ·
                <template v-if="curAnswer.result === 'ok'">回答正确</template>
                <template v-else-if="curAnswer.result === 'skip'">本题跳过</template>
                <template v-else>回答错误</template>
              </div>
              <div class="ab-body" v-html="curAnswer.analysis || '（暂无解析）'"></div>
              <el-button type="primary" @click="nextQ">{{ run.idx + 1 >= run.questions.length ? '完成' : '下一题' }}</el-button>
            </div>
            <div v-else class="run-actions">
              <el-button @click="skipQ">跳过</el-button>
            </div>
          </template>
        </template>

        <!-- ========== 结算 ========== -->
        <template v-else-if="phase === 'result' && finishInfo">
          <el-result :score="finishInfo.rate" :subtitle="`共 ${finishInfo.total} 题`" class="finish-result">
            <template #extra>
              <div class="finish-meta">
                对 {{ finishInfo.correct }} · 错 {{ finishInfo.wrong }} · 跳 {{ finishInfo.skipped }} · 用时 {{ formatMs(finishInfo.totalMs) }}
              </div>
              <div class="finish-btns">
                <el-button type="primary" @click="replay">再练一次</el-button>
                <el-button @click="enterReview">回看全部解析</el-button>
                <el-button @click="backToSetup">返回选题</el-button>
              </div>
            </template>
          </el-result>
        </template>
    </div>

    <!-- ========== 题库管理 ========== -->
    <div v-show="tab === 'manage'">
      <PracticeManage :banks="banks" @refresh-banks="loadBanks" />
    </div>

    <!-- ========== 练习记录 ========== -->
    <div v-show="tab === 'records'">
      <PracticeRecords />
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
.p-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.p-tab {
  padding: 7px 18px;
  border: 1px solid var(--el-border-color);
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.p-tab.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.p-tab:hover:not(.active) {
  background: #f3f4f6;
}
.run-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.run-title {
  font-size: 18px;
  font-weight: 700;
}
.run-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.run-counts {
  font-size: 13px;
}
.run-counts .ok { color: var(--el-color-success); }
.run-counts .ng { color: var(--el-color-danger); }
.run-counts .skip { color: var(--el-color-warning); }
.run-bar {
  margin-bottom: 14px;
}
.q-no {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.q-stem {
  font-size: 17px;
  font-weight: 600;
  margin: 8px 0 14px;
  white-space: pre-wrap;
}
/* v-html 渲染的题干/解析内嵌图片（题目图/公式图）统一约束尺寸 */
.q-stem :deep(img),
.ab-body :deep(img) {
  max-width: 100%;
  height: auto;
  display: inline-block;
  vertical-align: middle;
  border-radius: 6px;
}
.q-stem :deep(img) {
  max-height: 420px;
}
.stem-imgs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.stem-img {
  max-height: 110px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
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
  transition: border-color 0.15s;
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
.opt-img {
  width: auto;
  height: 84px;
  max-width: 100%;
}
.analysis-box {
  margin-top: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--el-fill-color-blank);
}
.ab-title {
  font-weight: 600;
  margin-bottom: 6px;
}
.ab-body {
  font-size: 13px;
  color: var(--el-text-color-regular);
  white-space: pre-wrap;
  margin-bottom: 10px;
  line-height: 1.7;
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
