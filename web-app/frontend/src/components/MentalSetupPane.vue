<!-- 速算·开始练习面板：题型卡片 + 题量 + 开始按钮（纯展示，状态由父组件持有） -->
<script setup lang="ts">
defineProps<{ type: string; count: number; tip: string }>()
const emit = defineEmits<{ (e: 'update:type', v: string): void; (e: 'update:count', v: number): void; (e: 'start'): void }>()

const TYPES = [
  { k: 'percent', n: '百化分', d: '分化百分/百分化分：分数↔百分数互化，除转乘秒出' },
  { k: 'compare', n: '分数比大小', d: '交叉相乘，一秒判断谁大' },
  { k: 'estimate', n: '估算值', d: '取整估算，先数量级再微调' },
  { k: 'square', n: '平方数', d: '10-20 平方秒回 + 幂次估算，资料分析基本功' },
  { k: 'mixed', n: '综合练习', d: '多类题型混合，全面检验' },
] as const
const COUNT_OPTIONS = [10, 15, 20, 0]
</script>

<template>
  <div>
    <div class="section-title">选择题型</div>
    <div class="type-grid">
      <div v-for="t in TYPES" :key="t.k" class="type-card" :class="{ active: type === t.k }" @click="emit('update:type', t.k)">
        <div class="tc-name">{{ t.n }}</div>
        <div class="tc-desc">{{ t.d }}</div>
      </div>
    </div>

    <div class="section-title">题量</div>
    <div class="count-row">
      <el-check-tag v-for="c in COUNT_OPTIONS" :key="c" :checked="count === c" @change="emit('update:count', c)">{{ c === 0 ? '∞' : c }}</el-check-tag>
    </div>

    <div class="start-row">
      <span class="hint">{{ tip }}</span>
      <el-button type="primary" size="large" @click="emit('start')">开始练习</el-button>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 14px 0 8px;
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.type-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  background: var(--el-bg-color);
}
.type-card.active {
  border: 1.5px solid #2563eb;
  background: #eff6ff;
}
.tc-name {
  font-weight: 700;
}
.tc-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.count-row {
  display: flex;
  gap: 8px;
}
.start-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0;
}
.hint {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
