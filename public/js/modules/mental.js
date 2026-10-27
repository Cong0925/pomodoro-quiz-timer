/* ============================================================
 * PQ Timer - modules/mental.js
 * 速算练习：专项技巧训练（百化分 / 分数比大小 / 估算值）
 * 流程与题库练习一致：开始 → 答题即判 + 技巧提示 → 结算归档历史
 * 页签：开始练习 / 练习记录 / 技巧手册
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const api = PQ.api;

    /* ---------- 常量 ---------- */
    const TABS = { START: 'start', MANAGE: 'manage', RECORDS: 'records', MANUAL: 'manual' };
    const TYPES = {
        percent: {
            k: 'percent', n: '百化分', d: '百分数与分数互化，除转乘秒出',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>'
        },
        compare: {
            k: 'compare', n: '分数比大小', d: '交叉相乘，一秒判断谁大',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10h10M10 7l-3 3 3 3M17 14H7M14 11l3 3-3 3"/></svg>'
        },
        estimate: {
            k: 'estimate', n: '估算值', d: '取整估算，先数量级再微调',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>'
        },
        square: {
            k: 'square', n: '平方数', d: '1-20 平方秒回，反查也练',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="1.5"/><path d="M16 8l5-5M21 3h-5v5M8 16l-5 5M3 21h5v-5"/></svg>'
        },
        mixed: {
            k: 'mixed', n: '综合练习', d: '三类题型混合，全面检验',
            icon: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 5h16M4 12h16M4 19h10"/><circle cx="19" cy="19" r="2.2"/></svg>'
        }
    };
    const DIFFS = [
        { k: 0, n: '不限难度', d: '随机混合全部难度' },
        { k: 1, n: '简单', d: '基础互化 / 一步交叉' },
        { k: 2, n: '中等', d: '高频考法 / 两位分母' },
        { k: 3, n: '困难', d: '生僻分母 / 多步估算' }
    ];
    const COUNT_OPTIONS = [10, 15, 20, 0];   // 0 = 无限流（循环随机抽题，随时可结束）
    const INFINITE = 0;
    const BATCH_SIZE = 10;                    // 无限流单批题量
    const DIFF_NAMES = { 0: '不限难度', 1: '简单', 2: '中等', 3: '困难' };
    /* 固定做题类型：百化分、平方数为填空题（直接填数字）；其余题型为选择题 */
    function answerModeFor(t) { return (t === 'percent' || t === 'square') ? 'fill' : 'choice'; }

    /* 百化分速查表（1/2 ~ 1/20，用于技巧手册） */
    const PERCENT_TABLE = [
        [1, 2, '50%'], [1, 3, '33.3%'], [1, 4, '25%'], [1, 5, '20%'],
        [1, 6, '16.7%'], [1, 7, '14.3%'], [1, 8, '12.5%'], [1, 9, '11.1%'],
        [1, 10, '10%'], [1, 11, '9.1%'], [1, 12, '8.3%'], [1, 13, '7.7%'],
        [1, 14, '7.1%'], [1, 15, '6.7%'], [1, 16, '6.25%'], [1, 17, '5.9%'],
        [1, 18, '5.6%'], [1, 19, '5.3%'], [1, 20, '5%']
    ];

    /* 平方数速查表（1² ~ 20²，用于技巧手册） */
    const SQUARE_TABLE = [
        [1, 1], [2, 4], [3, 9], [4, 16], [5, 25], [6, 36], [7, 49], [8, 64],
        [9, 81], [10, 100], [11, 121], [12, 144], [13, 169], [14, 196],
        [15, 225], [16, 256], [17, 289], [18, 324], [19, 361], [20, 400]
    ];

    /* 幂次估算速查表（1.x 连乘近似值，资料分析增长类常用，用于技巧手册） */
    const POW_TABLE = [
        ['1.2³', '1.7'], ['1.2⁴', '2'], ['1.3³', '2.2'], ['1.3⁴', '2.9'],
        ['1.4³', '2.7'], ['1.4⁴', '3.8'], ['1.05⁴', '1.21'], ['1.1⁴', '1.46'],
        ['1.15⁴', '1.75'], ['1.1⁵', '1.61']
    ];

    const state = {
        mtab: TABS.START,
        type: 'percent',
        count: COUNT_OPTIONS[0],
        diff: 0,
        run: null,            // 运行中会话 { sessionId, qtype, qtypeName, answerMode, questions, idx, ok, ng, skip, answers, startTs, itemStartTs, phase, finished }
        recPage: 1, recTotal: 0,
        stats: null,
        timer: null,
        /* 题库管理状态 */
        mg: { all: [], typeSel: 'all', tagSel: 'all', diffSel: 'all', kw: '', inactive: false, editId: 0, page: 1, pageSize: 20 }
    };

    function el(id) { return document.getElementById(id); }

    /* ---------- 视图进入 / 页签 ---------- */

    async function enter() {
        switchTab(state.mtab);
        if (state.mtab === TABS.MANAGE) await renderManage();
        if (state.mtab === TABS.RECORDS) { renderStatsBar(); renderRecords(true); }
    }

    function switchTab(mtab) {
        state.mtab = mtab;
        document.querySelectorAll('#viewMental .practice-tab').forEach(b => b.classList.toggle('active', b.dataset.mtab === mtab));
        el('mPaneStart').hidden = mtab !== TABS.START;
        el('mPaneManage').hidden = mtab !== TABS.MANAGE;
        el('mPaneManual').hidden = mtab !== TABS.MANUAL;
        el('mPaneRec').hidden = mtab !== TABS.RECORDS;
        if (mtab !== TABS.START) {
            el('mPaneRun').hidden = true;
            el('mPaneResult').hidden = true;
        } else {
            const ph = state.run ? state.run.phase : null;
            el('mPaneStart').hidden = ph !== null;
            el('mPaneRun').hidden = ph !== 'run';
            el('mPaneResult').hidden = ph !== 'result';
        }
        if (mtab === TABS.START) { renderTypes(); renderCounts(); renderDiffs(); renderModeRow(); updateStartBtn(); }
        if (mtab === TABS.MANAGE) { renderManage(); }
        if (mtab === TABS.MANUAL) renderManual();
        if (mtab === TABS.RECORDS) { renderStatsBar(); renderRecords(true); }
    }

    /* ---------- 开始页 ---------- */

    function renderTypes() {
        const grid = el('mTypeGrid');
        grid.innerHTML = Object.values(TYPES).map(t => `
            <div class="m-type-card ${state.type === t.k ? 'active' : ''}" data-k="${t.k}">
                <div class="m-tc-icon">${t.icon}</div>
                <div class="m-tc-info">
                    <div class="m-tc-name">${t.n}</div>
                    <div class="m-tc-desc">${t.d}</div>
                </div>
            </div>`).join('');
        grid.querySelectorAll('.m-type-card').forEach(x => x.addEventListener('click', () => {
            state.type = x.dataset.k;
            renderTypes(); renderModeRow(); updateStartBtn();
        }));
    }

    /* 做题类型已固定：百化分、平方数为填空题；其余题型为选择题。不再提供切换 */
    function renderModeRow() {
        const title = el('mModeTitle');
        const row = el('mModeRow');
        if (title) title.hidden = true;
        if (row) row.hidden = true;
    }

    function renderCounts() {
        const row = el('mCountRow');
        if (!COUNT_OPTIONS.includes(state.count)) state.count = COUNT_OPTIONS[0];
        row.innerHTML = COUNT_OPTIONS.map(c => `<button class="p-count-btn ${state.count === c ? 'selected' : ''}" data-c="${c}">${c === INFINITE ? '∞' : c}</button>`).join('');
        row.querySelectorAll('.p-count-btn').forEach(x => x.addEventListener('click', () => {
            state.count = Number(x.dataset.c); renderCounts(); updateStartBtn();
        }));
    }

    function renderDiffs() {
        const row = el('mDiffRow');
        /* 当前仅开放「不限难度」，简单/中等/困难隐藏（保留定义便于后续恢复） */
        const diffs = DIFFS.filter(d => d.k === 0);
        if (!diffs.find(d => d.k === state.diff)) state.diff = 0;
        row.innerHTML = diffs.map(d => `
            <div class="p-mode-chip ${state.diff === d.k ? 'selected' : ''}" data-k="${d.k}">
                <b>${d.n}</b><span>${d.d}</span>
            </div>`).join('');
        row.querySelectorAll('.p-mode-chip').forEach(x => x.addEventListener('click', () => {
            state.diff = Number(x.dataset.k); renderDiffs();
        }));
    }

    function updateStartBtn() {
        const fillNote = (state.type === 'percent' || state.type === 'square') ? '（填空题：直接填数字）' : '';
        el('mStartTip').textContent = state.count === INFINITE
            ? `「${TYPES[state.type].n}」不限题量 · 循环随机抽题，答完自动续题，随时可结束${fillNote}`
            : `将抽取 ${state.count} 道「${TYPES[state.type].n}」题，答完即时判对错并给出技巧${fillNote}`;
    }

    async function startRun() {
        try {
            const r = await api.post('/api/mental/start', {
                qtype: state.type, difficulty: state.diff, count: state.count,
                answerMode: answerModeFor(state.type)
            });
            state.run = {
                sessionId: r.sessionId, qtype: r.qtype, qtypeName: r.qtypeName,
                answerMode: r.answerMode || 'choice',
                infinite: !!r.infinite, total: r.total,
                questions: r.questions, idx: 0, ok: 0, ng: 0, skip: 0,
                answers: [], startTs: Date.now(), phase: 'run', finished: false
            };
            el('mPaneStart').hidden = true;
            el('mPaneResult').hidden = true;
            el('mPaneRun').hidden = false;
            el('mRunTitle').textContent = r.qtypeName + (state.run.answerMode === 'fill' ? ' · 填空题' : '');
            el('mRunMeta').textContent = '速算练习 · ' + (DIFF_NAMES[state.diff] || '不限难度') +
                (state.run.infinite ? ' · 无限流（循环抽题）' : ' · 共 ' + r.total + ' 题');
            startClock();
            renderQ();
        } catch (e) {
            U.showToast(e.message, 'error');
        }
    }

    function startClock() {
        if (state.timer) clearInterval(state.timer);
        state.timer = setInterval(() => {
            if (state.run && !state.run.finished) el('mRunTime').textContent = U.formatMs(Date.now() - state.run.startTs);
        }, 500);
    }

    /* ---------- 答题 ---------- */

    function renderQ() {
        const q = state.run.questions[state.run.idx];
        const no = state.run.idx + 1;
        el('mQNo').textContent = state.run.infinite
            ? `第 ${no} 题 · 无限流 · ${TYPES[q.qtype] ? TYPES[q.qtype].n : ''}`
            : `第 ${no} / ${state.run.questions.length} 题 · ${TYPES[q.qtype] ? TYPES[q.qtype].n : ''}`;
        el('mRunBar').style.width = (state.run.infinite
            ? (state.run.idx % BATCH_SIZE) / BATCH_SIZE
            : state.run.idx / state.run.questions.length) * 100 + '%';

        /* 比大小：题干拆两个分数卡 A/B（视觉辅助），选项列表 2 项 */
        const compareRow = el('mCompareRow');
        if (q.qtype === 'compare') {
            const parts = String(q.stem).split(' 与 ');
            const fa = parts[0] || '';
            const fb = parts[1] || '';
            compareRow.hidden = false;
            compareRow.innerHTML = `
                <div class="m-frac-box">
                    <div class="m-compare-label">A · 分数</div>
                    <div class="m-frac-num">${U.escapeHtml(fa.split('/')[0] || fa)}</div>
                    <div class="m-frac-line"></div>
                    <div class="m-frac-den">${U.escapeHtml(fa.split('/')[1] || '')}</div>
                </div>
                <div class="m-frac-box">
                    <div class="m-compare-label">B · 分数</div>
                    <div class="m-frac-num">${U.escapeHtml(fb.split('/')[0] || fb)}</div>
                    <div class="m-frac-line"></div>
                    <div class="m-frac-den">${U.escapeHtml(fb.split('/')[1] || '')}</div>
                </div>`;
            el('mQStem').textContent = '哪个分数更大？';
            el('mQStem').classList.remove('m-stem');
        } else {
            compareRow.hidden = true;
            el('mQStem').textContent = q.stem;
            el('mQStem').classList.add('m-stem');
        }

        const list = el('mOptList');
        const opts = Array.isArray(q.options) && q.options.length ? q.options : [];
        const fillMode = state.run.answerMode === 'fill';
        list.innerHTML = opts.map((t, i) => {
            const label = String.fromCharCode(65 + i);
            return `<div class="p-opt-item" data-k="${i}"><span class="p-opt-label">${label}</span><span class="p-opt-text">${U.escapeHtml(String(t))}</span></div>`;
        }).join('');
        list.querySelectorAll('.p-opt-item').forEach(x => x.addEventListener('click', () => answer(Number(x.dataset.k))));
        list.hidden = fillMode;

        /* 填空题：百分数→填分母(1/?)；分数→填百分数数值(?%)，百分号固定；平方数/幂次→直接填数字 */
        const fillRow = el('mFillRow');
        if (fillMode) {
            const prefix = el('mFillPrefix'), suffix = el('mFillSuffix'), input = el('mFillInput');
            prefix.textContent = q.fillDir === 'den' ? '1/' : '';
            suffix.hidden = q.fillDir !== 'pct';
            input.placeholder = q.fillDir === 'den' ? '填分母（如 12.5% 填 8）'
                : q.fillDir === 'val' ? '填数字（如 13² 填 169）'
                : q.fillDir === 'dec' ? '填数值（如 1.2³ 填 1.7）'
                : '填百分数数值（如 1/9 填 11.1）';
            input.value = '';
            fillRow.hidden = false;
            input.focus();
        } else {
            fillRow.hidden = true;
        }

        state.run.itemStartTs = Date.now();
        el('mAnalysis').hidden = true;
        el('mSkipBtn').hidden = false;
        el('mNextBtn').hidden = true;
        el('mEndBtn').hidden = !state.run.infinite;
    }

    /* 填空题提交：校验数字（整数或 1 位小数），调用统一判题接口 */
    async function answerFill() {
        const input = el('mFillInput');
        const val = String(input.value || '').trim();
        if (!/^\d+(\.\d+)?$/.test(val)) {
            U.showToast('请输入数字（如 8 或 11.1）', 'error');
            input.focus();
            return;
        }
        await answer(val);
    }

    async function answer(k) {
        const q = state.run.questions[state.run.idx];
        const no = state.run.idx + 1;
        const ms = Date.now() - state.run.itemStartTs;
        try {
            const r = await api.post(`/api/mental/${state.run.sessionId}/answer`, {
                no, questionId: q.id, answer: String(k), ms
            });
            state.run.answers.push({ my: String(k), correctAnswer: r.correctAnswer, correctIndex: r.correctIndex, tip: r.tip, result: r.result, q });
            if (r.result === 'ok') state.run.ok++; else state.run.ng++;
            updateCounts();
            renderResult(k, r.correctAnswer, r.correctIndex, r.tip, r.result);
        } catch (e) {
            U.showToast(e.message, 'error');
            if (String(e.message).includes('已作答')) {
                state.run.answers.push({ my: String(k), correctAnswer: '', correctIndex: null, tip: '', result: 'ng', q });
                renderResult(k, '', null, '', 'ng');
            }
        }
    }

    async function skipQ() {
        const q = state.run.questions[state.run.idx];
        const no = state.run.idx + 1;
        const ms = Date.now() - state.run.itemStartTs;
        try {
            const r = await api.post(`/api/mental/${state.run.sessionId}/skip`, { no, questionId: q.id, ms });
            state.run.answers.push({ my: null, correctAnswer: r.correctAnswer, correctIndex: r.correctIndex, tip: r.tip, result: 'skip', q });
            state.run.skip++;
            updateCounts();
            renderResult(null, r.correctAnswer, r.correctIndex, r.tip, 'skip');
        } catch (e) {
            U.showToast(e.message, 'error');
        }
    }

    function renderResult(my, correctAnswer, correctIndex, tip, result) {
        const list = el('mOptList');
        const fillMode = state.run.answerMode === 'fill';
        if (!fillMode) {
            [...list.querySelectorAll('.p-opt-item')].forEach(x => {
                x.disabled = true;
                const k = Number(x.dataset.k);
                const correctIdx = Number(correctIndex);
                if (k === correctIdx && !Number.isNaN(correctIdx)) x.classList.add('correct');
                else if (k === my) x.classList.add('wrong');
                else x.classList.add('dim');
            });
        }
        el('mFillRow').hidden = true;
        const ab = el('mAnalysis');
        ab.hidden = false;
        const tipHtml = tip ? `<div class="p-analysis-body" style="margin-top:4px">技巧：${U.escapeHtml(tip)}</div>` : '';
        const greenAns = `<span class="m-ok-ans">正确答案：${U.escapeHtml(correctAnswer || '—')}</span>`;
        if (result === 'ok') {
            /* 答对：只显示绿色正确答案 */
            ab.innerHTML = `<div class="p-analysis-title">${greenAns}</div>${tipHtml}`;
        } else if (result === 'skip') {
            /* 跳过：无用户答案，直接绿色正确答案 */
            ab.innerHTML = `<div class="p-analysis-title"><span class="m-skip-tag">本题跳过</span> · ${greenAns}</div>${tipHtml}`;
        } else {
            /* 答错：上一行红色小号字用户答案，下一行绿色正确答案 */
            let myTxt = my == null ? '—' : String(my);
            if (!fillMode) {
                const q = state.run.questions[state.run.idx];
                const k = Number(my);
                if (q && q.options && q.options[k] !== undefined) myTxt = String(q.options[k]);
            }
            ab.innerHTML = `<div class="p-analysis-title m-my-ans-line">你的答案：${U.escapeHtml(myTxt)}</div>` +
                `<div class="p-analysis-title">${greenAns}</div>${tipHtml}`;
        }
        el('mSkipBtn').hidden = true;
        el('mNextBtn').hidden = false;
    }

    function updateCounts() {
        el('mRunOk').textContent = state.run.ok;
        el('mRunNg').textContent = state.run.ng;
        el('mRunSkip').textContent = state.run.skip;
    }

    async function nextQ() {
        state.run.idx++;
        if (state.run.idx >= state.run.questions.length) {
            if (state.run.infinite) {
                await loadMore();
                return;
            }
            await finish();
            return;
        }
        renderQ();
    }

    /* 无限流：答完一批自动续一批（排除已出题，题库轮完循环随机） */
    async function loadMore() {
        try {
            const r = await api.post(`/api/mental/${state.run.sessionId}/more`, {});
            if (r.questions && r.questions.length) {
                state.run.questions = state.run.questions.concat(r.questions);
                renderQ();
                return;
            }
        } catch (e) {
            U.showToast('加载下一批题目失败：' + e.message, 'error');
        }
        await finish();
    }

    /* 无限流：随时手动结束（已答题目计入结算） */
    async function endRun() {
        if (!state.run || !state.run.infinite) return;
        const ok = await PQ.ui.confirm({
            title: '结束练习',
            message: '结束本轮无限流练习？已答题目将计入本次结算。',
            confirmText: '结束'
        });
        if (!ok) return;
        await finish();
    }

    /* ---------- 结算（归档历史） ---------- */

    async function finish() {
        state.run.finished = true;
        state.run.phase = 'result';
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        const ms = Date.now() - state.run.startTs;
        try {
            const r = await api.post(`/api/mental/${state.run.sessionId}/finish`, { ms });
            /* 刷新历史总数（侧边栏徽标） */
            try { await PQ.data.loadHistoryPage({ page: 1, limit: (PQ.data.historyPage || {}).limit || 20 }); if (PQ.app) PQ.app.updateBadges(); } catch (e) { /* 不阻塞结算 */ }
            /* 与题库练习一致：时长并入今日学习时长 */
            try { await api.post('/api/study-daily', { date: U.todayKey(new Date()), addMs: ms }); } catch (e) { /* 不阻塞结算 */ }
            el('mPaneRun').hidden = true;
            el('mPaneResult').hidden = false;
            el('mScore').textContent = r.rate + '%';
            el('mResOk').textContent = r.correct;
            el('mResNg').textContent = r.wrong;
            el('mResSkip').textContent = r.skipped;
            el('mResTime').textContent = U.formatMs(r.totalMs);
            renderReview();
        } catch (e) {
            U.showToast('结束练习失败：' + e.message, 'error');
        }
    }

    /* 错题回顾：答错 + 跳过的题目，带技巧提示 */
    function renderReview() {
        const title = el('mReviewTitle');
        const list = el('mReviewList');
        const wrongs = state.run.answers.filter(a => a.result !== 'ok');
        if (!wrongs.length) {
            title.hidden = true;
            list.innerHTML = '';
            return;
        }
        title.hidden = false;
        title.textContent = `错题回顾（${wrongs.length} 题）· 复盘技巧，下次更快`;
        list.innerHTML = wrongs.map(a => `
            <div class="m-review-item">
                <div class="m-ri-q">${U.escapeHtml(a.q.stem)}</div>
                <div class="m-ri-ans">正确答案：${U.escapeHtml(a.correctAnswer || '—')}${a.result === 'skip' ? '（本题跳过）' : ''}</div>
                ${a.tip ? `<div class="m-ri-tip">技巧：${U.escapeHtml(a.tip)}</div>` : ''}
            </div>`).join('');
    }

    function backToStart() {
        if (state.timer) { clearInterval(state.timer); state.timer = null; }
        state.run = null;
        el('mPaneResult').hidden = true;
        el('mPaneRun').hidden = true;
        el('mPaneStart').hidden = false;
        renderTypes(); renderCounts(); renderDiffs(); renderModeRow(); updateStartBtn();
    }

    /* ---------- 练习记录 ---------- */

    async function renderStatsBar() {
        if (state.stats) { renderStatsUi(state.stats); return; }
        try {
            state.stats = await api.get('/api/mental/stats');
            renderStatsUi(state.stats);
        } catch (e) { /* 忽略 */ }
    }

    function renderStatsUi(s) {
        const host = el('mRecStats');
        if (!host) return;
        host.innerHTML = `
            <div class="m-rec-stat"><b>${s.all.sessions}</b><span>累计练习</span></div>
            <div class="m-rec-stat"><b>${s.all.totalQ}</b><span>累计题量</span></div>
            <div class="m-rec-stat"><b>${s.all.rate}%</b><span>累计正确率</span></div>
            <div class="m-rec-stat"><b>${s.today.totalQ}</b><span>今日题量</span></div>
            <div class="m-rec-stat"><b>${Math.round(s.today.totalMs / 60000)}</b><span>今日分钟</span></div>`;
    }

    async function renderRecords(reset) {
        if (reset) { state.recPage = 1; }
        const page = state.recPage;
        let data;
        try {
            data = await api.get('/api/mental/history?page=' + page + '&limit=20');
        } catch (e) { U.showToast('记录加载失败：' + e.message, 'error'); return; }
        state.recTotal = data.total;
        const inner = el('mRecListInner');
        if (!inner) return;
        inner.innerHTML = data.list.map(r => `
            <div class="m-session-item" data-id="${r.id}">
                <div class="m-si-main">
                    <div class="m-si-title">${U.escapeHtml(r.qtype_name)}${r.answer_mode === 'fill' ? ' · 填空题' : ''}<span class="p-rec-sub"> · ${DIFF_NAMES[r.difficulty] || '不限难度'} · ${r.started_at || ''}</span></div>
                    <div class="m-si-meta">${r.total_count === 0 ? '∞ 无限流' : '共 ' + r.total_count + ' 题'} · 对 ${r.correct_count} · 错 ${r.wrong_count} · 跳 ${r.skipped_count} · 用时 ${U.formatMs(r.total_ms)}</div>
                </div>
                <span class="m-si-rate ${r.rate < 60 ? 'low' : ''}">${r.rate}%</span>
                <svg class="p-rec-toggle" viewBox="0 0 24 24" width="18" height="18"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>`).join('');
        inner.querySelectorAll('.m-session-item').forEach(x => {
            /* 折叠/展开只响应头部点击；明细区点击不触发 */
            const head = x.querySelector('.m-si-main');
            if (head) head.addEventListener('click', () => toggleRecDetail(x));
        });
        if (data.total > page * 20) {
            const more = document.createElement('div');
            more.className = 'p-rec-more';
            more.innerHTML = '<button class="df-btn">加载更多</button>';
            more.querySelector('button').addEventListener('click', () => { state.recPage++; renderRecords(false); });
            inner.appendChild(more);
        }
    }

    /* 会话卡：点击展开明细，再次点击收起 */
    async function toggleRecDetail(card) {
        const old = card.querySelector('.m-rec-detail');
        if (old) {
            old.remove();
            card.classList.remove('open');
            return;
        }
        await loadRecDetail(card);
        card.classList.add('open');
    }

    async function loadRecDetail(card) {
        const id = Number(card.dataset.id);
        let r;
        try {
            r = await api.get('/api/mental/history/' + id);
        } catch (e) { U.showToast('明细加载失败：' + e.message, 'error'); return; }
        const s = r.session;
        const fillSess = s.answer_mode === 'fill';
        const body = document.createElement('div');
        body.className = 'm-rec-detail';
        body.innerHTML = `
            <div class="p-rec-summary">${s.total_count === 0 ? '∞ 无限流' : '共 ' + s.total_count + ' 题'} · ${fillSess ? '填空题' : '选择题'} · 对 ${s.correct_count} · 错 ${s.wrong_count} · 跳 ${s.skipped_count} · 正确率 ${s.rate}% · 用时 ${U.formatMs(s.total_ms)}</div>
            <div class="m-rec-grid">
            ${r.records.map(d => {
                const ca = fillSess
                    ? (d.answer != null ? String(d.answer) : '—')
                    : (d.answer != null && d.options[d.answer] != null ? d.options[d.answer] : '—');
                const tipHtml = d.tip ? `<div class="m-rc-tip">技巧：${U.escapeHtml(d.tip)}</div>` : '';
                return `
                <div class="m-rec-cell p-rd-${d.result}">
                    <div class="m-rc-top">
                        <span class="p-rd-no p-rd-${d.result}">${d.result === 'ok' ? '✓' : d.result === 'skip' ? '○' : '✗'}</span>
                        <span class="m-rc-stem" title="${U.escapeHtml(d.stem)}">${U.escapeHtml(d.stem)}</span>
                    </div>
                    <div class="m-rc-ans">正确答案 <b>${U.escapeHtml(ca)}</b></div>
                    ${tipHtml}
                </div>`;
            }).join('')}
            </div>`;
        const old = card.querySelector('.m-rec-detail');
        if (old) old.remove();
        card.appendChild(body);
    }

    /* ---------- 题库管理 ---------- */

    const MG_TYPES_ORDER = ['percent', 'compare', 'estimate', 'square'];
    const mgEditSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    const mgDelSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
    const mgRestoreSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';

    async function loadMgQuestions() {
        try {
            state.mg.all = await api.get('/api/mental/admin/questions?inactive=1');
        } catch (e) { U.showToast('题库加载失败：' + e.message, 'error'); state.mg.all = []; }
    }

    /* 左侧：按题型分组 → 按标签聚合（与右侧默认一致：不含停用，除非勾选含停用） */
    function mgGroupsHtml() {
        const mg = state.mg;
        const list = mg.inactive ? state.mg.all : state.mg.all.filter(q => q.active);
        let html = '';
        MG_TYPES_ORDER.forEach(t => {
            const qs = list.filter(q => q.qtype === t);
            if (!qs.length) return;
            const tn = TYPES[t] ? TYPES[t].n : t;
            html += `<div class="m-mg-type ${mg.typeSel === t ? 'active' : ''}" data-type="${t}">
                <div class="m-mg-type-head"><span class="m-mg-type-name">${tn}</span><i>${qs.length}</i></div>`;
            const tagMap = {};
            qs.forEach(q => { const k = q.tag || '无标签'; (tagMap[k] = tagMap[k] || []).push(q); });
            const tags = Object.keys(tagMap).sort((a, b) => tagMap[b].length - tagMap[a].length);
            html += tags.map(k => `
                <div class="m-mg-tag ${mg.typeSel === t && mg.tagSel === k ? 'active' : ''}" data-type="${t}" data-tag="${U.escapeHtml(k)}">
                    <span>${U.escapeHtml(k)}</span><i>${tagMap[k].length}</i>
                </div>`).join('');
            html += `</div>`;
        });
        return html;
    }

    async function renderManage() {
        await loadMgQuestions();
        const mg = state.mg;
        /* 左侧分组（事件用 onxxx 覆盖式绑定，避免重复累积） */
        el('mMgGroups').innerHTML = mgGroupsHtml();
        el('mMgGroups').querySelectorAll('.m-mg-type').forEach(x => { x.onclick = () => { mg.typeSel = x.dataset.type; mg.tagSel = 'all'; renderManage(); }; });
        el('mMgGroups').querySelectorAll('.m-mg-tag').forEach(x => { x.onclick = () => { mg.typeSel = x.dataset.type; mg.tagSel = x.dataset.tag; renderManage(); }; });
        /* 筛选控件 */
        const typeSel = el('mMgTypeSel');
        typeSel.innerHTML = '<option value="all">全部题型</option>' + MG_TYPES_ORDER.map(t =>
            `<option value="${t}" ${mg.typeSel === t ? 'selected' : ''}>${TYPES[t].n}</option>`).join('');
        typeSel.onchange = () => { mg.typeSel = typeSel.value; mg.tagSel = 'all'; renderManage(); };
        el('mMgDiffSel').value = mg.diffSel;
        el('mMgDiffSel').onchange = () => { mg.diffSel = el('mMgDiffSel').value; renderManage(); };
        el('mMgKw').value = mg.kw;
        el('mMgKw').oninput = () => { mg.kw = el('mMgKw').value; renderManageFilter(); };
        el('mMgInactive').checked = mg.inactive;
        el('mMgInactive').onchange = () => { mg.inactive = el('mMgInactive').checked; renderManage(); };
        renderManageFilter();
    }

    function renderManageFilter() {
        const mg = state.mg;
        let list = state.mg.all;
        if (mg.typeSel !== 'all') list = list.filter(q => q.qtype === mg.typeSel);
        if (mg.tagSel !== 'all') list = list.filter(q => (q.tag || '无标签') === mg.tagSel);
        if (mg.diffSel !== 'all') list = list.filter(q => String(q.difficulty) === mg.diffSel);
        if (!mg.inactive) list = list.filter(q => q.active);
        const kw = mg.kw.trim().toLowerCase();
        if (kw) list = list.filter(q => String(q.stem).toLowerCase().includes(kw) || String(q.tip).toLowerCase().includes(kw) || String(q.tag).toLowerCase().includes(kw));

        el('mMgTitle').textContent = mg.typeSel === 'all' ? '全部题目' : (TYPES[mg.typeSel] ? TYPES[mg.typeSel].n : mg.typeSel);
        el('mMgPath').textContent = mg.tagSel === 'all' ? '' : mg.tagSel;
        el('mMgStat').textContent = list.length + ' 道题 · 题库共 ' + state.mg.all.length + ' 道';

        /* 分页切片 */
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / mg.pageSize));
        if (mg.page > totalPages) mg.page = totalPages;
        if (mg.page < 1) mg.page = 1;
        const pageList = list.slice((mg.page - 1) * mg.pageSize, mg.page * mg.pageSize);

        const diffMap = { 1: ['简单', 'p-diff-1'], 2: ['中等', 'p-diff-2'], 3: ['困难', 'p-diff-3'] };
        const tbody = el('mMgTbody');
        tbody.innerHTML = pageList.map((q, i) => {
            const dm = diffMap[q.difficulty] || diffMap[2];
            const ansTxt = q.fillable ? String(q.options[0] != null ? q.options[0] : q.answer)
                : (q.options[Number(q.answer)] !== undefined ? String(q.options[Number(q.answer)]) : String(q.answer));
            return `<tr class="${q.active ? '' : 'm-q-inactive'}">
                <td class="p-q-no">${(mg.page - 1) * mg.pageSize + i + 1}</td>
                <td class="p-q-stem-cell" title="${U.escapeHtml(q.stem)}">${U.escapeHtml(q.stem.split('\n')[0])}</td>
                <td>${TYPES[q.qtype] ? TYPES[q.qtype].n : q.qtype}</td>
                <td><span class="p-diff ${dm[1]}"><i></i>${dm[0]}</span></td>
                <td class="m-mg-ans">${U.escapeHtml(ansTxt)}</td>
                <td>${q.fillable ? '填空' : '选择'}</td>
                <td class="p-q-ops">
                    <button class="p-op-btn" data-act="edit" data-qid="${q.id}" title="编辑题目">${mgEditSvg}</button>
                    ${q.active
                        ? `<button class="p-op-btn danger" data-act="del" data-qid="${q.id}" title="停用题目">${mgDelSvg}</button>`
                        : `<button class="p-op-btn" data-act="restore" data-qid="${q.id}" title="恢复启用">${mgRestoreSvg}</button>`}
                </td>
            </tr>`;
        }).join('');
        tbody.querySelectorAll('.p-op-btn').forEach(x => { x.onclick = () => {
            const id = Number(x.dataset.qid);
            if (x.dataset.act === 'edit') openMgQModal(id);
            else if (x.dataset.act === 'del') delMgQ(id);
            else toggleMgQ(id, true);
        }; });
        el('mMgEmpty').style.display = total ? 'none' : 'block';
        el('mMgEmptyText').textContent = state.mg.all.length === 0 ? '题库暂无题目' : '该筛选下暂无题目';
        renderMgPager(total, totalPages);
    }

    /* 分页条：页大小切换 + 上一页/下一页 */
    function renderMgPager(total, totalPages) {
        const host = el('mMgPager');
        if (!host) return;
        host.style.display = total ? '' : 'none';
        el('mMgPagerInfo').textContent = `共 ${total} 道 · 第 ${state.mg.page} / ${totalPages} 页`;
        const sizeSel = el('mMgPagerSize');
        sizeSel.value = String(state.mg.pageSize);
        sizeSel.onchange = () => {
            state.mg.pageSize = Number(sizeSel.value);
            state.mg.page = 1;
            renderManageFilter();
        };
        el('mMgPrev').onclick = () => { if (state.mg.page > 1) { state.mg.page--; renderManageFilter(); } };
        el('mMgNext').onclick = () => { if (state.mg.page < totalPages) { state.mg.page++; renderManageFilter(); } };
    }

    /* ---------- 管理弹窗：新增 / 编辑 ---------- */

    async function openMgQModal(qid) {
        const mg = state.mg;
        mg.editId = qid || 0;
        el('mQModalTitle').textContent = qid ? '编辑题目' : '新增题目';
        const q = qid ? (state.mg.all.find(x => x.id === qid) || null) : null;

        const typeSel = el('mFType');
        typeSel.innerHTML = MG_TYPES_ORDER.map(t =>
            `<option value="${t}" ${q && q.qtype === t ? 'selected' : ''}>${TYPES[t].n}</option>`).join('');
        el('mFDiff').value = q ? String(q.difficulty) : '2';
        el('mFTag').value = q ? (q.tag || '') : (mg.tagSel !== 'all' ? mg.tagSel : '');
        el('mFStem').value = q ? q.stem : '';
        el('mFTip').value = q ? (q.tip || '') : '';
        el('mFFillable').checked = q ? !!q.fillable : (typeSel.value === 'percent' || typeSel.value === 'square');

        if (q) {
            mg.editOpts = q.fillable
                ? [String(q.options[0] != null ? q.options[0] : q.answer)]
                : (Array.isArray(q.options) ? q.options.map(o => String(o)) : ['', '']);
            mg.editAnswer = q.fillable ? String(q.options[0] != null ? q.options[0] : q.answer) : String(q.answer);
        } else {
            mg.editOpts = typeSel.value === 'compare' ? ['', ''] : ['', '', '', ''];
            mg.editAnswer = '0';
        }

        typeSel.onchange = () => {
            mg.editOpts = typeSel.value === 'compare' ? ['', ''] : ['', '', '', ''];
            mg.editAnswer = '0';
            el('mFFillable').checked = typeSel.value === 'percent' || typeSel.value === 'square';
            renderMgOpts();
            mgFillCtl();
        };
        el('mFFillable').onchange = () => { if (el('mFFillable').checked) mg.editAnswer = ''; renderMgOpts(); mgFillCtl(); };
        el('mFOptAdd').onclick = () => {
            if (mg.editOpts.length >= 6) { U.showToast('最多 6 个选项', 'warning'); return; }
            mg.editOpts.push('');
            renderMgOpts();
        };
        el('mFAnswerSel').onchange = () => { mg.editAnswer = String(el('mFAnswerSel').value); };
        el('mFAnswerTxt').oninput = () => { mg.editAnswer = el('mFAnswerTxt').value; };

        renderMgOpts();
        mgFillCtl();
        el('mQModalMask').classList.add('show');
        el('mFStem').focus();
    }

    function renderMgOpts() {
        const box = el('mFOpts');
        const mg = state.mg;
        const delSvg = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        box.innerHTML = mg.editOpts.map((t, j) => `
            <div class="p-form-row">
                <span class="p-form-opt-label">${String.fromCharCode(65 + j)}</span>
                <input type="text" data-oi="${j}" value="${U.escapeHtml(String(t))}" placeholder="选项 ${String.fromCharCode(65 + j)} 内容">
                <button class="p-op-btn danger m-opt-del" data-i="${j}" type="button" title="删除选项">${delSvg}</button>
            </div>`).join('');
        box.querySelectorAll('input').forEach(x => { x.oninput = () => {
            mg.editOpts[Number(x.dataset.oi)] = x.value;
            syncMgAnswerSel();
        }; });
        box.querySelectorAll('.m-opt-del').forEach(b => { b.onclick = () => {
            if (mg.editOpts.length <= 2) { U.showToast('至少保留 2 个选项', 'warning'); return; }
            mg.editOpts.splice(Number(b.dataset.i), 1);
            renderMgOpts();
        }; });
        syncMgAnswerSel();
    }

    function syncMgAnswerSel() {
        const sel = el('mFAnswerSel');
        if (!sel || sel.hidden) return;
        const cur = Number(state.mg.editAnswer);
        sel.innerHTML = state.mg.editOpts.map((_, j) => `<option value="${j}">${String.fromCharCode(65 + j)}</option>`).join('');
        sel.value = state.mg.editOpts[cur] !== undefined ? cur : 0;
        state.mg.editAnswer = String(sel.value);
    }

    function mgFillCtl() {
        const fill = el('mFFillable').checked;
        el('mFOpts').hidden = fill;
        el('mFOptAdd').hidden = fill;
        el('mFAnswerSel').hidden = fill;
        el('mFAnswerTxt').hidden = !fill;
        el('mFAnswerHint').hidden = !fill;
        el('mFOptsLabel').textContent = fill ? '填空答案（规范文本）' : '选项（选择题）';
        el('mFAnswerLabel').textContent = fill ? '正确答案（规范文本）' : '正确答案';
        if (fill) el('mFAnswerTxt').value = state.mg.editAnswer || '';
        else { syncMgAnswerSel(); el('mFAnswerTxt').value = ''; }
    }

    async function saveMgQ() {
        const mg = state.mg;
        const stem = el('mFStem').value.trim();
        if (!stem) { U.showToast('请填写题干', 'warning'); return; }
        const qtype = el('mFType').value;
        const fill = el('mFFillable').checked;
        let options, answer;
        if (fill) {
            answer = el('mFAnswerTxt').value.trim();
            if (!answer) { U.showToast('请填写规范答案文本（如 1/8、14.3%、169、1.7）', 'warning'); return; }
            options = [answer];
        } else {
            options = mg.editOpts.map(o => String(o).trim());
            if (options.length < 2 || options.some(o => !o)) { U.showToast('请填写全部选项', 'warning'); return; }
            answer = String(el('mFAnswerSel').value);
            if (options[Number(answer)] === undefined) { U.showToast('请选择正确答案', 'warning'); return; }
        }
        const body = {
            qtype, difficulty: Number(el('mFDiff').value), stem, options, answer,
            tip: el('mFTip').value.trim(), tag: el('mFTag').value.trim(), fillable: fill
        };
        try {
            if (mg.editId) await api.put('/api/mental/admin/questions/' + mg.editId, body);
            else await api.post('/api/mental/admin/questions', body);
            el('mQModalMask').classList.remove('show');
            await renderManage();
            U.showToast('题目已保存', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    /* 停用（软删）与恢复 */
    async function delMgQ(qid) {
        const ok = await PQ.ui.confirm({ title: '停用题目', message: '停用后练习将不再抽取该题，可随时恢复。确定停用？', confirmText: '停用', danger: true });
        if (!ok) return;
        try {
            await api.del('/api/mental/admin/questions/' + qid);
            await renderManage();
            U.showToast('题目已停用', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    async function toggleMgQ(qid, on) {
        const q = state.mg.all.find(x => x.id === qid);
        if (!q) return;
        try {
            await api.put('/api/mental/admin/questions/' + qid, {
                qtype: q.qtype, difficulty: q.difficulty, stem: q.stem,
                options: q.fillable ? [String(q.options[0] != null ? q.options[0] : q.answer)] : q.options,
                answer: q.fillable ? String(q.options[0] != null ? q.options[0] : q.answer) : q.answer,
                tip: q.tip, tag: q.tag, fillable: q.fillable, active: on ? 1 : 0
            });
            await renderManage();
            U.showToast(on ? '题目已恢复' : '题目已停用', 'success');
        } catch (e) { U.showToast(e.message, 'error'); }
    }

    /* ---------- 技巧手册 ---------- */

    function renderManual() {
        const tbody = el('mManualTbody');
        if (!tbody || tbody.dataset.rendered) return;
        tbody.dataset.rendered = '1';
        /* 先左后右：先填满左列，再填右列（列优先），而非左右交错 */
        const rows = [];
        const half = Math.ceil(PERCENT_TABLE.length / 2);
        for (let i = 0; i < half; i++) {
            const a = PERCENT_TABLE[i];
            const b = PERCENT_TABLE[i + half];
            rows.push(`
                <tr>
                    <td>${a[0]}/${a[1]}</td><td>${a[2]}</td>
                    <td>${b ? b[0] + '/' + b[1] : '—'}</td><td>${b ? b[2] : '—'}</td>
                </tr>`);
        }
        tbody.innerHTML = rows.join('');

        const sq = el('mSquareTbody');
        if (!sq || sq.dataset.rendered) return;
        sq.dataset.rendered = '1';
        const sRows = [];
        const sHalf = Math.ceil(SQUARE_TABLE.length / 2);
        for (let i = 0; i < sHalf; i++) {
            const a = SQUARE_TABLE[i];
            const b = SQUARE_TABLE[i + sHalf];
            sRows.push(`
                <tr>
                    <td>${a[0]}²</td><td>${a[1]}</td>
                    <td>${b ? b[0] + '²' : '—'}</td><td>${b ? b[1] : '—'}</td>
                </tr>`);
        }
        sq.innerHTML = sRows.join('');

        const pw = el('mPowTbody');
        if (!pw || pw.dataset.rendered) return;
        pw.dataset.rendered = '1';
        const pRows = [];
        const pHalf = Math.ceil(POW_TABLE.length / 2);
        for (let i = 0; i < pHalf; i++) {
            const a = POW_TABLE[i];
            const b = POW_TABLE[i + pHalf];
            pRows.push(`
                <tr>
                    <td>${a[0]}</td><td>${a[1]}</td>
                    <td>${b ? b[0] : '—'}</td><td>${b ? b[1] : '—'}</td>
                </tr>`);
        }
        pw.innerHTML = pRows.join('');
    }

    /* ---------- 事件绑定 ---------- */

    document.querySelectorAll('#viewMental .practice-tab').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.mtab)));
    el('mStartBtn').addEventListener('click', startRun);
    el('mSkipBtn').addEventListener('click', skipQ);
    el('mNextBtn').addEventListener('click', nextQ);
    el('mEndBtn').addEventListener('click', endRun);
    el('mReplayBtn').addEventListener('click', () => { el('mPaneResult').hidden = true; startRun(); });
    el('mBackBtn').addEventListener('click', backToStart);
    el('mFillBtn').addEventListener('click', answerFill);
    el('mFillInput').addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const nb = el('mNextBtn');
        if (nb && !nb.hidden) return;   // 已作答:交给面板回车下一题
        e.preventDefault();
        answerFill();
    });
    /* 回车下一题：作答完成后（下一题按钮可见）按 Enter 直接进入下一题。
       焦点可能在任何元素上（含隐藏输入框后回到 body），故用 document 级监听 */
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const pane = el('mPaneRun');
        if (!pane || pane.hidden) return;
        const nb = el('mNextBtn');
        if (nb && !nb.hidden) { e.preventDefault(); nextQ(); }
    });

    /* 题库管理事件 */
    el('mAddQBtn').addEventListener('click', () => openMgQModal(0));
    el('mMgEmptyAddBtn').addEventListener('click', () => openMgQModal(0));
    el('mQCancel').addEventListener('click', () => el('mQModalMask').classList.remove('show'));
    el('mQSave').addEventListener('click', saveMgQ);
    el('mQModalMask').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.classList.remove('show'); });

    /* 暴露给 app.js */
    PQ.mental = { enter, switchTab };
})();
