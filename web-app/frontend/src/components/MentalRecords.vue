<!-- 速算练习记录：统计条 + 会话表格（展开行显示明细） -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as mentalApi from '../api/mental'
import type { MentalDetailRecord, MentalSessionRow, MentalStats } from '../api/mental'
import { formatMs } from '../utils/format'

const DIFF_NAMES: Record<number, string> = { 0: '不限难度', 1: '简单', 2: '中等', 3: '困难' }

const stats = ref<MentalStats | null>(null)
const list = ref<MentalSessionRow[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const expandedKeys = ref<string[]>([])
const details = ref<Record<number, MentalDetailRecord[] | 'loading' | string>>({})

async function loadStats(): Promise<void> {
  try {
    stats.value = await mentalApi.fetchMentalStats()
  } catch (e) {
    console.error('【加载速算统计失败】', e)
  }
}

async function loadPage(reset = false): Promise<void> {
  if (reset) page.value = 1
  loading.value = true
  try {
    const data = await mentalApi.fetchMentalHistory(page.value, pageSize.value)
    list.value = data.list
    total.value = data.total
  } catch (e) {
    ElMessage.error('记录加载失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number): void {
  page.value = p
  loadPage()
}
function onSizeChange(s: number): void {
  pageSize.value = s
  page.value = 1
  loadPage()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function onExpandChange(row: MentalSessionRow, expandedRows: any): Promise<void> {
  const expanded = Array.isArray(expandedRows) && expandedRows.some((r: any) => r.id === row.id)
  // 手风琴：只保留当前展开行
  expandedKeys.value = expanded ? [String(row.id)] : []
  if (!expanded) return
  if (details.value[row.id]) return
  details.value[row.id] = 'loading'
  try {
    const res = await mentalApi.fetchMentalDetail(row.id)
    details.value[row.id] = res.records
  } catch (e) {
    details.value[row.id] = '明细加载失败：' + (e instanceof Error ? e.message : String(e))
  }
}

async function removeSession(s: MentalSessionRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${s.qtype_name}」这次速算记录吗？`, '删除练习记录', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【删除速算记录确认弹窗异常】', e)
    return
  }
  try {
    await mentalApi.deleteMentalSession(s.id)
    expandedKeys.value = []
    delete details.value[s.id]
    await loadPage(true)
    await loadStats()
    ElMessage.success('已删除该练习记录')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

function correctText(d: MentalDetailRecord, fill: boolean): string {
  if (d.answer == null) return '—'
  if (fill) return String(d.answer)
  const opt = d.options[Number(d.answer)]
  return opt != null ? String(opt) : String(d.answer)
}

function detailOf(id: number): { kind: 'list'; data: MentalDetailRecord[] } | { kind: 'loading' } | { kind: 'error'; msg: string } | null {
  const d = details.value[id]
  if (d === undefined) return null
  if (d === 'loading') return { kind: 'loading' }
  if (typeof d === 'string') return { kind: 'error', msg: d }
  return { kind: 'list', data: d }
}

onMounted(() => {
  refresh()
})

/* 切换到速算记录 tab 时由父组件调用：统计条 + 列表刷新（保留当前页） */
function refresh(): void {
  loadStats()
  loadPage()
}

defineExpose({ refresh })
</script>

<template>
  <div class="m-records">
    <div v-if="stats" class="stats-bar">
      <div><b>{{ stats.all.sessions }}</b><span>累计练习</span></div>
      <div><b>{{ stats.all.totalQ }}</b><span>累计题量</span></div>
      <div><b>{{ stats.all.rate }}%</b><span>累计正确率</span></div>
      <div><b>{{ stats.today.totalQ }}</b><span>今日题量</span></div>
      <div><b>{{ Math.round(stats.today.totalMs / 60000) }}</b><span>今日分钟</span></div>
    </div>

    <el-empty v-if="!loading && list.length === 0" description="暂无速算练习记录" />

    <el-table
      v-else
      v-loading="loading"
      :data="list"
      class="rec-table"
      stripe
      size="small"
      :height="list.length ? 560 : undefined"
      :row-key="(row: MentalSessionRow) => String(row.id)"
      :expand-row-keys="expandedKeys"
      @expand-change="(row: MentalSessionRow, expandedRows: any) => onExpandChange(row, expandedRows)"
    >
      <el-table-column type="index" label="#" width="55" align="center" :index="(i: number) => (page - 1) * pageSize + i + 1" />
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="expand-body">
            <template v-if="detailOf(row.id)?.kind === 'loading'">
              <div class="expand-loading">加载明细…</div>
            </template>
            <template v-else-if="detailOf(row.id)?.kind === 'error'">
              <div class="expand-error">{{ (detailOf(row.id) as { msg: string }).msg }}</div>
            </template>
            <template v-else-if="detailOf(row.id)?.kind === 'list'">
              <div class="rec-grid">
                <div
                  v-for="d in (detailOf(row.id) as { kind: 'list'; data: MentalDetailRecord[] }).data"
                  :key="d.no"
                  class="rec-cell"
                  :class="'m-' + d.result"
                >
                  <div class="rc-top">
                    <span class="rc-mark">{{ d.result === 'ok' ? '✓' : d.result === 'skip' ? '○' : '✗' }}</span>
                    <span class="rc-stem" :title="d.stem">{{ d.stem }}</span>
                  </div>
                  <div class="rc-ans">正确答案 <b>{{ correctText(d, row.answer_mode === 'fill') }}</b></div>
                  <div v-if="d.tip" class="rc-tip">技巧：{{ d.tip }}</div>
                </div>
              </div>
            </template>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="qtype_name" label="题型" width="200">
        <template #default="{ row }">
          <div class="cell-primary">{{ row.qtype_name }}</div>
          <div class="cell-sub">{{ row.answer_mode === 'fill' ? '填空题' : '选择题' }}</div>
        </template>
      </el-table-column>

      <el-table-column label="难度" width="90">
        <template #default="{ row }">{{ DIFF_NAMES[row.difficulty] || '不限' }}</template>
      </el-table-column>

      <el-table-column prop="total_count" label="题量" width="80" align="center" sortable>
        <template #default="{ row }">
          {{ row.total_count === 0 ? '∞' : row.total_count }}
        </template>
      </el-table-column>

      <el-table-column label="对/错/跳" width="110" align="center">
        <template #default="{ row }">
          <span class="c-ok">{{ row.correct_count }}</span> /
          <span class="c-ng">{{ row.wrong_count }}</span> /
          <span class="c-skip">{{ row.skipped_count }}</span>
        </template>
      </el-table-column>

      <el-table-column prop="total_ms" label="用时" width="100" align="center" sortable>
        <template #default="{ row }">{{ formatMs(row.total_ms) }}</template>
      </el-table-column>

      <el-table-column prop="rate" label="正确率" width="90" align="center" sortable>
        <template #default="{ row }">
          <span class="rate" :class="{ low: row.rate < 60 }">{{ row.rate }}%</span>
        </template>
      </el-table-column>

      <el-table-column prop="started_at" label="时间" min-width="150" sortable>
        <template #default="{ row }">{{ row.started_at || '—' }}</template>
      </el-table-column>

      <el-table-column label="操作" width="200" align="center" fixed="right">
        <template #default="{ row }">
          <el-button size="small" text type="danger" @click="removeSession(row as MentalSessionRow)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-if="total > 0"
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      class="rec-pager"
      @current-change="onPageChange"
      @size-change="onSizeChange"
    />
  </div>
</template>

<style scoped>
.stats-bar {
  display: flex;
  gap: 28px;
  padding: 12px 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  margin-bottom: 12px;
}
.stats-bar b {
  display: block;
  font-size: 18px;
}
.stats-bar span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rec-table {
  width: 100%;
}
.cell-primary {
  font-weight: 600;
}
.cell-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.c-ok { color: var(--el-color-success); font-weight: 600; }
.c-ng { color: var(--el-color-danger); font-weight: 600; }
.c-skip { color: var(--el-color-warning); font-weight: 600; }
.rate { font-weight: 700; color: var(--el-color-success); }
.rate.low { color: var(--el-color-danger); }
.expand-body {
  padding: 12px 16px;
  background: var(--el-fill-color-lighter);
}
.expand-loading, .expand-error {
  padding: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.rec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
}
.rec-cell {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  background: var(--el-bg-color);
}
.rc-top {
  display: flex;
  gap: 6px;
  align-items: center;
}
.rc-mark {
  font-weight: 700;
  flex-shrink: 0;
}
.m-ok .rc-mark { color: var(--el-color-success); }
.m-ng .rc-mark { color: var(--el-color-danger); }
.m-skip .rc-mark { color: var(--el-color-warning); }
.rc-stem {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rc-ans {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
}
.rc-ans b {
  color: var(--el-color-success);
}
.rc-tip {
  margin-top: 2px;
  color: var(--el-text-color-placeholder);
}
.load-more {
  text-align: center;
  margin: 14px 0;
}
.rec-pager {
  margin-top: 12px;
  justify-content: flex-end;
}
</style>
