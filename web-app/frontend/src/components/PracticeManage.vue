<!-- 题库管理：两层筛选 + 题库列表 + 题目表格（后端分页）+ 题库/题目增删改弹窗 -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCategoriesStore } from '../stores/categoriesStore'
import * as practiceApi from '../api/practice'
import { base64Bytes, compressImageFile, fmtKB, isDataImageUrl } from '../utils/image'
import type { Bank, PracticeOption, PracticeQuestion } from '../api/practice'

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
/* qPage 需声明在下方 banks watcher 之前：immediate 回调同步执行，内部会重置 qPage */
const qPage = ref(1)
watch(
  () => filteredBanks.value,
  (list) => {
    if (!list.find((b) => b.id === curBank.value)) {
      curBank.value = list.length ? list[0].id : 0
      qPage.value = 1 /* 题库删除等原因自动回落到其他题库时回第 1 页 */
    }
  },
  { immediate: true }
)

const curBankInfo = computed(() => props.banks.find((b) => b.id === curBank.value) || null)

const qPageSize = ref(10)
const qTotal = ref(0)
const questions = ref<PracticeQuestion[]>([])
const qLoading = ref(false)
/* 题目状态筛选：normal=仅正常 deleted=仅已停用 all=全部（后端分页过滤） */
const statusFilter = ref<practiceApi.QuestionStatus>('normal')

