<!-- 日历备忘：大日历 + 类型选择 + 备忘保存；标题点击进入 选月→选年 视图 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { deleteMemo, fetchMemosMonth, saveMemo } from '../api/memos'
import { MEMO_TYPES } from '../types'
import type { MemoType } from '../types'
import { pad2, todayKey } from '../utils/format'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']
const YEAR_PAGE = 12

const now = new Date()
const calYear = ref(now.getFullYear())
const calMonth = ref(now.getMonth()) // 0-11
const selected = ref(todayKey(now))
const viewMode = ref<'day' | 'month' | 'year'>('day')
const decadeStart = ref(now.getFullYear() - (now.getFullYear() % YEAR_PAGE))
const memos = ref<Record<string, { type: MemoType; title: string; text: string }>>({})

/* ---- 编辑器状态 ---- */
const editorTitle = ref('')
const memoTitle = ref('')
const memoText = ref('')
const memoType = ref<MemoType>('other')

function keyOf(y: number, m: number, d: number): string {
  return todayKey(new Date(y, m, d))
}

async function ensureMonthLoaded(y: number, m: number): Promise<void> {
  const month = `${y}-${pad2(m + 1)}`
  try {
    const list = await fetchMemosMonth(month)
    const map: Record<string, { type: MemoType; title: string; text: string }> = { ...memos.value }
    list.forEach((item) => {
      map[item.date] = { type: item.type, title: item.title, text: item.content || '' }
    })
    memos.value = map
  } catch (e) {
    console.error('【加载日历备忘失败】', e)
  }
}

/* ---- 日历格子 ---- */
const cells = computed(() => {
  const first = new Date(calYear.value, calMonth.value, 1)
  const lead = (first.getDay() + 6) % 7
  const daysInMonth = new Date(calYear.value, calMonth.value + 1, 0).getDate()
  const daysInPrev = new Date(calYear.value, calMonth.value, 0).getDate()
  const out: Array<{ day: number; key: string; other: boolean }> = []
  for (let i = lead - 1; i >= 0; i--) out.push({ day: daysInPrev - i, key: keyOf(calYear.value, calMonth.value - 1, daysInPrev - i), other: true })
  for (let d = 1; d <= daysInMonth; d++) out.push({ day: d, key: keyOf(calYear.value, calMonth.value, d), other: false })
  let nextD = 1
  while (out.length % 7 !== 0) {
    out.push({ day: nextD, key: keyOf(calYear.value, calMonth.value + 1, nextD), other: true })
    nextD++
  }
  return out
})

const title = computed(() => {
  if (viewMode.value === 'year') return `${decadeStart.value} - ${decadeStart.value + YEAR_PAGE - 1}`
  if (viewMode.value === 'month') return `${calYear.value} 年`
  return `${calYear.value} 年 ${calMonth.value + 1} 月`
})

function navBy(delta: number): void {
  if (viewMode.value === 'year') decadeStart.value += delta * YEAR_PAGE
  else if (viewMode.value === 'month') calYear.value += delta
  else {
    const m = calMonth.value + delta
    calYear.value += Math.floor(m / 12)
    calMonth.value = ((m % 12) + 12) % 12
    ensureMonthLoaded(calYear.value, calMonth.value)
  }
}

function onTitleClick(): void {
  if (viewMode.value === 'day') viewMode.value = 'month'
  else if (viewMode.value === 'month') {
    decadeStart.value = calYear.value - (calYear.value % YEAR_PAGE)
    viewMode.value = 'year'
  }
}

function pickMonth(m: number): void {
  calMonth.value = m
  viewMode.value = 'day'
  ensureMonthLoaded(calYear.value, m)
}

function pickYear(y: number): void {
  calYear.value = y
  viewMode.value = 'month'
}

function goToday(): void {
  const d = new Date()
  calYear.value = d.getFullYear()
  calMonth.value = d.getMonth()
  selected.value = todayKey(d)
  viewMode.value = 'day'
  ensureMonthLoaded(calYear.value, calMonth.value)
  renderEditor()
}

function pickDay(cell: { key: string; other: boolean }): void {
  if (cell.other) {
    const d = new Date(cell.key + 'T00:00:00')
    calYear.value = d.getFullYear()
    calMonth.value = d.getMonth()
    ensureMonthLoaded(calYear.value, calMonth.value)
  }
  selected.value = cell.key
  renderEditor()
}

