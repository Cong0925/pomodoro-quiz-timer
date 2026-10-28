<!-- 大类/小类联动选择器（计时视图、编辑表单、筛选器复用） -->
<script setup lang="ts">
import { computed } from 'vue'
import { useCategoriesStore } from '../stores/categoriesStore'

const props = withDefaults(
  defineProps<{
    catId: string
    subId: string
    /** 首项文案：未选择大类 / 全部大类 / 未分类 等 */
    catPlaceholder?: string
    subPlaceholder?: string
  }>(),
  { catPlaceholder: '未选择大类', subPlaceholder: '未选择小类' }
)

const emit = defineEmits<{ (e: 'update:catId', v: string): void; (e: 'update:subId', v: string): void }>()

const catStore = useCategoriesStore()

const catOptions = computed(() => [
  { value: '', label: props.catPlaceholder },
  ...catStore.categories.map((c) => ({ value: c.id, label: c.name })),
])

const subOptions = computed(() => {
  const cat = catStore.findCat(props.catId)
  return [
    { value: '', label: props.subPlaceholder },
    ...(cat ? cat.subs.map((s) => ({ value: s.id, label: s.name })) : []),
  ]
})

const subDisabled = computed(() => {
  const cat = catStore.findCat(props.catId)
  return !cat || cat.subs.length === 0
})

function onCatChange(v: string): void {
  emit('update:catId', v)
  emit('update:subId', '')
}
</script>

<template>
  <el-select :model-value="catId" class="cat-select" @change="onCatChange">
    <el-option v-for="o in catOptions" :key="o.value" :value="o.value" :label="o.label" />
  </el-select>
  <el-select
    :model-value="subId"
    class="cat-select"
    :disabled="subDisabled"
    @update:model-value="emit('update:subId', $event)"
  >
    <el-option v-for="o in subOptions" :key="o.value" :value="o.value" :label="o.label" />
  </el-select>
</template>

<style scoped>
.cat-select {
  width: 160px;
}
</style>
