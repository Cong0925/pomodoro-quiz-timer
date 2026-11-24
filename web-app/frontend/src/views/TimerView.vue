<!-- 计时模式：单题/整组（空格主控，Y/N/P 快捷键，整组错题标记面板） -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import CatSelect from '../components/CatSelect.vue'
import { useTimer } from '../composables/useTimer'
import { useHistoryStore } from '../stores/historyStore'
import { useCategoriesStore } from '../stores/categoriesStore'
import type { HistoryArchivePayload } from '../types'
import { formatTime } from '../utils/format'

defineOptions({ name: 'TimerView' })

const route = useRoute()
const historyStore = useHistoryStore()
const catStore = useCategoriesStore()

/* ---- 刷题分类选择（记忆上次，无记忆/失效时默认公务员考试 gk） ---- */
const DEFAULT_CAT_ID = 'gk'
const lastSel = catStore.loadLastSel()
const selCatId = ref(catStore.findCat(lastSel.catId) ? lastSel.catId : DEFAULT_CAT_ID)
const selSubId = ref(catStore.findSub(selCatId.value, lastSel.subId) ? lastSel.subId : '')

watch(selCatId, (v) => {
  catStore.saveLastSel(v, '')
  selSubId.value = ''
})
watch(selSubId, (v) => {
  catStore.saveLastSel(selCatId.value, v)
})

/* ---- 计时状态机 ---- */
const timer = useTimer({
  archive: async (payload: HistoryArchivePayload) => {
    const id = await historyStore.archive(payload)
    return id
  },
  notify: (msg, type) => {
    if (type === 'error') ElMessage.error(msg)
    else if (type === 'success') ElMessage.success(msg)
    else ElMessage.info(msg)
  },
  getCat: () => {
    const cat = catStore.findCat(selCatId.value)
    const sub = cat ? catStore.findSub(cat.id, selSubId.value) : null
    return {
      catId: cat ? cat.id : '',
      catName: cat ? cat.name : '',
      subId: sub ? sub.id : '',
      subName: sub ? sub.name : '',
    }
  },
})

/* ---- 路由参数驱动模式 ---- */
watch(
  () => route.params.mode,
  (m) => {
    if (m === 'batch' || m === 'single') timer.applyMode(m)
  },
  { immediate: true }
)

/* ---- 整组题量选择 ---- */
const batchCount = ref('20')
const customCount = ref<number | null>(null)

watch(batchCount, (v) => {
  if (v === 'custom') return
  timer.maxRound.value = Number(v)
})
watch(customCount, (v) => {
  if (batchCount.value === 'custom' && v && v > 0) {
    timer.maxRound.value = v
  }
})

/* ---- 整组完成面板排版：默认按 50 题断点换列，130 题可切国考答题卡版式 ---- */
type BatchLayoutPreset = 'default' | 'gk2025-before' | 'gk2025-after'
interface BatchLayoutRowDef {
  count: number
  subs?: Array<{ label: string; count: number }>
}
interface BatchLayoutGroupDef {
  label: string
  rows: BatchLayoutRowDef[]
}
interface BatchLayoutRow {
  cells: number[]
  subs?: Array<{ label: string; count: number }>
}
interface BatchLayoutGroup {
  label: string
  total: number
  rows: BatchLayoutRow[]
}

const BATCH_LAYOUT_PRESETS: Record<Exclude<BatchLayoutPreset, 'default'>, BatchLayoutGroupDef[]> = {
  'gk2025-before': [
    { label: '常识判断', rows: [{ count: 20 }] },
    { label: '言语理解与表达', rows: [{ count: 20 }, { count: 20 }] },
    { label: '数量关系', rows: [{ count: 10 }] },
    {
      label: '判断推理',
      rows: [
        { count: 20, subs: [{ label: '图形推理', count: 10 }, { label: '定义判断', count: 10 }] },
        { count: 20, subs: [{ label: '类比推理', count: 10 }, { label: '逻辑判断', count: 10 }] },
      ],
    },
    { label: '资料分析', rows: [{ count: 20 }] },
  ],
  'gk2025-after': [
    { label: '政治理论', rows: [{ count: 20 }] },
    { label: '常识判断', rows: [{ count: 15 }] },
    { label: '言语理解与表达', rows: [{ count: 20 }, { count: 10 }] },
    { label: '数量关系', rows: [{ count: 10 }] },
    {
      label: '判断推理',
      rows: [
        { count: 20, subs: [{ label: '图形推理', count: 10 }, { label: '定义判断', count: 10 }] },
        { count: 15, subs: [{ label: '类比推理', count: 5 }, { label: '逻辑判断', count: 10 }] },
      ],
    },
    { label: '资料分析', rows: [{ count: 20 }] },
  ],
}

