<!-- 学习统计：今日情况 + 按日/周/月汇总表（数据全部后端 SQL 聚合） -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchStats } from '../api/stats'
import type { StatsData, StatsGran } from '../types'
import { formatDuration } from '../utils/format'
import { useStudyStore } from '../stores/studyStore'

defineOptions({ name: 'StatsView' })

const studyStore = useStudyStore()
const gran = ref<StatsGran>('day')
const data = ref<StatsData | null>(null)
const loading = ref(false)
let refreshTimer: number | null = null

/* 分页（后端切页；默认 50 条，数据量与主版本表格一致时不再显示分页） */
const page = ref(1)
const pageSize = ref(50)

async function reload(): Promise<void> {
  loading.value = true
  try {
    const d = await fetchStats(gran.value, page.value, pageSize.value)
    /* 页码越界回退（数据变动后当前页可能超出总页数） */
    if (d.list.length === 0 && d.total > 0 && page.value > 1) {
      page.value = d.totalPages
      return
    }
    data.value = d
    /* 今日卡学习时长以后端权威入库值为基准，叠加本次会话未上报尾量，避免与按日表格口径打架 */
    studyStore.syncTodayBase(Number(d.today?.studyMs ?? 0))
  } catch (e) {
    console.error('【加载学习统计失败】', e)
    ElMessage.error(e instanceof Error ? e.message : '加载统计失败')
  } finally {
    loading.value = false
  }
}

/* 切粒度：重置页码并刷新（page 已为 1 时 watch 不触发，需手动 reload） */
function switchGran(g: StatsGran): void {
  gran.value = g
  if (page.value === 1) reload()
  else page.value = 1
}

watch([page, pageSize], () => reload())

/* 今日做题时长/学习时长（笔记时长 = 学习 - 做题，与主版本口径一致） */
const todayView = computed(() => {
  const t = data.value?.today
  if (!t) return null
  const learn = studyStore.todayTotal
  const work = Number(t.workMs)
  const note = Math.max(0, learn - work)
  const rate = t.questions === 0 ? '—' : ((t.correct / t.questions) * 100).toFixed(1) + '%'
  return { questions: t.questions, skipped: t.skipped || 0, rate, work, note, learn }
})

/* 当前粒度范围合计（后端对全段列表求和，不受分页影响） */
const sumView = computed(() => {
  const s = data.value?.sum
  if (!s) return { questions: 0, skipped: 0, rate: '—', workMs: 0, note: 0, studyMs: 0 }
  const rate = s.questions === 0 ? '—' : ((s.correct / s.questions) * 100).toFixed(1) + '%'
  const note = Math.max(0, s.studyMs - s.workMs)
  return { questions: s.questions, skipped: s.skipped, rate, workMs: s.workMs, note, studyMs: s.studyMs }
})

function rowRate(questions: number, correct: number): string {
  return questions === 0 ? '—' : ((correct / questions) * 100).toFixed(1) + '%'
}

interface StatCard {
  label: string
  value: string | number
}

/* 今日 / 合计均为 6 张统计卡：2 行 3 列，避免单行 6 项挤成 5+1 */
const todayCards = computed<StatCard[]>(() => {
  const v = todayView.value
  if (!v) return []
  return [
    { label: '做题数', value: v.questions },
    { label: '跳过', value: v.skipped },
    { label: '正确率', value: v.rate },
    { label: '做题时长', value: formatDuration(v.work) },
    { label: '笔记时长', value: formatDuration(v.note) },
    { label: '学习时长', value: formatDuration(v.learn) },
  ]
})

const sumCards = computed<StatCard[]>(() => [
  { label: '做题数', value: sumView.value.questions },
  { label: '跳过', value: sumView.value.skipped },
  { label: '正确率', value: sumView.value.rate },
  { label: '做题时长', value: formatDuration(sumView.value.workMs) },
  { label: '笔记时长', value: formatDuration(sumView.value.note) },
  { label: '学习时长', value: formatDuration(sumView.value.studyMs) },
])

