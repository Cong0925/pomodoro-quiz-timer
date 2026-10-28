<!-- 错题收藏：分页卡片、筛选、改分类（弹窗）、移除、清空 -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CatSelect from '../components/CatSelect.vue'
import CatTag from '../components/CatTag.vue'
import { useFavoritesStore } from '../stores/favoritesStore'
import { useCategoriesStore } from '../stores/categoriesStore'
import type { FavoriteItem } from '../types'

defineOptions({ name: 'FavoritesView' })

const favStore = useFavoritesStore()
const catStore = useCategoriesStore()

const filterMode = ref('')
const filterCatId = ref('')
const filterSubId = ref('')
const loading = ref(false)

async function reload(): Promise<void> {
  loading.value = true
  try {
    await favStore.setFilter({ mode: filterMode.value, catId: filterCatId.value, subId: filterSubId.value })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载收藏失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  reload()
})

const summary = computed(() => ({
  count: favStore.list.length,
  rounds: new Set(favStore.list.map((f) => f.hid)).size,
  single: favStore.list.filter((f) => f.mode === 'single').length,
}))

const filtering = computed(() => filterMode.value || filterCatId.value || filterSubId.value)

/* ---- 改分类弹窗 ---- */
const catDialogVisible = ref(false)
const catEditTarget = ref<FavoriteItem | null>(null)
const catEditCatId = ref('')
const catEditSubId = ref('')

function openCatEdit(f: FavoriteItem): void {
  catEditTarget.value = f
  catEditCatId.value = catStore.findCat(f.catId || '') ? f.catId || '' : ''
  catEditSubId.value = catEditCatId.value && catStore.findSub(catEditCatId.value, f.subId || '') ? f.subId || '' : ''
  catDialogVisible.value = true
}

async function saveCatEdit(): Promise<void> {
  const target = catEditTarget.value
  if (!target) return
  const cat = catStore.findCat(catEditCatId.value)
  const sub = cat ? catStore.findSub(cat.id, catEditSubId.value) : null
  try {
    await favStore.updateCat(target.id, {
      catId: cat ? cat.id : '',
      catName: cat ? cat.name : '',
      subId: sub ? sub.id : '',
      subName: sub ? sub.name : '',
    })
    catDialogVisible.value = false
    ElMessage.success('已修改该错题的分类')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '修改分类失败')
  }
}

async function removeItem(f: FavoriteItem): Promise<void> {
  try {
    await favStore.remove(f.id)
    ElMessage.success('已移除收藏')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '移除失败')
  }
}

async function clearAll(): Promise<void> {
  if (favStore.total === 0) return
  try {
    await ElMessageBox.confirm('确定清空全部错题收藏吗？', '清空确认', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await favStore.clearAll()
    ElMessage.success('已清空全部收藏')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '清空失败')
  }
}

async function loadMore(): Promise<void> {
  try {
    await favStore.loadMore()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载更多失败')
  }
}
</script>

<template>
  <div class="fav-view">
    <div class="view-header">
      <div>
        <h2>错题收藏</h2>
        <p class="mode-desc">在历史记录明细中点击「收藏」把错题加入这里，可改分类、移除</p>
      </div>
      <el-button plain type="danger" @click="clearAll">清空全部</el-button>
    </div>

    <el-card shadow="never" class="filter-card">
      <el-select v-model="filterMode" style="width: 140px" @change="reload">
        <el-option value="" label="全部模式" />
        <el-option value="single" label="单题模式" />
        <el-option value="batch" label="整组模式" />
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
        {{ filtering ? `筛选结果：${favStore.list.length} / ${favStore.total} 条` : `共 ${favStore.total} 条` }}
      </span>
    </el-card>

    <div class="summary-row">
      <el-card shadow="never" class="sum-card"><div class="num">{{ summary.count }}</div><div class="label">本页收藏</div></el-card>
      <el-card shadow="never" class="sum-card"><div class="num">{{ summary.rounds }}</div><div class="label">来源轮次</div></el-card>
      <el-card shadow="never" class="sum-card"><div class="num">{{ summary.single }}</div><div class="label">单题模式</div></el-card>
    </div>

    <el-empty v-if="!loading && favStore.list.length === 0" description="暂无收藏的错题" />

    <div v-loading="loading" class="fav-list">
      <el-card v-for="f in favStore.list" :key="f.id" shadow="never" class="fav-card">
        <div class="fav-no">{{ f.no }}</div>
        <div class="fav-info">
          <div class="fav-title" :title="f.title">{{ f.title }}</div>
          <div class="fav-meta">
            {{ f.modeName }}<template v-if="f.timeStr"> · 用时 {{ f.timeStr }}</template> · 收藏于 {{ f.collectedAt }}
          </div>
        </div>
        <CatTag :cat-id="f.catId" :cat-name="f.catName" :sub-id="f.subId" :sub-name="f.subName" />
        <div class="fav-actions">
          <el-button size="small" @click="openCatEdit(f)">改分类</el-button>
          <el-button size="small" type="danger" plain @click="removeItem(f)">移除</el-button>
        </div>
      </el-card>
    </div>

    <div v-if="favStore.page < favStore.totalPages" class="load-more">
      <el-button plain @click="loadMore">加载更多（{{ favStore.list.length }}/{{ favStore.total }}）</el-button>
    </div>

    <!-- 改分类弹窗 -->
    <el-dialog v-model="catDialogVisible" title="修改错题分类" width="400px" align-center>
      <CatSelect v-model:cat-id="catEditCatId" v-model:sub-id="catEditSubId" cat-placeholder="未分类" sub-placeholder="未分类" />
      <template #footer>
        <el-button @click="catDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCatEdit">确定</el-button>
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
  grid-template-columns: repeat(3, 1fr);
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
.fav-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.fav-card :deep(.el-card__body) {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}
.fav-no {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fav-info {
  flex: 1;
  min-width: 0;
}
.fav-title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fav-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.fav-actions {
  display: flex;
  gap: 6px;
}
.load-more {
  text-align: center;
  margin: 16px 0;
}
</style>
