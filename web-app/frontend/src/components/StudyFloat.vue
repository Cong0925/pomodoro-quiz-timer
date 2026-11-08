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

/* 可拖动：初始右下角（与主版本一致），位置存 localStorage */
const ballRef = ref<HTMLDivElement | null>(null)
const { pos, dragging, ready, onPointerDown } = useDraggable(ballRef, 'study-float-pos-v2', { right: 26, bottom: 26 })

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
    <el-icon :size="20">
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
  width: 66px;
  height: 66px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border-radius: 50%;
  background: var(--app-primary);
  color: #fff;
  cursor: grab;
  box-shadow: 0 4px 18px rgba(37, 99, 235, 0.4);
  user-select: none;
  /* 触屏拖动不触发页面滚动 */
  touch-action: none;
  transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}
.study-float.ready {
  visibility: visible;
}
.study-float:hover {
  transform: scale(1.06);
}
.study-float:active {
  transform: scale(0.96);
}
.study-float.dragging {
  cursor: grabbing;
  /* 拖动中禁 transition 防拖影 */
  transition: none;
}
.study-float.running {
  background: #dc2626;
  box-shadow: 0 4px 18px rgba(220, 38, 38, 0.4);
}
.sf-time {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.3px;
  font-variant-numeric: tabular-nums;
}
</style>
