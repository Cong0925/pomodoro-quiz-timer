<!-- 设置：本地化保存（JSON 导出/导入）+ 数据库信息 + 关于 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { exportAll, fetchDbInfo, importAll } from '../api/data'
import type { DbInfo } from '../api/data'
import { useCategoriesStore } from '../stores/categoriesStore'
import { useHistoryStore } from '../stores/historyStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { formatDuration, pad2 } from '../utils/format'

const catStore = useCategoriesStore()
const historyStore = useHistoryStore()
const favStore = useFavoritesStore()

const tab = ref<'backup' | 'db' | 'about'>('backup')
const dbInfo = ref<DbInfo | null>(null)
const dbLoading = ref(false)
const dbError = ref('')

/* ---- 导出 ---- */
async function doExport(): Promise<void> {
  try {
    ElMessage.info('正在导出全部数据…')
    const json = JSON.stringify(await exportAll(), null, 2)
    /* 优先系统保存对话框（Chromium），否则回退 a[download] */
    const w = window as Window & {
      showSaveFilePicker?: (opts: unknown) => Promise<{ name: string; createWritable: () => Promise<{ write: (d: string) => Promise<void>; close: () => Promise<void> }> }>
    }
    if (w.showSaveFilePicker) {
      try {
        const handle = await w.showSaveFilePicker({
          suggestedName: 'data.json',
          types: [{ description: 'JSON 数据文件', accept: { 'application/json': ['.json'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(json)
        await writable.close()
        ElMessage.success('已保存到：' + handle.name)
        return
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        console.warn('【系统保存对话框不可用，回退下载】', e)
      }
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date()
    a.href = url
    a.download = `data-${d.getFullYear()}-${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('已下载 JSON 文件')
  } catch (e) {
    ElMessage.error('导出失败：' + (e instanceof Error ? e.message : String(e)))
  }
}

/* ---- 导入 ---- */
const fileInput = ref<HTMLInputElement | null>(null)

function pickImportFile(): void {
  fileInput.value?.click()
}

async function onFileChange(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const file = input.files && input.files[0]
  if (!file) return
  try {
    const text = await file.text()
    const data: unknown = JSON.parse(text)
    ElMessage.info('正在导入数据…')
    const info = await importAll(data)
    /* 导入后全量刷新：分类/历史/收藏（徽标联动） */
    await catStore.load().catch(() => {})
    await historyStore.loadPage({ page: 1 }).catch(() => {})
    await favStore.loadPage({ page: 1 }).catch(() => {})
    ElMessage.success(
      `已导入：${info.h ?? 0} 条历史、${info.f ?? 0} 条收藏${info.hasCats ? '、分类' : ''}${info.hasStudy ? '、学习时长' : ''}${info.hasMemos ? '、日历备忘' : ''}`
    )
  } catch (err) {
    ElMessage.error('导入失败：' + (err instanceof Error ? err.message : String(err)))
  }
  input.value = ''
}

/* ---- 数据库信息 ---- */
async function loadDbInfo(): Promise<void> {
  dbLoading.value = true
  dbError.value = ''
  try {
    dbInfo.value = await fetchDbInfo()
  } catch (e) {
    dbError.value = e instanceof Error ? e.message : String(e)
  } finally {
    dbLoading.value = false
  }
}

onMounted(() => {
  loadDbInfo()
})
</script>

<template>
  <div class="settings-view">
    <h2>设置</h2>
    <el-tabs v-model="tab">
      <!-- 本地化保存 -->
      <el-tab-pane label="本地化保存" name="backup">
        <el-card shadow="never" class="s-card">
          <h3 class="s-title">本地化保存（JSON 备份 / 迁移）</h3>
          <p class="s-desc">把数据库中的全部数据导出为 JSON 文件保存到本地，或从 JSON 文件导入数据。适合定期备份、换电脑迁移数据。</p>
          <div class="s-actions">
            <el-button size="large" @click="doExport">保存 JSON（导出全部数据）</el-button>
            <el-button size="large" @click="pickImportFile">导入 JSON（合并数据）</el-button>
          </div>
          <p class="s-tip">
            <strong>说明：</strong>导出会下载一个 <code>data-日期.json</code> 文件；导入会自动合并数据（按轮次去重），不会重复、不会丢失。建议每周导出一次作为备份。
          </p>
          <input ref="fileInput" type="file" accept="application/json,.json" style="display: none" @change="onFileChange" />
        </el-card>
      </el-tab-pane>

      <!-- 数据库信息 -->
      <el-tab-pane label="数据库信息" name="db">
        <el-card v-loading="dbLoading" shadow="never" class="s-card">
          <el-descriptions v-if="dbInfo" :column="2" border size="small">
            <el-descriptions-item label="数据库名">{{ dbInfo.dbName }}</el-descriptions-item>
            <el-descriptions-item label="数据库地址">{{ dbInfo.host }}</el-descriptions-item>
            <el-descriptions-item label="分类（大类 / 小类）">{{ dbInfo.categories }} / {{ dbInfo.categorySubs }}</el-descriptions-item>
            <el-descriptions-item label="历史轮次">{{ dbInfo.rounds }} 轮</el-descriptions-item>
            <el-descriptions-item label="题目明细">{{ dbInfo.records }} 题</el-descriptions-item>
            <el-descriptions-item label="错题收藏">{{ dbInfo.favorites }} 条</el-descriptions-item>
            <el-descriptions-item label="日历备忘">{{ dbInfo.memos }} 条</el-descriptions-item>
            <el-descriptions-item label="学习时长">{{ dbInfo.studyDays }} 天，共 {{ formatDuration(Number(dbInfo.studyMs)) }}</el-descriptions-item>
            <el-descriptions-item label="题库 / 题目">{{ dbInfo.questionBanks }} / {{ dbInfo.questions }}</el-descriptions-item>
            <el-descriptions-item label="练习会话 / 明细">{{ dbInfo.practiceSessions }} / {{ dbInfo.practiceRecords }}</el-descriptions-item>
            <el-descriptions-item label="速算题 / 会话 / 明细">{{ dbInfo.mentalQuestions }} / {{ dbInfo.mentalSessions }} / {{ dbInfo.mentalRecords }}</el-descriptions-item>
          </el-descriptions>
          <el-alert v-else-if="dbError" type="error" :closable="false" :title="'读取失败：' + dbError" />
          <el-button v-if="dbInfo" text type="primary" size="small" style="margin-top: 10px" @click="loadDbInfo">刷新</el-button>
        </el-card>
      </el-tab-pane>

      <!-- 关于 -->
      <el-tab-pane label="关于" name="about">
        <el-card shadow="never" class="s-card">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="应用名称">刷题计时器（web-app 版 · Vue 3 + Node）</el-descriptions-item>
            <el-descriptions-item label="定位">计时 · 统计 · 留痕</el-descriptions-item>
            <el-descriptions-item label="数据存储">本地 MySQL（`pomodoro-quiz-timer` 库）</el-descriptions-item>
            <el-descriptions-item label="版本说明">与主版本（原生 HTML/JS）共用同一数据库，接口契约一致</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
h2 {
  margin: 0 0 10px;
}
.s-card {
  margin-bottom: 12px;
}
.s-title {
  margin: 0 0 10px;
  font-size: 16px;
}
.s-desc {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin: 0 0 16px;
  line-height: 1.6;
}
.s-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.s-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: #f9fafb;
  border: 1px dashed var(--el-border-color-light);
  border-radius: 6px;
  padding: 10px 12px;
  margin: 0;
  line-height: 1.6;
}
.s-tip code {
  background: #eef2ff;
  padding: 0 4px;
  border-radius: 3px;
  color: #2563eb;
}
</style>
