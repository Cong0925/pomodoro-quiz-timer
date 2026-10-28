<!-- 学习统计：今日情况 + 按日/周/月汇总表（数据全部后端 SQL 聚合） -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
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

async function reload(): Promise<void> {
  loading.value = true
  try {
    data.value = await fetchStats(gran.value)
  } catch (e) {
    console.error('【加载学习统计失败】', e)
    ElMessage.error(e instanceof Error ? e.message : '加载统计失败')
  } finally {
    loading.value = false
  }
}

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

/* 当前粒度范围合计 */
const sumView = computed(() => {
  const rows = data.value?.list || []
  let questions = 0
  let skipped = 0
  let correct = 0
  let workMs = 0
  let studyMs = 0
  rows.forEach((r) => {
    questions += Number(r.questions)
    skipped += Number(r.skipped || 0)
    correct += Number(r.correct)
    workMs += Number(r.workMs)
    studyMs += Number(r.studyMs)
  })
  const rate = questions === 0 ? '—' : ((correct / questions) * 100).toFixed(1) + '%'
  const note = Math.max(0, studyMs - workMs)
  return { questions, skipped, rate, workMs, note, studyMs }
})

function rowRate(questions: number, correct: number): string {
  return questions === 0 ? '—' : ((correct / questions) * 100).toFixed(1) + '%'
}

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
      <el-radio-group v-model="gran" @change="reload">
        <el-radio-button value="day">按日</el-radio-button>
        <el-radio-button value="week">按周</el-radio-button>
        <el-radio-button value="month">按月</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 今日情况 -->
    <h3 class="section-title">今日情况</h3>
    <div v-if="todayView" class="stats-grid">
      <el-card shadow="never" class="s-card"><div class="num">{{ todayView.questions }}</div><div class="label">今日做题数</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ todayView.skipped }}</div><div class="label">今日跳过</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ todayView.rate }}</div><div class="label">今日正确率</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ formatDuration(todayView.work) }}</div><div class="label">今日做题时长</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ formatDuration(todayView.note) }}</div><div class="label">今日笔记时长</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ formatDuration(todayView.learn) }}</div><div class="label">今日学习时长</div></el-card>
    </div>

    <!-- 范围合计 -->
    <h3 class="section-title">当前范围合计（{{ gran === 'day' ? '按日' : gran === 'week' ? '按周' : '按月' }}）</h3>
    <div class="stats-grid">
      <el-card shadow="never" class="s-card"><div class="num">{{ sumView.questions }}</div><div class="label">总做题数</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ sumView.skipped }}</div><div class="label">总跳过</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ sumView.rate }}</div><div class="label">总正确率</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ formatDuration(sumView.workMs) }}</div><div class="label">总做题时长</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ formatDuration(sumView.note) }}</div><div class="label">总笔记时长</div></el-card>
      <el-card shadow="never" class="s-card"><div class="num">{{ formatDuration(sumView.studyMs) }}</div><div class="label">总学习时长</div></el-card>
    </div>

    <!-- 明细表 -->
    <el-card shadow="never" class="table-card" v-loading="loading">
      <el-empty v-if="data && data.list.length === 0" description="暂无统计数据" />
      <el-table v-else :data="data?.list || []" size="small" stripe>
        <el-table-column prop="label" label="周期" min-width="140" />
        <el-table-column prop="rounds" label="轮次" width="80" align="center" />
        <el-table-column prop="questions" label="做题数" width="90" align="center" />
        <el-table-column prop="correct" label="答对" width="80" align="center" />
        <el-table-column prop="skipped" label="跳过" width="80" align="center" />
        <el-table-column label="正确率" width="90" align="center">
          <template #default="{ row }">{{ rowRate(row.questions, row.correct) }}</template>
        </el-table-column>
        <el-table-column label="做题时长" width="110" align="center">
          <template #default="{ row }">{{ formatDuration(row.workMs) }}</template>
        </el-table-column>
        <el-table-column label="学习时长" width="110" align="center">
          <template #default="{ row }">{{ formatDuration(row.studyMs) }}</template>
        </el-table-column>
      </el-table>
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
  margin: 16px 0 10px;
  font-size: 15px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}
.s-card {
  text-align: center;
}
.s-card .num {
  font-size: 18px;
  font-weight: 700;
}
.s-card .label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.table-card {
  margin-top: 14px;
}
</style>
