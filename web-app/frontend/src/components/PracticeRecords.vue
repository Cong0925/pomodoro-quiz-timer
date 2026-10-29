<!-- 练习记录：统计条 + 会话表格（展开行显示明细） -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as practiceApi from '../api/practice'
import type { PracticeDetailRecord, PracticeSessionRow, PracticeStats } from '../api/practice'
import { formatMs } from '../utils/format'

const MODE_NAMES: Record<string, string> = { order: '顺序', random: '随机', review: '错题重练' }

/* HTML 题干（真题导入题 stem 为 HTML，含内嵌 <img>）→ 纯文本，供回看列表展示 */
function stripHtml(html: string): string {
  return (html || '')
    .replace(/<img[^>]*>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

const stats = ref<PracticeStats | null>(null)
const list = ref<PracticeSessionRow[]>([])
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const expandedKeys = ref<string[]>([])
const details = ref<Record<number, PracticeDetailRecord[] | 'loading' | string>>({})

async function loadStats(): Promise<void> {
  try {
    stats.value = await practiceApi.fetchPracticeStats()
  } catch (e) {
    console.error('【加载练习统计失败】', e)
  }
}

async function loadPage(reset = false): Promise<void> {
  if (reset) page.value = 1
  loading.value = true
  try {
    const data = await practiceApi.fetchPracticeHistory(page.value, pageSize.value)
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
async function onExpandChange(row: PracticeSessionRow, expandedRows: any): Promise<void> {
  const expanded = Array.isArray(expandedRows) && expandedRows.some((r: any) => r.id === row.id)
  // 手风琴：只保留当前展开行
  expandedKeys.value = expanded ? [String(row.id)] : []
  if (!expanded) return
  if (details.value[row.id]) return
  details.value[row.id] = 'loading'
  try {
    const res = await practiceApi.fetchPracticeDetail(row.id)
    details.value[row.id] = res.records
  } catch (e) {
    details.value[row.id] = '明细加载失败：' + (e instanceof Error ? e.message : String(e))
  }
}

async function removeSession(s: PracticeSessionRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${s.bank_name}」这次练习记录吗？`, '删除练习记录', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【删除练习记录确认弹窗异常】', e)
    return
  }
  try {
    await practiceApi.deletePracticeSession(s.id)
    expandedKeys.value = []
    delete details.value[s.id]
    await loadPage(true)
    await loadStats()
    ElMessage.success('已删除该练习记录')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

function detailOf(id: number): { kind: 'list'; data: PracticeDetailRecord[] } | { kind: 'loading' } | { kind: 'error'; msg: string } | null {
  const d = details.value[id]
  if (d === undefined) return null
  if (d === 'loading') return { kind: 'loading' }
  if (typeof d === 'string') return { kind: 'error', msg: d }
  return { kind: 'list', data: d }
}

onMounted(() => {
  loadStats()
  loadPage(true)
})
</script>

<template>
  <div class="records">
    <!-- 统计条 -->
    <div v-if="stats" class="stats-bar">
      <div><b>{{ stats.all.sessions }}</b><span>累计练习</span></div>
      <div><b>{{ stats.all.totalQ }}</b><span>累计题量</span></div>
      <div><b>{{ stats.all.rate }}%</b><span>累计正确率</span></div>
      <div><b>{{ stats.today.totalQ }}</b><span>今日题量</span></div>
      <div><b>{{ Math.round(stats.today.totalMs / 60000) }}</b><span>今日分钟</span></div>
    </div>

    <el-empty v-if="!loading && list.length === 0" description="暂无练习记录" />

    <el-table
      v-else
      v-loading="loading"
      :data="list"
      class="rec-table"
      stripe
      size="small"
      :height="list.length ? 560 : undefined"
      :row-key="(row: PracticeSessionRow) => String(row.id)"
      :expand-row-keys="expandedKeys"
      @expand-change="(row: PracticeSessionRow, expandedRows: any) => onExpandChange(row, expandedRows)"
    >
      <el-table-column type="index" label="#" width="55" align="center" :index="(i: number) => (page - 1) * pageSize + i + 1" />
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="expand-body">
            <div class="rec-summary">
              共 {{ row.total_count }} 题 · 对 <span class="c-ok">{{ row.correct_count }}</span> ·
              错 <span class="c-ng">{{ row.wrong_count }}</span> ·
              跳 <span class="c-skip">{{ row.skipped_count }}</span> ·
              用时 {{ formatMs(row.total_ms) }}
            </div>
            <template v-if="detailOf(row.id)?.kind === 'loading'">
              <div class="expand-loading">加载明细…</div>
            </template>
            <template v-else-if="detailOf(row.id)?.kind === 'error'">
              <div class="expand-error">{{ (detailOf(row.id) as { msg: string }).msg }}</div>
            </template>
            <template v-else-if="detailOf(row.id)?.kind === 'list'">
              <div class="detail-list">
                <div
                  v-for="d in (detailOf(row.id) as { kind: 'list'; data: PracticeDetailRecord[] }).data"
                  :key="d.no"
                  class="detail-row"
                >
                  <span class="rd-mark" :class="'m-' + d.result">{{ d.result === 'ok' ? '✓' : d.result === 'skip' ? '○' : '✗' }}</span>
                  <span class="rd-no">#{{ d.no }}</span>
                  <span class="rd-stem-wrap">
                    <el-image
                      v-if="d.stemImg && d.stemImg.length"
                      :src="d.stemImg[0]"
                      :preview-src-list="d.stemImg"
                      fit="contain"
                      class="rd-stem-img"
                    />
                    <span class="rd-stem" :title="stripHtml(d.stem)">{{ stripHtml(d.stem) || (d.stemImg && d.stemImg.length ? '[图片题]' : '（题目已删除）') }}</span>
                  </span>
                  <span class="rd-ans">我的 <b>{{ d.userAnswer || '—' }}</b> · 答案 <b>{{ d.correctAnswer || '—' }}</b></span>
                </div>
              </div>
            </template>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="题库" width="300">
        <template #default="{ row }">
          <div class="cell-primary">{{ row.bank_name }}</div>
          <div class="cell-sub">{{ row.cat_name || '' }}{{ row.sub_name ? ' / ' + row.sub_name : '' }}</div>
        </template>
      </el-table-column>

      <el-table-column label="模式" width="90">
        <template #default="{ row }">{{ MODE_NAMES[row.mode] || row.mode }}</template>
      </el-table-column>

      <el-table-column prop="total_count" label="题量" width="80" align="center" sortable>
        <template #default="{ row }">{{ row.total_count }}</template>
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
          <el-button size="small" text type="danger" @click="removeSession(row as PracticeSessionRow)">删除</el-button>
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
.rec-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-bottom: 10px;
}
.expand-loading, .expand-error {
  padding: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.detail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.detail-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  font-size: 13px;
  border-radius: 4px;
}
.detail-row:hover {
  background: var(--el-fill-color);
}
.rd-mark {
  width: 22px;
  text-align: center;
  font-weight: 700;
  flex-shrink: 0;
}
.m-ok { color: var(--el-color-success); }
.m-ng { color: var(--el-color-danger); }
.m-skip { color: var(--el-color-warning); }
.rd-no {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
  flex-shrink: 0;
}
.rd-stem {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rd-stem-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.rd-stem-wrap .rd-stem {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rd-stem-img {
  width: 40px;
  height: 40px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  flex-shrink: 0;
}
.rd-ans {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  font-size: 12px;
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
