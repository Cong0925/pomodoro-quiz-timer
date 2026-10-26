/* ============================================================
 * PQ Timer - modules/practice.js
 * 练习模式：开始练习（大类→题库→方式→题量）、答题即判+解析、
 * 题库管理（题目增删改）、练习记录（列表+回看）、练习统计
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const api = PQ.api;

    const state = {
        ptab: 'start',            // start / manage / records
        cats: [],                 // 分类树（来自 PQ.data）
        banks: [],                // 题库列表
        selCat: null, selBank: null, mode: 'order', count: 5,
        run: null,                // 运行中会话 { sessionId, questions, idx, ok, ng, skip, answers, startTs, review }
        curBank: 1, editIdx: -1,  // 题库管理
        recPage: 1, recTotal: 0,  // 练习记录分页
        stats: null,              // 练习统计
        timer: null
    };

    /* ---------- 基础 ---------- */

    function el(id) { return document.getElementById(id); }

    function fmtMs(ms) {
        const s = Math.floor((ms || 0) / 1000);
        return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    }

    function todayStr() {
        const d = new Date();
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
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
            try { state.banks = await api.get('/api/practice/banks'); } catch (e) { U.showToast('题库加载失败：' + e.message); }
        }
        switchTab(state.ptab);
    }

    function switchTab(ptab) {
        state.ptab = ptab;
        document.querySelectorAll('.practice-tab').forEach(b => b.classList.toggle('active', b.dataset.ptab === ptab));
        el('pPaneStart').hidden = ptab !== 'start';
        el('pPaneManage').hidden = ptab !== 'manage';
        el('pPaneRec').hidden = ptab !== 'records';
        if (ptab !== 'start') {
            el('pPaneRun').hidden = true;
            el('pPaneResult').hidden = true;
        } else {
            const ph = state.run ? state.run.phase : null;
            el('pPaneStart').hidden = ph !== null;
            el('pPaneRun').hidden = ph !== 'run';
            el('pPaneResult').hidden = ph !== 'result';
        }
        if (ptab === 'start') { renderCats(); renderBanks(); renderModes(); renderCounts(); updateStartBtn(); }
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
            state.selCat = x.dataset.id; state.selBank = null;
            renderCats(); renderBanks(); renderCounts(); updateStartBtn();
        }));
    }

    function renderBanks() {
        const grid = el('pBankGrid');
        const label = el('pBankLabel');
        const banks = state.selCat ? state.banks.filter(b => b.catId === state.selCat) : [];
        const cat = state.cats.find(c => c.id === state.selCat);
        label.textContent = state.selCat
            ? (cat ? cat.name : '') + ' · 共 ' + banks.length + ' 个题库'
            : '请先选择大类';
        grid.innerHTML = banks.map(b => `
            <div class="p-bank-card ${state.selBank === b.id ? 'selected' : ''}" data-id="${b.id}">
                <div class="p-bc-name">${U.escapeHtml(b.name)}${b.subName ? '<span class="p-bc-sub">' + U.escapeHtml(b.subName) + '</span>' : ''}</div>
                <div class="p-bc-desc">${U.escapeHtml(b.description || '')}</div>
                <div class="p-bc-count">${b.count} 道题</div>
            </div>`).join('');
        grid.querySelectorAll('.p-bank-card').forEach(x => x.addEventListener('click', () => {
            state.selBank = Number(x.dataset.id); renderBanks(); renderCounts(); updateStartBtn();
        }));
    }

    function renderModes() {
        const row = el('pModeRow');
        const modes = [
            { k: 'order', n: '顺序练习', d: '按题库顺序逐题作答' },
            { k: 'random', n: '随机抽题', d: '打乱顺序随机抽取' },
            { k: 'review', n: '错题重练', d: '抽取练习历史中的错题' }
        ];
        row.innerHTML = modes.map(m => `
            <div class="p-mode-chip ${state.mode === m.k ? 'selected' : ''}" data-k="${m.k}">
                <b>${m.n}</b><span>${m.d}</span>
            </div>`).join('');
        row.querySelectorAll('.p-mode-chip').forEach(x => x.addEventListener('click', () => {
            state.mode = x.dataset.k;
            if (state.mode === 'review') state.count = Math.min(state.count, 5);
            renderModes(); renderCounts(); updateStartBtn();
        }));
    }

    function renderCounts() {
        const row = el('pCountRow');
        const bank = state.banks.find(b => b.id === state.selBank);
        const max = bank ? Math.max(bank.count, 1) : 10;
        const counts = [5, 10, 15, 20].filter(c => c <= max);
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
        if (!state.selCat) { btn.disabled = true; tip.textContent = '请先选择考试大类'; return; }
        if (!state.selBank) { btn.disabled = true; tip.textContent = '请选择题库'; return; }
        btn.disabled = false;
        tip.textContent = state.mode === 'review' ? '将从练习历史中抽取错题，不足部分补随机题' : `将抽取 ${state.count} 道题`;
    }

    async function startPractice() {
        try {
            const r = await api.post('/api/practice/start', {
                bankId: state.selBank, mode: state.mode, count: state.count
            });
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
                (r.mode === 'order' ? '顺序' : r.mode === 'random' ? '随机' : '错题重练');
            startClock();
            renderQ();
        } catch (e) {
            U.showToast(e.message);
        }
    }

    function startClock() {
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(() => {
            if (state.run && !state.run.finished) el('pRunTime').textContent = fmtMs(Date.now() - state.run.startTs);
        }, 500);
    }

    function renderQ() {
        const q = state.run.questions[state.run.idx];
        el('pQNo').textContent = `第 ${state.run.idx + 1} / ${state.run.questions.length} 题`;
        el('pQStem').textContent = q.stem;
        el('pRunBar').style.width = (state.run.idx / state.run.questions.length * 100) + '%';
        const list = el('pOptList');
        const opts = Array.isArray(q.options) && q.options.length ? q.options : [];
        list.innerHTML = opts.map((t, i) => {
            const label = String.fromCharCode(65 + i);
            return `<div class="p-opt-item" data-k="${label}"><span class="p-opt-label">${label}</span><span class="p-opt-text">${U.escapeHtml(String(t))}</span></div>`;
        }).join('');
        list.querySelectorAll('.p-opt-item').forEach(x => x.addEventListener('click', () => answer(x.dataset.k)));

        // 回看模式：直接展示结果
        if (state.run.review) {
            const prev = state.run.answers[state.run.idx];
            if (prev) renderResult(prev.my, prev.correctAnswer, prev.analysis, prev.result);
            el('pSkipBtn').hidden = true;
            el('pNextBtn').hidden = false;
            return;
        }
        el('pSkipBtn').hidden = false;
        el('pNextBtn').hidden = true;
        el('pAnalysis').hidden = true;
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
            U.showToast(e.message);
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
            U.showToast(e.message);
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
            <div class="p-analysis-body">${U.escapeHtml(analysis || '（暂无解析）')}</div>`;
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
            // 练习时长并入今日学习时长
            try { await api.post('/api/study-daily', { date: todayStr(), addMs: ms }); } catch (e) { /* 不阻塞结算 */ }
            el('pPaneRun').hidden = true;
            el('pPaneResult').hidden = false;
            el('pScore').textContent = r.rate + '%';
            el('pResOk').textContent = r.correct;
            el('pResNg').textContent = r.wrong;
            el('pResSkip').textContent = r.skipped;
            el('pResTime').textContent = fmtMs(r.totalMs);
        } catch (e) {
            U.showToast('结束练习失败：' + e.message);
        }
    }

    function backToResult() {
        state.run.review = false;
        state.run.phase = 'result';
        el('pPaneRun').hidden = true;
        el('pPaneResult').hidden = false;
    }

    function enterReview() {
        if (!state.run || !state.run.answers.length) { U.showToast('没有可回看的题目'); return; }
        state.run.review = true;
        state.run.idx = 0;
        el('pPaneResult').hidden = true;
        el('pPaneRun').hidden = false;
        renderQ();
    }

    /* ---------- 题库管理 ---------- */

    async function renderManage() {
        // 当前题库失效时默认选第一个
        if (!state.banks.find(b => b.id === state.curBank)) {
            state.curBank = state.banks.length ? state.banks[0].id : 0;
        }
        // 题库列表按大类分组
        const list = el('pBankList');
        list.innerHTML = state.cats.map(c => {
            const banks = state.banks.filter(b => b.catId === c.id);
            return '<div class="p-mg-cat-title">' + U.escapeHtml(c.name) + '</div>' +
                banks.map(b => `
                <div class="p-bank-row ${state.curBank === b.id ? 'active' : ''}" data-id="${b.id}">
                    <div class="p-br-name">${U.escapeHtml(b.name)}<span class="p-br-count">${b.count}题</span></div>
                    <div class="p-br-meta">${U.escapeHtml(b.description || '')}</div>
                </div>`).join('');
        }).join('');
        list.querySelectorAll('.p-bank-row').forEach(x => x.addEventListener('click', () => {
            state.curBank = Number(x.dataset.id); renderManage();
        }));

        const bank = state.banks.find(b => b.id === state.curBank);
        el('pManageTitle').textContent = bank ? bank.name : '';
        const qs = await loadQuestions(state.curBank);
        el('pQTbody').innerHTML = qs.map((q, i) => {
            const diff = q.difficulty === 1 ? '简单' : q.difficulty === 3 ? '困难' : '中等';
            return `<tr>
                <td>${i + 1}</td>
                <td class="p-q-stem-cell" title="${U.escapeHtml(q.stem)}">${U.escapeHtml(q.stem.split('\n')[0])}</td>
                <td><b>${U.escapeHtml(q.answer)}</b></td>
                <td><span class="p-diff p-diff-${q.difficulty}">${diff}</span></td>
                <td><span class="p-op-link" data-act="edit" data-i="${i}" data-qid="${q.id}">编辑</span><span class="p-op-link danger" data-act="del" data-i="${i}" data-qid="${q.id}">删除</span></td>
            </tr>`;
        }).join('');
        el('pQTbody').querySelectorAll('.p-op-link').forEach(x => x.addEventListener('click', () => {
            if (x.dataset.act === 'edit') openQModal(Number(x.dataset.qid));
            else delQ(Number(x.dataset.qid));
        }));
        el('pQEmpty').style.display = qs.length ? 'none' : 'block';
    }

    async function loadQuestions(bankId) {
        try {
            return await api.get(`/api/practice/banks/${bankId}/questions`);
        } catch (e) { U.showToast('题目加载失败：' + e.message); return []; }
    }

    async function delQ(qid) {
        if (!confirm('确认删除该题目？')) return;
        try {
            await api.del('/api/practice/questions/' + qid);
            state.banks = await api.get('/api/practice/banks');
            renderManage();
            U.showToast('题目已删除');
        } catch (e) { U.showToast(e.message); }
    }

    async function openQModal(qid) {
        state.editIdx = qid;
        el('pQModalTitle').textContent = qid ? '编辑题目' : '新增题目';
        let q = null;
        if (qid) {
            const qs = await loadQuestions(state.curBank);
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
        el('pFOpts').innerHTML = opts.map((t, j) => `
            <div class="p-form-row"><span class="p-form-opt-label">${String.fromCharCode(65 + j)}</span>
            <input type="text" data-oi="${j}" value="${U.escapeHtml(String(t))}" placeholder="选项 ${String.fromCharCode(65 + j)} 内容"></div>`).join('');
        el('pQModalMask').classList.add('show');
    }

    async function saveQ() {
        const stem = el('pFStem').value.trim();
        if (!stem) { U.showToast('请填写题干'); return; }
        const opts = [...el('pFOpts').querySelectorAll('input')].map(x => x.value.trim());
        if (opts.some(o => !o)) { U.showToast('请填写所有选项'); return; }
        const body = {
            bankId: state.curBank, type: 'single', stem,
            options: opts, answer: el('pFAnswer').value,
            analysis: el('pFAnalysis').value.trim(), difficulty: Number(el('pFDiff').value), source: ''
        };
        try {
            if (state.editIdx) await api.put('/api/practice/questions/' + state.editIdx, body);
            else await api.post('/api/practice/questions', body);
            el('pQModalMask').classList.remove('show');
            state.banks = await api.get('/api/practice/banks');
            renderManage();
            U.showToast('题目已保存');
        } catch (e) { U.showToast(e.message); }
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
        const host = el('pRecList');
        const html = `
            <div class="df-card p-card p-stats-bar">
                <div><b>${s.all.sessions}</b><span>累计练习</span></div>
                <div><b>${s.all.totalQ}</b><span>累计题量</span></div>
                <div><b>${s.all.rate}%</b><span>累计正确率</span></div>
                <div><b>${s.today.totalQ}</b><span>今日题量</span></div>
                <div><b>${Math.round(s.today.totalMs / 60000)}</b><span>今日分钟</span></div>
            </div>
            <div id="pRecListInner"></div>`;
        host.innerHTML = html;
    }

    async function renderRecords(reset) {
        if (reset) { state.recPage = 1; }
        const page = state.recPage;
        let data;
        try {
            data = await api.get('/api/practice/history?page=' + page + '&limit=20');
        } catch (e) { U.showToast('记录加载失败：' + e.message); return; }
        state.recTotal = data.total;
        const inner = el('pRecListInner');
        if (!inner) return;
        inner.innerHTML = data.list.map(r => `
            <div class="p-rec-card" data-id="${r.id}">
                <div class="p-rec-head">
                    <div class="p-rec-title">${U.escapeHtml(r.bank_name)}<span class="p-rec-sub">${r.mode === 'order' ? '顺序' : r.mode === 'random' ? '随机' : '错题重练'} · ${r.cat_name || ''}${r.sub_name ? ' / ' + r.sub_name : ''} · ${r.started_at || ''}</span></div>
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
            body.innerHTML = `
                <div class="p-rec-summary">共 ${s.total_count} 题 · 对 ${s.correct_count} · 错 ${s.wrong_count} · 跳 ${s.skipped_count} · 用时 ${fmtMs(s.total_ms)}</div>
                ${r.records.map(d => `
                    <div class="p-rec-row">
                        <span class="p-rd-no p-rd-${d.result}">${d.result === 'ok' ? '✓' : d.result === 'skip' ? '○' : '✗'}</span>
                        <span class="p-rd-stem" title="${U.escapeHtml(d.stem)}">${U.escapeHtml(d.stem)}</span>
                        <span class="p-rd-ans">我的 <b>${d.userAnswer || '—'}</b> · 答案 <b>${U.escapeHtml(d.correctAnswer) || '—'}</b></span>
                    </div>`).join('')}`;
        } catch (e) {
            body.innerHTML = '<div class="p-rec-loading">明细加载失败：' + U.escapeHtml(e.message) + '</div>';
        }
    }

    /* ---------- 事件绑定 ---------- */

    document.querySelectorAll('.practice-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.ptab)));
    el('pStartBtn').addEventListener('click', startPractice);
    el('pSkipBtn').addEventListener('click', skipQ);
    el('pNextBtn').addEventListener('click', nextQ);
    el('pReplayBtn').addEventListener('click', () => { el('pPaneResult').hidden = true; startPractice(); });
    el('pReviewBtn').addEventListener('click', enterReview);
    el('pBackBtn').addEventListener('click', () => {
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        state.run = null;
        el('pPaneResult').hidden = true;
        el('pPaneRun').hidden = true;
        el('pPaneStart').hidden = false;
    });
    el('pAddQBtn').addEventListener('click', () => openQModal(0));
    el('pQCancel').addEventListener('click', () => el('pQModalMask').classList.remove('show'));
    el('pQSave').addEventListener('click', saveQ);
    el('pQModalMask').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });

    /* 暴露给 app.js */
    PQ.practice = { enter, switchTab };
})();
