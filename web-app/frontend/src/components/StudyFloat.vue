<!-- 学习时长悬浮球：可拖动圆形按钮（初始右上角，位置记忆），显示今日学习时长，点击开始/暂停 -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useStudyStore } from '../stores/studyStore'
import { useDraggable } from '../composables/useDraggable'
import { formatDuration } from '../utils/format'

const study = useStudyStore()
const display = ref('0 分')
let renderTimer: number | null = null

/* 可拖动：初始右上角（距右/上各 24px），位置存 localStorage */
const ballRef = ref<HTMLDivElement | null>(null)
const { pos, dragging, ready, onPointerDown } = useDraggable(ballRef, 'study-float-pos', { right: 24, top: 24 })

function fmt(ms: number): string {
  const s = formatDuration(ms)
  return s === '不足 1 分钟' ? '0 分' : s
}

function render(): void {
  display.value = fmt(study.todayTotal)
}

function toggle(): void {
  if (study.running) {
    study.pause()
    ElMessage.success('学习计时已暂停')
  } else {
    study.start()
    ElMessage.success('开始学习计时')
  }
  render()
}

onMounted(() => {
  render()
  renderTimer = window.setInterval(render, 1000)
})

onUnmounted(() => {
  if (renderTimer) clearInterval(renderTimer)
})
</script>

<template>
  <div
    ref="ballRef"
    class="study-float"
    :class="{ running: study.running, dragging, ready }"
    :style="ready ? { left: `${pos.x}px`, top: `${pos.y}px` } : undefined"
    :title="study.running ? `学习中 ${display}，点击暂停（可拖动）` : '已暂停，点击开始学习计时（可拖动）'"
    @pointerdown="onPointerDown"
    @click="toggle"
  >
    <el-icon :size="18">
      <component :is="study.running ? 'VideoPause' : 'VideoPlay'" />
    </el-icon>
    <span class="sf-time">{{ display }}</span>
  </div>
</template>

<style scoped>
.study-float {
  position: fixed;
  /* left/top 由拖动状态注入；ready 前隐藏防首帧闪现 */
  visibility: hidden;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--el-color-primary);
  color: #fff;
  cursor: grab;
  box-shadow: var(--el-box-shadow-light);
  user-select: none;
  /* 触屏拖动不触发页面滚动 */
  touch-action: none;
  transition: background 0.2s;
}
.study-float.ready {
  visibility: visible;
}
.study-float.dragging {
  cursor: grabbing;
  /* 拖动中禁 transition 防拖影 */
  transition: none;
}
.study-float.running {
  background: var(--el-color-success);
}
.sf-time {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
</style>
