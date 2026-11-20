<!-- 资料管理：文件夹分类 + 搜索 + 上传 + 站内预览 + 下载 -->
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { UploadFile, UploadInstance } from 'element-plus'
import {
  downloadUrl,
  formatSize,
  materialsApi,
  materialUrl,
  uploadMaterial,
} from '../api/materials'
import type {
  MaterialCategory,
  MaterialCategoryCount,
  MaterialFolder,
  MaterialItem,
  MaterialPreviewType,
} from '../types'

defineOptions({ name: 'MaterialsView' })

const loading = ref(false)
const list = ref<MaterialItem[]>([])
const total = ref(0)
const page = ref(1)
const limit = 12
const q = ref('')
const activeFolder = ref<number | 'all' | 'none'>('all')
const activeType = ref<MaterialPreviewType | 'all'>('all')
const activeCategory = ref<MaterialCategory | 'all'>('all')
const categoryCounts = ref<MaterialCategoryCount[]>([])
const folders = ref<MaterialFolder[]>([])
const MAX_FILES = 30
const VIEW_KEY = 'pq-materials-view'

type ViewMode = 'grid' | 'list'

const initialView: ViewMode = (() => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
})()

const viewMode = ref<ViewMode>(initialView)

watch(viewMode, v => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // 忽略浏览器隐私模式限制
  }
})

interface TypeOption {
  value: MaterialPreviewType | 'all'
  label: string
}

const typeOptions: TypeOption[] = [
  { value: 'all', label: '全部类型' },
  { value: 'pdf', label: 'PDF 文档' },
  { value: 'image', label: '图片' },
  { value: 'text', label: '文本 / Markdown' },
  { value: 'audio', label: '音频' },
  { value: 'video', label: '视频' },
  { value: 'office', label: 'Office 文档' },
  { value: 'archive', label: '压缩包' },
  { value: 'other', label: '其他文件' },
]

const TYPE_META: Record<MaterialPreviewType, { label: string; icon: string; color: string; bg: string }> = {
  pdf: { label: 'PDF', icon: 'Document', color: '#b42318', bg: '#fef3f2' },
  image: { label: '图片', icon: 'Picture', color: '#026aa2', bg: '#f0f9ff' },
  text: { label: '文本', icon: 'Tickets', color: '#475467', bg: '#f2f4f7' },
  audio: { label: '音频', icon: 'Headset', color: '#b54708', bg: '#fffaeb' },
  video: { label: '视频', icon: 'VideoPlay', color: '#0e7090', bg: '#ecfdff' },
  office: { label: 'Office', icon: 'Memo', color: '#175cd3', bg: '#eff8ff' },
  archive: { label: '压缩包', icon: 'Box', color: '#7a5af8', bg: '#f4f3ff' },
  other: { label: '文件', icon: 'Files', color: '#667085', bg: '#f2f4f7' },
}

function typeMeta(type: MaterialPreviewType) {
  return TYPE_META[type] || TYPE_META.other
}

const CATEGORY_META: Record<MaterialCategory, { label: string; short: string; color: string; bg: string }> = {
  knowledge: { label: '知识点资料', short: '知识点', color: '#175cd3', bg: '#eff8ff' },
  paper: { label: '试卷题目', short: '试卷', color: '#b54708', bg: '#fffaeb' },
  answer: { label: '答案解析', short: '解析', color: '#027a48', bg: '#ecfdf3' },
  other: { label: '其他资料', short: '其他', color: '#667085', bg: '#f2f4f7' },
}

const categoryTabs = computed(() => {
  const allCount = categoryCounts.value.reduce((sum, c) => sum + c.count, 0)
  return [
    { value: 'all' as const, label: '全部', count: allCount },
    ...categoryCounts.value.map(c => ({ value: c.value, label: c.label, count: c.count })),
  ]
})

function categoryMeta(category?: MaterialCategory | null) {
  return CATEGORY_META[category || 'other'] || CATEGORY_META.other
}

const categoryOptions = (['knowledge', 'paper', 'answer', 'other'] as MaterialCategory[]).map(value => ({
  value,
  ...CATEGORY_META[value],
}))

const currentFolderName = computed(() => {
  if (activeFolder.value === 'all') return '全部资料'
  if (activeFolder.value === 'none') return '未分类'
  return folders.value.find(f => f.id === activeFolder.value)?.name || '资料'
})

const emptyText = computed(() => {
  if (q.value.trim()) return `没有找到与「${q.value.trim()}」相关的资料`
  if (activeCategory.value !== 'all') return `这个文件夹里还没有「${categoryMeta(activeCategory.value).label}」`
  if (activeType.value !== 'all') return '当前类型下还没有资料'
  return '这个文件夹还是空的，上传第一份资料吧'
})

let searchTimer: number | undefined

async function loadFolders(): Promise<void> {
  try {
    folders.value = await materialsApi.folders()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载文件夹失败')
  }
}

async function loadCategories(): Promise<void> {
  try {
    categoryCounts.value = await materialsApi.categories(activeFolder.value)
  } catch (e) {
    console.error('【资料分类计数加载失败】', e)
  }
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await materialsApi.list({
      q: q.value.trim(),
      folderId: activeFolder.value,
      type: activeType.value,
      category: activeCategory.value,
      page: page.value,
      limit,
    })
    list.value = res.list
    total.value = res.total
    const targetPage = Math.max(1, res.totalPages)
    if (page.value > targetPage) {
      page.value = targetPage
      await load()
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载资料失败')
  } finally {
    loading.value = false
  }
}