const batchLayout = ref<BatchLayoutPreset>('default')
const batchLayoutOptions = computed(() => {
  const base = [{ value: 'default', label: '默认' }]
  if (timer.maxRound.value !== 130) return base
  return [
    ...base,
    { value: 'gk2025-before', label: '国考2025前' },
    { value: 'gk2025-after', label: '国考2025后' },
  ]
})

/* 130 题默认进入「国考2025后」版式；题量不足 130 时自动收回默认 */
watch(
  () => timer.maxRound.value,
  (total) => {
    if (total === 130 && batchLayout.value === 'default') {
      batchLayout.value = 'gk2025-after'
      return
    }
    if (total !== 130 && batchLayout.value !== 'default') batchLayout.value = 'default'
  },
  { immediate: true }
)

const batchCustomGroups = computed<BatchLayoutGroup[]>(() => {
  if (batchLayout.value === 'default' || timer.maxRound.value !== 130) return []
  const defs = BATCH_LAYOUT_PRESETS[batchLayout.value]
  let cursor = 0
  return defs.map((group) => {
    const rows = group.rows.map((row) => {
      const start = cursor
      cursor += row.count
      return {
        cells: Array.from({ length: row.count }, (_, i) => start + i),
        subs: row.subs,
      }
    })
    return {
      label: group.label,
      total: rows.reduce((sum, row) => sum + row.cells.length, 0),
      rows,
    }
  })
})

const batchColumnCount = computed(() => {
  if (batchCustomGroups.value.length) return 20
  return timer.maxRound.value > 50 ? 10 : 5
})

const batchDialogWidth = computed(() => {
  if (batchCustomGroups.value.length) return 'min(960px, calc(100vw - 28px))'
  return timer.maxRound.value > 50 ? '720px' : '560px'
})

/* ---- 全局键盘 ---- */
function isInputFocused(): boolean {
  const tag = document.activeElement && document.activeElement.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

function onKeydown(e: KeyboardEvent): void {
  /* keep-alive 下监听常驻，仅计时页响应（防止切到其他页面误触快捷键） */
  if (route.name !== 'timer') return
  /* 整组错题标记面板 */
  if (timer.showBatchPanel.value) {
    const key = e.key.toLowerCase()
    if (key === 'n') { e.preventDefault(); timer.setCell(timer.batchCurIdx.value, 'ng'); timer.moveSel(1); return }
    if (key === 'y') { e.preventDefault(); timer.setCell(timer.batchCurIdx.value, null); timer.moveSel(1); return }
    if (key === 'p') { e.preventDefault(); timer.setCell(timer.batchCurIdx.value, 'skip'); timer.moveSel(1); return }
    if (e.key === 'ArrowLeft') { e.preventDefault(); timer.moveSel(-1); return }
    if (e.key === 'ArrowRight') { e.preventDefault(); timer.moveSel(1); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); timer.moveSel(-batchColumnCount.value); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); timer.moveSel(batchColumnCount.value); return }
    if (e.key === 'Enter') { e.preventDefault(); timer.finishBatchRound(); return }
    if (e.code === 'Space') { e.preventDefault(); timer.finishBatchRound(); return }
    return
  }
  /* 单题对错弹窗 */
  if (timer.showResultModal.value) {
    const key = e.key.toLowerCase()
    if (key === 'y') { e.preventDefault(); timer.confirmResult('ok'); return }
    if (key === 'n') { e.preventDefault(); timer.confirmResult('ng'); return }
    if (key === 'p') { e.preventDefault(); timer.confirmResult('skip'); return }
    return
  }
  /* 空格主控（输入框聚焦时不触发） */
  if (e.code !== 'Space') return
  if (isInputFocused()) return
  e.preventDefault()
  timer.onSpace()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

const modeTitle = computed(() => (timer.mode.value === 'single' ? '单题模式' : '整组模式'))
const modeDesc = computed(() =>
  timer.mode.value === 'single'
    ? '每题独立计时 · 空格开始 / 结束一题 · Y=对 N=错 P=没做跳过'
    : '空格开始整组计时，再次按空格结束并标记错题；中途可点「暂停」停表，再点「继续」接着计时'
)
</script>

