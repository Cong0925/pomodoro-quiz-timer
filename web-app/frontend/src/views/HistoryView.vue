<!-- 历史记录：分页卡片列表、筛选、展开明细、编辑标题/描述/分类、知识点编辑、收藏错题、删除/清空 -->
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CatSelect from '../components/CatSelect.vue'
import CatTag from '../components/CatTag.vue'
import { useHistoryStore } from '../stores/historyStore'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useCategoriesStore } from '../stores/categoriesStore'
import type { HistoryItem, HistoryRecord } from '../types'
import { formatTime } from '../utils/format'

defineOptions({ name: 'HistoryView' })

const historyStore = useHistoryStore()
const favStore = useFavoritesStore()
const catStore = useCategoriesStore()

const filterMode = ref('')
const filterCatId = ref('')
const filterSubId = ref('')

const loading = ref(false)

async function reload(): Promise<void> {
  loading.value = true
  try {
    await historyStore.setFilter({ mode: filterMode.value, catId: filterCatId.value, subId: filterSubId.value })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载历史记录失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  reload()
})

/* 本页概要（正确率分母为全部题数，跳过计错，与主版本一致） */
const summary = computed(() => {
  const list = historyStore.list
  let questions = 0
  let totalMs = 0
  let correct = 0
  list.forEach((h) => {
    questions += (h.records || []).length
    totalMs += h.totalMs
    correct += h.correct
  })
  const rate = questions === 0 ? '0%' : ((correct / questions) * 100).toFixed(1) + '%'
  return { rounds: list.length, questions, totalMs: formatTime(totalMs), rate }
})

const filtering = computed(() => filterMode.value || filterCatId.value || filterSubId.value)

/* ---- 展开/编辑状态 ---- */
const openIds = ref<Set<number>>(new Set())
const editingId = ref<number | null>(null)
const editForm = reactive({ title: '', desc: '', catId: '', subId: '' })

function toggleOpen(id: number): void {
  const s = new Set(openIds.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  openIds.value = s
}

function startEdit(h: HistoryItem): void {
  editingId.value = h.id
  editForm.title = h.title
  editForm.desc = h.desc
  editForm.catId = h.catId || ''
  editForm.subId = h.subId || ''
}

async function saveEdit(h: HistoryItem): Promise<void> {
  const changed =
    editForm.title !== h.title ||
    editForm.desc !== h.desc ||
    editForm.catId !== (h.catId || '') ||
    editForm.subId !== (h.subId || '')
  if (!changed) {
    editingId.value = null
    return
  }
  /* 从内存分类解析选中项名称（写入快照） */
  const cat = catStore.findCat(editForm.catId)
  const sub = cat ? catStore.findSub(cat.id, editForm.subId) : null
  try {
    await historyStore.update(h.id, {
      title: editForm.title.trim(),
      description: editForm.desc.trim(),
      catId: cat ? cat.id : '',
      catName: cat ? cat.name : '',
      subId: sub ? sub.id : '',
      subName: sub ? sub.name : '',
    })
    editingId.value = null
    ElMessage.success('已修改标题 / 描述 / 分类')
    favStore.loadPage({ page: 1 }).catch(() => {})
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '修改失败')
  }
}

async function removeItem(h: HistoryItem): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `确定删除「${h.title || '这条记录'}」吗？该轮的收藏也会一并删除。`,
      '删除确认',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【删除历史记录确认弹窗异常】', e)
    return
  }
  try {
    await historyStore.remove(h.id)
    favStore.loadPage({ page: 1 }).catch(() => {})
    ElMessage.success('已删除该条历史记录')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

async function clearAll(): Promise<void> {
  if (historyStore.total === 0) return
  try {
    await ElMessageBox.confirm('确定清空全部历史记录吗？此操作不可恢复，关联的收藏也会一并清空。', '清空确认', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【清空历史记录确认弹窗异常】', e)
    return
  }
  try {
    await historyStore.clearAll()
    favStore.loadPage({ page: 1 }).catch(() => {})
    ElMessage.success('已清空全部历史记录')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '清空失败')
  }
}

/* ---- 收藏切换（在明细里） ---- */
function isFaved(h: HistoryItem, no: number): boolean {
  return !!(h.favNos || []).find((x) => x.no === no)
}

async function toggleFav(h: HistoryItem, r: HistoryRecord): Promise<void> {
  try {
    if (isFaved(h, r.no)) {
      const f = (h.favNos || []).find((x) => x.no === r.no)
      if (f) await favStore.remove(f.id)
      historyStore.setFavNos(h.id, (h.favNos || []).filter((x) => x.no !== r.no))
      ElMessage.success(`已取消收藏 第${r.no}题`)
    } else {
      const newFavId = await favStore.add({
        roundId: h.id,
        no: r.no,
        title: h.title || '未命名轮次',
        mode: h.mode,
        modeName: h.modeName,
        timeStr: h.mode === 'single' || h.mode === 'practice' ? r.timeStr : '',
        catId: h.catId || '',
        catName: h.catName || '',
        subId: h.subId || '',
        subName: h.subName || '',
      })
      historyStore.setFavNos(h.id, [...(h.favNos || []), { no: r.no, id: newFavId }])
      ElMessage.success(`已收藏错题 第${r.no}题`)
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '收藏操作失败')
  }
}

/* ---- 知识点编辑 ---- */
const noteEditing = ref<string | null>(null) // `${roundId}:${no}`
const noteText = ref('')

function startNoteEdit(h: HistoryItem, r: HistoryRecord): void {
  noteEditing.value = `${h.id}:${r.no}`
  noteText.value = r.note || ''
}

async function saveNote(h: HistoryItem, r: HistoryRecord): Promise<void> {
  const val = noteText.value.trim()
  if (val !== (r.note || '')) {
    try {
      await historyStore.updateNote(h.id, r.no, val)
      ElMessage.success(`已保存 第${r.no}题 知识点`)
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '保存失败')
    }
  }
  noteEditing.value = null
}

