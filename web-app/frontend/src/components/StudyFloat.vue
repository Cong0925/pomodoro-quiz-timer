<!-- 学习时长悬浮球：右下角圆形按钮，显示今日学习时长，点击开始/暂停 -->
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useStudyStore } from '../stores/studyStore'
import { formatDuration } from '../utils/format'

const study = useStudyStore()
const display = ref('0 分')
let renderTimer: number | null = null

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
    class="study-float"
    :class="{ running: study.running }"
    :title="study.running ? `学习中 ${display}，点击暂停` : '已暂停，点击开始学习计时'"
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
  right: 24px;
  bottom: 24px;
  z-index: 900;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-radius: 999px;
  background: var(--el-color-primary);
  color: #fff;
  cursor: pointer;
  box-shadow: var(--el-box-shadow-light);
  user-select: none;
  transition: background 0.2s;
}
.study-float.running {
  background: var(--el-color-success);
}
.sf-time {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}
</style>
