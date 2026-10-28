<!-- 速算练习记录：统计条 + 会话列表（展开明细/删除/加载更多） -->
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
const total = ref(0)
const loading = ref(false)
const openIds = ref<Set<number>>(new Set())
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
    const data = await mentalApi.fetchMentalHistory(page.value)
    list.value = reset ? data.list : [...list.value, ...data.list]
    total.value = data.total
  } catch (e) {
    ElMessage.error('记录加载失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

async function toggleDetail(s: MentalSessionRow): Promise<void> {
  const next = new Set(openIds.value)
  if (next.has(s.id)) {
    next.delete(s.id)
    openIds.value = next
    return
  }
  next.add(s.id)
  openIds.value = next
  if (!details.value[s.id]) {
    details.value[s.id] = 'loading'
    try {
      const r = await mentalApi.fetchMentalDetail(s.id)
      details.value[s.id] = r.records
    } catch (e) {
      details.value[s.id] = '明细加载失败：' + (e instanceof Error ? e.message : String(e))
    }
  }
}

async function removeSession(s: MentalSessionRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${s.qtype_name}」这次速算记录吗？`, '删除练习记录', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await mentalApi.deleteMentalSession(s.id)
    openIds.value.delete(s.id)
    delete details.value[s.id]
    await loadPage(true)
    await loadStats()
    ElMessage.success('已删除该练习记录')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

/** 明细里的正确答案文本：填空直接文本，选择转选项 */
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
  loadStats()
  loadPage(true)
})
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

    <div v-loading="loading" class="rec-list">
      <el-card v-for="s in list" :key="s.id" shadow="never" class="rec-card">
        <div class="rec-head" @click="toggleDetail(s)">
          <div class="rec-main">
            <div class="rec-title">
              {{ s.qtype_name }}{{ s.answer_mode === 'fill' ? ' · 填空题' : '' }}
              <span class="rec-sub"> · {{ DIFF_NAMES[s.difficulty] || '不限难度' }} · {{ s.started_at || '' }}</span>
            </div>
            <div class="rec-meta">
              {{ s.total_count === 0 ? '∞ 无限流' : `共 ${s.total_count} 题` }} · 对 {{ s.correct_count }} · 错 {{ s.wrong_count }} · 跳 {{ s.skipped_count }} · 用时 {{ formatMs(s.total_ms) }}
            </div>
          </div>
          <span class="rec-rate" :class="{ low: s.rate < 60 }">{{ s.rate }}%</span>
          <el-button size="small" text type="danger" @click.stop="removeSession(s)">删除</el-button>
          <span class="rec-arrow" :class="{ open: openIds.has(s.id) }">›</span>
        </div>

        <div v-if="openIds.has(s.id)" class="rec-body">
          <template v-if="detailOf(s.id)?.kind === 'loading'">加载明细…</template>
          <template v-else-if="detailOf(s.id)?.kind === 'error'">{{ (detailOf(s.id) as { msg: string }).msg }}</template>
          <template v-else-if="detailOf(s.id)?.kind === 'list'">
            <div class="rec-grid">
              <div
                v-for="d in (detailOf(s.id) as { kind: 'list'; data: MentalDetailRecord[] }).data"
                :key="d.no"
                class="rec-cell"
                :class="'m-' + d.result"
              >
                <div class="rc-top">
                  <span class="rc-mark">{{ d.result === 'ok' ? '✓' : d.result === 'skip' ? '○' : '✗' }}</span>
                  <span class="rc-stem" :title="d.stem">{{ d.stem }}</span>
                </div>
                <div class="rc-ans">正确答案 <b>{{ correctText(d, s.answer_mode === 'fill') }}</b></div>
                <div v-if="d.tip" class="rc-tip">技巧：{{ d.tip }}</div>
              </div>
            </div>
          </template>
        </div>
      </el-card>
    </div>

    <div v-if="list.length < total" class="load-more">
      <el-button plain @click="loadPage()">加载更多（{{ list.length }}/{{ total }}）</el-button>
    </div>
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
.rec-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rec-head {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}
.rec-main {
  flex: 1;
  min-width: 0;
}
.rec-title {
  font-weight: 600;
}
.rec-sub {
  font-weight: 400;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.rec-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.rec-rate {
  font-weight: 700;
  color: var(--el-color-success);
}
.rec-rate.low {
  color: var(--el-color-danger);
}
.rec-arrow {
  font-size: 18px;
  color: var(--el-text-color-secondary);
  transition: transform 0.15s;
  display: inline-block;
}
.rec-arrow.open {
  transform: rotate(90deg);
}
.rec-body {
  margin-top: 10px;
  border-top: 1px solid var(--el-border-color-lighter);
  padding-top: 10px;
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
  background: var(--el-fill-color-blank);
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
</style>