watch(q, () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

watch([activeFolder, activeType, activeCategory], () => {
  page.value = 1
  load()
})

watch(activeFolder, () => {
  loadCategories()
})

function selectFolder(id: number | 'all' | 'none'): void {
  activeFolder.value = id
}

function selectCategory(id: MaterialCategory | 'all'): void {
  activeCategory.value = id
}

onMounted(async () => {
  await loadFolders()
  await Promise.all([load(), loadCategories()])
})

onUnmounted(() => {
  if (searchTimer) window.clearTimeout(searchTimer)
})

/* ---------------- 上传 ---------------- */
const uploadOpen = ref(false)
const uploadRef = ref<UploadInstance>()
const uploadFiles = ref<File[]>([])
const uploading = ref(false)
const uploadPercent = ref(0)
const uploadForm = reactive({
  title: '',
  description: '',
  folderId: null as number | null,
  category: 'auto' as MaterialCategory | 'auto',
})

const uploadTotalSize = computed(() =>
  uploadFiles.value.reduce((sum, file) => sum + file.size, 0),
)
const isSingleUpload = computed(() => uploadFiles.value.length === 1)

function fileKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`
}

function openUpload(): void {
  uploadOpen.value = true
  uploadFiles.value = []
  uploadPercent.value = 0
  uploadForm.title = ''
  uploadForm.description = ''
  const first = activeFolder.value !== 'all' && activeFolder.value !== 'none'
    ? activeFolder.value
    : folders.value[0]?.id ?? null
  uploadForm.folderId = first
  uploadForm.category = activeCategory.value === 'all' ? 'auto' : activeCategory.value
  nextTick(() => uploadRef.value?.clearFiles())
}

function onFileChange(file: UploadFile): void {
  const raw = file.raw
  if (!raw) return
  if (raw.size > 100 * 1024 * 1024) {
    ElMessage.warning(`「${raw.name}」超过 100MB 上限，已跳过`)
    return
  }
  if (uploadFiles.value.some(f => fileKey(f) === fileKey(raw))) return
  if (uploadFiles.value.length >= MAX_FILES) {
    ElMessage.warning(`一次最多上传 ${MAX_FILES} 个文件`)
    return
  }
  uploadFiles.value.push(raw)
  if (uploadFiles.value.length === 1 && !uploadForm.title.trim()) {
    uploadForm.title = raw.name.replace(/\.[^.]+$/, '').slice(0, 200)
  }
}

function removeUploadFile(index: number): void {
  uploadFiles.value.splice(index, 1)
  if (uploadFiles.value.length === 1 && !uploadForm.title.trim()) {
    uploadForm.title = uploadFiles.value[0].name.replace(/\.[^.]+$/, '').slice(0, 200)
  }
}

function clearUploadFiles(): void {
  uploadFiles.value = []
  uploadForm.title = ''
  uploadRef.value?.clearFiles()
}

async function submitUpload(): Promise<void> {
  if (!uploadFiles.value.length) {
    ElMessage.warning('请先选择要上传的文件')
    return
  }
  uploading.value = true
  uploadPercent.value = 0
  try {
    const result = await uploadMaterial(
      {
        files: uploadFiles.value,
        title: isSingleUpload.value ? uploadForm.title.trim() : undefined,
        description: uploadForm.description.trim(),
        folderId: uploadForm.folderId,
        category: uploadForm.category,
      },
      p => {
        uploadPercent.value = p
      },
    )
    uploadOpen.value = false
    ElMessage.success(result.count > 1 ? `已上传 ${result.count} 份资料` : `「${result.list[0]?.title || '资料'}」已上传`)
    if (activeType.value !== 'all') activeType.value = 'all'
    if (activeCategory.value !== 'all') activeCategory.value = 'all'
    const folderId = result.list[0]?.folderId
    if (folderId !== null && folderId !== undefined) activeFolder.value = folderId
    page.value = 1
    await load()
    await loadFolders()
    await loadCategories()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '上传失败')
  } finally {
    uploading.value = false
  }
}

/* ---------------- 直接移动文件夹 ---------------- */
async function moveItem(item: MaterialItem, folderId: number | null): Promise<void> {
  if (item.folderId === folderId) return
  const targetName = folderId === null
    ? '未分类'
    : folders.value.find(f => f.id === folderId)?.name || '目标文件夹'
  try {
    await materialsApi.moveFolder(item.id, folderId)
    if (current.value?.id === item.id) {
      current.value.folderId = folderId
      current.value.folderName = targetName
    }
    ElMessage.success(`已移动到「${targetName}」`)
    await load()
    await loadFolders()
    await loadCategories()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '移动文件夹失败')
  }
}

function onMoveCommand(item: MaterialItem, command: number | string): void {
  moveItem(item, command === 'none' ? null : Number(command))
}

/* ---------------- 直接设置资料分类 ---------------- */
const categorySavingId = ref<number | null>(null)

async function changeCategory(item: MaterialItem, category: MaterialCategory): Promise<void> {
  if (!category || category === item.category) return
  categorySavingId.value = item.id
  try {
    const res = await materialsApi.updateCategory(item.id, category)
    item.category = res.category
    item.categoryLabel = res.categoryLabel
    if (current.value?.id === item.id) {
      current.value.category = res.category
      current.value.categoryLabel = res.categoryLabel
    }
    ElMessage.success(`「${item.title}」已设为${res.categoryLabel}`)
    await loadCategories()
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '设置分类失败')
  } finally {
    categorySavingId.value = null
  }
}

/* ---------------- 文件夹 ---------------- */
async function createFolder(): Promise<void> {
  try {
    const { value } = await ElMessageBox.prompt('给文件夹起一个名字，例如「申论素材」「面试真题」', '新建文件夹', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: '文件夹名称',
      inputValidator: (v: string) => {
        const name = (v || '').trim()
        if (!name) return '文件夹名称不能为空'
        if (name.length > 80) return '文件夹名称不能超过 80 个字'
        if (folders.value.some(f => f.name === name)) return '已存在同名文件夹'
        return true
      },
    })
    const name = value.trim()
    const res = await materialsApi.createFolder(name)
    await loadFolders()
    activeFolder.value = res.id
    ElMessage.success(`文件夹「${name}」已创建`)
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : '创建文件夹失败')
    }
  }
}

/* ---------------- 编辑资料 ---------------- */
const editOpen = ref(false)
const saving = ref(false)
const editTarget = ref<MaterialItem | null>(null)
const editForm = reactive({
  title: '',
  description: '',
  folderId: null as number | null,
  category: 'other' as MaterialCategory,
})

function openEdit(item: MaterialItem): void {
  editTarget.value = item
  editForm.title = item.title
  editForm.description = item.description
  editForm.folderId = item.folderId
  editForm.category = item.category || 'other'
  editOpen.value = true
}

async function submitEdit(): Promise<void> {
  const target = editTarget.value
  if (!target) return
  if (!editForm.title.trim()) {
    ElMessage.warning('标题不能为空')
    return
  }
  saving.value = true
  try {
    await materialsApi.update(target.id, {
      title: editForm.title.trim(),
      description: editForm.description.trim(),
      folderId: editForm.folderId,
      category: editForm.category,
    })
    editOpen.value = false
    ElMessage.success('资料信息已更新')
    await load()
    await loadFolders()
    await loadCategories()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

/* ---------------- 删除 ---------------- */
async function removeItem(item: MaterialItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除「${item.title}」吗？数据库记录与磁盘文件会一并删除，且不可恢复。`,
      '删除资料',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') console.error('【删除资料确认异常】', e)
    return
  }
  try {
    await materialsApi.remove(item.id)
    if (previewOpen.value && current.value?.id === item.id) previewOpen.value = false
    ElMessage.success('资料已删除')
    await load()
    await loadFolders()
    await loadCategories()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

/* ---------------- 下载 ---------------- */
function download(item: MaterialItem): void {
  const a = document.createElement('a')
  a.href = downloadUrl(item.id)
  a.download = item.originalName
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/* ---------------- 预览 ---------------- */
const previewOpen = ref(false)
const current = ref<MaterialItem | null>(null)
const textContent = ref('')
const textLoading = ref(false)
const textTooLarge = ref(false)

async function openPreview(item: MaterialItem): Promise<void> {
  current.value = item
  previewOpen.value = true
  textContent.value = ''
  textTooLarge.value = false
  materialsApi.touchView(item.id).catch(() => {})
  if (item.previewType !== 'text') return
  if (item.sizeBytes > 2 * 1024 * 1024) {
    textTooLarge.value = true
    return
  }
  textLoading.value = true
  try {
    const res = await fetch(materialUrl(item))
    if (!res.ok) throw new Error(`读取文件失败（HTTP ${res.status}）`)
    textContent.value = await res.text()
  } catch (e) {
    textContent.value = e instanceof Error ? `读取失败：${e.message}` : '读取文件失败'
  } finally {
    textLoading.value = false
  }
}

function editFromPreview(): void {
  const item = current.value
  if (!item) return
  previewOpen.value = false
  openEdit(item)
}

function dateText(s: string | null): string {
  if (!s) return '—'
  return s.replace('T', ' ').slice(0, 16)
}

function extText(item: MaterialItem): string {
  return (item.fileExt || item.originalName.split('.').pop() || '').replace(/^\./, '').toUpperCase() || 'FILE'
}

function onPageChange(p: number): void {
  page.value = p
  load()
}
</script>

<template>
  <div class="materials-view">
    <div class="view-header">
      <div>
        <h2>资料管理</h2>
        <p class="mode-desc">上传备考资料，按文件夹归档；PDF、图片、文本、音视频可直接在页面内阅读</p>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-card">
      <div class="folder-row">
        <button
          type="button"
          class="folder-chip"
          :class="{ active: activeFolder === 'all' }"
          @click="selectFolder('all')"
        >
          <el-icon><Files /></el-icon>
          <span>全部</span>
        </button>
        <button
          v-for="f in folders"
          :key="f.id"
          type="button"
          class="folder-chip"
          :class="{ active: activeFolder === f.id }"
          @click="selectFolder(f.id)"
        >
          <el-icon><FolderOpened /></el-icon>
          <span>{{ f.name }}</span>
          <em>{{ f.count }}</em>
        </button>
        <button type="button" class="folder-create" @click="createFolder">
          <el-icon><FolderAdd /></el-icon>
          <span>新建文件夹</span>
        </button>
      </div>

      <div class="category-row">
        <span class="category-row-label">资料分类</span>
        <button
          v-for="tab in categoryTabs"
          :key="tab.value"
          type="button"
          class="category-chip"
          :class="[{ active: activeCategory === tab.value }, tab.value !== 'all' ? `cat-${tab.value}` : '']"
          @click="selectCategory(tab.value)"
        >
          <span class="cat-dot" />
          <span>{{ tab.label }}</span>
          <em>{{ tab.count }}</em>
        </button>
      </div>

      <div class="toolbar-row">
        <el-input
          v-model="q"
          class="search-input"
          clearable
          placeholder="搜索标题、文件名或说明"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="activeType" class="type-select">
          <el-option v-for="t in typeOptions" :key="t.value" :label="t.label" :value="t.value" />
        </el-select>
        <div class="toolbar-meta">
          当前：<strong>{{ currentFolderName }}</strong>
          <span class="dot">·</span>
          <span>{{ total }} 份资料</span>
        </div>
        <div class="view-toggle" role="group" aria-label="切换资料展示方式">
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ active: viewMode === 'grid' }"
            title="卡片视图"
            aria-label="卡片视图"
            :aria-pressed="viewMode === 'grid'"
            @click="viewMode = 'grid'"
          >
            <el-icon><Grid /></el-icon>
          </button>
          <button
            type="button"
            class="view-toggle-btn"
            :class="{ active: viewMode === 'list' }"
            title="列表视图"
            aria-label="列表视图"
            :aria-pressed="viewMode === 'list'"
            @click="viewMode = 'list'"
          >
            <el-icon><List /></el-icon>
          </button>
        </div>
        <el-button type="primary" class="toolbar-upload" @click="openUpload">
          <el-icon><UploadFilled /></el-icon>
          <span>上传资料</span>
        </el-button>
      </div>
    </div>

    <!-- 列表 -->
    <div v-loading="loading" class="material-list-wrap" element-loading-background="transparent">
      <div v-if="list.length && viewMode === 'grid'" class="material-grid">
        <article v-for="item in list" :key="item.id" class="material-card">
          <div class="card-open" @click="openPreview(item)">
            <div
              class="card-cover"
              :style="{ color: typeMeta(item.previewType).color, background: typeMeta(item.previewType).bg }"
            >
              <img v-if="item.previewType === 'image'" :src="item.filePath" alt="" loading="lazy" />
              <template v-else>
                <el-icon class="cover-icon" :size="30"><component :is="typeMeta(item.previewType).icon" /></el-icon>
                <span class="cover-ext">{{ extText(item) }}</span>
              </template>
              <span class="cover-type">{{ typeMeta(item.previewType).label }}</span>
            </div>
            <div class="card-copy">
              <div class="card-title" :title="item.title">{{ item.title }}</div>
              <div class="card-file" :title="item.originalName">{{ item.originalName }}</div>
              <div class="card-meta">
                <el-dropdown
                  class="category-setter"
                  trigger="click"
                  placement="bottom-start"
                  :disabled="categorySavingId === item.id"
                  @command="(value: MaterialCategory) => changeCategory(item, value)"
                  @click.stop
                >
                  <button
                    type="button"
                    class="category-badge category-badge-btn"
                    :class="`cat-${item.category || 'other'}`"
                    title="设置资料分类"
                    @click.stop
                  >
                    {{ categoryMeta(item.category).short }}
                    <el-icon class="cat-caret"><ArrowDown /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="opt in categoryOptions"
                        :key="opt.value"
                        :command="opt.value"
                        :disabled="opt.value === (item.category || 'other')"
                      >
                        <span class="category-option">
                          <span class="cat-swatch" :class="`cat-${opt.value}`" />
                          {{ opt.label }}
                        </span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <span>{{ formatSize(item.sizeBytes) }}</span>
                <span class="meta-dot">·</span>
                <span>{{ dateText(item.createdAt) }}</span>
              </div>
            </div>
          </div>
          <div class="card-footer">
            <el-dropdown
              trigger="click"
              placement="bottom-start"
              @command="(cmd: number | string) => onMoveCommand(item, cmd)"
            >
              <button type="button" class="folder-move-btn" title="修改所属文件夹" @click.stop>
                <el-icon><FolderOpened /></el-icon>
                <span>{{ item.folderName }}</span>
                <el-icon class="chev"><ArrowDown /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="none" :disabled="item.folderId === null">未分类</el-dropdown-item>
                  <el-dropdown-item
                    v-for="f in folders"
                    :key="f.id"
                    :command="f.id"
                    :disabled="f.id === item.folderId"
                  >
                    {{ f.name }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <div class="card-actions">
              <el-tooltip content="打开预览" placement="top">
                <button type="button" class="icon-btn" @click.stop="openPreview(item)"><el-icon><View /></el-icon></button>
              </el-tooltip>
              <el-tooltip content="下载" placement="top">
                <button type="button" class="icon-btn" @click.stop="download(item)"><el-icon><Download /></el-icon></button>
              </el-tooltip>
              <el-tooltip content="编辑信息" placement="top">
                <button type="button" class="icon-btn" @click.stop="openEdit(item)"><el-icon><EditPen /></el-icon></button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <button type="button" class="icon-btn danger" @click.stop="removeItem(item)"><el-icon><Delete /></el-icon></button>
              </el-tooltip>
            </div>
          </div>
        </article>
      </div>

      <div v-else-if="list.length" class="material-table">
        <div class="table-head">
          <span>资料</span>
          <span>文件夹</span>
          <span>大小</span>
          <span>上传时间</span>
          <span>操作</span>
        </div>
        <div v-for="item in list" :key="item.id" class="material-row">
          <div class="row-main" @click="openPreview(item)">
            <div class="row-thumb" :style="{ color: typeMeta(item.previewType).color, background: typeMeta(item.previewType).bg }">
              <img v-if="item.previewType === 'image'" :src="item.filePath" alt="" loading="lazy" />
              <span v-else>{{ extText(item) }}</span>
            </div>
            <div class="row-copy">
              <div class="row-title-line">
                <el-dropdown
                  class="category-setter"
                  trigger="click"
                  placement="bottom-start"
                  :disabled="categorySavingId === item.id"
                  @command="(value: MaterialCategory) => changeCategory(item, value)"
                  @click.stop
                >
                  <button
                    type="button"
                    class="category-badge category-badge-btn"
                    :class="`cat-${item.category || 'other'}`"
                    title="设置资料分类"
                    @click.stop
                  >
                    {{ categoryMeta(item.category).short }}
                    <el-icon class="cat-caret"><ArrowDown /></el-icon>
                  </button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item
                        v-for="opt in categoryOptions"
                        :key="opt.value"
                        :command="opt.value"
                        :disabled="opt.value === (item.category || 'other')"
                      >
                        <span class="category-option">
                          <span class="cat-swatch" :class="`cat-${opt.value}`" />
                          {{ opt.label }}
                        </span>
                      </el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
                <div class="row-title" :title="item.title">{{ item.title }}</div>
              </div>
              <div class="row-file" :title="item.originalName">{{ item.originalName }}</div>
            </div>
          </div>
          <div class="row-folder">
            <el-dropdown
              trigger="click"
              placement="bottom-start"
              @command="(cmd: number | string) => onMoveCommand(item, cmd)"
            >
              <button type="button" class="folder-move-btn" title="修改所属文件夹" @click.stop>
                <el-icon><FolderOpened /></el-icon>
                <span>{{ item.folderName }}</span>
                <el-icon class="chev"><ArrowDown /></el-icon>
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="none" :disabled="item.folderId === null">未分类</el-dropdown-item>
                  <el-dropdown-item
                    v-for="f in folders"
                    :key="f.id"
                    :command="f.id"
                    :disabled="f.id === item.folderId"
                  >
                    {{ f.name }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="row-size">{{ formatSize(item.sizeBytes) }}</div>
          <div class="row-date">{{ dateText(item.createdAt) }}</div>
          <div class="row-actions">
            <el-tooltip content="打开预览" placement="top">
              <button type="button" class="icon-btn" @click="openPreview(item)"><el-icon><View /></el-icon></button>
            </el-tooltip>
            <el-tooltip content="下载" placement="top">
              <button type="button" class="icon-btn" @click="download(item)"><el-icon><Download /></el-icon></button>
            </el-tooltip>
            <el-tooltip content="编辑信息" placement="top">
              <button type="button" class="icon-btn" @click="openEdit(item)"><el-icon><EditPen /></el-icon></button>
            </el-tooltip>
            <el-tooltip content="删除" placement="top">
              <button type="button" class="icon-btn danger" @click="removeItem(item)"><el-icon><Delete /></el-icon></button>
            </el-tooltip>
          </div>
        </div>
      </div>

      <div v-else-if="!loading" class="empty-state">
        <div class="empty-icon"><el-icon :size="30"><FolderOpened /></el-icon></div>
        <div class="empty-title">{{ emptyText }}</div>
        <div class="empty-sub">支持 PDF、图片、TXT / Markdown、音频、视频，单个文件不超过 100MB</div>
        <el-button type="primary" plain @click="openUpload">上传资料</el-button>
      </div>

      <div v-if="total > limit" class="pager-row">
        <el-pagination
          background
          layout="prev, pager, next"
          :page-size="limit"
          :current-page="page"
          :total="total"
          @current-change="onPageChange"
        />
      </div>
    </div>

    <!-- 上传弹窗 -->
    <el-dialog v-model="uploadOpen" title="上传资料" width="min(600px, 94vw)" class="material-dialog" destroy-on-close>
      <el-upload
        ref="uploadRef"
        drag
        multiple
        class="material-uploader"
        :auto-upload="false"
        :show-file-list="false"
        :on-change="onFileChange"
      >
        <el-icon class="uploader-icon"><UploadFilled /></el-icon>
        <div class="uploader-text">把文件拖到这里，或 <em>点击选择多个文件</em></div>
        <div class="uploader-hint">一次最多 30 个文件，单个文件上限 100MB；上传后统一归入所选文件夹</div>
      </el-upload>

      <div v-if="uploadFiles.length" class="upload-file-panel">
        <div class="upload-file-head">
          <div>
            已选择 <strong>{{ uploadFiles.length }}</strong> 个文件
            <span class="upload-total">合计 {{ formatSize(uploadTotalSize) }}</span>
          </div>
          <button type="button" class="clear-files" @click="clearUploadFiles">清空</button>
        </div>
        <div class="upload-file-list">
          <div v-for="(file, index) in uploadFiles" :key="fileKey(file)" class="upload-file-row">
            <span class="upload-file-ext">{{ (file.name.split('.').pop() || 'FILE').toUpperCase() }}</span>
            <span class="upload-file-name" :title="file.name">{{ file.name }}</span>
            <span class="upload-file-size">{{ formatSize(file.size) }}</span>
            <button type="button" class="upload-file-remove" title="移除" @click="removeUploadFile(index)">
              <el-icon><Close /></el-icon>
            </button>
          </div>
        </div>
      </div>

      <el-form label-position="top" class="material-form">
        <el-form-item v-if="isSingleUpload" label="标题（可选）">
          <el-input v-model="uploadForm.title" maxlength="200" show-word-limit placeholder="留空则使用原文件名" />
        </el-form-item>
        <div v-else-if="uploadFiles.length > 1" class="batch-title-note">
          批量上传会按每个文件的原文件名自动命名，不需要逐个填写标题。
        </div>
        <el-form-item label="说明（可选，应用到本批全部资料）">
          <el-input v-model="uploadForm.description" type="textarea" :rows="2" maxlength="500" placeholder="例如：2026 国考申论范文合集" />
        </el-form-item>
        <el-form-item label="归属文件夹">
          <div class="folder-select-row">
            <el-select v-model="uploadForm.folderId" placeholder="选择文件夹" class="folder-select">
              <el-option v-for="f in folders" :key="f.id" :label="f.name" :value="f.id" />
            </el-select>
            <el-button text type="primary" @click="createFolder">新建</el-button>
          </div>
        </el-form-item>
        <el-form-item label="资料分类">
          <div class="category-select-row">
            <el-select v-model="uploadForm.category" class="folder-select">
              <el-option label="自动识别（按文件名判断）" value="auto" />
              <el-option label="知识点资料" value="knowledge" />
              <el-option label="试卷题目" value="paper" />
              <el-option label="答案解析" value="answer" />
              <el-option label="其他资料" value="other" />
            </el-select>
            <span class="category-hint">
              {{ uploadForm.category === 'auto'
                ? '先看「答案 / 解析」，再看「试卷 / 套卷 / 500题」，最后看讲义、课件等知识点'
                : '本批文件将统一归入所选分类' }}
            </span>
          </div>
        </el-form-item>
      </el-form>

      <div v-if="uploading" class="upload-progress">
        <el-progress :percentage="uploadPercent" :stroke-width="7" />
        <div class="progress-text">
          {{ uploadPercent < 100 ? `正在上传 ${uploadFiles.length} 个文件…` : '正在写入资料库…' }}
        </div>
      </div>

      <template #footer>
        <el-button :disabled="uploading" @click="uploadOpen = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="submitUpload">
          上传{{ uploadFiles.length > 1 ? ` ${uploadFiles.length} 个文件` : '资料' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editOpen" title="编辑资料信息" width="520px" class="material-dialog">
      <el-form label-position="top" class="material-form">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" maxlength="200" show-word-limit />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="editForm.description" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="归属文件夹">
          <el-select v-model="editForm.folderId" placeholder="选择文件夹" class="folder-select">
            <el-option v-for="f in folders" :key="f.id" :label="f.name" :value="f.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="资料分类">
          <el-select v-model="editForm.category" class="folder-select">
            <el-option label="知识点资料" value="knowledge" />
            <el-option label="试卷题目" value="paper" />
            <el-option label="答案解析" value="answer" />
            <el-option label="其他资料" value="other" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="saving" @click="editOpen = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 预览抽屉 -->
    <el-drawer
      v-model="previewOpen"
      size="min(1100px, 90vw)"
      direction="rtl"
      class="preview-drawer"
      :with-header="false"
    >
      <div v-if="current" class="preview-shell">
        <header class="preview-header">
          <div class="preview-title-wrap">
            <div class="preview-title">{{ current.title }}</div>
            <div class="preview-sub">
              <span class="folder-tag"><el-icon><FolderOpened /></el-icon>{{ current.folderName }}</span>
              <span class="category-badge" :class="`cat-${current.category || 'other'}`">
                {{ categoryMeta(current.category).label }}
              </span>
              <span>{{ current.originalName }}</span>
              <span>{{ formatSize(current.sizeBytes) }}</span>
              <span>上传于 {{ dateText(current.createdAt) }}</span>
            </div>
          </div>
          <div class="preview-actions">
            <el-button plain @click="download(current)">
              <el-icon><Download /></el-icon>下载
            </el-button>
            <el-button plain @click="editFromPreview">
              <el-icon><EditPen /></el-icon>编辑
            </el-button>
            <button type="button" class="close-btn" @click="previewOpen = false"><el-icon><Close /></el-icon></button>
          </div>
        </header>

        <div v-if="current.description" class="preview-desc">{{ current.description }}</div>

        <div class="preview-body">
          <iframe
            v-if="current.previewType === 'pdf'"
            :src="`${current.filePath}#view=FitH`"
            class="preview-frame"
            title="PDF 预览"
          />
          <div v-else-if="current.previewType === 'image'" class="preview-center">
            <img :src="current.filePath" :alt="current.title" class="preview-image" />
          </div>
          <div v-else-if="current.previewType === 'text'" v-loading="textLoading" class="preview-text-wrap">
            <div v-if="textTooLarge" class="unsupported">
              <div class="unsupported-icon"><el-icon :size="28"><Document /></el-icon></div>
              <div class="unsupported-title">文本超过 2MB，建议下载后查看</div>
              <el-button type="primary" plain @click="download(current)">下载文件</el-button>
            </div>
            <pre v-else class="preview-text">{{ textContent }}</pre>
          </div>
          <div v-else-if="current.previewType === 'audio'" class="preview-center">
            <div class="av-card">
              <div class="av-icon audio"><el-icon :size="34"><Headset /></el-icon></div>
              <div class="av-title">{{ current.title }}</div>
              <audio :src="current.filePath" controls class="preview-audio" />
            </div>
          </div>
          <div v-else-if="current.previewType === 'video'" class="preview-center">
            <video :src="current.filePath" controls class="preview-video" />
          </div>
          <div v-else class="unsupported">
            <div class="unsupported-icon"><el-icon :size="30"><component :is="typeMeta(current.previewType).icon" /></el-icon></div>
            <div class="unsupported-title">该类型暂不支持页面内预览</div>
            <div class="unsupported-sub">Word、Excel、PPT、压缩包等文件可以下载后在本机打开</div>
            <el-button type="primary" plain @click="download(current)">下载文件</el-button>
          </div>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.materials-view {
  padding-bottom: 12px;
}

.view-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.toolbar-upload {
  flex: 0 0 auto;
  height: 32px;
  margin-left: 0;
  padding: 0 13px;
  border-radius: 8px;
  font-weight: 600;
}

.toolbar-upload .el-icon {
  margin-right: 5px;
  font-size: 15px;
}

.filter-card {
  margin-top: 14px;
  padding: 14px 16px 12px;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #fff;
}

.folder-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px dashed var(--app-border-light);
}

.folder-chip,
.folder-create {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #fff;
  color: var(--app-text-regular);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.16s ease;
}

.folder-chip:hover,
.folder-create:hover {
  border-color: var(--app-primary);
  color: var(--app-primary);
}

.folder-chip.active {
  border-color: var(--app-primary);
  background: #eff6ff;
  color: var(--app-primary);
  font-weight: 600;
}

.folder-chip em {
  font-style: normal;
  font-size: 11px;
  color: var(--app-text-secondary);
  background: #f2f4f7;
  border-radius: 4px;
  padding: 1px 5px;
}

.folder-chip.active em {
  color: var(--app-primary);
  background: #dbeafe;
}

.folder-create {
  border-style: dashed;
  color: var(--app-text-secondary);
}

.category-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px 0 12px;
  border-bottom: 1px dashed var(--app-border-light);
}

.category-row-label {
  margin-right: 2px;
  font-size: 12px;
  color: #98a2b3;
  letter-spacing: 0.02em;
}

.category-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: #f8fafc;
  color: var(--app-text-regular);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.16s ease;
}

.category-chip:hover {
  background: #f2f4f7;
}

.category-chip .cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #98a2b3;
}

.category-chip em {
  padding: 1px 5px;
  border-radius: 4px;
  background: #eef0f3;
  color: #667085;
  font-style: normal;
  font-size: 11px;
}

.category-chip.active {
  border-color: var(--app-primary);
  background: #eff6ff;
  color: var(--app-primary);
  font-weight: 600;
}

.category-chip.active em {
  background: #dbeafe;
  color: var(--app-primary);
}

.category-chip.cat-knowledge .cat-dot { background: #175cd3; }
.category-chip.cat-paper .cat-dot { background: #b54708; }
.category-chip.cat-answer .cat-dot { background: #027a48; }
.category-chip.cat-other .cat-dot { background: #667085; }

.category-chip.cat-knowledge.active { border-color: #84adff; background: #eff8ff; color: #175cd3; }
.category-chip.cat-paper.active { border-color: #fec84b; background: #fffaeb; color: #b54708; }
.category-chip.cat-answer.active { border-color: #75e0a7; background: #ecfdf3; color: #027a48; }
.category-chip.cat-other.active { border-color: #d0d5dd; background: #f2f4f7; color: #475467; }

.category-chip.cat-knowledge.active em { background: #d1e9ff; color: #175cd3; }
.category-chip.cat-paper.active em { background: #fef0c7; color: #b54708; }
.category-chip.cat-answer.active em { background: #d1fadf; color: #027a48; }
.category-chip.cat-other.active em { background: #e4e7ec; color: #475467; }

.category-badge {
  display: inline-flex;
  align-items: center;
  flex: none;
  height: 20px;
  padding: 0 6px;
  border-radius: 5px;
  background: #f2f4f7;
  color: #667085;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.category-badge.cat-knowledge { background: #eff8ff; color: #175cd3; }
.category-badge.cat-paper { background: #fffaeb; color: #b54708; }
.category-badge.cat-answer { background: #ecfdf3; color: #027a48; }
.category-badge.cat-other { background: #f2f4f7; color: #667085; }

.category-setter {
  display: inline-flex;
  flex: none;
}

.category-badge-btn {
  border: 0;
  cursor: pointer;
  font-family: inherit;
  transition: box-shadow 0.15s ease, filter 0.15s ease;
}

.category-badge-btn:hover {
  box-shadow: inset 0 0 0 1px currentColor;
  filter: brightness(0.98);
}

.category-badge-btn .cat-caret {
  margin-left: 2px;
  font-size: 10px;
  opacity: 0.72;
}

.category-option {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 92px;
}

.cat-swatch {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #667085;
}

.cat-swatch.cat-knowledge { background: #175cd3; }
.cat-swatch.cat-paper { background: #b54708; }
.cat-swatch.cat-answer { background: #027a48; }
.cat-swatch.cat-other { background: #667085; }

.category-select-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}

.category-hint {
  font-size: 11.5px;
  line-height: 1.5;
  color: var(--app-text-secondary);
}

.toolbar-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 12px;
}

.search-input {
  width: 300px;
}

.type-select {
  width: 150px;
}

.toolbar-meta {
  margin-left: auto;
  font-size: 13px;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.toolbar-meta strong {
  color: var(--app-text);
  font-weight: 600;
}

.toolbar-meta .dot {
  margin: 0 6px;
  color: #cbd5e1;
}

.material-list-wrap {
  margin-top: 16px;
  min-height: 240px;
}

.view-toggle {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.view-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.view-toggle-btn:hover {
  color: var(--app-primary);
  background: #f2f6ff;
}

.view-toggle-btn.active {
  color: var(--app-primary);
  background: #eff6ff;
}

.material-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(292px, 1fr));
  gap: 16px;
}

.material-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border: 1px solid var(--app-border);
  border-radius: 13px;
  background: #fff;
  overflow: hidden;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.material-card:hover {
  border-color: #bfdbfe;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
  transform: translateY(-1px);
}

.card-open {
  min-width: 0;
  cursor: pointer;
}

.card-cover {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 104px;
  padding: 0 16px;
  overflow: hidden;
  isolation: isolate;
}

.card-cover::before {
  content: '';
  position: absolute;
  right: -26px;
  top: -52px;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.52);
  z-index: -1;
}

.card-cover::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: rgba(15, 23, 42, 0.05);
}

.card-cover > img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-icon {
  flex-shrink: 0;
  opacity: 0.92;
}

.cover-ext {
  margin-left: auto;
  max-width: 58%;
  font-size: 31px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.06em;
  opacity: 0.24;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cover-type {
  position: absolute;
  top: 11px;
  left: 14px;
  padding: 3px 7px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.82);
  color: currentColor;
  font-size: 10px;
  font-weight: 650;
  line-height: 1;
  letter-spacing: 0.04em;
  backdrop-filter: blur(4px);
}

.card-cover > img ~ .cover-type {
  left: auto;
  right: 12px;
  color: #fff;
  background: rgba(15, 23, 42, 0.54);
}

.card-copy {
  padding: 13px 14px 11px;
}

.card-title {
  display: -webkit-box;
  min-height: 40px;
  font-size: 14.5px;
  font-weight: 650;
  line-height: 1.4;
  color: var(--app-text);
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-file {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 11.5px;
  color: #98a2b3;
  white-space: nowrap;
}

.meta-dot {
  color: #d0d5dd;
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: auto;
  padding: 8px 10px 8px 12px;
  border-top: 1px solid var(--app-border-light);
  background: #fcfcfd;
}

.folder-move-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  height: 27px;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #475467;
  font-size: 11.5px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}

.folder-move-btn:hover {
  border-color: #dbeafe;
  background: #eff6ff;
  color: var(--app-primary);
}

.folder-move-btn > span {
  max-width: 106px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-move-btn .chev {
  flex-shrink: 0;
  font-size: 11px;
  color: #98a2b3;
}

.card-footer .folder-move-btn {
  flex: 1;
  max-width: 148px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 27px;
  height: 27px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #667085;
  cursor: pointer;
  transition: background 0.14s ease, color 0.14s ease;
}

.icon-btn:hover {
  background: #eff6ff;
  color: var(--app-primary);
}

.icon-btn.danger:hover {
  background: #fef3f2;
  color: #d92d20;
}

.folder-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 180px;
  padding: 2px 7px;
  border-radius: 5px;
  background: #f8fafc;
  color: #475467;
  font-size: 12px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 列表视图 */
.material-table {
  border: 1px solid var(--app-border);
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.table-head,
.material-row {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) 82px 128px 136px;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
}

.table-head {
  height: 40px;
  border-bottom: 1px solid var(--app-border-light);
  background: #fcfcfd;
  color: #98a2b3;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.table-head span:last-child {
  text-align: right;
}

.material-row {
  min-height: 66px;
  border-bottom: 1px solid var(--app-border-light);
  transition: background 0.14s ease;
}

.material-row:last-child {
  border-bottom: 0;
}

.material-row:hover {
  background: #f8fbff;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  cursor: pointer;
}

.row-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 38px;
  height: 38px;
  border-radius: 8px;
  font-size: 9.5px;
  font-weight: 750;
  letter-spacing: 0.04em;
  overflow: hidden;
}

.row-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.row-copy {
  min-width: 0;
  flex: 1;
}

.row-title-line {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.row-title {
  min-width: 0;
  flex: 1;
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.45;
  color: var(--app-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-file {
  margin-top: 2px;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-folder .folder-move-btn {
  width: 100%;
  justify-content: flex-start;
  background: #f8fafc;
  border-color: #eef0f3;
}

.row-folder .folder-move-btn > span {
  max-width: none;
  min-width: 0;
  flex: 1;
}

.row-size,
.row-date {
  font-size: 12px;
  color: var(--app-text-secondary);
  white-space: nowrap;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1px;
}

@media (max-width: 1080px) {
  .table-head,
  .material-row {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) 76px 132px;
  }

  .table-head span:nth-child(4),
  .row-date {
    display: none;
  }

  .toolbar-meta {
    display: none;
  }

  .view-toggle {
    margin-left: auto;
  }
}

@media (max-width: 820px) {
  .table-head,
  .material-row {
    grid-template-columns: minmax(0, 1fr) 132px;
  }

  .table-head span:nth-child(3),
  .table-head span:nth-child(4),
  .row-size,
  .row-date {
    display: none;
  }

  .table-head span:last-child {
    display: none;
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 36px 20px;
  border: 1px dashed var(--app-border);
  border-radius: 12px;
  background: #fff;
}

.empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 62px;
  height: 62px;
  border-radius: 16px;
  background: #eff6ff;
  color: var(--app-primary);
}

.empty-title {
  margin-top: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.empty-sub {
  margin: 6px 0 16px;
  font-size: 12.5px;
  color: var(--app-text-secondary);
}

.pager-row {
  display: flex;
  justify-content: flex-end;
  padding: 18px 0 4px;
}

/* 弹窗 */
.material-dialog :deep(.el-dialog__body) {
  padding-top: 6px;
}

.material-uploader :deep(.el-upload-dragger) {
  padding: 22px 16px;
  border-radius: 10px;
  border-color: #d0d5dd;
  background: #fcfcfd;
}

.material-uploader :deep(.el-upload-dragger:hover) {
  border-color: var(--app-primary);
}

.uploader-icon {
  font-size: 30px;
  color: var(--app-primary);
}

.uploader-text {
  margin-top: 6px;
  font-size: 13.5px;
  color: var(--app-text-regular);
}

.uploader-text em {
  font-style: normal;
  color: var(--app-primary);
  font-weight: 600;
}

.uploader-hint {
  margin-top: 4px;
  font-size: 11.5px;
  color: var(--app-text-secondary);
}

.upload-file-panel {
  margin-top: 12px;
  border: 1px solid var(--app-border);
  border-radius: 9px;
  background: #f8fafc;
  overflow: hidden;
}

.upload-file-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 36px;
  padding: 0 11px;
  border-bottom: 1px solid var(--app-border-light);
  font-size: 12px;
  color: var(--app-text-secondary);
}

.upload-file-head strong {
  color: var(--app-text);
  font-weight: 650;
}

.upload-total {
  margin-left: 7px;
  color: #98a2b3;
}

.clear-files {
  border: 0;
  background: transparent;
  color: var(--app-primary);
  font-size: 12px;
  cursor: pointer;
}

.upload-file-list {
  max-height: 184px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d0d5dd transparent;
}

.upload-file-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 66px 24px;
  align-items: center;
  gap: 9px;
  min-height: 34px;
  padding: 0 9px 0 10px;
  border-bottom: 1px solid #f0f2f5;
}

.upload-file-row:last-child {
  border-bottom: 0;
}

.upload-file-ext {
  justify-self: start;
  padding: 2px 5px;
  border-radius: 4px;
  background: #fff;
  border: 1px solid var(--app-border);
  color: #667085;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.upload-file-name {
  min-width: 0;
  font-size: 12px;
  color: #344054;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-file-size {
  font-size: 11px;
  color: #98a2b3;
  text-align: right;
  white-space: nowrap;
}

.upload-file-remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: #98a2b3;
  cursor: pointer;
}

.upload-file-remove:hover {
  background: #fef3f2;
  color: #d92d20;
}

.batch-title-note {
  margin: 2px 0 14px;
  padding: 8px 10px;
  border-radius: 7px;
  background: #eff6ff;
  color: #475467;
  font-size: 12px;
  line-height: 1.55;
}

.material-form {
  margin-top: 14px;
}

.material-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

.folder-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.folder-select {
  flex: 1;
}

.upload-progress {
  margin-top: 2px;
}

.progress-text {
  margin-top: 4px;
  font-size: 12px;
  color: var(--app-text-secondary);
  text-align: center;
}

/* 预览抽屉 */
.preview-drawer :deep(.el-drawer__body) {
  padding: 0;
}

.preview-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: #f8fafc;
}

.preview-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--app-border);
  background: #fff;
}

.preview-title-wrap {
  min-width: 0;
  flex: 1;
}

.preview-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-sub {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 7px;
  font-size: 12px;
  color: var(--app-text-secondary);
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.preview-actions :deep(.el-button) {
  height: 32px;
  border-radius: 7px;
}

.close-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin-left: 2px;
  border: 1px solid var(--app-border);
  border-radius: 7px;
  background: #fff;
  color: #667085;
  cursor: pointer;
}

.close-btn:hover {
  color: var(--app-text);
  background: #f2f4f7;
}

.preview-desc {
  padding: 10px 22px;
  border-bottom: 1px solid var(--app-border-light);
  background: #fff;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--app-text-secondary);
}

.preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  padding: 16px 22px 20px;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
}

.preview-center {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 8px 26px rgba(15, 23, 42, 0.09);
  background: #fff;
}

.preview-text-wrap {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
  overflow: auto;
}

.preview-text {
  margin: 0;
  padding: 22px 24px;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Microsoft YaHei', monospace;
  font-size: 13px;
  line-height: 1.75;
  color: #344054;
  white-space: pre-wrap;
  word-break: break-word;
}

.av-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(520px, 100%);
  padding: 30px 28px;
  border: 1px solid var(--app-border);
  border-radius: 14px;
  background: #fff;
}

.av-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 66px;
  height: 66px;
  border-radius: 16px;
  background: #fffaeb;
  color: #b54708;
}

.av-title {
  margin: 12px 0 20px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.preview-audio {
  width: 100%;
}

.preview-video {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  background: #101828;
}

.unsupported {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  border: 1px dashed var(--app-border);
  border-radius: 12px;
  background: #fff;
}

.unsupported-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  border-radius: 15px;
  background: #f2f4f7;
  color: #667085;
}

.unsupported-title {
  margin-top: 14px;
  font-size: 15px;
  font-weight: 600;
  color: var(--app-text);
}

.unsupported-sub {
  margin: 6px 0 16px;
  font-size: 12.5px;
  color: var(--app-text-secondary);
}

@media (max-width: 640px) {
  .material-grid {
    grid-template-columns: 1fr;
  }

  .toolbar-row {
    flex-wrap: wrap;
  }

  .search-input {
    width: 100%;
  }

  .toolbar-meta {
    order: 3;
  }

  .view-toggle {
    margin-left: auto;
  }
}
</style>