async function loadQuestions(): Promise<void> {
  if (!curBank.value) {
    questions.value = []
    qTotal.value = 0
    return
  }
  qLoading.value = true
  try {
    const data = await practiceApi.fetchQuestionsPage(curBank.value, qPage.value, qPageSize.value, statusFilter.value)
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

/* 翻页/改页容量/筛选变化统一走此 watcher 重新加载；
   页码重置放在各筛选事件点（切题库点击、状态 @change、size-change），
   禁止在此回调内重置 qPage——qPage 自身是监听源，重置会把翻页打回第 1 页 */
watch([curBank, qPage, qPageSize, statusFilter], () => {
  loadQuestions()
}, { immediate: true })

function diffText(d: number): string {
  return d === 1 ? '简单' : d === 3 ? '困难' : '中等'
}

/* ---- 题库行操作菜单（三点） ---- */
function onBankCmd(cmd: string | number | object, b: Bank): void {
  if (cmd === 'edit') openBankDialog(b.id)
  else if (cmd === 'delete') delBank(b)
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
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【删除题库确认弹窗异常】', e)
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
interface QOptionDraft { text: string; img: string }

const qDialog = ref(false)
const qEditId = ref(0)
const qForm = ref<{
  stem: string
  stemImg: string[]
  analysis: string
  difficulty: number
  answer: string
  options: QOptionDraft[]
}>({ stem: '', stemImg: [], analysis: '', difficulty: 2, answer: 'A', options: Array.from({ length: 4 }, () => ({ text: '', img: '' })) })

/* 图片上传 refs（题干多图 / 选项逐项） */
const stemFileInput = ref<HTMLInputElement | null>(null)
const optFileInputs = ref<(HTMLInputElement | null)[]>([])
function setOptFileRef(i: number, el: unknown): void {
  optFileInputs.value[i] = el as HTMLInputElement
}
function triggerOptFile(i: number): void {
  optFileInputs.value[i]?.click()
}

async function onOptFile(i: number, e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  if (!f) return
  try {
    const res = await compressImageFile(f)
    qForm.value.options[i].img = res.dataUrl
    ElMessage.success(`选项 ${String.fromCharCode(65 + i)} 图已上传：${fmtKB(res.orig)} → ${fmtKB(res.size)}`)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '图片压缩失败')
  } finally {
    input.value = ''
  }
}

async function onStemFiles(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files || [])
  if (!files.length) return
  let ok = 0
  for (const f of files) {
    try {
      const res = await compressImageFile(f)
      qForm.value.stemImg.push(res.dataUrl)
      ok++
    } catch (err) {
      console.error('【题干图压缩失败】', err)
    }
  }
  ElMessage.success(ok === files.length ? `已上传 ${ok} 张题干图` : `已上传 ${ok}/${files.length} 张题干图`)
  input.value = ''
}

function removeStemImg(i: number): void {
  qForm.value.stemImg.splice(i, 1)
}

const stemImgTotal = computed(() => qForm.value.stemImg.reduce((s, x) => s + base64Bytes(x), 0))

function openQDialog(id = 0): void {
  qEditId.value = id
  if (id) {
    const q = questions.value.find((x) => x.id === id)
    const opts = (q?.options && q.options.length ? [...q.options] : ['', '', '', '']) as PracticeOption[]
    qForm.value = {
      stem: q?.stem || '',
      stemImg: Array.isArray(q?.stem_img) ? q.stem_img : [],
      analysis: q?.analysis || '',
      difficulty: q?.difficulty || 2,
      answer: q?.answer || 'A',
      options: opts.map((o) => (typeof o === 'string' ? { text: o, img: '' } : { text: o.text || '', img: o.img || '' })),
    }
  } else {
    qForm.value = { stem: '', stemImg: [], analysis: '', difficulty: 2, answer: 'A', options: Array.from({ length: 4 }, () => ({ text: '', img: '' })) }
  }
  qDialog.value = true
}

async function saveQuestion(): Promise<void> {
  const stem = qForm.value.stem.trim()
  const stemImg = qForm.value.stemImg.filter(isDataImageUrl)
  if (!stem && stemImg.length === 0) return void ElMessage.warning('请填写题干或上传题干图')
  if (qForm.value.options.some((o) => !o.text.trim() && !o.img)) return void ElMessage.warning('请填写所有选项（文字或图片至少一项）')
  const options: PracticeOption[] = qForm.value.options.map((o) => {
    const text = o.text.trim()
    if (o.img) return text ? { text, img: o.img } : { img: o.img }
    return text
  })
  const payload: practiceApi.QuestionPayload = {
    bankId: curBank.value,
    type: 'single',
    stem,
    stemImg,
    options,
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
    await ElMessageBox.confirm('停用后该题不再被抽到，题目与作答记录保留，可随时恢复。确定停用该题目？', '停用题目', {
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
    await practiceApi.deleteQuestion(id)
    emit('refresh-banks')
    loadQuestions()
    ElMessage.success('题目已停用')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '停用题目失败')
  }
}

async function restoreQ(id: number): Promise<void> {
  try {
    await ElMessageBox.confirm('恢复后该题将重新进入抽取范围，作答记录仍保留。确定恢复该题目？', '恢复题目', {
      type: 'warning',
      confirmButtonText: '恢复',
      cancelButtonText: '取消',
    })
  } catch (e) {
    /* 用户取消确认，非业务错误 */
    if (e !== 'cancel' && e !== 'close') console.error('【恢复题目确认弹窗异常】', e)
    return
  }
  try {
    await practiceApi.restoreQuestion(id)
    emit('refresh-banks')
    loadQuestions()
    ElMessage.success('题目已恢复')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '恢复题目失败')
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
            <el-dropdown trigger="click" @command="(cmd: string | number | object) => onBankCmd(cmd, b)">
              <el-button class="ops-btn" text>
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="delete" type="danger" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
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
          <el-select v-model="statusFilter" style="width: 130px" @change="qPage = 1">
            <el-option value="normal" label="仅正常" />
            <el-option value="deleted" label="仅已停用" />
            <el-option value="all" label="全部状态" />
          </el-select>
        </div>

        <el-table v-loading="qLoading" :data="questions" size="default" stripe :row-class-name="({ row }: { row: PracticeQuestion }) => (row.is_deleted ? 'row-deleted' : '')" :height="questions.length ? 500 : undefined">
          <el-table-column type="index" label="#" width="80" align="center" :index="(i: number) => (qPage - 1) * qPageSize + i + 1" />
          <el-table-column prop="stem" label="题干" min-width="240">
            <template #default="{ row }">
              <div class="stem-cell-wrap">
                <el-image v-if="row.stem_img && row.stem_img.length" :src="row.stem_img[0]" :preview-src-list="row.stem_img" fit="contain" class="table-stem-img" />
                <span class="stem-cell">{{ row.stem.split('\n')[0] || (row.stem_img && row.stem_img.length ? '[图片题]' : '') }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="answer" label="答案" width="90" align="center" sortable>
            <template #default="{ row }"><el-tag size="small">{{ row.answer }}</el-tag></template>
          </el-table-column>
          <el-table-column prop="difficulty" label="难度" width="90" align="center" sortable>
            <template #default="{ row }">{{ diffText(row.difficulty) }}</template>
          </el-table-column>
          <el-table-column prop="is_deleted" label="状态" width="90" align="center" sortable>
            <template #default="{ row }">
              <el-tag v-if="row.is_deleted" type="info" size="small">已停用</el-tag>
              <el-tag v-else type="success" size="small">正常</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" align="center" fixed="right">
            <template #default="{ row }">
              <el-button size="small" text type="primary" @click="openQDialog(row.id)">编辑</el-button>
              <el-button v-if="row.is_deleted" size="small" text type="success" @click="restoreQ(row.id)">恢复</el-button>
              <el-button v-else size="small" text type="danger" @click="delQuestion(row.id)">停用</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="q-pager">
          <el-pagination
            v-model:current-page="qPage"
            v-model:page-size="qPageSize"
            :total="qTotal"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            size="small"
            @size-change="qPage = 1"
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
    <el-dialog v-model="qDialog" :title="qEditId ? '编辑题目' : '新增题目'" width="880px" align-center>
      <el-form label-width="60px">
        <el-form-item label="题干" required>
          <el-input v-model="qForm.stem" type="textarea" :rows="6" maxlength="20000" placeholder="题干文字（图推等图片题可留空，用题干图）" />
          <div class="stem-img-toolbar">
            <el-button size="small" @click="stemFileInput?.click()">+ 上传题干图（支持多张）</el-button>
            <span v-if="qForm.stemImg.length" class="img-count">已传 {{ qForm.stemImg.length }} 张 · 合计 {{ fmtKB(stemImgTotal) }}</span>
          </div>
          <div v-if="qForm.stemImg.length" class="stem-img-grid">
            <div v-for="(src, i) in qForm.stemImg" :key="i" class="stem-img-item">
              <el-image :src="src" :preview-src-list="qForm.stemImg" :initial-index="i" fit="contain" class="stem-img-thumb" />
              <div class="stem-img-meta">
                <span>{{ fmtKB(base64Bytes(src)) }}</span>
                <el-button size="small" text type="danger" @click="removeStemImg(i)">删除</el-button>
              </div>
            </div>
          </div>
          <input ref="stemFileInput" type="file" accept="image/*" multiple class="hidden-file" @change="onStemFiles" />
        </el-form-item>
        <el-form-item v-for="(opt, i) in qForm.options" :key="i" :label="String.fromCharCode(65 + i)">
          <div class="opt-edit-block">
            <div class="opt-edit-row">
              <el-input v-model="opt.text" maxlength="200" :placeholder="`选项 ${String.fromCharCode(65 + i)} 内容（图片题可留空）`" />
              <el-button size="small" @click="triggerOptFile(i)">{{ opt.img ? '更换图片' : '+ 传图' }}</el-button>
              <input :ref="(el: unknown) => setOptFileRef(i, el)" type="file" accept="image/*" class="hidden-file" @change="onOptFile(i, $event)" />
            </div>
            <div v-if="opt.img" class="opt-img-preview">
              <el-image :src="opt.img" :preview-src-list="[opt.img]" fit="contain" class="opt-preview-img" />
              <span class="img-count">{{ fmtKB(base64Bytes(opt.img)) }}</span>
              <el-button size="small" text type="danger" @click="opt.img = ''">删除图片</el-button>
            </div>
          </div>
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
          <el-input v-model="qForm.analysis" type="textarea" :rows="4" maxlength="20000" placeholder="可选" />
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
.br-ops .ops-btn {
  padding: 4px;
  color: var(--el-text-color-secondary);
}
.br-ops .ops-btn:hover {
  color: var(--el-color-primary);
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
.q-head-ops {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
/* 已停用（逻辑删除）题目：行灰化 */
:deep(.el-table .row-deleted) {
  opacity: 0.55;
  background: var(--el-fill-color-light);
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
.stem-cell-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-stem-img {
  width: 44px;
  height: 44px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  flex-shrink: 0;
}
/* 图片题目（方案C）：弹窗上传与预览 */
.hidden-file {
  display: none;
}
.stem-img-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.img-count {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.stem-img-grid {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}
.stem-img-item {
  width: 110px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 4px;
  background: var(--el-fill-color-light);
}
.stem-img-thumb {
  width: 100px;
  height: 100px;
}
.stem-img-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}
.opt-edit-block {
  width: 100%;
}
.opt-edit-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.opt-img-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
}
.opt-preview-img {
  width: 64px;
  height: 64px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
}
.q-pager {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>
