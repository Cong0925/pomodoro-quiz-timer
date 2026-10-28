<!-- 分类管理：两级分类（大类→小类）增删改 + 恢复内置 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCategoriesStore } from '../stores/categoriesStore'
import { useHistoryStore } from '../stores/historyStore'
import * as categoriesApi from '../api/categories'
import type { Category, CategorySub } from '../types'

const catStore = useCategoriesStore()
const historyStore = useHistoryStore()
const loading = ref(false)

/* 输入弹窗（替代原生 prompt/confirm） */
const dialogVisible = ref(false)
const dialogTitle = ref('')
const dialogValue = ref('')
const dialogPlaceholder = ref('')
let dialogResolve: ((v: string | null) => void) | null = null

function promptText(title: string, init: string, placeholder: string): Promise<string | null> {
  dialogTitle.value = title
  dialogValue.value = init
  dialogPlaceholder.value = placeholder
  dialogVisible.value = true
  return new Promise((resolve) => {
    dialogResolve = resolve
  })
}

function dialogOk(): void {
  const v = dialogValue.value.trim()
  if (!v) {
    ElMessage.warning('名称不能为空')
    return
  }
  dialogVisible.value = false
  dialogResolve?.(v)
  dialogResolve = null
}

function dialogCancel(): void {
  dialogVisible.value = false
  dialogResolve?.(null)
  dialogResolve = null
}

async function reload(): Promise<void> {
  loading.value = true
  try {
    await catStore.load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载分类失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  reload()
})

/* ---- 大类 ---- */
async function addCat(): Promise<void> {
  const name = await promptText('添加大类', '', '输入新大类名称')
  if (name === null) return
  if (catStore.categories.some((c) => c.name === name)) {
    ElMessage.warning('已存在同名大类')
    return
  }
  try {
    await categoriesApi.createCategory(name)
    await reload()
    ElMessage.success(`已添加大类「${name}」`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '添加大类失败')
  }
}

async function renameCat(cat: Category): Promise<void> {
  const name = await promptText('重命名大类', cat.name, '输入新名称')
  if (name === null || name === cat.name) return
  if (catStore.categories.some((c) => c.id !== cat.id && c.name === name)) {
    ElMessage.warning('已存在同名大类')
    return
  }
  try {
    await categoriesApi.renameCategory(cat.id, name)
    await reload()
    ElMessage.success(`已重命名为「${name}」`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '重命名失败')
  }
}

async function delCat(cat: Category): Promise<void> {
  const tip = historyStore.total > 0 ? `当前共 ${historyStore.total} 条历史记录（记录不会丢失，仍会保留原分类名显示）。` : ''
  try {
    await ElMessageBox.confirm(`确定删除分类「${cat.name}」吗？${tip}删除后无法恢复该分类的选项。`, '删除分类', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【删除分类确认弹窗异常】', e)
    return
  }
  try {
    await categoriesApi.deleteCategory(cat.id)
    await reload()
    ElMessage.success(`已删除分类「${cat.name}」`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除分类失败')
  }
}

/* ---- 小类 ---- */
async function addSub(cat: Category): Promise<void> {
  const name = await promptText(`为「${cat.name}」添加小类`, '', '输入小类名称')
  if (name === null) return
  if ((cat.subs || []).some((s) => s.name === name)) {
    ElMessage.warning('已存在同名小类')
    return
  }
  try {
    await categoriesApi.createSub(cat.id, name)
    await reload()
    ElMessage.success(`已添加小类「${name}」`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '添加小类失败')
  }
}

async function renameSub(cat: Category, sub: CategorySub): Promise<void> {
  const name = await promptText('重命名小类', sub.name, '输入新名称')
  if (name === null || name === sub.name) return
  if ((cat.subs || []).some((s) => s.id !== sub.id && s.name === name)) {
    ElMessage.warning('已存在同名小类')
    return
  }
  try {
    await categoriesApi.renameSub(cat.id, sub.id, name)
    await reload()
    ElMessage.success(`已重命名为「${name}」`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '重命名失败')
  }
}

async function delSub(cat: Category, sub: CategorySub): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除小类「${sub.name}」吗？已有历史记录不受影响。`, '删除小类', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【删除小类确认弹窗异常】', e)
    return
  }
  try {
    await categoriesApi.deleteSub(cat.id, sub.id)
    await reload()
    ElMessage.success(`已删除小类「${sub.name}」`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除小类失败')
  }
}

async function restoreBuiltin(): Promise<void> {
  try {
    const r = await categoriesApi.restoreBuiltin()
    await reload()
    ElMessage.success(r.added > 0 ? `已恢复 ${r.added} 个内置分类` : '内置分类都已存在')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '恢复内置分类失败')
  }
}
</script>

<template>
  <div class="cat-view">
    <div class="view-header">
      <div>
        <h2>分类管理</h2>
        <p class="mode-desc">两级分类（大类 → 小类）；删除分类不影响历史记录的名称快照</p>
      </div>
      <div class="header-actions">
        <el-button plain @click="restoreBuiltin">恢复内置分类</el-button>
        <el-button plain @click="addCat">+ 添加大类</el-button>
      </div>
    </div>

    <el-empty v-if="!loading && catStore.categories.length === 0" description="暂无分类，点击右上角「+ 添加大类」创建" />

    <div v-loading="loading" class="cat-list">
      <el-card v-for="cat in catStore.categories" :key="cat.id" shadow="never" class="cat-group">
        <div class="group-head">
          <span class="cat-name" :title="cat.name">{{ cat.name }}</span>
          <el-tag size="small" :type="cat.builtin ? 'info' : 'success'">{{ cat.builtin ? '内置' : '自定义' }}</el-tag>
          <div class="group-actions">
            <el-button size="small" text type="primary" @click="addSub(cat)">+ 小类</el-button>
            <el-button size="small" text @click="renameCat(cat)">重命名</el-button>
            <el-button size="small" text @click="delCat(cat)">删除</el-button>
          </div>
        </div>
        <div class="subs">
          <el-tag
            v-for="sub in cat.subs || []"
            :key="sub.id"
            class="sub-chip"
            closable
            @close="delSub(cat, sub)"
            @click="renameSub(cat, sub)"
          >{{ sub.name }}</el-tag>
          <span v-if="!cat.subs || !cat.subs.length" class="no-sub">暂无小类</span>
        </div>
      </el-card>
    </div>

    <!-- 名称输入弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="360px" align-center @open="undefined">
      <el-input v-model="dialogValue" :placeholder="dialogPlaceholder" maxlength="100" @keydown.enter.prevent="dialogOk" />
      <template #footer>
        <el-button @click="dialogCancel">取消</el-button>
        <el-button type="primary" @click="dialogOk">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.view-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 14px;
}
.view-header h2 {
  margin: 0 0 4px;
}
.mode-desc {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.header-actions {
  display: flex;
  gap: 8px;
}
.cat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.group-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cat-name {
  font-weight: 700;
  font-size: 15px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-actions {
  margin-left: auto;
}
.subs {
  margin-top: 10px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sub-chip {
  cursor: pointer;
  background: #f3f4f6 !important;
  border-color: #e5e7eb !important;
  color: #4b5563 !important;
}
.sub-chip .el-tag__close {
  color: #9ca3af;
}
.no-sub {
  font-size: 12px;
  color: var(--el-text-color-placeholder);
}
</style>