function showTime(h: HistoryItem): boolean {
  return h.mode === 'single' || h.mode === 'practice' || h.mode === 'mental'
}

async function loadMore(): Promise<void> {
  try {
    await historyStore.loadMore()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载更多失败')
  }
}
</script>

<template>
  <div class="history-view">
    <div class="view-header">
      <div>
        <h2>历史记录</h2>
        <p class="mode-desc">每完成一整轮自动归档，清空本轮也会先存档再清空</p>
      </div>
      <el-button plain @click="clearAll">清空全部</el-button>
    </div>

    <!-- 筛选 -->
    <el-card shadow="never" class="filter-card">
      <el-select v-model="filterMode" style="width: 140px" placeholder="全部模式" @change="reload">
        <el-option value="" label="全部模式" />
        <el-option value="single" label="单题模式" />
        <el-option value="batch" label="整组模式" />
        <el-option value="practice" label="练习模式" />
      </el-select>
      <CatSelect
        v-model:cat-id="filterCatId"
        v-model:sub-id="filterSubId"
        cat-placeholder="全部大类"
        sub-placeholder="全部小类"
        @update:cat-id="reload"
        @update:sub-id="reload"
      />
      <span class="filter-count">
        {{ filtering ? `筛选结果：${historyStore.list.length} / ${historyStore.total} 条` : `共 ${historyStore.total} 条` }}
      </span>
    </el-card>

    <!-- 本页概要 -->
    <div class="summary-row">
      <el-card shadow="never" class="sum-card"><div class="num">{{ summary.rounds }}</div><div class="label">本页轮次</div></el-card>
      <el-card shadow="never" class="sum-card"><div class="num">{{ summary.questions }}</div><div class="label">本页题数</div></el-card>
      <el-card shadow="never" class="sum-card"><div class="num">{{ summary.totalMs }}</div><div class="label">本页用时</div></el-card>
      <el-card shadow="never" class="sum-card"><div class="num">{{ summary.rate }}</div><div class="label">本页正确率（跳过计错）</div></el-card>
    </div>

    <el-empty v-if="!loading && historyStore.isEmpty" description="暂无历史记录" />

    <div v-loading="loading" class="history-list">
      <el-card v-for="(h, idx) in historyStore.list" :key="h.id" shadow="never" class="history-card" :class="{ open: openIds.has(h.id) }">
        <div class="card-head" @click="toggleOpen(h.id)">
          <div class="head-top">
            <span class="no">{{ idx + 1 }}</span>
            <el-tag size="small" :type="h.mode === 'single' ? 'primary' : h.mode === 'batch' ? 'warning' : 'info'">{{ h.modeName }}</el-tag>
            <CatTag :cat-id="h.catId" :cat-name="h.catName" :sub-id="h.subId" :sub-name="h.subName" />
            <span class="title">{{ h.title || '未命名轮次' }}</span>
            <span class="rate" :class="{ low: h.rate < 60 }">{{ h.rate }}%</span>
          </div>
          <div class="head-meta">
            <span>{{ h.date }}</span>
            <span>{{ (h.records || []).length }} 题</span>
            <span>用时 {{ formatTime(h.totalMs) }}</span>
            <span>答对 {{ h.correct }}/{{ (h.records || []).length }}</span>
            <span v-if="(h.records || []).filter((x) => x.result === 'skip').length" class="meta-skip">
              跳过 {{ (h.records || []).filter((x) => x.result === 'skip').length }}
            </span>
            <span class="actions" @click.stop>
              <el-button size="small" text type="primary" @click="startEdit(h)">编辑</el-button>
              <el-button size="small" text @click="toggleOpen(h.id)">{{ openIds.has(h.id) ? '收起' : '展开' }}</el-button>
              <el-button size="small" text type="danger" @click="removeItem(h)">删除</el-button>
            </span>
          </div>
          <div v-if="h.desc" class="head-desc">描述：{{ h.desc }}</div>
        </div>

        <!-- 编辑表单 -->
        <div v-if="editingId === h.id" class="edit-form" @click.stop>
          <el-input v-model="editForm.title" maxlength="100" placeholder="标题" />
          <el-input v-model="editForm.desc" maxlength="200" placeholder="描述（可选）" />
          <CatSelect v-model:cat-id="editForm.catId" v-model:sub-id="editForm.subId" cat-placeholder="未分类" sub-placeholder="未分类" />
          <el-button type="primary" size="small" @click="saveEdit(h)">保存</el-button>
          <el-button size="small" @click="editingId = null">取消</el-button>
        </div>

        <!-- 明细 -->
        <div v-if="openIds.has(h.id)" class="detail-grid">
          <div v-for="r in h.records || []" :key="r.no" class="detail-item">
            <div class="di-top">
              <span class="di-title">第{{ r.no }}题</span>
              <span v-if="showTime(h)" class="di-time">{{ r.timeStr }}</span>
              <span class="di-right">
                <el-button
                  v-if="r.result === 'ng'"
                  size="small"
                  text
                  :type="isFaved(h, r.no) ? 'warning' : 'info'"
                  :title="isFaved(h, r.no) ? '取消收藏' : '收藏这道错题'"
                  @click="toggleFav(h, r)"
                >{{ isFaved(h, r.no) ? '★ 已收藏' : '☆ 收藏' }}</el-button>
                <span class="di-mark" :class="'mark-' + r.result">{{ r.result === 'ok' ? '✓' : r.result === 'skip' ? '○' : '✗' }}</span>
              </span>
            </div>
            <div class="di-note">
              <template v-if="noteEditing === `${h.id}:${r.no}`">
                <el-input v-model="noteText" size="small" maxlength="255" placeholder="如：逻辑判断-削弱质疑类" @keydown.enter.prevent="saveNote(h, r)" />
                <el-button size="small" type="primary" text @click="saveNote(h, r)">保存</el-button>
                <el-button size="small" text @click="noteEditing = null">取消</el-button>
              </template>
              <template v-else>
                <span class="note-text" :class="'note-' + r.result">{{ r.note || '暂无知识点描述' }}</span>
                <el-button size="small" text type="primary" @click="startNoteEdit(h, r)">{{ r.note ? '修改' : '添加' }}</el-button>
              </template>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <div v-if="historyStore.page < historyStore.totalPages" class="load-more">
      <el-button plain @click="loadMore">加载更多（{{ historyStore.list.length }}/{{ historyStore.total }}）</el-button>
    </div>
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
.filter-card {
  margin-bottom: 12px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.filter-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}
