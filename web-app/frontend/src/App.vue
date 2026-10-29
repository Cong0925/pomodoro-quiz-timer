<!-- 应用外壳：左侧菜单 + 右侧路由视图 + 学习时长悬浮球 -->
<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import StudyFloat from './components/StudyFloat.vue'
import { useCategoriesStore } from './stores/categoriesStore'
import { useFavoritesStore } from './stores/favoritesStore'
import { useHistoryStore } from './stores/historyStore'
import { useStudyStore } from './stores/studyStore'

const route = useRoute()
const router = useRouter()
const catStore = useCategoriesStore()
const historyStore = useHistoryStore()
const favStore = useFavoritesStore()
const studyStore = useStudyStore()

/* 菜单结构（与主版本一致的分组） */
const menuGroups = computed(() => [
  {
    label: '计时模式',
    items: [
      { key: 'timer-single', icon: 'Clock', label: '单题模式', to: '/timer/single' },
      { key: 'timer-batch', icon: 'Stopwatch', label: '整组模式', to: '/timer/batch' },
    ],
  },
  {
    label: '练习',
    items: [
      { key: 'practice', icon: 'Notebook', label: '题库练习', to: '/practice' },
      { key: 'mental', icon: 'Lightning', label: '速算练习', to: '/mental' },
    ],
  },
  {
    label: '数据',
    items: [
      { key: 'history', icon: 'Clock', label: '历史记录', to: '/history' },
      { key: 'favorites', icon: 'Star', label: '错题收藏', to: '/favorites' },
      { key: 'stats', icon: 'TrendCharts', label: '学习统计', to: '/stats' },
      { key: 'categories', icon: 'Grid', label: '分类管理', to: '/categories' },
    ],
  },
  {
    label: '备忘',
    items: [{ key: 'calendar', icon: 'Calendar', label: '日历备忘', to: '/calendar' }],
  },
  {
    label: '系统',
    items: [{ key: 'settings', icon: 'Setting', label: '设置', to: '/settings' }],
  },
])

const activeKey = computed(() => {
  if (route.name === 'timer') return `timer-${route.params.mode}`
  return (route.name as string) || ''
})

/** el-menu index → 路由路径 */
function menuRoute(index: string): string {
  if (index === 'timer-single') return '/timer/single'
  if (index === 'timer-batch') return '/timer/batch'
  return `/${index}`
}

function onMenuSelect(index: string): void {
  router.push(menuRoute(index))
}

function onStorage(e: StorageEvent): void {
  studyStore.onStorageEvent(e)
}

function onPageHide(): void {
  studyStore.beaconReport()
}

function onPageShow(e: PageTransitionEvent): void {
  studyStore.onPageShow(e)
}

onMounted(async () => {
  window.addEventListener('storage', onStorage)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('pageshow', onPageShow)
  /* 初始化：分类 + 今日学习基数 + 学习计时会话 + 历史/收藏徽标 */
  try {
    await catStore.load()
  } catch (e) {
    console.error('【初始化分类失败】', e)
  }
  try {
    await studyStore.loadTodayBase()
    studyStore.startSession()
  } catch (e) {
    console.error('【启动学习计时会话失败】', e)
  }
  historyStore.loadPage({ page: 1 }).catch(() => {})
  favStore.loadPage({ page: 1 }).catch(() => {})
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorage)
  window.removeEventListener('pagehide', onPageHide)
  window.removeEventListener('pageshow', onPageShow)
})
</script>

<template>
  <el-config-provider :locale="zhCn">
  <el-container class="app-shell">
    <!-- 左侧菜单 -->
    <el-aside width="200px" class="sidebar">
      <div class="brand">
        <el-icon :size="26" color="var(--el-color-primary)"><Timer /></el-icon>
        <div class="brand-text">
          <div class="brand-name">刷题计时器</div>
          <div class="brand-sub">计时 · 统计 · 留痕</div>
        </div>
      </div>

      <el-menu :default-active="activeKey" class="menu" @select="onMenuSelect">
        <el-menu-item-group v-for="g in menuGroups" :key="g.label" :title="g.label">
          <el-menu-item v-for="item in g.items" :key="item.key" :index="item.key">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.label }}</span>
            <span
              v-if="item.key === 'history' && historyStore.total > 0"
              class="menu-badge"
            >{{ historyStore.total > 99 ? '99+' : historyStore.total }}</span>
            <span
              v-if="item.key === 'favorites' && favStore.total > 0"
              class="menu-badge"
            >{{ favStore.total }}</span>
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>

      <div class="data-file-card">
        <div>存储：MySQL 数据库</div>
        <div class="tip">备份/迁移 → 设置页</div>
      </div>
    </el-aside>

    <!-- 右侧内容 -->
    <el-main class="content">
      <router-view v-slot="{ Component }">
        <keep-alive :include="['TimerView', 'HistoryView', 'FavoritesView', 'StatsView']">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </el-main>

    <StudyFloat />
  </el-container>
  </el-config-provider>
</template>

<style scoped>
.app-shell {
  height: 100vh;
}
.sidebar {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--el-border-color-light);
  background: var(--el-bg-color);
  overflow: hidden;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 18px 16px 12px;
}
.brand-name {
  font-size: 16px;
  font-weight: 700;
}
.brand-sub {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
}
/* 原版风格：active 整行浅蓝底 + 蓝字，不要左边框 */
.menu :deep(.el-menu-item.is-active) {
  background: #eff6ff;
  color: #2563eb;
  border-right: none;
}
.menu :deep(.el-menu-item.is-active::before) {
  display: none;
}
.menu :deep(.el-menu-item:hover) {
  background: #f3f4f6;
}
.menu-badge {
  margin-left: auto;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: #2563eb;
  color: #fff;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  font-weight: 600;
  flex-shrink: 0;
}
.data-file-card {
  margin: 8px 10px 12px;
  padding: 10px 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: #f9fafb;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.data-file-card .tip {
  margin-top: 2px;
  font-size: 11px;
}
.content {
  overflow-y: auto;
  background: var(--el-fill-color-light);
}
</style>
