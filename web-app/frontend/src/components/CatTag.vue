<!-- 分类名称标签：显示大类/小类（现名优先，删除后回落名称快照），无分类显示「未分类」 -->
<script setup lang="ts">
import { computed } from 'vue'
import { useCategoriesStore } from '../stores/categoriesStore'

const props = defineProps<{
  catId?: string | null
  catName?: string | null
  subId?: string | null
  subName?: string | null
}>()

const catStore = useCategoriesStore()
const picked = computed(() => catStore.labelOf(props))
</script>

<template>
  <span v-if="!picked.catName && !picked.subName" class="cat-tag none">未分类</span>
  <template v-else>
    <el-tag v-if="picked.catName" size="small" disable-transitions>{{ picked.catName }}</el-tag>
    <el-tag v-if="picked.subName" size="small" type="info" disable-transitions>{{ picked.subName }}</el-tag>
  </template>
</template>

<style scoped>
.cat-tag.none {
  color: var(--el-text-color-placeholder);
  font-size: 12px;
}
</style>
