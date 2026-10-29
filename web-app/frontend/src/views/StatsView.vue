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

/* 分页（后端切页） */
const page = ref(1)
const pageSize = ref(10)

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

    <!-- 今日情况：单行内联指标条（每项「数值 + 标签」横向平铺，细分隔线） -->
    <h3 class="section-title">今日</h3>
    <div v-if="todayView" class="metric-strip">
      <div class="metric">
        <div class="m-val">{{ todayView.questions }}</div>
        <div class="m-label">做题数</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ todayView.skipped }}</div>
        <div class="m-label">跳过</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ todayView.rate }}</div>
        <div class="m-label">正确率</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ formatDuration(todayView.work) }}</div>
        <div class="m-label">做题时长</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ formatDuration(todayView.note) }}</div>
        <div class="m-label">笔记时长</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ formatDuration(todayView.learn) }}</div>
        <div class="m-label">学习时长</div>
      </div>
    </div>

    <!-- 范围合计：单行内联指标条 -->
    <h3 class="section-title">总计（当前粒度范围）</h3>
    <div class="metric-strip">
      <div class="metric">
        <div class="m-val">{{ sumView.questions }}</div>
        <div class="m-label">做题数</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ sumView.skipped }}</div>
        <div class="m-label">跳过</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ sumView.rate }}</div>
        <div class="m-label">正确率</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ formatDuration(sumView.workMs) }}</div>
        <div class="m-label">做题时长</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ formatDuration(sumView.note) }}</div>
        <div class="m-label">笔记时长</div>
      </div>
      <div class="metric">
        <div class="m-val">{{ formatDuration(sumView.studyMs) }}</div>
        <div class="m-label">学习时长</div>
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
        <el-table :data="data?.list || []" size="default" stripe>
          <el-table-column prop="label" label="周期" min-width="130" />
          <el-table-column prop="rounds" label="轮次" min-width="70" align="center" />
          <el-table-column prop="questions" label="做题数" min-width="80" align="center" />
          <el-table-column prop="correct" label="答对" min-width="70" align="center" />
          <el-table-column prop="skipped" label="跳过" min-width="70" align="center" />
          <el-table-column label="正确率" min-width="80" align="center">
            <template #default="{ row }">{{ rowRate(row.questions, row.correct) }}</template>
          </el-table-column>
          <el-table-column label="做题时长" min-width="100" align="center">
            <template #default="{ row }">{{ formatDuration(row.workMs) }}</template>
          </el-table-column>
          <el-table-column label="学习时长" min-width="100" align="center">
            <template #default="{ row }">{{ formatDuration(row.studyMs) }}</template>
          </el-table-column>
        </el-table>
        <div class="stats-pager">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="data?.total || 0"
            :page-sizes="[10, 20, 50, 100]"
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
  margin: 14px 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}
/* 内联指标条：每项「数值 + 标签」纵向堆叠，项间细分隔线，窄屏自动换行 */
.metric-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  overflow: hidden;
}
.metric {
  flex: 1 1 120px;
  min-width: 110px;
  padding: 10px 8px;
  text-align: center;
}
/* 除首项外左侧加分隔线（含换行后每行首项的视觉分隔交给容器背景，保持简洁） */
.metric + .metric {
  border-left: 1px solid var(--el-border-color-lighter);
}
.m-val {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--el-text-color-primary);
}
.m-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.table-card {
  margin-top: 14px;
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
  border: 1px solid var(--el-border-color);
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.gran-tab.active {
  background: #2563eb;
  border-color: #2563eb;
  color: #fff;
}
.gran-tab:hover:not(.active) {
  background: #f3f4f6;
}
</style>
