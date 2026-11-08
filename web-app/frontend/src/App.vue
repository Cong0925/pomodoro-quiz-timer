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
    <el-aside width="230px" class="sidebar">
      <div class="brand">
        <div class="brand-logo">
          <el-icon :size="20" color="#fff"><Timer /></el-icon>
        </div>
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
  width: 230px;
  padding: 20px 14px;
  border-right: 1px solid var(--app-border);
  background: var(--app-bg);
  overflow: hidden;
  box-sizing: border-box;
}
.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 8px 18px;
  border-bottom: 1px solid var(--app-border-light);
  margin-bottom: 14px;
}
.brand-logo {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9px;
  background: var(--app-primary);
}
.brand-name {
  font-size: 17px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--app-text);
}
.brand-sub {
  font-size: 12px;
  color: var(--app-text-secondary);
}
.menu {
  flex: 1;
  border-right: none;
  overflow-y: auto;
  background: transparent;
}
.menu :deep(.el-menu-item-group__title) {
  padding: 12px 10px 6px;
  font-size: 12px;
  line-height: 1.4;
  color: #9aa1ac;
  letter-spacing: 0.05em;
}
.menu :deep(.el-menu-item) {
  height: 40px;
  line-height: 40px;
  padding: 0 12px !important;
  margin-bottom: 2px;
  border-radius: 8px;
  font-size: 15px;
  color: var(--app-text-regular);
}
.menu :deep(.el-menu-item .el-icon) {
  font-size: 18px;
  margin-right: 10px;
}
.menu :deep(.el-menu-item:hover) {
  background: #f3f4f6;
  color: var(--app-text);
}
/* 主版本同款 active：整行浅蓝底 + 蓝字 + 600 */
.menu :deep(.el-menu-item.is-active) {
  background: #eaf1ff;
  color: var(--app-primary);
  font-weight: 600;
}
.menu :deep(.el-menu-item.is-active::before) {
  display: none;
}
.menu-badge {
  margin-left: auto;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--app-primary);
  color: #fff;
  font-size: 12px;
  line-height: 20px;
  text-align: center;
  font-weight: 600;
  flex-shrink: 0;
}
.data-file-card {
  margin-top: 20px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 10px;
}
.data-file-card .tip {
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
}
.content {
  overflow-y: auto;
  background: var(--app-page-bg);
}
</style>