.sum-card {
  text-align: center;
}
.sum-card .num {
  font-size: 20px;
  font-weight: 700;
}
.sum-card .label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.history-card :deep(.el-card__body) {
  padding: 12px 16px;
}
.card-head {
  cursor: pointer;
}
.head-top {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.head-top .no {
  font-weight: 700;
  color: var(--el-text-color-secondary);
}
.head-top .title {
  font-weight: 600;
}
.head-top .rate {
  margin-left: auto;
  font-weight: 700;
  color: var(--el-color-success);
}
.head-top .rate.low {
  color: var(--el-color-danger);
}
.head-meta {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  align-items: center;
  flex-wrap: wrap;
}
.head-meta .meta-skip {
  color: var(--el-color-warning);
}
.head-meta .actions {
  margin-left: auto;
}
.head-desc {
  margin-top: 4px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}
.edit-form {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.edit-form .el-input {
  width: 200px;
}
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 8px;
  margin-top: 10px;
}
.detail-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--el-fill-color-blank);
}
.di-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.di-title {
  font-weight: 600;
  font-size: 13px;
}
.di-time {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.di-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
}
.di-mark {
  font-weight: 700;
}
.mark-ok { color: var(--el-color-success); }
.mark-ng { color: var(--el-color-danger); }
.mark-skip { color: var(--el-color-warning); }
.di-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
}
.note-text {
  color: var(--el-text-color-regular);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 180px;
  display: inline-block;
}
.note-ok { color: var(--el-color-success); }
.note-ng { color: var(--el-color-danger); }
.load-more {
  text-align: center;
  margin: 16px 0;
}
</style>
