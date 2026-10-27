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
    const TABS = { START: 'start', RECORDS: 'records', MANUAL: 'manual' };
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
    /* 做题类型：选择题（四选一） / 填空题（仅百化分，常规几分之一型） */
    const MODES = [
        { k: 'choice', n: '选择题', d: '四选一，选项辅助判断' },
        { k: 'fill', n: '填空题', d: '直接填写：12.5% 填 8，1/9 填 11.1' }
    ];

    /* 百化分速查表（1/2 ~ 1/20，用于技巧手册） */
    const PERCENT_TABLE = [
        [1, 2, '50%'], [1, 3, '33.3%'], [1, 4, '25%'], [1, 5, '20%'],
        [1, 6, '16.7%'], [1, 7, '14.3%'], [1, 8, '12.5%'], [1, 9, '11.1%'],
        [1, 10, '10%'], [1, 11, '9.1%'], [1, 12, '8.3%'], [1, 13, '7.7%'],
        [1, 14, '7.1%'], [1, 15, '6.7%'], [1, 16, '6.25%'], [1, 17, '5.9%'],
        [1, 18, '5.6%'], [1, 19, '5.3%'], [1, 20, '5%']
    ];

    const state = {
        mtab: TABS.START,
        type: 'percent',
        count: COUNT_OPTIONS[0],
        diff: 0,
        answerMode: 'choice',
        run: null,            // 运行中会话 { sessionId, qtype, qtypeName, answerMode, questions, idx, ok, ng, skip, answers, startTs, itemStartTs, phase, finished }
        recPage: 1, recTotal: 0,
        stats: null,
        timer: null
    };

    function el(id) { return document.getElementById(id); }

    /* ---------- 视图进入 / 页签 ---------- */

    async function enter() {
        switchTab(state.mtab);
        if (state.mtab === TABS.RECORDS) { renderStatsBar(); renderRecords(true); }
    }

    function switchTab(mtab) {
        state.mtab = mtab;
        document.querySelectorAll('#viewMental .practice-tab').forEach(b => b.classList.toggle('active', b.dataset.mtab === mtab));
        el('mPaneStart').hidden = mtab !== TABS.START;
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

    /* 做题类型：仅百化分可选（填空题面向常规几分之一型）；其他题型固定选择题 */
    function renderModeRow() {
        const title = el('mModeTitle');
        const row = el('mModeRow');
        if (!title || !row) return;
        const visible = state.type === 'percent';
        title.hidden = !visible;
        row.hidden = !visible;
        if (!visible) return;
        row.innerHTML = MODES.map(m => `
            <div class="p-mode-chip ${state.answerMode === m.k ? 'selected' : ''}" data-k="${m.k}">
                <b>${m.n}</b><span>${m.d}</span>
            </div>`).join('');
        row.querySelectorAll('.p-mode-chip').forEach(x => x.addEventListener('click', () => {
            state.answerMode = x.dataset.k; renderModeRow();
        }));
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
        row.innerHTML = DIFFS.map(d => `
            <div class="p-mode-chip ${state.diff === d.k ? 'selected' : ''}" data-k="${d.k}">
                <b>${d.n}</b><span>${d.d}</span>
            </div>`).join('');
        row.querySelectorAll('.p-mode-chip').forEach(x => x.addEventListener('click', () => {
            state.diff = Number(x.dataset.k); renderDiffs();
        }));
    }

    function updateStartBtn() {
        const fillNote = (state.type === 'percent' && state.answerMode === 'fill') ? '（填空题：直接填数字）' : '';
        el('mStartTip').textContent = state.count === INFINITE
            ? `「${TYPES[state.type].n}」不限题量 · 循环随机抽题，答完自动续题，随时可结束${fillNote}`
            : `将抽取 ${state.count} 道「${TYPES[state.type].n}」题，答完即时判对错并给出技巧${fillNote}`;
    }

    async function startRun() {
        try {
            const r = await api.post('/api/mental/start', {
                qtype: state.type, difficulty: state.diff, count: state.count, answerMode: state.answerMode
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

        /* 填空题：百分数→填分母(1/?)；分数→填百分数数值(?%)，百分号固定 */
        const fillRow = el('mFillRow');
        if (fillMode) {
            const prefix = el('mFillPrefix'), suffix = el('mFillSuffix'), input = el('mFillInput');
            prefix.textContent = q.fillDir === 'den' ? '1/' : '';
            suffix.hidden = q.fillDir !== 'pct';
            input.placeholder = q.fillDir === 'den' ? '填分母（如 12.5% 填 8）' : '填百分数数值（如 1/9 填 11.1）';
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

    /* ---------- 技巧手册 ---------- */

    function renderManual() {
        const tbody = el('mManualTbody');
        if (!tbody || tbody.dataset.rendered) return;
        tbody.dataset.rendered = '1';
        const rows = [];
        for (let i = 0; i < PERCENT_TABLE.length; i += 2) {
            const a = PERCENT_TABLE[i];
            const b = PERCENT_TABLE[i + 1];
            rows.push(`
                <tr>
                    <td>${a[0]}/${a[1]}</td><td>${a[2]}</td>
                    <td>${b ? b[0] + '/' + b[1] : '—'}</td><td>${b ? b[2] : '—'}</td>
                </tr>`);
        }
        tbody.innerHTML = rows.join('');
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

    /* 暴露给 app.js */
    PQ.mental = { enter, switchTab };
})();
