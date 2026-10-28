<!-- 速算·结算后错题回顾列表（答错+跳过，带技巧提示） -->
<script setup lang="ts">
interface ReviewItem {
  stem: string
  correctAnswer: string
  tip: string
  skipped: boolean
}

defineProps<{ items: ReviewItem[] }>()
</script>

<template>
  <div v-if="items.length" class="review-block">
    <div class="review-title">错题回顾（{{ items.length }} 题）· 复盘技巧，下次更快</div>
    <div v-for="(a, i) in items" :key="i" class="review-item">
      <div class="ri-q">{{ a.stem }}</div>
      <div class="ri-ans">正确答案：{{ a.correctAnswer || '—' }}{{ a.skipped ? '（本题跳过）' : '' }}</div>
      <div v-if="a.tip" class="ri-tip">技巧：{{ a.tip }}</div>
    </div>
  </div>
</template>

<style scoped>
.review-title {
  font-weight: 700;
  margin-bottom: 8px;
}
.review-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--el-bg-color);
}
.ri-q {
  font-weight: 600;
}
.ri-ans {
  font-size: 13px;
  color: var(--el-color-success);
  margin-top: 4px;
}
.ri-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
</style>
