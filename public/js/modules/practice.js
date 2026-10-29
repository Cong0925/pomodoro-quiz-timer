/* ============================================================
 * PQ Timer - modules/practice.js
 * 练习模式：开始练习（大类→题库→方式→题量）、答题即判+解析、
 * 题库管理（题目增删改）、练习记录（列表+回看）、练习统计
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const api = PQ.api;

    /* ---------- 常量（魔法值集中管理，便于扩展） ---------- */
    const TABS = { START: 'start', MANAGE: 'manage', RECORDS: 'records' };
    const MODES = {
        order: { k: 'order', n: '顺序练习', d: '按题库顺序逐题作答' },
        random: { k: 'random', n: '随机抽题', d: '打乱顺序随机抽取' },
        review: { k: 'review', n: '错题重练', d: '抽取练习历史中的错题' }
    };
    const MODE_NAMES = { order: '顺序', random: '随机', review: '错题重练' }; // 记录/历史列表里的短名
    const COUNT_OPTIONS = [5, 10, 15, 20, 25, 30];  // 固定题量档位（仅显示所选题库能满足的）
    const MIN_COUNT = COUNT_OPTIONS[0];

    const state = {
        ptab: TABS.START,         // TABS.START / MANAGE / RECORDS
        cats: [],                 // 分类树（来自 PQ.data）
        banks: [],                // 题库列表
        selCat: null, selSub: null, selBank: null, mode: MODES.order.k, count: MIN_COUNT,
        run: null,                // 运行中会话 { sessionId, questions, idx, ok, ng, skip, answers, startTs, review }
        curBank: 1, editIdx: -1, mgCat: 'all', mgSub: 'all',  // 题库管理（两层下拉筛选：大类→二级分类）
        editStemImgs: [], editOptImgs: [], editOptCount: 4,   // 图片题目（方案C）：编辑弹窗题干图数组/选项图数组/选项数量
        mgQPage: 1, mgQPageSize: 10,   // 题库管理题目列表分页
        mgQStatus: 'normal',        // 题库管理题目状态筛选：normal/deleted/all
        mgStatusSort: 0,             // 状态列排序：0=不排 1=正常在前 -1=停用在前
        recPage: 1, recTotal: 0,  // 练习记录分页
        stats: null,              // 练习统计
        timer: null
    };

    /* ---------- 基础 ---------- */

    function el(id) { return document.getElementById(id); }

    /* HTML 题干（真题导入题 stem 为 HTML 含内嵌图）→ 纯文本，供表格/回看展示 */
    function stripHtml(html) {
        return String(html || '')
            .replace(/<img[^>]*>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /* 进入练习视图：优先使用已缓存的分类，避免重复请求 */
    async function enter() {
        if (!state.cats.length) {
            state.cats = (PQ.data.categories || []).slice();
            if (!state.cats.length) {
                try { await PQ.data.loadCategories(); state.cats = (PQ.data.categories || []).slice(); } catch (e) { /* 忽略 */ }
            }
        }
        if (!state.banks.length) {
            try { state.banks = await api.get('/api/practice/banks'); } catch (e) { U.showToast('题库加载失败：' + e.message, 'error'); }
        }
        // 默认选择：第一个大类 → 第一个二级分类 → 该分类下第一个题库
        if (!state.selCat && state.cats.length) {
            state.selCat = state.cats[0].id;
            const cat = state.cats[0];
            if (cat.subs && cat.subs.length) state.selSub = cat.subs[0].id;
            const banks = state.banks.filter(b => b.catId === state.selCat && (b.subId || '') === state.selSub);
            if (banks.length) state.selBank = banks[0].id;
        }
        switchTab(state.ptab);
    }

    function switchTab(ptab) {
        state.ptab = ptab;
        document.querySelectorAll('.practice-tab').forEach(b => b.classList.toggle('active', b.dataset.ptab === ptab));
        el('pPaneStart').hidden = ptab !== TABS.START;
        el('pPaneManage').hidden = ptab !== TABS.MANAGE;
        el('pPaneRec').hidden = ptab !== TABS.RECORDS;
        if (ptab !== TABS.START) {
            el('pPaneRun').hidden = true;
            el('pPaneResult').hidden = true;
        } else {
            const ph = state.run ? state.run.phase : null;
            el('pPaneStart').hidden = ph !== null;
            el('pPaneRun').hidden = ph !== 'run';
            el('pPaneResult').hidden = ph !== 'result';
        }
        if (ptab === 'start') { renderCats(); renderSubs(); renderBanks(); renderModes(); renderCounts(); updateStartBtn(); }
        if (ptab === 'manage') renderManage();
        if (ptab === 'records') { renderStatsBar(); renderRecords(true); }
    }

    /* ---------- 开始练习 ---------- */

    function renderCats() {
        const grid = el('pCatGrid');
        grid.innerHTML = state.cats.map(c => `
            <div class="p-cat-card ${state.selCat === c.id ? 'selected' : ''}" data-id="${c.id}">
                <div class="p-cc-name">${U.escapeHtml(c.name)}</div>
                <div class="p-cc-count">${c.subs.length} 个小类</div>
            </div>`).join('');
        grid.querySelectorAll('.p-cat-card').forEach(x => x.addEventListener('click', () => {
            state.selCat = x.dataset.id; state.selSub = null; state.selBank = null;
            renderCats(); renderSubs(); renderBanks(); renderCounts(); updateStartBtn();
        }));
    }

    function renderSubs() {
        const grid = el('pSubGrid');
        const label = el('pSubLabel');
        const cat = state.cats.find(c => c.id === state.selCat);
        if (!cat) { grid.innerHTML = ''; label.textContent = ''; return; }
        const subs = (cat.subs || []).map(s => ({ id: s.id, name: s.name }));
        if (state.banks.some(b => b.catId === state.selCat && !b.subId)) subs.push({ id: '', name: '未分类' });
        label.textContent = cat.name + ' · 共 ' + subs.length + ' 个二级分类';
        grid.innerHTML = subs.map(s => `
            <div class="p-cat-card ${state.selSub === s.id ? 'selected' : ''}" data-id="${s.id}">
                <div class="p-cc-name">${U.escapeHtml(s.name)}</div>
                <div class="p-cc-count">${state.banks.filter(b => b.catId === state.selCat && (b.subId || '') === s.id).length} 个题库</div>
            </div>`).join('');
        grid.querySelectorAll('.p-cat-card').forEach(x => x.addEventListener('click', () => {
            state.selSub = x.dataset.id; state.selBank = null;
            renderSubs(); renderBanks(); renderCounts(); updateStartBtn();
        }));
    }

    function renderBanks() {
        const grid = el('pBankGrid');
        const label = el('pBankLabel');
        const banks = (state.selCat && state.selSub !== null)
            ? state.banks.filter(b => b.catId === state.selCat && (b.subId || '') === state.selSub) : [];
        const cat = state.cats.find(c => c.id === state.selCat);
        let sub = null;
        if (cat) sub = state.selSub === '' ? { name: '未分类' } : (cat.subs || []).find(s => s.id === state.selSub);
        label.textContent = (state.selCat && state.selSub !== null)
            ? ((cat ? cat.name : '') + ' / ' + (sub ? sub.name : '') + ' · 共 ' + banks.length + ' 个题库')
            : (state.selCat ? '请先选择二级分类' : '请先选择大类');
        grid.innerHTML = banks.map(b => `
            <div class="p-bank-card ${state.selBank === b.id ? 'selected' : ''}" data-id="${b.id}">
                <div class="p-bc-name">${U.escapeHtml(b.name)}</div>
                <div class="p-bc-desc">${U.escapeHtml(b.description || '')}</div>
                <div class="p-bc-count">${b.count} 道题</div>
            </div>`).join('');
        grid.querySelectorAll('.p-bank-card').forEach(x => x.addEventListener('click', () => {
            state.selBank = Number(x.dataset.id); renderBanks(); renderCounts(); updateStartBtn();
        }));
    }

    function renderModes() {
        const row = el('pModeRow');
        const modes = Object.values(MODES);
        row.innerHTML = modes.map(m => `
            <div class="p-mode-chip ${state.mode === m.k ? 'selected' : ''}" data-k="${m.k}">
                <b>${m.n}</b><span>${m.d}</span>
            </div>`).join('');
        row.querySelectorAll('.p-mode-chip').forEach(x => x.addEventListener('click', () => {
            state.mode = x.dataset.k;
            if (state.mode === MODES.review.k) state.count = Math.min(state.count, MIN_COUNT);
            renderModes(); renderCounts(); updateStartBtn();
        }));
    }

    function renderCounts() {
        const row = el('pCountRow');
        const bank = state.banks.find(b => b.id === state.selBank);
        const max = bank ? Math.max(bank.count, 1) : 5;
        const counts = COUNT_OPTIONS.filter(c => c <= max);
        if (counts.length === 0) counts.push(Math.max(1, max));
        if (!counts.includes(state.count)) state.count = counts[0];
        row.innerHTML = counts.map(c => `<button class="p-count-btn ${state.count === c ? 'selected' : ''}" data-c="${c}">${c}</button>`).join('');
        row.querySelectorAll('.p-count-btn').forEach(x => x.addEventListener('click', () => {
            state.count = Number(x.dataset.c); renderCounts(); updateStartBtn();
        }));
    }

    function updateStartBtn() {
        const btn = el('pStartBtn');
        const tip = el('pStartTip');
        // 按钮始终可点：未完成选择时点击由 startPractice 弹 toast 提示
        btn.disabled = false;
        if (!state.selCat) { btn.classList.add('muted'); tip.textContent = '请先选择考试大类'; return; }
        if (!state.selSub) { btn.classList.add('muted'); tip.textContent = '请先选择二级分类'; return; }
        if (!state.selBank) { btn.classList.add('muted'); tip.textContent = '请选择题库'; return; }
        btn.classList.remove('muted');
        tip.textContent = state.mode === MODES.review.k ? '将从练习历史中抽取错题，不足部分补随机题' : `将抽取 ${state.count} 道题`;
    }

    async function startPractice() {
        // 未完成选择时给出明确提示，按钮不静默无反应
        if (!state.selCat) { U.showToast('请先选择考试大类', 'warning'); return; }
        if (!state.selSub) { U.showToast('请先选择二级分类', 'warning'); return; }
        if (!state.selBank) { U.showToast('请先选择题库', 'warning'); return; }
        try {
            const r = await api.post('/api/practice/start', {
                bankId: state.selBank, mode: state.mode, count: state.count
            });
            enterSession(r);
        } catch (e) {
            U.showToast(e.message, 'error');
        }
    }

    /* 注入会话进入答题（start / 记录页本场错题重练共用） */
    function enterSession(r) {
        state.run = {
            sessionId: r.sessionId, bank: r.bank, mode: r.mode,
            questions: r.questions, idx: 0, ok: 0, ng: 0, skip: 0,
            answers: [], startTs: Date.now(), review: false, finished: false, phase: 'run'
        };
        el('pPaneStart').hidden = true;
        el('pPaneResult').hidden = true;
        el('pPaneRun').hidden = false;
        el('pRunTitle').textContent = r.bank.name;
        el('pRunMeta').textContent = (r.bank.catName || '') + (r.bank.subName ? ' / ' + r.bank.subName : '') + ' · ' +
            (MODE_NAMES[r.mode] || r.mode);
        startClock();
        renderQ();
    }

    function startClock() {
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(() => {
            if (state.run && !state.run.finished) el('pRunTime').textContent = U.formatMs(Date.now() - state.run.startTs);
        }, 500);
    }

    function renderQ() {
        const q = state.run.questions[state.run.idx];
        el('pQNo').textContent = `第 ${state.run.idx + 1} / ${state.run.questions.length} 题`;
        /* 回看模式：题号导航条（对/错/跳着色，点击跳题，当前高亮） */
        renderReviewNav();
        /* 真题导入题 stem 为 HTML（含内嵌题目图/公式图）；手录题为纯文本，innerHTML 同样安全渲染 */
        el('pQStem').innerHTML = q.stem || '';
        el('pRunBar').style.width = (state.run.idx / state.run.questions.length * 100) + '%';
        /* 题干多图（图片题目方案C） */
        const si = el('pQStemImgs');
        if (Array.isArray(q.stemImg) && q.stemImg.length) {
            si.hidden = false;
            si.innerHTML = q.stemImg.map(s => `<img src="${s}" data-src="${s}" alt="题干图">`).join('');
            si.querySelectorAll('img').forEach(x => x.addEventListener('click', () => openLightbox(x.dataset.src)));
        } else si.hidden = true;
        const list = el('pOptList');
        const opts = Array.isArray(q.options) && q.options.length ? q.options : [];
        list.innerHTML = opts.map((t, i) => {
            const label = String.fromCharCode(65 + i);
            const isObj = t && typeof t === 'object';
            const text = isObj ? (t.text || '') : String(t || '');
            const img = isObj ? (t.img || '') : '';
            return `<div class="p-opt-item" data-k="${label}"><span class="p-opt-label">${label}</span>
                ${img ? `<img src="${img}" data-src="${img}" class="p-opt-img" alt="选项${label}">` : `<span class="p-opt-text">${U.escapeHtml(text)}</span>`}</div>`;
        }).join('');
        list.querySelectorAll('.p-opt-item').forEach(x => x.addEventListener('click', () => answer(x.dataset.k)));
        list.querySelectorAll('img.p-opt-img').forEach(x => x.addEventListener('click', (e) => { e.stopPropagation(); openLightbox(x.dataset.src); }));

        // 回看模式：直接展示结果
        if (state.run.review) {
            const prev = state.run.answers[state.run.idx];
            if (prev) renderResult(prev.my, prev.correctAnswer, prev.analysis, prev.result);
            el('pSkipBtn').hidden = true;
            el('pPrevBtn').hidden = false;
            el('pPrevBtn').disabled = state.run.idx === 0;
            el('pNextBtn').hidden = false;
            el('pNextBtn').textContent = state.run.idx + 1 >= state.run.questions.length ? '返回结算' : '下一题';
            return;
        }
        el('pSkipBtn').hidden = false;
        el('pPrevBtn').hidden = true;
        el('pNextBtn').hidden = true;
        el('pAnalysis').hidden = true;
    }

    /* 回看题号导航条：ok=绿 ng=红 skip=灰 todo=描边；非回看模式隐藏 */
    function renderReviewNav() {
        const nav = el('pReviewNav');
        const r = state.run;
        nav.hidden = !r.review;
        if (!r.review) return;
        nav.innerHTML = r.questions.map((_, i) => {
            const a = r.answers[i];
            const cls = !a ? 'todo' : a.result;
            return `<button type="button" class="p-rv-item ${cls}${i === r.idx ? ' cur' : ''}" data-i="${i}" title="第 ${i + 1} 题">${i + 1}</button>`;
        }).join('');
        nav.querySelectorAll('button').forEach(b => b.addEventListener('click', () => jumpTo(Number(b.dataset.i))));
    }

    function jumpTo(i) {
        if (!state.run || i < 0 || i >= state.run.questions.length) return;
        state.run.idx = i;
        renderQ();
    }

    async function answer(k) {
        const q = state.run.questions[state.run.idx];
        const no = state.run.idx + 1;
        const ms = 0; // 用时统计：会话整体计时，单题 ms 记 0（保持与整组模式一致）
        try {
            const r = await api.post(`/api/practice/${state.run.sessionId}/answer`, {
                no, questionId: q.id, answer: k, ms
            });
            state.run.answers.push({ my: k, correctAnswer: r.correctAnswer, analysis: r.analysis, result: r.result, q });
            if (r.result === 'ok') state.run.ok++; else state.run.ng++;
            updateCounts();
            renderResult(k, r.correctAnswer, r.analysis, r.result);
        } catch (e) {
            U.showToast(e.message, 'error');
            if (String(e.message).includes('已作答')) state.run.answers.push({ my: k, correctAnswer: '', analysis: '', result: 'ng', q });
        }
    }

    async function skipQ() {
        const q = state.run.questions[state.run.idx];
        const no = state.run.idx + 1;
        try {
            const r = await api.post(`/api/practice/${state.run.sessionId}/skip`, { no, questionId: q.id, ms: 0 });
            state.run.answers.push({ my: null, correctAnswer: r.correctAnswer, analysis: r.analysis, result: 'skip', q });
            state.run.skip++;
            updateCounts();
            renderResult(null, r.correctAnswer, r.analysis, 'skip');
        } catch (e) {
            U.showToast(e.message, 'error');
        }
    }

    function renderResult(my, correctAnswer, analysis, result) {
        const q = state.run.questions[state.run.idx];
        const list = el('pOptList');
        const items = [...list.querySelectorAll('.p-opt-item')];
        items.forEach(x => {
            x.disabled = true;
            const k = x.dataset.k;
            if (k === correctAnswer) x.classList.add('correct');
            else if (k === my) x.classList.add('wrong');
            else x.classList.add('dim');
        });
        const ab = el('pAnalysis');
        ab.hidden = false;
        const head = result === 'ok' ? '回答正确' : result === 'skip' ? '本题跳过' : '回答错误';
        ab.innerHTML = `<div class="p-analysis-title">解析 · ${head}</div>
            <div class="p-analysis-body">${analysis || '（暂无解析）'}</div>`;
        el('pSkipBtn').hidden = true;
        el('pNextBtn').hidden = false;
    }

    function updateCounts() {
        el('pRunOk').textContent = state.run.ok;
        el('pRunNg').textContent = state.run.ng;
        el('pRunSkip').textContent = state.run.skip;
    }

    async function nextQ() {
        state.run.idx++;
        if (state.run.idx >= state.run.questions.length) {
            if (state.run.review) { backToResult(); return; }
            await finish();
            return;
        }
        renderQ();
    }

    async function finish() {
        state.run.finished = true;
        state.run.phase = 'result';
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        const ms = Date.now() - state.run.startTs;
        try {
            const r = await api.post(`/api/practice/${state.run.sessionId}/finish`, { ms });
            /* 刷新历史总数（侧边栏徽标） */
            try { await PQ.data.loadHistoryPage({ page: 1, limit: (PQ.data.historyPage || {}).limit || 20 }); if (PQ.app) PQ.app.updateBadges(); } catch (e) { /* 不阻塞结算 */ }
            // 练习时长并入今日学习时长
            try { await api.post('/api/study-daily', { date: U.todayKey(new Date()), addMs: ms }); } catch (e) { /* 不阻塞结算 */ }
            el('pPaneRun').hidden = true;
            el('pPaneResult').hidden = false;
            el('pScore').textContent = r.rate + '%';
            el('pResOk').textContent = r.correct;
            el('pResNg').textContent = r.wrong;
            el('pResSkip').textContent = r.skipped;
            el('pResTime').textContent = U.formatMs(r.totalMs);
            /* 对错分布条：点击色块直接进入该题回看 */
            renderFinishDots();
        } catch (e) {
            U.showToast('结束练习失败：' + e.message, 'error');
        }
    }

    function backToResult() {
        state.run.review = false;
        state.run.phase = 'result';
        el('pPaneRun').hidden = true;
        el('pPaneResult').hidden = false;
    }

    /* 结算页对错分布条（复用题号着色，点击进入该题回看） */
    function renderFinishDots() {
        const box = el('pFinishDots');
        if (!state.run || !state.run.answers.length) { box.innerHTML = ''; return; }
        box.innerHTML = state.run.questions.map((_, i) => {
            const a = state.run.answers[i];
            const cls = !a ? 'todo' : a.result;
            return `<button type="button" class="p-fd-item ${cls}" data-i="${i}" title="第 ${i + 1} 题">${i + 1}</button>`;
        }).join('');
        box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => enterReview(Number(b.dataset.i))));
    }

    function enterReview(i) {
        if (!state.run || !state.run.answers.length) { U.showToast('没有可回看的题目', 'warning'); return; }
        state.run.review = true;
        state.run.idx = i ? Math.min(Math.max(0, i), state.run.questions.length - 1) : 0;
        el('pPaneResult').hidden = true;
        el('pPaneRun').hidden = false;
        renderQ();
    }

    /* ---------- 题库管理 ---------- */

    async function renderManage() {
        const list = el('pBankList');
        const editSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
        const delSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        // 两层下拉：大类 → 二级分类（select 元素常驻，用 onchange 避免监听器累积）
        const catSel = el('pMgCatSel');
        const subSel = el('pMgSubSel');
        catSel.innerHTML = '<option value="all">全部大类</option>' + state.cats.map(c =>
            `<option value="${c.id}" ${state.mgCat === c.id ? 'selected' : ''}>${U.escapeHtml(c.name)}（${state.banks.filter(b => b.catId === c.id).length}）</option>`).join('');
        const subList = [];
        state.cats.forEach(c => (c.subs || []).forEach(s => {
            if (state.banks.some(b => b.catId === c.id && (b.subId || '') === s.id)) subList.push({ id: s.id, name: s.name, catId: c.id });
        }));
        if (state.banks.some(b => b.catId === state.mgCat && !b.subId)) subList.push({ id: '', name: '未分类', catId: state.mgCat });
        if (state.mgSub !== 'all' && !subList.some(s => s.id === state.mgSub)) state.mgSub = 'all';
        subSel.innerHTML = '<option value="all">全部分类</option>' + subList.map(s =>
            `<option value="${s.id}" ${state.mgSub === s.id ? 'selected' : ''}>${U.escapeHtml(s.name)}</option>`).join('');
        catSel.onchange = () => { state.mgCat = catSel.value; state.mgSub = 'all'; renderManage(); };
        subSel.onchange = () => { state.mgSub = subSel.value; renderManage(); };
        // 题库列表按当前筛选
        let filtered = state.banks;
        if (state.mgCat !== 'all') filtered = filtered.filter(b => b.catId === state.mgCat);
        if (state.mgSub !== 'all') filtered = filtered.filter(b => (b.subId || '') === state.mgSub);
        if (!filtered.find(b => b.id === state.curBank)) {
            state.curBank = filtered.length ? filtered[0].id : 0;
        }
        // 题库行（单次遍历，避免分组重复渲染）
        const bankRow = b => `
            <div class="p-bank-row ${state.curBank === b.id ? 'active' : ''}" data-id="${b.id}">
                <span class="p-br-ind"></span>
                <div class="p-br-main">
                    <div class="p-br-name">${U.escapeHtml(b.name)}<span class="p-br-count">${b.count} 题</span></div>
                    <div class="p-br-meta">${U.escapeHtml(b.description || '暂无描述')}</div>
                </div>
                <div class="p-br-ops">
                    <button class="p-op-btn" data-op="edit" data-id="${b.id}" title="编辑题库">${editSvg}</button>
                    <button class="p-op-btn danger" data-op="del" data-id="${b.id}" title="删除题库">${delSvg}</button>
                </div>
            </div>`;
        let html = '';
        const catTitle = (name, n) => '<div class="p-mg-cat-title"><span>' + U.escapeHtml(name) + '</span><i>' + n + '</i></div>';
        if (state.mgSub === 'all' && state.mgCat === 'all') {
            state.cats.forEach(c => {
                const banks = filtered.filter(b => b.catId === c.id);
                if (banks.length) html += catTitle(c.name, banks.length) + banks.map(bankRow).join('');
            });
            const uncat = filtered.filter(b => !b.catId);
            if (uncat.length) html += catTitle('未分类', uncat.length) + uncat.map(bankRow).join('');
        } else if (state.mgSub === 'all') {
            const cat = state.cats.find(c => c.id === state.mgCat);
            (cat && cat.subs ? cat.subs : []).forEach(s => {
                const banks = filtered.filter(b => (b.subId || '') === s.id);
                if (banks.length) html += catTitle(s.name, banks.length) + banks.map(bankRow).join('');
            });
            const uncat = filtered.filter(b => !b.subId);
            if (uncat.length) html += catTitle('未分类', uncat.length) + uncat.map(bankRow).join('');
        } else if (filtered.length) {
            const cat = state.cats.find(c => (c.subs || []).some(s => s.id === state.mgSub));
            const sub = cat ? (cat.subs || []).find(s => s.id === state.mgSub) : null;
            const title = state.mgSub === '' ? '未分类' : (sub ? sub.name : '分类');
            html += catTitle(title, filtered.length) + filtered.map(bankRow).join('');
        }
        list.innerHTML = html;
        list.querySelectorAll('.p-bank-row').forEach(x => {
            x.addEventListener('click', e => {
                if (e.target.closest('.p-br-ops')) return;
                state.curBank = Number(x.dataset.id); state.mgQPage = 1; renderManage();
            });
        });
        list.querySelectorAll('.p-br-ops button').forEach(s => {
            s.addEventListener('click', e => {
                e.stopPropagation();
                const id = Number(s.dataset.id);
                if (s.dataset.op === 'edit') openBankModal(id);
                else delBank(id);
            });
        });

        // 右侧头部：标题 + 分类路径 + 题量统计
        const bank = state.banks.find(b => b.id === state.curBank);
        el('pManageTitle').textContent = bank ? bank.name : '未选题库';
        if (bank) {
            const cat = state.cats.find(c => c.id === bank.catId);
            const sub = cat && cat.subs ? cat.subs.find(s => s.id === bank.subId) : null;
            el('pManagePath').textContent = (cat ? cat.name : '') + (sub ? ' / ' + sub.name : '') || '未分类';
            el('pManageStat').textContent = bank.count + ' 道题 · ' + (bank.description || '暂无描述');
        } else {
            el('pManagePath').textContent = '';
            el('pManageStat').textContent = '';
        }
        /* 题目状态三态筛选（仅正常 / 仅已停用 / 全部状态） */
        const statusSel = el('pQStatusSel');
        if (statusSel) {
            statusSel.value = state.mgQStatus;
            statusSel.onchange = () => { state.mgQStatus = statusSel.value; state.mgQPage = 1; renderManage(); };
        }
        /* 后端分页加载当前页题目（按状态参数） */
        const data = await loadQuestionsPage(state.curBank, state.mgQPage, state.mgQPageSize, state.mgQStatus);
        const qs = data.list;
        const total = data.total;
        const diffMap = { 1: ['简单', 'p-diff-1'], 2: ['中等', 'p-diff-2'], 3: ['困难', 'p-diff-3'] };
        /* 删除当前页最后一条后页码越界回退 */
        if (qs.length === 0 && total > 0 && state.mgQPage > 1) {
            state.mgQPage--;
            const data2 = await loadQuestionsPage(state.curBank, state.mgQPage, state.mgQPageSize, state.mgQStatus);
            qs.length = 0; qs.push(...data2.list);
        }
        const totalPages = Math.max(1, Math.ceil(total / state.mgQPageSize));
        /* 状态列排序（本地，当前页；与 web-app el-table sortable 行为一致） */
        const sortTh = el('pQSortStatus');
        if (sortTh) {
            sortTh.onclick = () => { state.mgStatusSort = state.mgStatusSort === 1 ? -1 : 1; renderManage(); };
            const arrow = el('pQSortStatusArrow');
            if (arrow) arrow.textContent = state.mgStatusSort ? (state.mgStatusSort === 1 ? ' ▲' : ' ▼') : '';
        }
        if (state.mgStatusSort) qs.sort((a, b) => ((a.is_deleted || 0) - (b.is_deleted || 0)) * state.mgStatusSort);
        el('pQTbody').innerHTML = qs.map((q, i) => {
            const dm = diffMap[q.difficulty] || diffMap[2];
            const deleted = q.is_deleted === 1;
            return `<tr class="${deleted ? 'p-q-row-deleted' : ''}">
                <td class="p-q-no">${(state.mgQPage - 1) * state.mgQPageSize + i + 1}</td>
                <td class="p-q-stem-cell" title="${U.escapeHtml(stripHtml(q.stem))}">${U.escapeHtml(stripHtml(q.stem).slice(0, 60))}</td>
                <td><span class="p-ans-badge">${U.escapeHtml(q.answer)}</span></td>
                <td><span class="p-diff ${dm[1]}"><i></i>${dm[0]}</span></td>
                <td>${deleted ? '<span class="p-q-del-tag">已停用</span>' : '<span class="p-q-ok-tag">正常</span>'}</td>
                <td class="p-q-ops">
                    <button class="p-op-btn" data-act="edit" data-qid="${q.id}" title="编辑题目">${editSvg}</button>
                    ${deleted
                        ? `<button class="p-op-btn ok" data-act="restore" data-qid="${q.id}" title="恢复题目">↺</button>`
                        : `<button class="p-op-btn danger" data-act="del" data-qid="${q.id}" title="停用题目">${delSvg}</button>`}
                </td>
            </tr>`;
        }).join('');
        el('pQTbody').querySelectorAll('.p-op-btn').forEach(x => x.addEventListener('click', () => {
            if (x.dataset.act === 'edit') openQModal(Number(x.dataset.qid));
            else if (x.dataset.act === 'restore') restoreQ(Number(x.dataset.qid));
            else delQ(Number(x.dataset.qid));
        }));
        const eb = el('pQEmptyAddBtn');
        if (eb) eb.onclick = () => openQModal(0);
        el('pQEmpty').style.display = total ? 'none' : 'block';
        renderQPager(total, totalPages);
    }

    /* 后端分页请求题目：返回 { total, list }；status=normal|deleted|all */
    async function loadQuestionsPage(bankId, page, pageSize, status) {
        try {
            return await api.get(`/api/practice/banks/${bankId}/questions?page=${page}&pageSize=${pageSize}&status=${status || 'normal'}`);
        } catch (e) { U.showToast('题目加载失败：' + e.message, 'error'); return { total: 0, list: [] }; }
    }

    /* 题库管理题目列表分页条：组件库分页（PQ.ui.pagination） */
    function renderQPager(total, totalPages) {
        const host = el('pQPager');
        if (!host) return;
        PQ.ui.pagination({
            host: host, total: total, page: state.mgQPage, pageSize: state.mgQPageSize,
            sizes: [10, 20, 50, 100],
            onChange: p => { state.mgQPage = p; renderManage(); },
            onSizeChange: s => { state.mgQPageSize = s; state.mgQPage = 1; renderManage(); }
        });
    }

    async function loadQuestions(bankId, includeDeleted) {
        try {
            const delParam = includeDeleted ? '?includeDeleted=1' : '';
            return await api.get(`/api/practice/banks/${bankId}/questions${delParam}`);
        } catch (e) { U.showToast('题目加载失败：' + e.message, 'error'); return []; }
    }

    async function delQ(qid) {
        const ok = await PQ.ui.confirm({ title: '停用题目', message: '停用后该题不再被抽到，题目与作答记录保留，可随时恢复。确定停用该题目？', confirmText: '停用', danger: true });
        if (!ok) return;
        try {
            await api.del('/api/practice/questions/' + qid);
            state.banks = await api.get('/api/practice/banks');
            renderManage();
            U.showToast('题目已停用', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    async function restoreQ(qid) {
        const ok = await PQ.ui.confirm({ title: '恢复题目', message: '恢复后该题将重新进入抽取范围，作答记录仍保留。确定恢复该题目？', confirmText: '恢复' });
        if (!ok) return;
        try {
            await api.post('/api/practice/questions/' + qid + '/restore');
            state.banks = await api.get('/api/practice/banks');
            renderManage();
            U.showToast('题目已恢复', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    async function openQModal(qid) {
        state.editIdx = qid;
        el('pQModalTitle').textContent = qid ? '编辑题目' : '新增题目';
        let q = null;
        if (qid) {
            /* includeDeleted=1：编辑已停用题目也能回填数据 */
            const qs = await loadQuestions(state.curBank, true);
            q = qs.find(x => x.id === qid) || null;
        }
        const stem = q ? q.stem : '';
        const opts = q && Array.isArray(q.options) ? q.options : ['', '', '', ''];
        const answer = q ? q.answer : 'A';
        const diff = q ? String(q.difficulty) : '2';
        const analysis = q ? (q.analysis || '') : '';
        el('pFStem').value = stem;
        el('pFAnalysis').value = analysis;
        el('pFDiff').value = diff;
        const sel = el('pFAnswer');
        sel.innerHTML = opts.map((_, j) => `<option value="${String.fromCharCode(65 + j)}">${String.fromCharCode(65 + j)}</option>`).join('');
        sel.value = answer;
        state.editStemImgs = (q && Array.isArray(q.stem_img)) ? q.stem_img.map(String) : [];
        state.editOptImgs = opts.map(o => (o && typeof o === 'object' ? (o.img || '') : ''));
        state.editOptCount = opts.length;
        renderOptRows(opts);
        renderStemImgGrid();
        el('pQModalMask').classList.add('show');
    }

    /* 渲染选项行（文字 input + 传图按钮 + 图片缩略图；保留已有文字值） */
    function renderOptRows(opts) {
        const prevVals = [...el('pFOpts').querySelectorAll('input[data-oi]')].map(x => x.value);
        el('pFOpts').innerHTML = opts.map((t, j) => {
            const isObj = t && typeof t === 'object';
            const text = prevVals[j] !== undefined ? prevVals[j] : (isObj ? (t.text || '') : String(t || ''));
            const img = state.editOptImgs[j] || '';
            return `<div class="p-form-row">
                <span class="p-form-opt-label">${String.fromCharCode(65 + j)}</span>
                <input type="text" class="pq-input pq-input--small" data-oi="${j}" value="${U.escapeHtml(text)}" placeholder="选项 ${String.fromCharCode(65 + j)} 内容（图片题可留空）">
                <button type="button" class="pq-btn pq-btn--tiny" data-addimg="${j}">${img ? '换图' : '+ 图'}</button>
                ${img ? `<img src="${img}" data-src="${img}" class="p-opt-img-thumb" alt="选项${String.fromCharCode(65 + j)}图">` : ''}
                ${img ? `<button type="button" class="pq-btn pq-btn--tiny pq-btn--danger" data-delimg="${j}">删</button>` : ''}
                <input type="file" data-file="${j}" accept="image/*" hidden>
            </div>`;
        }).join('');
        el('pFOpts').querySelectorAll('img.p-opt-img-thumb').forEach(x =>
            x.addEventListener('click', e => { e.stopPropagation(); openLightbox(x.dataset.src); }));
    }

    /* 渲染题干图缩略图网格 */
    function renderStemImgGrid() {
        const host = el('pFStemImgs');
        host.innerHTML = state.editStemImgs.map((s, i) => `
            <div class="p-q-img-item">
                <img src="${s}" data-src="${s}" alt="题干图${i + 1}">
                <button type="button" class="pq-btn pq-btn--tiny pq-btn--danger" data-delstem="${i}">×</button>
            </div>`).join('');
        host.querySelectorAll('img').forEach(x => x.addEventListener('click', () => openLightbox(x.dataset.src)));
        el('pFStemImgCount').textContent = state.editStemImgs.length ? `已传 ${state.editStemImgs.length} 张` : '';
    }

    /* 图片压缩：canvas 缩放（长边 1000）+ JPEG 质量迭代，目标 ≤ maxKB；PNG 透明转白底 */
    function compressImageFile(file, maxKB) {
        maxKB = maxKB || 300;
        return new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const MAX_EDGE = 1000;
                    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
                    const w = Math.max(1, Math.round(img.width * scale));
                    const h = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = w; canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('当前浏览器不支持图片压缩'));
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, w, h);
                    ctx.drawImage(img, 0, 0, w, h);
                    let q = 0.85, dataUrl = '', size = Infinity;
                    while (size > maxKB * 1024 && q >= 0.25) {
                        dataUrl = canvas.toDataURL('image/jpeg', q);
                        size = Math.round(dataUrl.length * 0.75);
                        q -= 0.1;
                    }
                    resolve({ dataUrl, size, orig: file.size });
                };
                img.onerror = () => reject(new Error('图片解析失败，请更换图片'));
                img.src = r.result;
            };
            r.onerror = () => reject(new Error('读取图片失败'));
            r.readAsDataURL(file);
        });
    }

    /* 图片放大（lightbox） */
    let lightboxEl = null;
    function openLightbox(src) {
        if (!lightboxEl) {
            lightboxEl = document.createElement('div');
            lightboxEl.className = 'p-lightbox';
            lightboxEl.innerHTML = '<img alt="">';
            lightboxEl.addEventListener('click', () => lightboxEl.classList.remove('show'));
            document.body.appendChild(lightboxEl);
        }
        lightboxEl.querySelector('img').src = src;
        lightboxEl.classList.add('show');
    }

    async function saveQ() {
        const stem = el('pFStem').value.trim();
        const stemImg = state.editStemImgs.filter(s => s && /^data:image\//.test(s));
        if (!stem && !stemImg.length) { U.showToast('请填写题干或上传题干图', 'warning'); return; }
        const opts = [...el('pFOpts').querySelectorAll('input[data-oi]')].map(x => x.value.trim());
        const optImgs = state.editOptImgs;
        if (opts.some((o, i) => !o && !optImgs[i])) { U.showToast('请填写所有选项（文字或图片至少一项）', 'warning'); return; }
        const options = opts.map((text, i) => optImgs[i] ? (text ? { text, img: optImgs[i] } : { img: optImgs[i] }) : text);
        const body = {
            bankId: state.curBank, type: 'single', stem, stemImg,
            options, answer: el('pFAnswer').value,
            analysis: el('pFAnalysis').value.trim(), difficulty: Number(el('pFDiff').value), source: ''
        };
        try {
            if (state.editIdx) await api.put('/api/practice/questions/' + state.editIdx, body);
            else await api.post('/api/practice/questions', body);
            el('pQModalMask').classList.remove('show');
            state.banks = await api.get('/api/practice/banks');
            renderManage();
            U.showToast('题目已保存', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    /* ---------- 题库管理：新增/编辑/删除 ---------- */

    async function openBankModal(id) {
        state.editBank = id || 0;
        el('pBankModalTitle').textContent = id ? '编辑题库' : '新增题库';
        const bank = id ? state.banks.find(b => b.id === id) : null;
        el('pFBankName').value = bank ? bank.name : '';
        el('pFBankDesc').value = bank ? (bank.description || '') : '';
        // 新增时默认分类：优先跟随管理页两层下拉当前选择
        let defCat = state.selCat || '';
        if (!bank && state.mgCat !== 'all') defCat = state.mgCat;
        renderBankCatSub(bank ? bank.catId : defCat);
        if (bank) {
            const catSel = el('pFBankCat');
            catSel.value = bank.catId || '';
            renderBankSubs(bank.catId, bank.subId || '');
        } else if (state.mgSub !== 'all' && state.mgSub !== '') {
            renderBankSubs(defCat, state.mgSub);
        }
        el('pBankModalMask').classList.add('show');
    }

    function renderBankCatSub(cur) {
        const catSel = el('pFBankCat');
        const def = cur || (state.cats.length ? state.cats[0].id : '');
        catSel.innerHTML = '<option value="">（不指定）</option>' + state.cats.map(c =>
            `<option value="${c.id}" ${c.id === def ? 'selected' : ''}>${U.escapeHtml(c.name)}</option>`).join('');
        catSel.value = def || '';
        renderBankSubs(def || '', null);
    }

    function renderBankSubs(catId, cur) {
        const subSel = el('pFBankSub');
        const cat = state.cats.find(c => c.id === catId);
        subSel.innerHTML = '<option value="">（无）</option>' + (cat ? cat.subs.map(s =>
            `<option value="${s.id}" ${s.id === cur ? 'selected' : ''}>${U.escapeHtml(s.name)}</option>`).join('') : '');
        subSel.value = cur || '';
    }

    async function saveBank() {
        const name = el('pFBankName').value.trim();
        if (!name) { U.showToast('请填写题库名称', 'warning'); return; }
        const catId = el('pFBankCat').value;
        if (!catId) { U.showToast('请选择所属大类', 'warning'); return; }
        const body = {
            name,
            catId,
            subId: el('pFBankSub').value,
            description: el('pFBankDesc').value.trim()
        };
        try {
            if (state.editBank) await api.put('/api/practice/banks/' + state.editBank, body);
            else await api.post('/api/practice/banks', body);
            el('pBankModalMask').classList.remove('show');
            state.banks = await api.get('/api/practice/banks');
            if (!state.selBank && state.banks.length) state.selBank = state.banks[0].id;
            renderManage();
            U.showToast(state.editBank ? '题库已更新' : '题库已创建', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    async function delBank(id) {
        const bank = state.banks.find(b => b.id === id);
        const tip = bank ? `删除题库「${bank.name}」将同时删除其下 ${bank.count} 道题目，练习记录保留（快照不受影响）。` : '删除后无法恢复，确定删除该题库？';
        const ok = await PQ.ui.confirm({ title: '删除题库', message: tip, confirmText: '删除', danger: true });
        if (!ok) return;
        try {
            await api.del('/api/practice/banks/' + id);
            state.banks = await api.get('/api/practice/banks');
            if (state.selBank === id) state.selBank = state.banks.length ? state.banks[0].id : null;
            if (!state.banks.find(b => b.id === state.curBank)) state.curBank = state.banks.length ? state.banks[0].id : 0;
            renderManage();
            U.showToast('题库已删除', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    /* ---------- 练习记录 ---------- */

    async function renderStatsBar() {
        if (state.stats) { renderStatsUi(state.stats); return; }
        try {
            state.stats = await api.get('/api/practice/stats');
            renderStatsUi(state.stats);
        } catch (e) { /* 忽略 */ }
    }

    function renderStatsUi(s) {
        const host = el('pRecStats');
        if (!host) return;
        host.innerHTML = `
            <div class="df-card p-card p-stats-bar">
                <div><b>${s.all.sessions}</b><span>累计练习</span></div>
                <div><b>${s.all.totalQ}</b><span>累计题量</span></div>
                <div><b>${s.all.rate}%</b><span>累计正确率</span></div>
                <div><b>${s.today.totalQ}</b><span>今日题量</span></div>
                <div><b>${Math.round(s.today.totalMs / 60000)}</b><span>今日分钟</span></div>
            </div>`;
    }

    async function renderRecords(reset) {
        if (reset) { state.recPage = 1; }
        const page = state.recPage;
        let data;
        try {
            data = await api.get('/api/practice/history?page=' + page + '&limit=20');
        } catch (e) { U.showToast('记录加载失败：' + e.message, 'error'); return; }
        state.recTotal = data.total;
        const inner = el('pRecListInner');
        if (!inner) return;
        inner.innerHTML = data.list.map(r => `
            <div class="p-rec-card" data-id="${r.id}">
                <div class="p-rec-head">
                    <div class="p-rec-title">${U.escapeHtml(r.bank_name)}<span class="p-rec-sub">${MODE_NAMES[r.mode] || r.mode} · ${r.cat_name || ''}${r.sub_name ? ' / ' + r.sub_name : ''} · ${r.started_at || ''}</span></div>
                    <span class="p-rec-rate ${r.rate < 60 ? 'low' : ''}">${r.rate}%</span>
                    <svg class="p-rec-toggle" viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <div class="p-rec-body" hidden>
                    <div class="p-rec-loading">加载明细…</div>
                </div>
            </div>`).join('');
        inner.querySelectorAll('.p-rec-head').forEach(h => h.addEventListener('click', () => {
            const card = h.parentElement;
            const open = !card.classList.contains('open');
            card.classList.toggle('open', open);
            const body = card.querySelector('.p-rec-body');
            body.hidden = !open;
            if (open) loadRecDetail(card);
        }));
        if (data.total > page * 20) {
            const more = document.createElement('div');
            more.className = 'p-rec-more';
            more.innerHTML = '<button class="df-btn">加载更多</button>';
            more.querySelector('button').addEventListener('click', () => { state.recPage++; renderRecords(false); });
            inner.appendChild(more);
        }
    }

    async function loadRecDetail(card) {
        const body = card.querySelector('.p-rec-body');
        const id = Number(card.dataset.id);
        try {
            const r = await api.get('/api/practice/history/' + id);
            const s = r.session;
            card.dataset.records = '1';
            body.innerHTML = `
                <div class="p-rec-summary">共 ${s.total_count} 题 · 对 ${s.correct_count} · 错 ${s.wrong_count} · 跳 ${s.skipped_count} · 用时 ${U.formatMs(s.total_ms)}
                    <label class="p-rec-only-wrong"><input type="checkbox" class="p-rec-ow"> 只看错题</label>
                </div>
                <div class="p-rec-detail-list">
                ${r.records.map(d => {
                    const imgHtml = (Array.isArray(d.stemImg) && d.stemImg.length)
                        ? `<img src="${d.stemImg[0]}" data-src="${d.stemImg[0]}" class="p-rd-img" alt="题干图">` : '';
                    return `<div class="p-rec-row" data-result="${d.result}">
                        <span class="p-rd-no p-rd-${d.result}">${d.result === 'ok' ? '✓' : d.result === 'skip' ? '○' : '✗'}</span>
                        ${imgHtml}
                        <span class="p-rd-stem" title="${U.escapeHtml(stripHtml(d.stem))}">${U.escapeHtml(stripHtml(d.stem) || (d.stemImg && d.stemImg.length ? '[图片题]' : ''))}</span>
                        <span class="p-rd-ans">我的 <b>${d.userAnswer || '—'}</b> · 答案 <b>${U.escapeHtml(d.correctAnswer) || '—'}</b></span>
                        <button type="button" class="p-rec-detail-btn" data-no="${d.no}">解析</button>
                    </div>`;
                }).join('')}
                </div>
                <div class="p-rec-ops">
                    <button type="button" class="df-btn small" data-act="review">回顾本场</button>
                    <button type="button" class="df-btn small" data-act="replay" ${s.wrong_count === 0 ? 'disabled' : ''}>重练错题</button>
                </div>`;
            body.querySelectorAll('img.p-rd-img').forEach(x => x.addEventListener('click', () => openLightbox(x.dataset.src)));
            /* 只看错题：过滤非错题行 */
            const ow = body.querySelector('.p-rec-ow');
            if (ow) ow.addEventListener('change', () => {
                body.querySelectorAll('.p-rec-row').forEach(row => {
                    row.hidden = ow.checked && row.dataset.result !== 'ng';
                });
            });
            /* 单题解析 → 回顾弹层定位该题 */
            body.querySelectorAll('.p-rec-detail-btn').forEach(b => b.addEventListener('click', () => openRecReview(id, Number(b.dataset.no))));
            /* 回顾本场 / 重练错题 */
            body.querySelectorAll('.p-rec-ops button').forEach(b => b.addEventListener('click', (e) => {
                e.stopPropagation();
                if (b.dataset.act === 'review') openRecReview(id, 1);
                else if (b.dataset.act === 'replay') doReplay(id, s);
            }));
        } catch (e) {
            body.innerHTML = '<div class="p-rec-loading">明细加载失败：' + U.escapeHtml(e.message) + '</div>';
        }
    }

    /* ---------- 记录回顾弹层（整场/单题共用） ---------- */

    let rvState = { records: [], idx: 0 };

    async function openRecReview(sessionId, no) {
        const mask = el('pRecReviewMask');
        if (!rvState.records.length || rvState.sid !== sessionId) {
            try {
                const r = await api.get('/api/practice/history/' + sessionId);
                rvState = { sid: sessionId, records: r.records, idx: Math.min(Math.max(0, no - 1), r.records.length - 1) };
            } catch (e) {
                U.showToast('明细加载失败：' + e.message, 'error');
                return;
            }
        } else {
            rvState.idx = Math.min(Math.max(0, no - 1), rvState.records.length - 1);
        }
        mask.classList.add('show');
        renderRv();
    }

    function closeRecReview() {
        el('pRecReviewMask').classList.remove('show');
    }

    function renderRv() {
        const d = rvState.records[rvState.idx];
        if (!d) return;
        el('pRvTitle').textContent = `回顾解析 · 第 ${rvState.idx + 1} / ${rvState.records.length} 题`;
        el('pRvNav').innerHTML = rvState.records.map((r, i) =>
            `<button type="button" class="p-rv-item ${r.result}${i === rvState.idx ? ' cur' : ''}" data-i="${i}" title="第 ${r.no} 题">${r.no}</button>`).join('');
        el('pRvNav').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { rvState.idx = Number(b.dataset.i); renderRv(); }));
        const isObj = o => o && typeof o === 'object';
        const optsHtml = (Array.isArray(d.options) && d.options.length)
            ? `<div class="p-rv-opts">${d.options.map((o, i) => {
                const label = String.fromCharCode(65 + i);
                const text = isObj(o) ? (o.text || '') : String(o || '');
                const img = isObj(o) ? (o.img || '') : '';
                const cls = label === d.correctAnswer ? 'correct'
                    : (label === d.userAnswer && d.result !== 'ok') ? 'wrong' : 'dim';
                return `<div class="p-rv-opt ${cls}"><span class="p-rv-opt-label">${label}</span>${img ? `<img src="${img}" data-src="${img}" class="p-rv-opt-img" alt="选项${label}">` : `<span>${U.escapeHtml(text)}</span>`}</div>`;
            }).join('')}</div>` : '';
        const imgsHtml = (Array.isArray(d.stemImg) && d.stemImg.length)
            ? `<div class="p-rv-imgs">${d.stemImg.map(s => `<img src="${s}" data-src="${s}" class="p-rv-img" alt="题干图">`).join('')}</div>` : '';
        const head = d.result === 'ok' ? '回答正确' : d.result === 'skip' ? '本题跳过' : '回答错误';
        el('pRvBody').innerHTML = `
            <div class="p-rv-meta"><span class="p-rv-mark p-rd-${d.result}">${head}</span><span>用时 ${U.formatMs(d.ms)}</span></div>
            <div class="p-rv-stem">${d.stem || ''}</div>
            ${imgsHtml}
            ${optsHtml}
            <div class="p-rv-ans">我的答案 <b>${d.userAnswer || '—'}</b> · 正确答案 <b>${U.escapeHtml(d.correctAnswer) || '—'}</b></div>
            <div class="p-rv-at">解析</div>
            <div class="p-rv-analysis">${d.analysis || '（暂无解析）'}</div>`;
        el('pRvBody').querySelectorAll('img').forEach(x => x.addEventListener('click', () => openLightbox(x.dataset.src)));
        el('pRvPrev').disabled = rvState.idx === 0;
        el('pRvNext').disabled = rvState.idx >= rvState.records.length - 1;
    }

    /* 本场错题重练：取该会话错题开新会话（mode=review） */
    async function doReplay(sessionId, s) {
        try {
            const r = await api.post(`/api/practice/${sessionId}/replay-errors`, {});
            U.showToast(`已创建错题重练（${r.total} 题）`, 'success');
            switchTab('start');
            enterSession(r);
        } catch (e) {
            U.showToast(e.message, 'error');
        }
    }

    /* ---------- 事件绑定 ---------- */

    document.querySelectorAll('#viewPractice .practice-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.ptab)));
    el('pStartBtn').addEventListener('click', startPractice);
    el('pSkipBtn').addEventListener('click', skipQ);
    el('pNextBtn').addEventListener('click', nextQ);
    el('pReplayBtn').addEventListener('click', () => { el('pPaneResult').hidden = true; startPractice(); });
    el('pReviewBtn').addEventListener('click', () => enterReview(0));
    el('pPrevBtn').addEventListener('click', () => { if (state.run && state.run.review && state.run.idx > 0) jumpTo(state.run.idx - 1); });
    el('pRvPrev').addEventListener('click', () => { if (rvState.idx > 0) { rvState.idx--; renderRv(); } });
    el('pRvNext').addEventListener('click', () => { if (rvState.idx < rvState.records.length - 1) { rvState.idx++; renderRv(); } });
    el('pRvClose').addEventListener('click', closeRecReview);
    el('pRecReviewMask').addEventListener('click', e => { if (e.target === e.currentTarget) closeRecReview(); });

    /* 方向键翻题：回顾弹层优先；答题回看模式 ← → 翻题（避开输入框） */
    window.addEventListener('keydown', (e) => {
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        if (el('pRecReviewMask').classList.contains('show')) {
            if (e.key === 'ArrowLeft' && rvState.idx > 0) { rvState.idx--; renderRv(); e.preventDefault(); }
            else if (e.key === 'ArrowRight' && rvState.idx < rvState.records.length - 1) { rvState.idx++; renderRv(); e.preventDefault(); }
            return;
        }
        if (state.run && state.run.review && !el('pPaneRun').hidden) {
            if (e.key === 'ArrowLeft' && state.run.idx > 0) { jumpTo(state.run.idx - 1); e.preventDefault(); }
            else if (e.key === 'ArrowRight' && state.run.idx < state.run.questions.length - 1) { jumpTo(state.run.idx + 1); e.preventDefault(); }
        }
    });
    el('pBackBtn').addEventListener('click', () => {
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        state.run = null;
        el('pPaneResult').hidden = true;
        el('pPaneRun').hidden = true;
        el('pPaneStart').hidden = false;
    });
    el('pAddBankBtn').addEventListener('click', () => openBankModal(0));
    el('pBankCancel').addEventListener('click', () => el('pBankModalMask').classList.remove('show'));
    el('pBankSave').addEventListener('click', saveBank);
    el('pBankModalMask').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });
    el('pFBankCat').addEventListener('change', e => { renderBankSubs(e.target.value, null); });
    el('pAddQBtn').addEventListener('click', () => openQModal(0));
    el('pQCancel').addEventListener('click', () => el('pQModalMask').classList.remove('show'));
    el('pQSave').addEventListener('click', saveQ);
    el('pQModalMask').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });

    /* 图片题目（方案C）：题干图上传 + 选项传图 */
    el('pFStemAddBtn').addEventListener('click', () => el('pFStemFile').click());
    el('pFStemFile').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        let ok = 0;
        for (const f of files) {
            try { state.editStemImgs.push((await compressImageFile(f)).dataUrl); ok++; }
            catch (err) { console.error('【题干图压缩失败】', err); }
        }
        U.showToast(`已上传 ${ok}/${files.length} 张题干图`, 'success');
        renderStemImgGrid();
        e.target.value = '';
    });
    el('pFStemImgs').addEventListener('click', e => {
        const del = e.target.closest('[data-delstem]');
        if (del) { state.editStemImgs.splice(Number(del.dataset.delstem), 1); renderStemImgGrid(); }
    });
    el('pFOpts').addEventListener('click', e => {
        const add = e.target.closest('[data-addimg]');
        if (add) { el('pFOpts').querySelector(`input[data-file="${add.dataset.addimg}"]`).click(); return; }
        const del = e.target.closest('[data-delimg]');
        if (del) { state.editOptImgs[Number(del.dataset.delimg)] = ''; renderOptRows(Array.from({ length: state.editOptCount }, () => '')); }
    });
    el('pFOpts').addEventListener('change', async e => {
        const fi = e.target.closest('input[data-file]');
        if (!fi || !fi.files || !fi.files[0]) return;
        const j = Number(fi.dataset.file);
        try {
            const res = await compressImageFile(fi.files[0]);
            state.editOptImgs[j] = res.dataUrl;
            U.showToast(`选项 ${String.fromCharCode(65 + j)} 图：${(res.orig / 1024).toFixed(1)}KB → ${(res.size / 1024).toFixed(1)}KB`, 'success');
        } catch (err) { U.showToast('图片压缩失败：' + err.message, 'error'); }
        renderOptRows(Array.from({ length: state.editOptCount }, () => ''));
        fi.value = '';
    });

    /* 暴露给 app.js */
    PQ.practice = { enter, switchTab };
})();
