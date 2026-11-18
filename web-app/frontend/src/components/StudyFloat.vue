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
    role="button"
    tabindex="0"
    :aria-label="study.running ? '暂停学习计时' : '开始学习计时'"
    @pointerdown="onPointerDown"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <span class="sf-orb" aria-hidden="true">
      <el-icon :size="18">
        <component :is="study.running ? 'VideoPause' : 'VideoPlay'" />
      </el-icon>
    </span>
    <span class="sf-copy">
      <span class="sf-state">
        <i class="sf-dot" aria-hidden="true"></i>
        {{ study.running ? '学习计时中' : '今日学习' }}
      </span>
      <span class="sf-time">{{ display }}</span>
    </span>
    <span class="sf-grip" aria-hidden="true">
      <i v-for="n in 6" :key="n"></i>
    </span>
  </div>
</template>

<style scoped>
.study-float {
  position: fixed;
  /* left/top 由拖动状态注入；ready 前隐藏防首帧闪现 */
  visibility: hidden;
  z-index: 900;
  min-width: 158px;
  height: 56px;
  padding: 0 11px 0 8px;
  display: flex;
  align-items: center;
  gap: 9px;
  border-radius: 16px;
  border: 1px solid rgba(37, 99, 235, 0.14);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 255, 0.96));
  color: var(--app-text);
  cursor: grab;
  user-select: none;
  touch-action: none;
  backdrop-filter: blur(14px) saturate(1.2);
  box-shadow:
    0 12px 32px rgba(15, 23, 42, 0.16),
    0 2px 6px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 #fff;
  transition:
    transform 0.18s ease,
    box-shadow 0.22s ease,
    border-color 0.22s ease,
    background 0.22s ease;
}
.study-float.ready {
  visibility: visible;
}
.study-float:hover {
  transform: translateY(-2px);
  border-color: rgba(37, 99, 235, 0.28);
  box-shadow:
    0 16px 40px rgba(15, 23, 42, 0.2),
    0 3px 8px rgba(15, 23, 42, 0.07),
    inset 0 1px 0 #fff;
}
.study-float:active {
  transform: translateY(0) scale(0.985);
}
.study-float.dragging {
  cursor: grabbing;
  /* 拖动中禁 transition 防拖影 */
  transition: none;
  box-shadow: 0 20px 48px rgba(15, 23, 42, 0.24);
}
.study-float.running {
  border-color: rgba(37, 99, 235, 0.3);
  background: linear-gradient(180deg, #ffffff, #f3f7ff);
  box-shadow:
    0 14px 36px rgba(37, 99, 235, 0.2),
    0 2px 6px rgba(37, 99, 235, 0.08),
    inset 0 1px 0 #fff;
}
.study-float:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.45);
  outline-offset: 3px;
}
.sf-orb {
  flex: 0 0 36px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(135deg, #eef4ff, #dbeafe);
  color: var(--app-primary);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.1);
  transition: background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
}
.study-float.running .sf-orb {
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: #fff;
  box-shadow:
    0 6px 14px rgba(37, 99, 235, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}
.sf-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.sf-state {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: 0.4px;
  color: var(--app-text-secondary);
  white-space: nowrap;
}
.sf-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #b6bec9;
  box-shadow: 0 0 0 2px rgba(182, 190, 201, 0.14);
}
.study-float.running .sf-state {
  color: var(--app-primary);
}
.study-float.running .sf-dot {
  background: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.16);
  animation: sf-pulse 1.9s ease-in-out infinite;
}
.sf-time {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.2px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: var(--app-text);
}
.study-float.running .sf-time {
  color: #1d4ed8;
}
.sf-grip {
  flex: 0 0 auto;
  margin-left: auto;
  display: grid;
  grid-template-columns: repeat(2, 2px);
  gap: 4px 3px;
  opacity: 0.35;
  transition: opacity 0.18s ease;
}
.sf-grip i {
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: #9aa1ac;
}
.study-float:hover .sf-grip {
  opacity: 0.7;
}
@keyframes sf-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.16);
  }
  50% {
    box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.06);
  }
}
@media (prefers-reduced-motion: reduce) {
  .study-float,
  .sf-orb,
  .sf-grip {
    transition: none;
  }
  .study-float.running .sf-dot {
    animation: none;
  }
}
</style>
