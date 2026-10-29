<!-- 速算题库管理：题型/标签/关键词筛选 + 后端分页 + 新增/编辑/停用/恢复 -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as mentalApi from '../api/mental'
import type { MentalAdminGroup, MentalQuestion } from '../api/mental'

const TYPE_NAMES: Record<string, string> = { percent: '百化分', compare: '分数比大小', estimate: '估算值', square: '平方数' }
const MG_TYPES = ['percent', 'compare', 'estimate', 'square']

const typeSel = ref('all')
const tagSel = ref('all')
const diffSel = ref('all')
const kw = ref('')
/* 状态三态筛选：仅正常（默认）/ 仅已停用 / 全部 */
const statusSel = ref<'normal' | 'deleted' | 'all'>('normal')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)
const allTotal = ref(0)
const groups = ref<Record<string, MentalAdminGroup>>({})
const list = ref<MentalQuestion[]>([])
const loading = ref(false)

let kwTimer: number | null = null

async function load(): Promise<void> {
  loading.value = true
  try {
    const data = await mentalApi.fetchAdminQuestions({
      qtype: typeSel.value !== 'all' ? typeSel.value : undefined,
      tag: tagSel.value !== 'all' ? tagSel.value : undefined,
      diff: diffSel.value !== 'all' ? diffSel.value : undefined,
      kw: kw.value.trim() || undefined,
      status: statusSel.value,
      page: page.value,
      pageSize: pageSize.value,
    })
    list.value = data.list || []
    total.value = data.total || 0
    groups.value = data.groups || {}
    allTotal.value = data.allTotal != null ? data.allTotal : list.value.length
    /* 删除后页码越界回退 */
    if (list.value.length === 0 && total.value > 0 && page.value > 1) {
      page.value--
    }
  } catch (e) {
    ElMessage.error('题库加载失败：' + (e instanceof Error ? e.message : String(e)))
    list.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

watch([typeSel, tagSel, diffSel, statusSel, page, pageSize], () => load())
watch(kw, () => {
  if (kwTimer) clearTimeout(kwTimer)
  kwTimer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 300)
})

/* 左侧：题型+标签分组 */
const groupTree = computed(() =>
  MG_TYPES.map((t) => {
    const grp = groups.value[t]
    if (!grp || !grp.n) return null
    const tags = Object.keys(grp.tags || {}).sort((a, b) => (grp.tags[b] || 0) - (grp.tags[a] || 0))
    return { type: t, name: TYPE_NAMES[t] || t, n: grp.n, tags: tags.map((k) => ({ tag: k, n: grp.tags[k] })) }
  }).filter((x): x is NonNullable<typeof x> => x !== null)
)

/* 标签下拉候选（跨题型去重按数量降序） */
const tagOptions = computed(() => {
  const map: Record<string, number> = {}
  MG_TYPES.forEach((t) => {
    const grp = groups.value[t]
    if (!grp || !grp.tags) return
    Object.keys(grp.tags).forEach((k) => {
      map[k] = (map[k] || 0) + (grp.tags[k] || 0)
    })
  })
  return Object.keys(map).sort((a, b) => map[b] - map[a] || a.localeCompare(b, 'zh'))
})

function diffText(d: number): string {
  return d === 1 ? '简单' : d === 3 ? '困难' : '中等'
}

function ansText(q: MentalQuestion): string {
  if (q.fillable) return String(q.options[0] != null ? q.options[0] : q.answer)
  const opt = q.options[Number(q.answer)]
  return opt !== undefined ? String(opt) : String(q.answer)
}

/* ---- 新增/编辑弹窗 ---- */
const dialog = ref(false)
const editId = ref(0)
const form = ref({
  qtype: 'percent',
  difficulty: 2,
  stem: '',
  tip: '',
  tag: '',
  fillable: true,
  options: [] as string[],
  answer: '',
})

function openDialog(id = 0): void {
  editId.value = id
  const q = id ? list.value.find((x) => x.id === id) : null
  if (q) {
    form.value = {
      qtype: q.qtype,
      difficulty: q.difficulty,
      stem: q.stem,
      tip: q.tip || '',
      tag: q.tag || '',
      fillable: !!q.fillable,
      options: q.fillable ? [String(q.options[0] != null ? q.options[0] : q.answer)] : q.options.map((o) => String(o)),
      answer: q.fillable ? String(q.options[0] != null ? q.options[0] : q.answer) : String(q.answer),
    }
  } else {
    const t = typeSel.value !== 'all' ? typeSel.value : 'percent'
    form.value = {
      qtype: t,
      difficulty: 2,
      stem: '',
      tip: '',
      tag: tagSel.value !== 'all' ? tagSel.value : '',
      fillable: t === 'percent' || t === 'square',
      options: t === 'compare' ? ['', ''] : ['', '', '', ''],
      answer: t === 'percent' || t === 'square' ? '' : '0',
    }
  }
  dialog.value = true
}

function onTypeChange(): void {
  form.value.fillable = form.value.qtype === 'percent' || form.value.qtype === 'square'
  form.value.options = form.value.qtype === 'compare' ? ['', ''] : ['', '', '', '']
  form.value.answer = form.value.fillable ? '' : '0'
}

function addOption(): void {
  if (form.value.options.length >= 6) return void ElMessage.warning('最多 6 个选项')
  form.value.options.push('')
}

function removeOption(i: number): void {
  if (form.value.options.length <= 2) return void ElMessage.warning('至少保留 2 个选项')
  form.value.options.splice(i, 1)
  const cur = Number(form.value.answer)
  if (form.value.options[cur] === undefined) form.value.answer = '0'
}

async function save(): Promise<void> {
  const stem = form.value.stem.trim()
  if (!stem) return void ElMessage.warning('请填写题干')
  let options: string[]
  let answer: string
  if (form.value.fillable) {
    answer = form.value.answer.trim()
    if (!answer) return void ElMessage.warning('请填写规范答案文本（如 1/8、14.3%、169、1.7）')
    options = [answer]
  } else {
    options = form.value.options.map((o) => o.trim())
    if (options.length < 2 || options.some((o) => !o)) return void ElMessage.warning('请填写全部选项')
    if (options[Number(form.value.answer)] === undefined) return void ElMessage.warning('请选择正确答案')
    answer = String(form.value.answer)
  }
  const payload: mentalApi.MentalAdminPayload = {
    qtype: form.value.qtype,
    difficulty: form.value.difficulty,
    stem,
    options,
    answer,
    tip: form.value.tip.trim(),
    tag: form.value.tag.trim(),
    fillable: form.value.fillable,
  }
  try {
    if (editId.value) await mentalApi.updateAdminQuestion(editId.value, payload)
    else await mentalApi.createAdminQuestion(payload)
    dialog.value = false
    await load()
    ElMessage.success('题目已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存题目失败')
  }
}

async function deactivate(q: MentalQuestion): Promise<void> {
  try {
    await ElMessageBox.confirm('停用后练习将不再抽取该题，可随时恢复。确定停用？', '停用题目', {
      type: 'warning',
      confirmButtonText: '停用',
      cancelButtonText: '取消',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【停用题目确认弹窗异常】', e)
    return
  }
  try {
    await mentalApi.deactivateQuestion(q.id)
    await load()
    ElMessage.success('题目已停用')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '停用失败')
  }
}

async function restore(q: MentalQuestion): Promise<void> {
  try {
    await mentalApi.updateAdminQuestion(q.id, {
      qtype: q.qtype,
      difficulty: q.difficulty,
      stem: q.stem,
      options: q.fillable ? [String(q.options[0] != null ? q.options[0] : q.answer)] : q.options,
      answer: q.fillable ? String(q.options[0] != null ? q.options[0] : q.answer) : q.answer,
      tip: q.tip,
      tag: q.tag,
      fillable: !!q.fillable,
      active: true,
    })
    await load()
    ElMessage.success('题目已恢复')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '恢复失败')
  }
}

onMounted(() => load())
</script>

<template>
  <div class="m-manage">
    <div class="mg-body">
      <!-- 左：题型+标签分组 -->
      <div class="group-nav">
        <div
          class="g-type"
          :class="{ active: typeSel === 'all' && tagSel === 'all' }"
          @click="typeSel = 'all'; tagSel = 'all'; page = 1"
        >
          全部题目 <i>{{ allTotal }}</i>
        </div>
        <div v-for="g in groupTree" :key="g.type" class="g-group">
          <div class="g-type" :class="{ active: typeSel === g.type && tagSel === 'all' }" @click="typeSel = g.type; tagSel = 'all'; page = 1">
            {{ g.name }} <i>{{ g.n }}</i>
          </div>
          <div
            v-for="t in g.tags"
            :key="t.tag"
            class="g-tag"
            :class="{ active: typeSel === g.type && tagSel === t.tag }"
            @click="typeSel = g.type; tagSel = t.tag; page = 1"
          >
            <span>{{ t.tag }}</span> <i>{{ t.n }}</i>
          </div>
        </div>
      </div>

      <!-- 右：筛选 + 表格 -->
      <div class="q-panel">
        <div class="toolbar">
          <el-select v-model="typeSel" style="width: 130px" @change="tagSel = 'all'; page = 1">
            <el-option value="all" label="全部题型" />
            <el-option v-for="t in MG_TYPES" :key="t" :value="t" :label="TYPE_NAMES[t]" />
          </el-select>
          <el-select v-model="tagSel" style="width: 150px" filterable allow-create placeholder="全部标签" @change="page = 1">
            <el-option value="all" label="全部标签" />
            <el-option v-for="t in tagOptions" :key="t" :value="t" :label="t" />
          </el-select>
          <el-select v-model="diffSel" style="width: 120px" @change="page = 1">
            <el-option value="all" label="全部难度" />
            <el-option value="1" label="简单" />
            <el-option value="2" label="中等" />
            <el-option value="3" label="困难" />
          </el-select>
          <el-select v-model="statusSel" style="width: 120px" @change="page = 1">
            <el-option value="normal" label="仅正常" />
            <el-option value="deleted" label="仅已停用" />
            <el-option value="all" label="全部状态" />
          </el-select>
          <el-input v-model="kw" style="width: 180px" placeholder="搜索题干/技巧/标签" clearable />
          <el-button type="primary" @click="openDialog(0)">+ 新增题目</el-button>
        </div>

        <div class="stat-line">
          {{ typeSel === 'all' ? '全部题目' : TYPE_NAMES[typeSel] }}{{ tagSel !== 'all' ? ` / ${tagSel}` : '' }} ·
          {{ total }} 道题 · 题库共 {{ allTotal }} 道
        </div>

        <el-table v-loading="loading" :data="list" size="default" stripe :height="list.length ? 500 : undefined">
          <el-table-column type="index" label="#" width="55" align="center" :index="(i: number) => (page - 1) * pageSize + i + 1" />
          <el-table-column prop="stem" label="题干" min-width="200">
            <template #default="{ row }">
              <span class="stem-cell" :class="{ inactive: !row.active }">{{ row.stem.split('\n')[0] }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="qtype" label="题型" width="100" sortable>
            <template #default="{ row }">{{ TYPE_NAMES[row.qtype] || row.qtype }}</template>
          </el-table-column>
          <el-table-column prop="difficulty" label="难度" width="100" align="center" sortable>
            <template #default="{ row }">{{ diffText(row.difficulty) }}</template>
          </el-table-column>
          <el-table-column label="答案" min-width="90">
            <template #default="{ row }">{{ ansText(row as MentalQuestion) }}</template>
          </el-table-column>
          <el-table-column label="形式" width="60" align="center">
            <template #default="{ row }">{{ row.fillable ? '填空' : '选择' }}</template>
          </el-table-column>
          <el-table-column prop="active" label="状态" width="80" align="center" sortable>
            <template #default="{ row }">
              <el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '正常' : '已停用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openDialog(row.id)">编辑</el-button>
              <el-button v-if="row.active" size="small" text type="danger" @click="deactivate(row as MentalQuestion)">停用</el-button>
              <el-button v-else size="small" text type="success" @click="restore(row as MentalQuestion)">恢复</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pager">
          <el-pagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            size="small"
          />
        </div>
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialog" :title="editId ? '编辑题目' : '新增题目'" width="800px" align-center>
      <el-form label-width="90px">
        <el-form-item label="题型" required>
          <el-select v-model="form.qtype" style="width: 160px" @change="onTypeChange">
            <el-option v-for="t in MG_TYPES" :key="t" :value="t" :label="TYPE_NAMES[t]" />
          </el-select>
          <el-checkbox v-model="form.fillable" style="margin-left: 14px">填空题</el-checkbox>
        </el-form-item>
        <el-form-item label="难度">
          <el-radio-group v-model="form.difficulty">
            <el-radio-button :value="1">简单</el-radio-button>
            <el-radio-button :value="2">中等</el-radio-button>
            <el-radio-button :value="3">困难</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="题干" required>
          <el-input v-model="form.stem" type="textarea" :rows="4" maxlength="20000" />
        </el-form-item>
        <el-form-item v-if="!form.fillable" v-for="(_, i) in form.options" :key="i" :label="String.fromCharCode(65 + i)">
          <el-input v-model="form.options[i]" maxlength="200" :placeholder="`选项 ${String.fromCharCode(65 + i)} 内容`" />
          <el-button text type="danger" size="small" @click="removeOption(i)">删</el-button>
        </el-form-item>
        <el-form-item v-if="!form.fillable" label=" ">
          <el-button size="small" @click="addOption">+ 添加选项</el-button>
        </el-form-item>
        <el-form-item :label="form.fillable ? '正确答案' : '正确答案'" required>
          <el-select v-if="!form.fillable" v-model="form.answer" style="width: 120px">
            <el-option v-for="(_, i) in form.options" :key="i" :value="String(i)" :label="String.fromCharCode(65 + i)" />
          </el-select>
          <el-input v-else v-model="form.answer" style="width: 220px" placeholder="规范答案文本（如 1/8、14.3%、169、1.7）" />
        </el-form-item>
        <el-form-item label="技巧提示">
          <el-input v-model="form.tip" type="textarea" :rows="3" maxlength="20000" placeholder="答题反馈的核心内容" />
        </el-form-item>
        <el-form-item label="标签">
          <el-input v-model="form.tag" style="width: 260px" placeholder="如 百化分-1/7 / 交叉相乘" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mg-body {
  display: grid;
  grid-template-columns: 210px 1fr;
  gap: 12px;
  align-items: start;
}
.group-nav {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 8px;
  background: var(--el-bg-color);
  max-height: 70vh;
  overflow-y: auto;
}
.g-type {
  padding: 6px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  display: flex;
  justify-content: space-between;
}
.g-type i,
.g-tag i {
  font-style: normal;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.g-type.active,
.g-tag.active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}
.g-tag {
  padding: 4px 8px 4px 18px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  display: flex;
  justify-content: space-between;
}
.g-tag:hover,
.g-type:hover {
  background: var(--el-fill-color);
}
.q-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
  background: var(--el-bg-color);
}
.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.stat-line {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-bottom: 8px;
}
.stem-cell {
  display: inline-block;
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.stem-cell.inactive {
  opacity: 0.5;
  text-decoration: line-through;
}
.pager {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>
