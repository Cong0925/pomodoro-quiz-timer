<!-- 速算·作答结果面板：我的答案 / 跳过 / 正确答案 / 技巧提示 / 下一题 -->
<script setup lang="ts">
defineProps<{
  result: 'ok' | 'ng' | 'skip'
  myText: string
  correctAnswer: string
  tip: string
  nextLabel: string
}>()
const emit = defineEmits<{ (e: 'next'): void }>()
</script>

<template>
  <div class="analysis-box">
    <div v-if="result === 'ng'" class="my-ans">你的答案：{{ myText }}</div>
    <div v-if="result === 'skip'" class="skip-tag">本题跳过</div>
    <div class="green-ans">正确答案：{{ correctAnswer || '—' }}</div>
    <div v-if="tip" class="tip">技巧：{{ tip }}</div>
    <el-button type="primary" @click="emit('next')">{{ nextLabel }}</el-button>
  </div>
</template>

<style scoped>
.analysis-box {
  margin-top: 14px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--el-fill-color-blank);
}
.my-ans {
  color: var(--el-color-danger);
  font-size: 13px;
  margin-bottom: 4px;
}
.skip-tag {
  display: inline-block;
  font-size: 12px;
  color: var(--el-color-warning);
  border: 1px solid var(--el-color-warning);
  border-radius: 4px;
  padding: 0 6px;
  margin-bottom: 4px;
}
.green-ans {
  color: var(--el-color-success);
  font-weight: 700;
  margin-bottom: 6px;
}
.tip {
  font-size: 13px;
  color: var(--el-text-color-regular);
  margin-bottom: 10px;
}
</style>
