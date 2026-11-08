<!-- 速算·开始练习面板：题型卡片 + 难度 + 题量 + 开始按钮（纯展示，状态由父组件持有） -->
<script setup lang="ts">
defineProps<{ type: string; diff: number; count: number; tip: string }>()
const emit = defineEmits<{ (e: 'update:type', v: string): void; (e: 'update:diff', v: number): void; (e: 'update:count', v: number): void; (e: 'start'): void }>()

const TYPES = [
  { k: 'percent', n: '百化分', d: '分数↔百分数互化，除转乘秒出', i: 'Odometer' },
  { k: 'compare', n: '分数比大小', d: '交叉相乘，一秒判断谁大', i: 'Sort' },
  { k: 'estimate', n: '估算值', d: '取整估算，先数量级再微调', i: 'TrendCharts' },
  { k: 'square', n: '平方数', d: '10-20 平方秒回 + 幂次估算，资料分析基本功', i: 'Grid' },
  { k: 'mixed', n: '综合练习', d: '多类题型混合，全面检验', i: 'DataAnalysis' },
] as const
const COUNT_OPTIONS = [10, 15, 20, 0]
/* 难度映射后端 difficulty 字段：0=不限，1/2/3=简单/中等/困难 */
const DIFF_OPTIONS = [
  { v: 0, n: '不限难度', d: '全部难度随机混合' },
  { v: 1, n: '简单', d: '基础题型，适合热身' },
  { v: 2, n: '中等', d: '常规考试难度' },
  { v: 3, n: '困难', d: '高阶估算与变形' },
] as const
</script>

<template>
  <div class="setup-card">
    <div class="section-title">选择题型</div>
    <div class="type-grid">
      <div v-for="t in TYPES" :key="t.k" class="type-card" :class="{ active: type === t.k }" @click="emit('update:type', t.k)">
        <div class="tc-icon">
          <el-icon :size="20"><component :is="t.i" /></el-icon>
        </div>
        <div class="tc-info">
          <div class="tc-name">{{ t.n }}</div>
          <div class="tc-desc">{{ t.d }}</div>
        </div>
      </div>
    </div>

    <div class="section-title">难度</div>
    <div class="diff-grid">
      <div v-for="d in DIFF_OPTIONS" :key="d.v" class="diff-card" :class="{ active: diff === d.v }" @click="emit('update:diff', d.v)">
        <div class="dc-name">{{ d.n }}</div>
        <div class="dc-desc">{{ d.d }}</div>
      </div>
    </div>

    <div class="section-title">题量</div>
    <div class="count-row">
      <el-check-tag v-for="c in COUNT_OPTIONS" :key="c" :checked="count === c" @change="emit('update:count', c)">{{ c === 0 ? '∞' : c }}</el-check-tag>
    </div>

    <div class="start-row">
      <span class="hint">{{ tip }}</span>
      <el-button type="primary" class="start-btn" @click="emit('start')">开始练习</el-button>
    </div>
  </div>
</template>

<style scoped>
.setup-card {
  /* 操作配置区：白色背景卡片（与主版本一致，2026-11-01） */
  background: #fff;
  border: 1px solid #d3dbe6;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 2px 12px rgba(31, 45, 61, 0.08);
}
.setup-card > .section-title:first-child {
  margin-top: 0;
}
.setup-card .start-row {
  margin-bottom: 0;
}
.section-title {
  font-size: 14.5px;
  font-weight: 700;
  margin: 18px 0 10px;
  color: var(--app-text);
}
.type-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.type-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-height: 112px;
  border: 1.5px solid var(--app-border);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.type-card:hover {
  border-color: #93b4f5;
}
.type-card.active {
  border-color: var(--app-primary);
  background: #eff6ff;
  box-shadow: 0 2px 10px rgba(37, 99, 235, 0.12);
}
.tc-icon {
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: #eff6ff;
  color: var(--app-primary);
}
.tc-info {
  min-width: 0;
}
.tc-name {
  font-size: 16.5px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--app-text);
}
.tc-desc {
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-secondary);
  margin-top: 4px;
}
.diff-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
.diff-card {
  min-height: 58px;
  border: 1.5px solid var(--app-border);
  border-radius: 10px;
  padding: 10px 14px;
  cursor: pointer;
  background: #fff;
  transition: border-color 0.15s, background 0.15s;
}
.diff-card:hover {
  border-color: #93b4f5;
}
.diff-card.active {
  border-color: var(--app-primary);
  background: #eff6ff;
}
.dc-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--app-text);
}
.dc-desc {
  margin-top: 2px;
  font-size: 11.5px;
  color: var(--app-text-secondary);
}
.count-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.count-row :deep(.el-check-tag) {
  height: 34px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 500;
}
.start-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 20px 0 0;
}
.hint {
  font-size: 12px;
  color: var(--app-text-placeholder);
}
@media (max-width: 900px) {
  .type-grid,
  .diff-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
