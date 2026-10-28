<!-- 练习记录：统计条 + 会话列表（展开明细/删除/加载更多） -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as practiceApi from '../api/practice'
import type { PracticeDetailRecord, PracticeSessionRow, PracticeStats } from '../api/practice'
import { formatMs } from '../utils/format'

const MODE_NAMES: Record<string, string> = { order: '顺序', random: '随机', review: '错题重练' }

const stats = ref<PracticeStats | null>(null)
const list = ref<PracticeSessionRow[]>([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const openIds = ref<Set<number>>(new Set())
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
    const data = await practiceApi.fetchPracticeHistory(page.value)
    list.value = reset ? data.list : [...list.value, ...data.list]
    total.value = data.total
  } catch (e) {
    ElMessage.error('记录加载失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    loading.value = false
  }
}

async function toggleDetail(s: PracticeSessionRow): Promise<void> {
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
      const r = await practiceApi.fetchPracticeDetail(s.id)
      details.value[s.id] = r.records
    } catch (e) {
      details.value[s.id] = '明细加载失败：' + (e instanceof Error ? e.message : String(e))
    }
  }
}

async function removeSession(s: PracticeSessionRow): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${s.bank_name}」这次练习记录吗？`, '删除练习记录', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await practiceApi.deletePracticeSession(s.id)
    openIds.value.delete(s.id)
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

    <div v-loading="loading" class="rec-list">
      <el-card v-for="s in list" :key="s.id" shadow="never" class="rec-card">
        <div class="rec-head" @click="toggleDetail(s)">
          <div class="rec-title">
            {{ s.bank_name }}
            <span class="rec-sub">{{ MODE_NAMES[s.mode] || s.mode }} · {{ s.cat_name || '' }}{{ s.sub_name ? ' / ' + s.sub_name : '' }} · {{ s.started_at || '' }}</span>
          </div>
          <span class="rec-rate" :class="{ low: s.rate < 60 }">{{ s.rate }}%</span>
          <el-button size="small" text type="danger" @click.stop="removeSession(s)">删除</el-button>
          <span class="rec-arrow" :class="{ open: openIds.has(s.id) }">›</span>
        </div>

        <div v-if="openIds.has(s.id)" class="rec-body">
          <template v-if="detailOf(s.id)?.kind === 'loading'">加载明细…</template>
          <template v-else-if="detailOf(s.id)?.kind === 'error'">{{ (detailOf(s.id) as { msg: string }).msg }}</template>
          <template v-else-if="detailOf(s.id)?.kind === 'list'">
            <div class="rec-summary">
              共 {{ s.total_count }} 题 · 对 {{ s.correct_count }} · 错 {{ s.wrong_count }} · 跳 {{ s.skipped_count }} · 用时 {{ formatMs(s.total_ms) }}
            </div>
            <div v-for="d in (detailOf(s.id) as { kind: 'list'; data: PracticeDetailRecord[] }).data" :key="d.no" class="rec-row">
              <span class="rd-mark" :class="'m-' + d.result">{{ d.result === 'ok' ? '✓' : d.result === 'skip' ? '○' : '✗' }}</span>
              <span class="rd-stem" :title="d.stem">{{ d.stem }}</span>
              <span class="rd-ans">我的 <b>{{ d.userAnswer || '—' }}</b> · 答案 <b>{{ d.correctAnswer || '—' }}</b></span>
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
.rec-title {
  font-weight: 600;
  flex: 1;
  min-width: 0;
}
.rec-sub {
  font-weight: 400;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-left: 6px;
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
  font-size: 13px;
}
.rec-summary {
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.rec-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}
.rd-mark {
  width: 20px;
  text-align: center;
  font-weight: 700;
}
.m-ok { color: var(--el-color-success); }
.m-ng { color: var(--el-color-danger); }
.m-skip { color: var(--el-color-warning); }
.rd-stem {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rd-ans {
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}
.load-more {
  text-align: center;
  margin: 14px 0;
}
</style>
