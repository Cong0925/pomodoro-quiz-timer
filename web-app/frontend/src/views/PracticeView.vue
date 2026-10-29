<!-- 题库练习：开始练习（大类→小类→题库→方式→题量）+ 答题 + 结算回看 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
const recordsRef = ref<InstanceType<typeof PracticeRecords> | null>(null)

/* 切到练习记录 tab 时刷新（v-show 常驻组件不会自动重新挂载，否则新完成的记录要刷新页面才出现） */
watch(tab, (v) => {
  if (v === 'records') recordsRef.value?.refresh()
})

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

/* 注入会话进入答题（start 接口 / 记录页本场错题重练 replay 共用） */
function enterSession(s: {
  sessionId: number
  bank: { id: number; name: string; catName: string; subName: string }
  mode: string
  questions: practiceApi.StartResult['questions']
}): void {
  run.value = {
    sessionId: s.sessionId,
    bank: s.bank,
    mode: s.mode,
    questions: s.questions,
    idx: 0,
    ok: 0,
    ng: 0,
    skip: 0,
    answers: [],
    startTs: Date.now(),
    review: false,
    finished: false,
  }
  /* 同步选题区状态：结算页「再练一次」/记录页重练沿用本会话的题库与方式，避免练到别家题库 */
  const b = banks.value.find((x) => x.id === s.bank.id)
  if (b) {
    selCat.value = b.catId || ''
    selSub.value = b.subId || ''
    selBank.value = b.id
  }
  if (s.mode === 'order' || s.mode === 'random' || s.mode === 'review') mode.value = s.mode
  count.value = s.questions.length
  phase.value = 'run'
  tab.value = 'start'
  startClock()
}

async function startPractice(): Promise<void> {
  if (!selCat.value) return void ElMessage.warning('请先选择考试大类')
  if (selSub.value === null) return void ElMessage.warning('请先选择二级分类')
  if (!selBank.value) return void ElMessage.warning('请选择题库')
  try {
    const r = await practiceApi.startPractice(selBank.value, mode.value, count.value)
    enterSession(r)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '开始练习失败')
  }
}

const multiSel = ref<string[]>([]) // 多选题已勾选项（提交前暂存）
watch(
  () => run.value?.idx,
  () => {
    multiSel.value = []
  }
)

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

/** 选项点击：多选题切换勾选，其余题型直接提交 */
function onOptClick(label: string): void {
  const q = curQ.value
  if (q?.type === 'multi' && !curAnswer.value) {
    const i = multiSel.value.indexOf(label)
    if (i >= 0) multiSel.value.splice(i, 1)
    else multiSel.value.push(label)
    return
  }
  void answer(label)
}