onMounted(() => {
  reload()
  /* 每 30 秒刷新（今日学习时长实时增长） */
  refreshTimer = window.setInterval(() => {
    reload()
  }, 30000)
})

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="stats-view">
    <div class="view-header">
      <div>
        <h2>学习统计</h2>
        <p class="mode-desc">今日情况 + 按日/周/月汇总；正确率分母为全部题数（跳过计错）</p>
      </div>
    </div>

    <!-- 今日情况：2 行 3 列蓝调统计卡（与主版本一致） -->
    <h3 class="section-title today-title">今日</h3>
    <div v-if="todayCards.length" class="stat-grid">
      <div v-for="c in todayCards" :key="c.label" class="stat-card today">
        <div class="s-val">{{ c.value }}</div>
        <div class="s-label">{{ c.label }}</div>
      </div>
    </div>

    <!-- 范围合计：同规格 6 卡，白底与今日蓝卡区分 -->
    <h3 class="section-title">总计（当前粒度范围）</h3>
    <div class="stat-grid">
      <div v-for="c in sumCards" :key="c.label" class="stat-card total">
        <div class="s-val">{{ c.value }}</div>
        <div class="s-label">{{ c.label }}</div>
      </div>
    </div>

    <!-- 粒度切换（原版：表格上方居中胶囊按钮组） -->
    <div class="gran-tabs">
      <button class="gran-tab" :class="{ active: gran === 'day' }" @click="switchGran('day')">按日</button>
      <button class="gran-tab" :class="{ active: gran === 'week' }" @click="switchGran('week')">按周</button>
      <button class="gran-tab" :class="{ active: gran === 'month' }" @click="switchGran('month')">按月</button>
    </div>

    <!-- 明细表 -->
    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-empty v-if="data && data.total === 0" description="暂无统计数据" />
      <template v-else>
        <el-table :data="data?.list || []" size="default" stripe class="stats-table">
          <el-table-column prop="label" label="周期" min-width="100" />
          <el-table-column prop="rounds" label="轮次" min-width="60" align="center" />
          <el-table-column prop="questions" label="做题数" min-width="66" align="center" />
          <el-table-column prop="correct" label="答对" min-width="60" align="center" />
          <el-table-column prop="skipped" label="跳过" min-width="60" align="center" />
          <el-table-column label="正确率" min-width="72" align="center">
            <template #default="{ row }">{{ rowRate(row.questions, row.correct) }}</template>
          </el-table-column>
          <el-table-column label="做题时长" min-width="80" align="center">
            <template #default="{ row }">{{ formatDuration(row.workMs) }}</template>
          </el-table-column>
          <el-table-column label="学习时长" min-width="80" align="center">
            <template #default="{ row }">{{ formatDuration(row.studyMs) }}</template>
          </el-table-column>
        </el-table>
        <div v-if="(data?.total || 0) > pageSize" class="stats-pager">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="data?.total || 0"
            :page-sizes="[50, 100, 200]"
            layout="total, sizes, prev, pager, next"
            background
            size="small"
            @size-change="page = 1"
          />
        </div>
      </template>
    </el-card>
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
.section-title {
  margin: 18px 0 10px;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--app-text);
}
.today-title {
  margin-top: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--app-primary);
}
/* 统计卡：2 行 3 列，今日蓝调 / 合计白底，规格完全一致 */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.stat-card {
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 14px 16px;
  min-height: 74px;
}
.stat-card.today {
  background: #eff6ff;
  border-color: #bfdbfe;
}
.stat-card.total {
  background: #fff;
}
.s-val {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--app-text);
  font-variant-numeric: tabular-nums;
}
.stat-card.today .s-val {
  color: #1d4ed8;
}
.s-label {
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--app-text-secondary);
}
.stat-card.today .s-label {
  color: #1e40af;
}
.table-card {
  margin-top: 14px;
}
.table-card :deep(.el-card__body) {
  padding: 14px 12px;
}
.stats-table :deep(.el-table__header .cell) {
  white-space: nowrap;
  word-break: keep-all;
}
.stats-pager {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
.gran-tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 18px 0 12px;
}
.gran-tab {
  padding: 7px 20px;
  border: 1px solid var(--app-border);
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--app-text-regular);
}
.gran-tab.active {
  background: var(--app-primary);
  border-color: var(--app-primary);
  color: #fff;
  font-weight: 600;
}
.gran-tab:hover:not(.active) {
  background: #f3f4f6;
}
@media (max-width: 900px) {
  .stat-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
