<!-- 回顾解析弹窗：整场/单题共用（题号导航条 + 完整题干含图 + 选项着色 + 解析），支持 ← → 翻题 -->
<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import type { PracticeDetailRecord, PracticeOption } from '../api/practice'
import { formatMs } from '../utils/format'

const props = defineProps<{
  modelValue: boolean
  records: PracticeDetailRecord[]
}>()
const emit = defineEmits<{ 'update:modelValue': [v: boolean] }>()

const idx = ref(0)

const cur = computed<PracticeDetailRecord | null>(() => props.records[idx.value] || null)

watch(
  () => props.modelValue,
  (open) => {
    if (open) idx.value = 0
  }
)

/* 题号着色：ok=绿 ng=红 skip=灰 */
function dotCls(i: number): string {
  const r = props.records[i]
  return r ? r.result : 'todo'
}

function optLabel(i: number): string {
  return String.fromCharCode(65 + i)
}
function optText(o: PracticeOption | undefined): string {
  return typeof o === 'string' ? o : (o?.text || '')
}
function optImg(o: PracticeOption | undefined): string {
  return typeof o === 'object' && o?.img ? o.img : ''
}
/* 选项样式：正确=绿 我的错误=红 其余淡化 */
function optClass(_o: PracticeOption | undefined, i: number): string {
  const c = cur.value
  if (!c) return ''
  const label = optLabel(i)
  if (label === c.correctAnswer) return 'correct'
  if (label === c.userAnswer && c.result !== 'ok') return 'wrong'
  return 'dim'
}

function onKeydown(e: KeyboardEvent): void {
  if (!props.modelValue || !props.records.length) return
  const t = e.target as HTMLElement | null
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  if (e.key === 'ArrowLeft' && idx.value > 0) {
    idx.value--
    e.preventDefault()
  } else if (e.key === 'ArrowRight' && idx.value < props.records.length - 1) {
    idx.value++
    e.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="`回顾解析 · 第 ${idx + 1} / ${records.length} 题`"
    width="720px"
    append-to-body
    class="rv-dialog"
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <div v-if="records.length" class="pd-body">
      <!-- 题号导航条 -->
      <div class="pd-nav">
        <button
          v-for="(r, i) in records"
          :key="r.no"
          class="pd-item"
          :class="[dotCls(i), { cur: i === idx }]"
          :title="`第 ${r.no} 题`"
          @click="idx = i"
        >{{ r.no }}</button>
      </div>

      <div v-if="cur" class="pd-card">
        <div class="pd-meta">
          用时 {{ formatMs(cur.ms) }}
          <span class="pd-mark" :class="'m-' + cur.result">{{ cur.result === 'ok' ? '回答正确' : cur.result === 'skip' ? '本题跳过' : '回答错误' }}</span>
        </div>
        <div class="pd-stem" v-html="cur.stem"></div>
        <div v-if="cur.stemImg && cur.stemImg.length" class="pd-imgs">
          <el-image
            v-for="(src, i) in cur.stemImg"
            :key="i"
            :src="src"
            :preview-src-list="cur.stemImg"
            :initial-index="i"
            fit="contain"
            class="pd-img"
          />
        </div>
        <div v-if="cur.options && cur.options.length" class="pd-opts">
          <div
            v-for="(o, i) in cur.options"
            :key="i"
            class="pd-opt"
            :class="optClass(o, i)"
          >
            <span class="pd-opt-label">{{ optLabel(i) }}</span>
            <el-image v-if="optImg(o)" :src="optImg(o)" :preview-src-list="[optImg(o)]" fit="contain" class="pd-opt-img" />
            <span v-else class="pd-opt-text">{{ optText(o) }}</span>
          </div>
        </div>
        <div class="pd-ans">
          我的答案 <b>{{ cur.userAnswer || '—' }}</b> · 正确答案 <b>{{ cur.correctAnswer || '—' }}</b>
        </div>
        <div class="pd-analysis-title">解析</div>
        <div class="pd-analysis" v-html="cur.analysis || '（暂无解析）'"></div>
      </div>

      <div class="pd-foot">
        <el-button :disabled="idx === 0" @click="idx--">上一题</el-button>
        <el-button type="primary" :disabled="idx >= records.length - 1" @click="idx++">下一题</el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
/* 弹窗固定在视口内（顶部留白 2vh、内容内部滚动），避免超高撑出全屏滚动条 */
:global(.rv-dialog) {
  height: 96vh;
  margin: 2vh auto 0;
  display: flex;
  flex-direction: column;
}
:global(.rv-dialog .el-dialog__header) {
  flex-shrink: 0;
  padding-bottom: 12px;
}
:global(.rv-dialog .el-dialog__body) {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-top: 2px;
}
.pd-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pd-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.pd-item {
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  background: var(--el-bg-color);
  font-size: 12px;
  color: var(--el-text-color-regular);
  cursor: pointer;
  line-height: 1;
}
.pd-item.ok { background: var(--el-color-success); border-color: var(--el-color-success); color: #fff; }
.pd-item.ng { background: var(--el-color-danger); border-color: var(--el-color-danger); color: #fff; }
.pd-item.skip { background: var(--el-color-warning); border-color: var(--el-color-warning); color: #fff; }
.pd-item.todo { color: var(--el-text-color-placeholder); }
.pd-item.cur { outline: 2px solid var(--el-color-primary); outline-offset: 1px; }
.pd-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 12px 14px;
  background: var(--el-fill-color-lighter);
}
.pd-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.pd-mark {
  padding: 1px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.pd-mark.m-ok { background: var(--el-color-success); color: #fff; }
.pd-mark.m-ng { background: var(--el-color-danger); color: #fff; }
.pd-mark.m-skip { background: var(--el-color-warning); color: #fff; }
.pd-stem {
  font-size: 15px;
  font-weight: 600;
  line-height: 1.7;
  white-space: pre-wrap;
}
.pd-stem :deep(img),
.pd-analysis :deep(img) {
  max-width: 100%;
  height: auto;
  display: inline-block;
  vertical-align: middle;
  border-radius: 6px;
}
.pd-imgs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.pd-img {
  max-width: 100%;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.pd-opts {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}
.pd-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-bg-color);
  font-size: 14px;
}
.pd-opt.correct { border-color: var(--el-color-success); background: var(--el-color-success-light-9); }
.pd-opt.wrong { border-color: var(--el-color-danger); background: var(--el-color-danger-light-9); }
.pd-opt.dim { color: var(--el-text-color-placeholder); }
.pd-opt-label {
  font-weight: 700;
  flex-shrink: 0;
}
.pd-opt-img {
  width: 60px;
  height: 60px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  flex-shrink: 0;
}
.pd-ans {
  margin-top: 10px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.pd-analysis-title {
  margin-top: 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--el-text-color-regular);
}
.pd-analysis {
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.8;
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
}
.pd-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
