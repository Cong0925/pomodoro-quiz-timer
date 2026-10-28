<!-- 题库管理：两层筛选 + 题库列表 + 题目表格（后端分页）+ 题库/题目增删改弹窗 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCategoriesStore } from '../stores/categoriesStore'
import * as practiceApi from '../api/practice'
import type { Bank, PracticeQuestion } from '../api/practice'

const props = defineProps<{ banks: Bank[] }>()
const emit = defineEmits<{ (e: 'refresh-banks'): void }>()

const catStore = useCategoriesStore()

/* ---- 筛选 ---- */
const mgCat = ref('all')
const mgSub = ref('all')

const filteredBanks = computed(() => {
  let list = props.banks
  if (mgCat.value !== 'all') list = list.filter((b) => b.catId === mgCat.value)
  if (mgSub.value !== 'all') list = list.filter((b) => (b.subId || '') === mgSub.value)
  return list
})

const subFilterOptions = computed(() => {
  const subs: Array<{ id: string; name: string }> = []
  catStore.categories.forEach((c) => {
    if (mgCat.value !== 'all' && c.id !== mgCat.value) return
    ;(c.subs || []).forEach((s) => {
      if (props.banks.some((b) => b.catId === c.id && (b.subId || '') === s.id)) subs.push({ id: s.id, name: s.name })
    })
  })
  if (props.banks.some((b) => (mgCat.value === 'all' || b.catId === mgCat.value) && !b.subId)) {
    subs.push({ id: '', name: '未分类' })
  }
  return subs
})

/* ---- 当前题库与题目分页 ---- */
const curBank = ref(0)
watch(
  () => filteredBanks.value,
  (list) => {
    if (!list.find((b) => b.id === curBank.value)) curBank.value = list.length ? list[0].id : 0
  },
  { immediate: true }
)

const curBankInfo = computed(() => props.banks.find((b) => b.id === curBank.value) || null)

const qPage = ref(1)
const qPageSize = ref(10)
const qTotal = ref(0)
const questions = ref<PracticeQuestion[]>([])
const qLoading = ref(false)

async function loadQuestions(): Promise<void> {
  if (!curBank.value) {
    questions.value = []
    qTotal.value = 0
    return
  }
  qLoading.value = true
  try {
    const data = await practiceApi.fetchQuestionsPage(curBank.value, qPage.value, qPageSize.value)
    qTotal.value = data.total
    questions.value = data.list
    /* 删除后页码越界回退 */
    if (questions.value.length === 0 && data.total > 0 && qPage.value > 1) {
      qPage.value--
      return
    }
  } catch (e) {
    ElMessage.error('题目加载失败：' + (e instanceof Error ? e.message : String(e)))
  } finally {
    qLoading.value = false
  }
}

watch([curBank, qPage, qPageSize], () => loadQuestions(), { immediate: true })

function diffText(d: number): string {
  return d === 1 ? '简单' : d === 3 ? '困难' : '中等'
}

/* ---- 题库弹窗 ---- */
const bankDialog = ref(false)
const bankEditId = ref(0)
const bankForm = ref({ name: '', catId: '', subId: '', description: '' })

function openBankDialog(id = 0): void {
  bankEditId.value = id
  const bank = id ? props.banks.find((b) => b.id === id) : null
  bankForm.value = {
    name: bank ? bank.name : '',
    catId: bank ? bank.catId || '' : mgCat.value !== 'all' ? mgCat.value : '',
    subId: bank ? bank.subId || '' : mgSub.value !== 'all' ? mgSub.value : '',
    description: bank ? bank.description || '' : '',
  }
  bankDialog.value = true
}

async function saveBank(): Promise<void> {
  const name = bankForm.value.name.trim()
  if (!name) return void ElMessage.warning('请填写题库名称')
  if (!bankForm.value.catId) return void ElMessage.warning('请选择所属大类')
  try {
    if (bankEditId.value) await practiceApi.updateBank(bankEditId.value, { ...bankForm.value, name })
    else await practiceApi.createBank({ ...bankForm.value, name })
    bankDialog.value = false
    emit('refresh-banks')
    ElMessage.success(bankEditId.value ? '题库已更新' : '题库已创建')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存题库失败')
  }
}

