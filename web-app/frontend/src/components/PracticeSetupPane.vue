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
  <div class="setup-layout">
    <!-- 左栏：大类竖排列表 -->
    <aside class="cat-rail">
      <div class="rail-title">大类</div>
      <div
        v-for="c in categories"
        :key="c.id"
        class="rail-item"
        :class="{ selected: selCat === c.id }"
        @click="emit('pick-cat', c.id)"
      >
        <span class="ri-name">{{ c.name }}</span>
        <span class="ri-badge">{{ c.subs.length }}</span>
      </div>
    </aside>

    <!-- 右栏：小类 / 题库 / 方式 / 题量 / 开始 -->
    <div class="setup-main">
      <div class="section-title">
        选择二级分类
        <small class="hint">{{ subOptions.length ? `共 ${subOptions.length} 个` : '' }}</small>
      </div>
      <div class="chip-flow">
        <div
          v-for="s in subOptions"
          :key="s.id || '__none__'"
          class="sub-chip"
          :class="{ selected: selSub === s.id }"
          @click="emit('pick-sub', s.id)"
        >
          <span class="sc-name">{{ s.name }}</span>
          <span class="sc-count">{{ banks.filter((b) => b.catId === selCat && (b.subId || '') === s.id).length }}</span>
        </div>
      </div>

      <div class="section-title">
        选择题库
        <small class="hint">{{ selSub === null ? '请先选择二级分类' : `共 ${catBanks.length} 个` }}</small>
      </div>
      <div class="bank-grid">
        <div
          v-for="b in catBanks"
          :key="b.id"
          class="pick-card bank"
          :class="{ selected: selBank === b.id }"
          @click="emit('pick-bank', b.id)"
        >
          <div class="pc-top">
            <div class="pc-name">{{ b.name }}</div>
            <div class="pc-count">{{ b.count }} 题</div>
          </div>
          <div class="pc-desc">{{ b.description || '暂无描述' }}</div>
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
        <span class="hint">{{ startTip }}</span>
        <el-button type="primary" size="large" @click="emit('start')">开始练习</el-button>
      </div>
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
/* 两栏骨架：左大类竖排列表（固定 200px）+ 右侧主区 */
.setup-layout {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}
.cat-rail {
  width: 200px;
  flex-shrink: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-bg-color);
  padding: 8px;
  position: sticky;
  top: 12px;
}
.rail-title {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
  padding: 2px 8px 6px;
}
.rail-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--el-text-color-regular);
  transition: background 0.15s, color 0.15s;
}
.rail-item:hover {
  background: var(--el-fill-color-light);
}
.rail-item.selected {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}
.ri-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ri-badge {
  flex-shrink: 0;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 9px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rail-item.selected .ri-badge {
  background: var(--el-color-primary);
  color: #fff;
}
.setup-main {
  flex: 1;
  min-width: 0;
}
/* 小类：流式紧凑 chip，一行多个 */
.chip-flow {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sub-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 999px;
  background: var(--el-bg-color);
  cursor: pointer;
  font-size: 13px;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
}
.sub-chip:hover {
  border-color: var(--el-color-primary-light-5);
}
.sub-chip.selected {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary);
  color: #fff;
  font-weight: 600;
}
.sc-count {
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.sub-chip.selected .sc-count {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}
/* 题库：自适应列数卡片网格 */
.bank-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
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
  border: 1.5px solid #2563eb;
  background: #eff6ff;
}
.pc-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pc-name {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc-desc {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pc-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--el-color-primary);
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
  justify-content: space-between;
  gap: 12px;
  margin: 18px 0;
}
</style>
