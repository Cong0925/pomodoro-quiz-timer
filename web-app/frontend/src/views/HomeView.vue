<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { http } from '../api/http'

/** 健康检查返回体 */
interface HealthResult {
  ok: boolean
  db: string
}

const health = ref<string>('未检测')
const loading = ref(false)

async function checkHealth(): Promise<void> {
  loading.value = true
  try {
    const res = await http.get<HealthResult>('/health')
    health.value = res.ok ? '后端与数据库连接正常' : '后端可达但数据库异常'
  } catch {
    // 错误已在 http 封装中统一 console.error，此处仅更新界面状态
    health.value = '后端未启动或请求失败'
  } finally {
    loading.value = false
  }
}

function showMessage(): void {
  ElMessage.success('Element Plus 组件正常工作')
}
</script>

<template>
  <div class="home">
    <h1>刷题计时器</h1>
    <p>web-app 版骨架已就绪（Vue 3 + TypeScript + Pinia + Vue Router + Element Plus）</p>
    <el-button type="primary" :loading="loading" @click="checkHealth">检测后端连接</el-button>
    <el-button @click="showMessage">测试消息提示</el-button>
    <p class="health">{{ health }}</p>
  </div>
</template>

<style scoped>
.home {
  max-width: 640px;
  margin: 80px auto;
  text-align: center;
  font-family: system-ui, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}

h1 {
  font-size: 28px;
  color: var(--text-h);
  margin-bottom: 12px;
}

p {
  color: var(--text);
  margin-bottom: 16px;
}

.health {
  margin-top: 16px;
  font-size: 14px;
}
</style>
