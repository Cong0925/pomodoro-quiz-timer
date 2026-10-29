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
  // 本轮已有记录时只改题量上限，不重开（防止中途改题量丢弃整轮记录）
  if (timer.records.value.length === 0) timer.newRound()
})
watch(customCount, (v) => {
  if (batchCount.value === 'custom' && v && v > 0) {
    timer.maxRound.value = v
    if (timer.records.value.length === 0) timer.newRound()
  }
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
    if (e.key === 'ArrowUp') { e.preventDefault(); timer.moveSel(-10); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); timer.moveSel(10); return }
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
    : '空格开始整组计时，做完后再次按空格停止并标记错题'
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
      <template #header><b>信息</b></template>
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
        <el-button type="danger" @click="timer.stop()">停止</el-button>
        <el-button class="btn-gray" @click="timer.clearRound()">清空本轮</el-button>
        <el-button v-if="timer.showNewRoundBtn.value" type="primary" @click="timer.startNewRound()">开启新一轮</el-button>
      </div>
    </el-card>

    <!-- 本轮记录（5 题一列） -->
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

    <!-- 单题对错弹窗 -->
    <el-dialog v-model="timer.showResultModal.value" title="本题结果？" width="320px" :close-on-click-modal="false" :show-close="false" align-center>
      <div class="result-btns">
        <el-button type="success" size="large" @click="timer.confirmResult('ok')">对（Y）</el-button>
        <el-button type="danger" size="large" @click="timer.confirmResult('ng')">错（N）</el-button>
        <el-button size="large" @click="timer.confirmResult('skip')">跳过（P）</el-button>
      </div>
    </el-dialog>

    <!-- 整组错题标记面板 -->
    <el-dialog v-model="timer.showBatchPanel.value" title="整组完成 · 标记错题与跳过" width="560px" :close-on-click-modal="false" :show-close="false" align-center>
      <div class="result-grid">
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
      <div class="batch-progress">{{ timer.batchProgress.value.text }}</div>
      <template #footer>
        <el-button @click="timer.cancelBatchRound()">取消本轮</el-button>
        <el-button type="primary" @click="timer.finishBatchRound()">完成归档（Enter/空格）</el-button>
      </template>
      <div class="key-hint">快捷键：N=错 · Y=对 · P=跳过 ←→=移动 · 上下=翻页</div>
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
  margin-bottom: 14px;
}
.block-card :deep(.el-card__header) {
  padding: 10px 16px;
}
.block-card :deep(.el-card__body) {
  padding-top: 14px;
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
  padding: 8px 0;
}
.time-display {
  font-size: 64px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 2px;
  margin: 12px 0;
}
.info-bar {
  color: var(--el-text-color-regular);
  margin-bottom: 16px;
  line-height: 1.9;
}
.info-line {
  font-size: 14px;
}
.info-gap {
  margin-left: 24px;
}
.btn-group {
  display: flex;
  justify-content: center;
  gap: 10px;
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
  color: var(--el-text-color-secondary);
  margin-bottom: 6px;
}
.record-item {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 6px 10px;
  margin-bottom: 6px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
.mark {
  font-weight: 700;
}
.mark-ok { color: var(--el-color-success); }
.mark-ng { color: var(--el-color-danger); }
.mark-skip { color: var(--el-color-warning); }
.mark-toggle { cursor: pointer; }
.result-btns {
  display: flex;
  justify-content: center;
  gap: 8px;
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
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
.batch-progress {
  margin-top: 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
.key-hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  text-align: center;
}
</style>