function renderEditor(): void {
  if (!selected.value) {
    editorTitle.value = '请选择日期'
    memoTitle.value = ''
    memoText.value = ''
    memoType.value = 'other'
    return
  }
  const d = new Date(selected.value + 'T00:00:00')
  editorTitle.value = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 周${WEEKDAY_CN[d.getDay()]}`
  const memo = memos.value[selected.value]
  memoTitle.value = memo ? memo.title : ''
  memoText.value = memo ? memo.text : ''
  memoType.value = memo ? memo.type : 'other'
}

/* 标题限 4 字 */
function onTitleInput(): void {
  memoTitle.value = Array.from(memoTitle.value).slice(0, 4).join('')
}

async function save(): Promise<void> {
  if (!selected.value) return
  try {
    await saveMemo(selected.value, { type: memoType.value, title: memoTitle.value, content: memoText.value.trim() })
    await ensureMonthLoaded(calYear.value, calMonth.value)
    renderEditor()
    ElMessage.success(memoText.value.trim() ? '已保存备忘' : '已清空备忘')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存备忘失败')
  }
}

async function clear(): Promise<void> {
  if (!selected.value) return
  try {
    await deleteMemo(selected.value)
    const map = { ...memos.value }
    delete map[selected.value]
    memos.value = map
    memoTitle.value = ''
    memoText.value = ''
    ElMessage.success('已清空该日备忘')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '清空备忘失败')
  }
}

function memoOfDay(key: string) {
  return memos.value[key]
}

onMounted(() => {
  ensureMonthLoaded(calYear.value, calMonth.value)
  renderEditor()
})
</script>

<template>
  <div class="cal-view">
    <div class="view-header">
      <div>
        <h2>日历备忘</h2>
        <p class="mode-desc">点击日期填写备忘；点击标题可在 选月 / 选年 视图间切换</p>
      </div>
    </div>

    <div class="cal-layout">
      <el-card shadow="never" class="cal-card">
        <div class="cal-toolbar">
          <el-button text @click="navBy(-1)">‹</el-button>
          <span class="cal-title" :class="{ picker: viewMode !== 'year' }" @click="onTitleClick">{{ title }}</span>
          <el-button text @click="navBy(1)">›</el-button>
          <el-button size="small" class="today-btn" @click="goToday">今天</el-button>
        </div>

        <!-- 日历视图 -->
        <div v-if="viewMode === 'day'" class="calendar-grid">
          <div v-for="(w, i) in WEEKDAYS" :key="i" class="cal-weekday">{{ w }}</div>
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="cal-day"
            :class="{ other: cell.other, today: cell.key === todayKey(), selected: cell.key === selected, 'has-memo': !!memoOfDay(cell.key) }"
            @click="pickDay(cell)"
          >
            <span class="cal-day-num">{{ cell.day }}</span>
            <template v-if="memoOfDay(cell.key)">
              <span
                class="cal-tag"
                :style="{ color: MEMO_TYPES[memoOfDay(cell.key)!.type].color, background: MEMO_TYPES[memoOfDay(cell.key)!.type].bg }"
                :title="memoOfDay(cell.key)!.text"
              >{{ MEMO_TYPES[memoOfDay(cell.key)!.type].label }}</span>
              <span v-if="memoOfDay(cell.key)!.title" class="cal-memo-title" :title="memoOfDay(cell.key)!.text">{{ memoOfDay(cell.key)!.title }}</span>
            </template>
          </div>
        </div>

        <!-- 选月 / 选年视图 -->
        <div v-else class="picker-grid">
          <template v-if="viewMode === 'month'">
            <button
              v-for="m in 12"
              :key="m"
              type="button"
              class="picker-cell"
              :class="{ active: m - 1 === calMonth, today: now.getFullYear() === calYear && now.getMonth() === m - 1 }"
              @click="pickMonth(m - 1)"
            >{{ m }}月</button>
          </template>
          <template v-else>
            <button
              v-for="y in YEAR_PAGE"
              :key="y"
              type="button"
              class="picker-cell"
              :class="{ active: decadeStart + y - 1 === calYear, today: decadeStart + y - 1 === now.getFullYear() }"
              @click="pickYear(decadeStart + y - 1)"
            >{{ decadeStart + y - 1 }}年</button>
          </template>
        </div>
      </el-card>

      <!-- 编辑器 -->
      <el-card shadow="never" class="editor-card">
        <template #header>
          <b>{{ editorTitle }}</b>
        </template>
        <div class="type-row">
          <el-check-tag
            v-for="(cfg, k) in MEMO_TYPES"
            :key="k"
            :checked="memoType === k"
            @change="memoType = k"
          >{{ cfg.label }}</el-check-tag>
        </div>
        <el-input v-model="memoTitle" maxlength="4" placeholder="标题（限 4 字）" class="memo-title" @input="onTitleInput" />
        <el-input v-model="memoText" type="textarea" :rows="6" maxlength="1000" placeholder="备忘详细内容" />
        <div class="editor-actions">
          <el-button type="primary" :disabled="!selected" @click="save">保存备忘</el-button>
          <el-button :disabled="!selected" @click="clear">清空该日</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.view-header {
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
.cal-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 12px;
  align-items: start;
}
.cal-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.cal-title {
  font-size: 16px;
  font-weight: 700;
  min-width: 140px;
  text-align: center;
}
.cal-title.picker {
  cursor: pointer;
  color: var(--el-color-primary);
}
.today-btn {
  margin-left: auto;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cal-weekday {
  text-align: center;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  padding: 4px 0;
}
.cal-day {
  min-height: 64px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 4px 6px;
  cursor: pointer;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.cal-day.other {
  opacity: 0.4;
}
.cal-day.today {
  border-color: var(--el-color-primary);
}
.cal-day.selected {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
}
.cal-day-num {
  font-size: 12px;
  font-weight: 600;
}
.cal-tag {
  font-size: 10px;
  border-radius: 4px;
  padding: 0 4px;
  align-self: flex-start;
}
.cal-memo-title {
  font-size: 10px;
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.picker-cell {
  height: 56px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  cursor: pointer;
  font-size: 14px;
}
.picker-cell.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 700;
}
.picker-cell.today {
  border-color: var(--el-color-warning);
}
.type-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.memo-title {
  margin-bottom: 10px;
}
.editor-actions {
  margin-top: 12px;
  display: flex;
  gap: 8px;
}
</style>