async function delBank(b: Bank): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除题库「${b.name}」将同时删除其下 ${b.count} 道题目，练习记录保留（快照不受影响）。`,
      '删除题库',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await practiceApi.deleteBank(b.id)
    emit('refresh-banks')
    ElMessage.success('题库已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除题库失败')
  }
}

/* ---- 题目弹窗 ---- */
const qDialog = ref(false)
const qEditId = ref(0)
const qForm = ref({ stem: '', analysis: '', difficulty: 2, answer: 'A', options: ['', '', '', ''] })

function openQDialog(id = 0): void {
  qEditId.value = id
  if (id) {
    const q = questions.value.find((x) => x.id === id)
    qForm.value = {
      stem: q?.stem || '',
      analysis: q?.analysis || '',
      difficulty: q?.difficulty || 2,
      answer: q?.answer || 'A',
      options: (q?.options && q.options.length ? [...q.options] : ['', '', '', '']) as string[],
    }
  } else {
    qForm.value = { stem: '', analysis: '', difficulty: 2, answer: 'A', options: ['', '', '', ''] }
  }
  qDialog.value = true
}

async function saveQuestion(): Promise<void> {
  const stem = qForm.value.stem.trim()
  if (!stem) return void ElMessage.warning('请填写题干')
  if (qForm.value.options.some((o) => !o.trim())) return void ElMessage.warning('请填写所有选项')
  const payload: practiceApi.QuestionPayload = {
    bankId: curBank.value,
    type: 'single',
    stem,
    options: qForm.value.options.map((o) => o.trim()),
    answer: qForm.value.answer,
    analysis: qForm.value.analysis.trim(),
    difficulty: qForm.value.difficulty,
    source: '',
  }
  try {
    if (qEditId.value) await practiceApi.updateQuestion(qEditId.value, payload)
    else await practiceApi.createQuestion(payload)
    qDialog.value = false
    emit('refresh-banks')
    loadQuestions()
    ElMessage.success('题目已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存题目失败')
  }
}

async function delQuestion(id: number): Promise<void> {
  try {
    await ElMessageBox.confirm('删除后无法恢复，确定删除该题目？', '删除题目', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  try {
    await practiceApi.deleteQuestion(id)
    emit('refresh-banks')
    loadQuestions()
    ElMessage.success('题目已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除题目失败')
  }
}
</script>

<template>
  <div class="manage">
    <div class="mg-toolbar">
      <el-select v-model="mgCat" style="width: 170px" @change="mgSub = 'all'">
        <el-option value="all" label="全部大类" />
        <el-option v-for="c in catStore.categories" :key="c.id" :value="c.id" :label="`${c.name}（${banks.filter((b) => b.catId === c.id).length}）`" />
      </el-select>
      <el-select v-model="mgSub" style="width: 150px">
        <el-option value="all" label="全部分类" />
        <el-option v-for="s in subFilterOptions" :key="s.id || '__none__'" :value="s.id" :label="s.name" />
      </el-select>
      <el-button type="primary" @click="openBankDialog(0)">+ 新增题库</el-button>
    </div>

    <div class="mg-body">
      <!-- 左：题库列表 -->
      <div class="bank-list">
        <el-empty v-if="filteredBanks.length === 0" description="暂无题库" :image-size="60" />
        <div
          v-for="b in filteredBanks"
          :key="b.id"
          class="bank-row"
          :class="{ active: curBank === b.id }"
          @click="curBank = b.id; qPage = 1"
        >
          <div class="br-main">
            <div class="br-name">{{ b.name }} <span class="br-count">{{ b.count }} 题</span></div>
            <div class="br-meta">{{ b.description || '暂无描述' }}</div>
          </div>
          <div class="br-ops" @click.stop>
            <el-button size="small" text @click="openBankDialog(b.id)">编辑</el-button>
            <el-button size="small" text type="danger" @click="delBank(b)">删除</el-button>
          </div>
        </div>
      </div>

      <!-- 右：题目表格 -->
      <div class="q-panel">
        <div class="q-head">
          <div>
            <div class="q-title">{{ curBankInfo ? curBankInfo.name : '未选题库' }}</div>
            <div class="q-sub">{{ curBankInfo ? `${curBankInfo.catName || ''}${curBankInfo.subName ? ' / ' + curBankInfo.subName : ''} · ${curBankInfo.count} 道题` : '' }}</div>
          </div>
          <el-button type="primary" :disabled="!curBank" @click="openQDialog(0)">+ 新增题目</el-button>
        </div>

        <el-table v-loading="qLoading" :data="questions" size="small" stripe>
          <el-table-column label="#" width="50">
            <template #default="{ $index }">{{ (qPage - 1) * qPageSize + $index + 1 }}</template>
          </el-table-column>
          <el-table-column label="题干" min-width="260">
            <template #default="{ row }"><span class="stem-cell">{{ row.stem.split('\n')[0] }}</span></template>
          </el-table-column>
          <el-table-column label="答案" width="70" align="center">
            <template #default="{ row }"><el-tag size="small">{{ row.answer }}</el-tag></template>
          </el-table-column>
          <el-table-column label="难度" width="80" align="center">
            <template #default="{ row }">{{ diffText(row.difficulty) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="110" align="center">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openQDialog(row.id)">编辑</el-button>
              <el-button size="small" text type="danger" @click="delQuestion(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!qLoading && questions.length === 0" description="该题库暂无题目" :image-size="60" />

        <div class="q-pager">
          <el-pagination
            v-model:current-page="qPage"
            v-model:page-size="qPageSize"
            :total="qTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            size="small"
          />
        </div>
      </div>
    </div>

    <!-- 题库弹窗 -->
    <el-dialog v-model="bankDialog" :title="bankEditId ? '编辑题库' : '新增题库'" width="440px" align-center>
      <el-form label-width="80px">
        <el-form-item label="题库名称" required>
          <el-input v-model="bankForm.name" maxlength="100" placeholder="如：公务员考试-资料分析" />
        </el-form-item>
        <el-form-item label="所属大类" required>
          <el-select v-model="bankForm.catId" style="width: 100%" @change="bankForm.subId = ''">
            <el-option value="" label="（不指定）" />
            <el-option v-for="c in catStore.categories" :key="c.id" :value="c.id" :label="c.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="二级分类">
          <el-select v-model="bankForm.subId" style="width: 100%" :disabled="!bankForm.catId">
            <el-option value="" label="（无）" />
            <el-option v-for="s in catStore.findCat(bankForm.catId)?.subs || []" :key="s.id" :value="s.id" :label="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="bankForm.description" maxlength="255" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bankDialog = false">取消</el-button>
        <el-button type="primary" @click="saveBank">保存</el-button>
      </template>
    </el-dialog>

    <!-- 题目弹窗 -->
    <el-dialog v-model="qDialog" :title="qEditId ? '编辑题目' : '新增题目'" width="560px" align-center>
      <el-form label-width="60px">
        <el-form-item label="题干" required>
          <el-input v-model="qForm.stem" type="textarea" :rows="3" maxlength="20000" placeholder="题干内容" />
        </el-form-item>
        <el-form-item v-for="(_, i) in qForm.options" :key="i" :label="String.fromCharCode(65 + i)">
          <el-input v-model="qForm.options[i]" maxlength="200" :placeholder="`选项 ${String.fromCharCode(65 + i)} 内容`" />
        </el-form-item>
        <el-form-item label="答案" required>
          <el-select v-model="qForm.answer" style="width: 120px">
            <el-option v-for="(_, i) in qForm.options" :key="i" :value="String.fromCharCode(65 + i)" :label="String.fromCharCode(65 + i)" />
          </el-select>
        </el-form-item>
        <el-form-item label="难度">
          <el-radio-group v-model="qForm.difficulty">
            <el-radio-button :value="1">简单</el-radio-button>
            <el-radio-button :value="2">中等</el-radio-button>
            <el-radio-button :value="3">困难</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="解析">
          <el-input v-model="qForm.analysis" type="textarea" :rows="2" maxlength="20000" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="qDialog = false">取消</el-button>
        <el-button type="primary" @click="saveQuestion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mg-toolbar {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}
.mg-body {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 12px;
  align-items: start;
}
.bank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 70vh;
  overflow-y: auto;
}
.bank-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 8px 10px;
  cursor: pointer;
  background: var(--el-bg-color);
}
.bank-row.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.br-name {
  font-weight: 600;
  font-size: 13px;
}
.br-count {
  font-size: 11px;
  color: var(--el-color-primary);
  margin-left: 4px;
}
.br-meta {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.br-ops {
  flex-shrink: 0;
}
.q-panel {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  padding: 12px;
  background: var(--el-bg-color);
}
.q-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}
.q-title {
  font-size: 16px;
  font-weight: 700;
}
.q-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}
.stem-cell {
  display: inline-block;
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  vertical-align: middle;
}
.q-pager {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>