<template>
  <div class="timer-view">
    <div class="view-header">
      <div>
        <h2>{{ modeTitle }}</h2>
        <p class="mode-desc">{{ modeDesc }}</p>
      </div>
    </div>

    <el-card shadow="never" class="block-card">
      <div class="cat-row">
        <span class="label">刷题类型：</span>
        <CatSelect v-model:cat-id="selCatId" v-model:sub-id="selSubId" />
        <span class="hint">选择本轮刷题类型，便于按分类查找；可在「分类管理」中自定义</span>
      </div>
    </el-card>

    <el-card shadow="never" class="block-card">
      <div class="meta-row">
        <span class="meta-label">标题</span>
        <el-input v-model="timer.roundMeta.title" maxlength="60" placeholder="本轮标题（回车确认后空格开始计时）" />
      </div>
      <div class="meta-row">
        <span class="meta-label">描述</span>
        <el-input v-model="timer.roundMeta.desc" maxlength="120" placeholder="练习册 / 题号范围 / 训练内容" />
      </div>
      <div class="batch-setting">
        <span class="meta-label">本轮题量</span>
        <el-select v-model="batchCount" style="width: 110px">
          <el-option value="10" label="10 题" />
          <el-option value="15" label="15 题" />
          <el-option value="20" label="20 题" />
          <el-option value="100" label="100 题" />
          <el-option value="130" label="130 题" />
          <el-option value="custom" label="自定义" />
        </el-select>
        <el-input-number
          v-if="batchCount === 'custom'"
          v-model="customCount"
          :min="1"
          :max="200"
          placeholder="题数"
          style="width: 120px; margin-left: 8px"
        />
      </div>
    </el-card>

    <el-card shadow="never" class="block-card stage-card">
      <div class="time-display">{{ timer.timeText.value }}</div>
      <div class="info-bar">
        <div class="info-line">
          本轮：<b>{{ timer.records.value.length }}</b>/<b>{{ timer.maxRound.value }}</b> 题
          <span class="info-gap">总用时：<b>{{ formatTime(timer.totalMs.value) }}</b></span>
        </div>
        <div class="info-line">
          答对：<b>{{ timer.correctCount.value }}</b> 题
          <span class="info-gap">正确率：<b>{{ timer.rateText.value }}</b></span>
        </div>
      </div>
      <div class="btn-group">
        <!-- 单题模式：空格开始 / 结束当前题 -->
        <template v-if="timer.mode.value === 'single'">
          <el-button
            v-if="!timer.showNewRoundBtn.value && !timer.isTiming.value"
            type="primary"
            @click="timer.onSpace()"
          >{{ timer.records.value.length ? '继续计时（空格）' : '开始计时（空格）' }}</el-button>
          <el-button
            v-else-if="!timer.showNewRoundBtn.value"
            type="primary"
            @click="timer.onSpace()"
          >暂停（空格）</el-button>
        </template>
        <!-- 整组模式：空格开始 / 结束；暂停、继续只走按钮，暂停时间不计入本轮 -->
        <template v-else>
          <el-button
            v-if="!timer.showNewRoundBtn.value && !timer.isTiming.value && !timer.isPaused.value"
            type="primary"
            @click="timer.onSpace()"
          >开始计时（空格）</el-button>
          <el-button
            v-if="!timer.showNewRoundBtn.value && (timer.isTiming.value || timer.isPaused.value)"
            type="primary"
            @click="timer.toggleBatchPause()"
          >{{ timer.isPaused.value ? '继续计时' : '暂停计时' }}</el-button>
          <el-button
            v-if="!timer.showNewRoundBtn.value && (timer.isTiming.value || timer.isPaused.value)"
            @click="timer.onSpace()"
          >结束（空格）</el-button>
        </template>
        <el-button
          type="danger"
          @click="timer.stop()"
          :disabled="!timer.isTiming.value && !timer.isPaused.value"
        >停止</el-button>
        <el-button
          class="btn-gray"
          @click="timer.clearRound()"
          :disabled="timer.records.value.length === 0 && !timer.isTiming.value && !timer.isPaused.value"
        >清空本轮</el-button>
        <el-button v-if="timer.showNewRoundBtn.value" type="primary" @click="timer.startNewRound()">开启新一轮</el-button>
      </div>
    </el-card>

    <!-- 本轮记录（5 题一列，主版本同款白底记录面板） -->
    <div class="record-panel">
      <div v-if="timer.records.value.length" class="record-wrap">
        <div v-for="(col, ci) in timer.recordColumns.value" :key="ci" class="record-column">
          <div class="col-title">第{{ ci + 1 }}组</div>
          <div v-for="rec in col" :key="rec.no" class="record-item">
            <template v-if="timer.mode.value === 'single'">
              第{{ rec.no }}题：{{ rec.timeStr }}
              <span
                class="mark mark-toggle"
                :class="'mark-' + rec.result"
                title="点击修正本题状态（计时中请先暂停）"
                @click="timer.toggleRecordResult(rec.no)"
              >{{ rec.result === 'ok' ? '✓' : rec.result === 'skip' ? '○' : '✗' }}</span>
            </template>
            <template v-else>
              第{{ rec.no }}题
              <span class="mark" :class="'mark-' + rec.result">{{ rec.result === 'ok' ? '✓' : rec.result === 'skip' ? '○' : '✗' }}</span>
            </template>
          </div>
        </div>
      </div>
      <div v-else class="record-empty">本轮暂无记录，开始计时后这里会显示每题的用时与对错标记</div>
    </div>

    <!-- 单题对错弹窗 -->
    <el-dialog v-model="timer.showResultModal.value" width="420px" :close-on-click-modal="false" :show-close="false" align-center class="result-dialog">
      <template #header>
        <div class="result-dialog-title">本题结果？</div>
      </template>
      <div class="result-hint">键盘快捷键：Y = 对，N = 错，P = 没做跳过</div>
      <div class="result-btns">
        <el-button type="success" size="large" @click="timer.confirmResult('ok')">对（Y）</el-button>
        <el-button type="danger" size="large" @click="timer.confirmResult('ng')">错（N）</el-button>
        <el-button type="warning" size="large" @click="timer.confirmResult('skip')">跳过（P）</el-button>
      </div>
    </el-dialog>

    <!-- 整组错题标记面板：默认 ≤50 题 5 列、>50 题 10 列；130 题可切国考答题卡版式 -->
    <el-dialog
      v-model="timer.showBatchPanel.value"
      :width="batchDialogWidth"
      :close-on-click-modal="false"
      :show-close="false"
      align-center
      class="batch-dialog"
    >
      <template #header>
        <div class="batch-head">
          <div class="batch-head-main">
            <span class="batch-eyebrow">✓ 整组完成</span>
            <h3 class="batch-title">标记错题与跳过</h3>
          </div>
          <div class="batch-head-side">
            <span class="batch-layout-label">排版</span>
            <el-select v-model="batchLayout" size="small" class="batch-layout-select">
              <el-option v-for="opt in batchLayoutOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <span class="batch-total">共 {{ timer.maxRound.value }} 题</span>
          </div>
        </div>
        <p class="batch-subtitle">
          默认全部正确，点击题号切换：
          <span class="batch-legend ng"><i></i>错</span>
          <span class="batch-arrow">→</span>
          <span class="batch-legend skip"><i></i>没做</span>
          <span class="batch-arrow">→</span>
          <span class="batch-legend ok"><i></i>恢复</span>
        </p>
      </template>

      <div v-if="batchCustomGroups.length" class="result-sections">
        <section v-for="group in batchCustomGroups" :key="group.label" class="result-section">
          <div class="result-section-head">
            <span class="result-section-title">{{ group.label }}</span>
            <span class="result-section-count">{{ group.total }} 题</span>
          </div>
          <div v-for="(row, rowIdx) in group.rows" :key="rowIdx" class="result-row-block">
            <div v-if="row.subs" class="result-subrow">
              <span
                v-for="sub in row.subs"
                :key="sub.label"
                :style="{ gridColumn: `span ${sub.count}` }"
              >
                {{ sub.label }}<em>{{ sub.count }}</em>
              </span>
            </div>
            <div class="result-row">
              <button
                v-for="i in row.cells"
                :key="i"
                class="result-cell"
                :class="{ ng: timer.batchResults.value[i] === 'ng', skip: timer.batchResults.value[i] === 'skip', selected: i === timer.batchCurIdx.value }"
                @click="timer.cycleCell(i)"
              >
                <span class="no">{{ i + 1 }}</span>
                <span class="mark">{{ timer.batchResults.value[i] === 'ng' ? '✗' : timer.batchResults.value[i] === 'skip' ? '○' : '' }}</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      <div v-else class="result-grid" :class="{ 'result-grid--wide': timer.maxRound.value > 50 }">
        <button
          v-for="(_, i) in timer.batchResults.value"
          :key="i"
          class="result-cell"
          :class="{ ng: timer.batchResults.value[i] === 'ng', skip: timer.batchResults.value[i] === 'skip', selected: i === timer.batchCurIdx.value }"
          @click="timer.cycleCell(i)"
        >
          <span class="no">{{ i + 1 }}</span>
          <span class="mark">{{ timer.batchResults.value[i] === 'ng' ? '✗' : timer.batchResults.value[i] === 'skip' ? '○' : '' }}</span>
        </button>
      </div>

      <div class="batch-summary">
        <div class="batch-stat ng">
          <span class="batch-stat-label"><i></i>已标错</span>
          <span class="batch-stat-value">{{ timer.batchProgress.value.wrong }}<small>题</small></span>
        </div>
        <div class="batch-stat skip">
          <span class="batch-stat-label"><i></i>没做</span>
          <span class="batch-stat-value">{{ timer.batchProgress.value.skipped }}<small>题</small></span>
        </div>
        <div class="batch-stat ok">
          <span class="batch-stat-label"><i></i>默认正确</span>
          <span class="batch-stat-value">{{ timer.batchProgress.value.correct }}<small>题</small></span>
        </div>
      </div>

      <template #footer>
        <div class="batch-footer">
          <div class="batch-shortcuts">
            <span><kbd>N</kbd>错</span>
            <span><kbd>Y</kbd>正确</span>
            <span><kbd>P</kbd>跳过</span>
            <span><kbd>←→ ↑↓</kbd>移动/翻页</span>
          </div>
          <div class="batch-actions">
            <el-button size="large" @click="timer.cancelBatchRound()">取消本轮</el-button>
            <el-button size="large" type="primary" @click="timer.finishBatchRound()">完成归档</el-button>
          </div>
        </div>
      </template>
    </el-dialog>
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
.batch-setting {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.meta-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.block-card {
  margin-bottom: 16px;
}
.block-card :deep(.el-card__body) {
  padding: 18px 24px;
}
.cat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cat-row .label {
  font-size: 14px;
}
.cat-row .hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.meta-row .el-input {
  flex: 1;
}
.stage-card {
  text-align: center;
  padding: 12px 0 8px;
}
.time-display {
  font-size: 104px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  line-height: 1.15;
  margin: 8px 0 14px;
  color: var(--app-text);
}
.info-bar {
  color: var(--el-text-color-regular);
  margin-bottom: 16px;
  line-height: 1.7;
}
.info-line {
  font-size: 20px;
}
.info-gap {
  margin-left: 24px;
}
.btn-group {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
.btn-group :deep(.el-button) {
  margin-left: 0;
}
.btn-gray {
  background: #6b7280;
  color: #fff;
  border-color: #6b7280;
}
.btn-gray:hover {
  background: #4b5563;
  border-color: #4b5563;
  color: #fff;
}
/* 本轮记录：主版本同款白底面板 + 5 题一列 */
.record-panel {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #fff;
  padding: 18px 24px;
  min-height: 112px;
}
.record-wrap {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.record-column {
  min-width: 150px;
}
.col-title {
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-bottom: 6px;
}
.record-item {
  background: #f8fafc;
  border: 1px solid var(--app-border-light);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 6px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.record-empty {
  padding: 18px 0;
  text-align: center;
  font-size: 13px;
  color: #9aa1ac;
}
@media (max-width: 900px) {
  .time-display {
    font-size: 72px;
  }
  .info-line {
    font-size: 16px;
  }
  .info-gap {
    margin-left: 12px;
  }
}
.mark {
  font-weight: 700;
}
.mark-ok { color: var(--el-color-success); }
.mark-ng { color: var(--el-color-danger); }
.mark-skip { color: var(--el-color-warning); }
.mark-toggle { cursor: pointer; }
/* 单题对错弹窗：弹窗内容 teleport 到 body，scoped 样式不生效，须用 :global 包裹 */
:global(.result-dialog .el-dialog__header) {
  padding-bottom: 2px;
}
:global(.result-dialog .result-dialog-title) {
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  color: var(--el-text-color-primary);
}
:global(.result-dialog .result-hint) {
  margin: 0 0 14px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
:global(.result-dialog .result-btns) {
  display: flex;
  gap: 10px;
}
:global(.result-dialog .result-btns .el-button) {
  flex: 1;
  margin-left: 0;
}
:global(.batch-dialog .el-dialog) {
  max-width: calc(100vw - 24px);
}
:global(.batch-dialog .el-dialog__header) {
  padding: 20px 24px 0;
  margin: 0;
}
:global(.batch-dialog .el-dialog__body) {
  padding: 0 24px 16px;
}
:global(.batch-dialog .el-dialog__footer) {
  padding: 0 24px 20px;
}
.batch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.batch-head-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.batch-eyebrow {
  flex: none;
  display: inline-flex;
  align-items: center;
  height: 23px;
  padding: 0 8px;
  border-radius: 6px;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success-dark-2);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.batch-title {
  margin: 0;
  font-size: 19px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}
.batch-total {
  flex: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
}
.batch-head-side {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
}
.batch-layout-label {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.batch-layout-select {
  width: 118px;
}
.batch-layout-select :deep(.el-select__wrapper) {
  min-height: 30px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--el-border-color-lighter) inset;
}
.batch-layout-select :deep(.el-select__selected-item) {
  font-size: 12px;
}
.batch-subtitle {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin: 10px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}
.batch-legend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}
.batch-legend i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.batch-legend.ng { color: var(--el-color-danger); }
.batch-legend.ng i { background: var(--el-color-danger); }
.batch-legend.skip { color: var(--el-color-warning-dark-2); }
.batch-legend.skip i { background: var(--el-color-warning); }
.batch-legend.ok { color: var(--el-color-success); }
.batch-legend.ok i { background: var(--el-color-success); }
.batch-arrow {
  color: var(--el-text-color-placeholder);
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-top: 18px;
}
.result-grid--wide {
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 6px;
}
.result-sections {
  display: grid;
  gap: 5px;
  margin-top: 8px;
}
.result-section {
  padding: 4px 9px 5px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}
.result-section-head {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 2px;
}
.result-section-title {
  color: var(--el-text-color-primary);
  font-size: 14px;
  font-weight: 700;
}
.result-section-count {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.7;
}
.result-row-block + .result-row-block {
  margin-top: 5px;
}
.result-subrow {
  display: grid;
  grid-template-columns: repeat(20, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: 3px;
}
.result-subrow span {
  display: flex;
  align-items: baseline;
  gap: 4px;
  min-width: 0;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.result-subrow em {
  color: var(--el-text-color-placeholder);
  font-size: 10.5px;
  font-style: normal;
}
.result-row {
  display: grid;
  grid-template-columns: repeat(20, minmax(0, 1fr));
  gap: 6px;
}
.result-row .result-cell {
  height: 41px;
  border-radius: 8px;
}
.result-row .result-cell .no {
  top: 4px;
  left: 5px;
  font-size: 13px;
}
.result-row .result-cell .mark {
  font-size: 20px;
}
.result-cell {
  position: relative;
  height: 48px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: var(--el-bg-color);
  cursor: pointer;
  font-size: 14px;
}
.result-cell .no {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.result-cell .mark {
  font-size: 18px;
}
.result-cell.ng { background: var(--el-color-danger-light-9); border-color: var(--el-color-danger); }
.result-cell.skip { background: var(--el-color-warning-light-9); border-color: var(--el-color-warning); }
.result-cell.selected { outline: 2px solid var(--el-color-primary); }
.batch-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
  overflow: hidden;
}
.batch-stat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-right: 1px solid var(--el-border-color-lighter);
}
.batch-stat:last-child {
  border-right: 0;
}
.batch-stat-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  white-space: nowrap;
}
.batch-stat-label i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
.batch-stat.ng .batch-stat-label i { background: var(--el-color-danger); }
.batch-stat.skip .batch-stat-label i { background: var(--el-color-warning); }
.batch-stat.ok .batch-stat-label i { background: var(--el-color-success); }
.batch-stat-value {
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
}
.batch-stat-value small {
  margin-left: 2px;
  color: var(--el-text-color-secondary);
  font-size: 11px;
  font-weight: 500;
}
.batch-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 14px;
}
.batch-shortcuts {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  color: var(--el-text-color-placeholder);
  font-size: 11px;
  line-height: 1.6;
}
.batch-shortcuts span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.batch-shortcuts kbd {
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 1px solid var(--el-border-color);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-regular);
  font-family: inherit;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}
.batch-actions {
  display: flex;
  flex: none;
  gap: 10px;
  margin-left: auto;
}
:global(.batch-dialog .batch-actions .el-button) {
  margin-left: 0;
}
@media (max-width: 640px) {
  .batch-head-main {
    flex-wrap: wrap;
    gap: 6px;
  }
  .batch-title {
    font-size: 17px;
  }
  .batch-footer {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
  .batch-actions {
    justify-content: flex-end;
    margin-left: 0;
  }
}
</style>
