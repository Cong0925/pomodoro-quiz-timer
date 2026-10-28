<!-- 速算·比大小分数卡（A/B 两个分数视觉辅助） -->
<script setup lang="ts">
defineProps<{ a: string; b: string }>()
</script>

<template>
  <div class="compare-row">
    <div class="frac-box">
      <div class="frac-label">A · 分数</div>
      <div class="frac-num">{{ a.split('/')[0] || a }}</div>
      <div class="frac-line" />
      <div class="frac-den">{{ a.split('/')[1] || '' }}</div>
    </div>
    <div class="frac-box">
      <div class="frac-label">B · 分数</div>
      <div class="frac-num">{{ b.split('/')[0] || b }}</div>
      <div class="frac-line" />
      <div class="frac-den">{{ b.split('/')[1] || '' }}</div>
    </div>
    <div class="compare-q">哪个分数更大？</div>
  </div>
</template>

<style scoped>
.compare-row {
  display: flex;
  gap: 18px;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.frac-box {
  text-align: center;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 8px 18px;
  background: var(--el-bg-color);
}
.frac-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.frac-num,
.frac-den {
  font-size: 20px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.frac-line {
  height: 2px;
  background: var(--el-text-color-primary);
  margin: 2px 8px;
}
.compare-q {
  font-size: 16px;
  font-weight: 600;
}
</style>