/** 多选题提交：勾选项按字母序合并（与判分归一口径一致） */
function submitMulti(): void {
  if (!multiSel.value.length) return
  void answer([...multiSel.value].sort().join(''))
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
    /* 恢复到末题保持界面可操作（可点「完成」重试结算），避免答题区空白卡死 */
    r.finished = false
    r.idx = Math.max(0, r.questions.length - 1)
    ElMessage.error('结束练习失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

function enterReview(i = 0): void {
  const r = run.value
  if (!r || !r.answers.filter(Boolean).length) {
    ElMessage.warning('没有可回看的题目')
    return
  }
  r.review = true
  r.idx = Math.min(Math.max(0, i), r.questions.length - 1)
  phase.value = 'run'
}

/* 题号导航/分布条着色：ok=绿 ng=红 skip=灰 todo=未作答描边 */
function dotCls(i: number): string {
  const a = run.value?.answers[i]
  if (!a) return 'todo'
  return a.result === 'ok' ? 'ok' : a.result === 'ng' ? 'ng' : 'skip'
}

/* 回看/回顾模式：← → 翻题 */
function onKeydown(e: KeyboardEvent): void {
  const r = run.value
  if (!r || !r.review || phase.value !== 'run') return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'ArrowLeft' && r.idx > 0) {
    r.idx--
    e.preventDefault()
  } else if (e.key === 'ArrowRight' && r.idx < r.questions.length - 1) {
    r.idx++
    e.preventDefault()
  }
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

/* 选项样式：作答后 正确=绿 / 我的错误=红 / 其余淡化；多选按集合判定，未作答时高亮已勾选项 */
function optClass(label: string): string {
  const a = curAnswer.value
  const isMulti = curQ.value?.type === 'multi'
  if (!a) return isMulti && multiSel.value.includes(label) ? 'opt-sel' : ''
  const correctSet = isMulti ? a.correctAnswer.split('') : [a.correctAnswer]
  const mySet = isMulti && a.my ? a.my.split('') : a.my ? [a.my] : []
  if (correctSet.includes(label)) return 'correct'
  if (mySet.includes(label)) return 'wrong'
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
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (clockTimer) clearInterval(clockTimer)
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

            <!-- 回看模式：题号导航条（对/错/跳着色，点击跳题，当前高亮） -->
            <div v-if="run.review" class="review-nav">
              <button
                v-for="(_, i) in run.questions"
                :key="i"
                class="rn-item"
                :class="[dotCls(i), { cur: i === run.idx }]"
                :title="`第 ${i + 1} 题`"
                @click="run.idx = i"
              >{{ i + 1 }}</button>
            </div>
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
                @click="onOptClick(optLabel(i))"
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
              <div class="ab-btns">
                <el-button v-if="run.review" :disabled="run.idx === 0" @click="run.idx--">上一题</el-button>
                <el-button type="primary" @click="nextQ">
                  {{ run.review ? (run.idx + 1 >= run.questions.length ? '返回结算' : '下一题') : (run.idx + 1 >= run.questions.length ? '完成' : '下一题') }}
                </el-button>
              </div>
            </div>
            <div v-else class="run-actions">
              <el-button v-if="curQ?.type === 'multi'" type="primary" :disabled="!multiSel.length" @click="submitMulti">提交答案</el-button>
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
              <!-- 对错分布条：点击色块直接进入该题回看 -->
              <div v-if="run && run.answers.length" class="finish-dots">
                <button
                  v-for="(_, i) in run.questions"
                  :key="i"
                  class="fd-item"
                  :class="dotCls(i)"
                  :title="`第 ${i + 1} 题`"
                  @click="enterReview(i)"
                >{{ i + 1 }}</button>
              </div>
              <div class="finish-btns">
                <el-button type="primary" @click="replay">再练一次</el-button>
                <el-button @click="enterReview()">回看全部解析</el-button>
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
      <PracticeRecords ref="recordsRef" @replay="enterSession" />
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
/* 回看题号导航条 / 结算分布条（ok=绿 ng=红 skip=灰 todo=描边） */
.review-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 2px 0 14px;
}
.rn-item {
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  line-height: 1;
}
.rn-item.ok { background: var(--el-color-success); border-color: var(--el-color-success); color: #fff; }
.rn-item.ng { background: var(--el-color-danger); border-color: var(--el-color-danger); color: #fff; }
.rn-item.skip { background: var(--el-color-warning); border-color: var(--el-color-warning); color: #fff; }
.rn-item.todo { color: var(--el-text-color-placeholder); }
.rn-item.cur { outline: 2px solid var(--el-color-primary); outline-offset: 1px; }
.finish-dots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: center;
  margin: 4px 0 14px;
}
.fd-item {
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  line-height: 1;
}
.fd-item.ok { background: var(--el-color-success); border-color: var(--el-color-success); color: #fff; }
.fd-item.ng { background: var(--el-color-danger); border-color: var(--el-color-danger); color: #fff; }
.fd-item.skip { background: var(--el-color-warning); border-color: var(--el-color-warning); color: #fff; }
.fd-item.todo { color: var(--el-text-color-placeholder); }
.ab-btns {
  display: flex;
  gap: 10px;
  margin-top: 10px;
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
.opt-item.opt-sel {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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
