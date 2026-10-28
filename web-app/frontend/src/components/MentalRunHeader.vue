<!-- 速算·做题中头部：标题/用时/对错跳计数/结束按钮（无限流） -->
<script setup lang="ts">
defineProps<{ title: string; meta: string; ok: number; ng: number; skip: number; infinite: boolean }>()
const emit = defineEmits<{ (e: 'end'): void }>()
</script>

<template>
  <div class="run-head">
    <div>
      <div class="run-title">{{ title }}</div>
      <div class="run-meta">{{ meta }}</div>
    </div>
    <div class="run-counts">
      对 <b class="ok">{{ ok }}</b> · 错 <b class="ng">{{ ng }}</b> · 跳 <b class="skip">{{ skip }}</b>
      <el-button v-if="infinite" size="small" type="warning" plain class="end-btn" @click="emit('end')">结束练习</el-button>
    </div>
  </div>
</template>

<style scoped>
.run-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.run-title {
  font-size: 18px;
  font-weight: 700;
}
.run-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.run-counts {
  font-size: 13px;
}
.run-counts .ok { color: var(--el-color-success); }
.run-counts .ng { color: var(--el-color-danger); }
.run-counts .skip { color: var(--el-color-warning); }
.end-btn { margin-left: 10px; }
</style>
