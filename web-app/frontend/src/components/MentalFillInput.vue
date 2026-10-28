<!-- 速算·填空输入行：1/ 前缀（填分母）/ % 后缀（填百分数）+ 提交 -->
<script setup lang="ts">
defineProps<{ modelValue: string; fillDir?: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'submit'): void }>()
</script>

<template>
  <div class="fill-row">
    <span v-if="fillDir === 'den' || fillDir === 'frac'" class="fill-prefix">1/</span>
    <el-input
      :model-value="modelValue"
      class="fill-input"
      :placeholder="
        fillDir === 'den' ? '填分母（如 12.5% 填 8）'
        : fillDir === 'frac' ? '填分母（如 11.1% 填 9）'
        : fillDir === 'val' ? '填数字（如 13² 填 169）'
        : fillDir === 'dec' ? '填数值（如 1.2³ 填 1.7）'
        : '填百分数数值（如 1/9 填 11.1）'
      "
      @update:model-value="emit('update:modelValue', $event)"
      @keydown.enter.prevent="emit('submit')"
    />
    <span v-if="fillDir === 'pct'" class="fill-suffix">%</span>
    <el-button type="primary" @click="emit('submit')">提交</el-button>
  </div>
</template>

<style scoped>
.fill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0;
}
.fill-prefix,
.fill-suffix {
  font-size: 20px;
  font-weight: 700;
}
.fill-input {
  width: 220px;
}
</style>
