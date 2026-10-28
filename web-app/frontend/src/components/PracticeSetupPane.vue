<!-- 题库练习·开始面板：大类→小类→题库三级卡片 + 方式 + 题量（纯展示，状态由父组件持有） -->
<script setup lang="ts">
import type { Bank } from '../api/practice'
import type { Category } from '../types'

defineProps<{
  categories: Category[]
  banks: Bank[]
  catBanks: Bank[]
  subOptions: Array<{ id: string; name: string }>
  selCat: string
  selSub: string | null
  selBank: number | null
  mode: string
  count: number
  countOptions: number[]
  startTip: string
}>()

const emit = defineEmits<{
  (e: 'pick-cat', id: string): void
  (e: 'pick-sub', id: string): void
  (e: 'pick-bank', id: number): void
  (e: 'update:mode', v: string): void
  (e: 'update:count', v: number): void
  (e: 'start'): void
}>()

const MODES = [
  { k: 'order', n: '顺序练习', d: '按题库顺序逐题作答' },
  { k: 'random', n: '随机抽题', d: '打乱顺序随机抽取' },
  { k: 'review', n: '错题重练', d: '抽取练习历史中的错题' },
] as const
</script>

<template>
  <div>
    <div class="section-title">选择大类</div>
    <div class="card-grid">
      <div v-for="c in categories" :key="c.id" class="pick-card" :class="{ selected: selCat === c.id }" @click="emit('pick-cat', c.id)">
        <div class="pc-name">{{ c.name }}</div>
        <div class="pc-sub">{{ c.subs.length }} 个小类</div>
      </div>
    </div>

    <div class="section-title">
      选择二级分类
      <small class="hint">{{ subOptions.length ? `共 ${subOptions.length} 个二级分类` : '' }}</small>
    </div>
    <div class="card-grid">
      <div v-for="s in subOptions" :key="s.id || '__none__'" class="pick-card" :class="{ selected: selSub === s.id }" @click="emit('pick-sub', s.id)">
        <div class="pc-name">{{ s.name }}</div>
        <div class="pc-sub">{{ banks.filter((b) => b.catId === selCat && (b.subId || '') === s.id).length }} 个题库</div>
      </div>
    </div>

    <div class="section-title">
      选择题库
      <small class="hint">{{ selSub === null ? '请先选择二级分类' : `共 ${catBanks.length} 个题库` }}</small>
    </div>
    <div class="card-grid">
      <div v-for="b in catBanks" :key="b.id" class="pick-card bank" :class="{ selected: selBank === b.id }" @click="emit('pick-bank', b.id)">
        <div class="pc-name">{{ b.name }}</div>
        <div class="pc-desc">{{ b.description || '暂无描述' }}</div>
        <div class="pc-count">{{ b.count }} 道题</div>
      </div>
      <el-empty v-if="selSub !== null && catBanks.length === 0" description="该分类下暂无题库" :image-size="60" />
    </div>

    <div class="section-title">练习方式</div>
    <div class="mode-row">
      <div v-for="m in MODES" :key="m.k" class="mode-chip" :class="{ selected: mode === m.k }" @click="emit('update:mode', m.k)">
        <b>{{ m.n }}</b><span>{{ m.d }}</span>
      </div>
    </div>

    <div class="section-title">题量</div>
    <div class="count-row">
      <el-check-tag v-for="c in countOptions" :key="c" :checked="count === c" @change="emit('update:count', c)">{{ c }}</el-check-tag>
    </div>

    <div class="start-row">
      <el-button type="primary" size="large" @click="emit('start')">开始练习</el-button>
      <span class="hint">{{ startTip }}</span>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  font-size: 14px;
  font-weight: 600;
  margin: 14px 0 8px;
}
.hint {
  font-weight: 400;
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  margin-left: 8px;
}
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 10px;
}
.pick-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--el-bg-color);
  transition: border-color 0.15s;
}
.pick-card:hover {
  border-color: var(--el-color-primary-light-5);
}
.pick-card.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.pc-name {
  font-weight: 600;
  font-size: 14px;
}
.pc-sub,
.pc-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc-count {
  font-size: 12px;
  color: var(--el-color-primary);
  margin-top: 4px;
}
.mode-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.mode-chip {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  background: var(--el-bg-color);
}
.mode-chip.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.mode-chip b {
  display: block;
}
.mode-chip span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.count-row {
  display: flex;
  gap: 8px;
}
.start-row {
  display: flex;
  align-items: center;
  margin: 18px 0;
}
</style>
