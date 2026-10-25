/* ============================================================
 * PQ Timer - modules/timer.js
 * 计时核心（MySQL 版）：单题分段 / 整组计时两种模式，本轮记录、
 * 归档（调 API 写库）、整组错题标记面板、全局键盘。
 * 归档时把当前刷题分类（大类/小类名称快照）一并提交。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;

    /* ---- 元素引用 ---- */
    const timeText = document.getElementById('timeText');
    const stopBtn = document.getElementById('stopBtn');
    const clearBtn = document.getElementById('clearBtn');
    const newRoundBtn = document.getElementById('newRoundBtn');
    const recordWrap = document.getElementById('recordWrap');
    const countText = document.getElementById('countText');
    const maxText = document.getElementById('maxText');
    const sumText = document.getElementById('sumText');
    const correctText = document.getElementById('correctText');
    const rateText = document.getElementById('rateText');
    const modalMask = document.getElementById('modalMask');
    const btnY = document.getElementById('btnY');
    const btnN = document.getElementById('btnN');
    const batchModalMask = document.getElementById('batchModalMask');
    const resultGrid = document.getElementById('resultGrid');
    const resultProgress = document.getElementById('resultProgress');
    const batchCancelBtn = document.getElementById('batchCancelBtn');
    const batchDoneBtn = document.getElementById('batchDoneBtn');
    const batchCountSelect = document.getElementById('batchCountSelect');
    const customBatchInput = document.getElementById('customBatchInput');
    const modeTitle = document.getElementById('modeTitle');
    const modeDesc = document.getElementById('modeDesc');
    const roundTitleInput = document.getElementById('roundTitleInput');
    const roundDescInput = document.getElementById('roundDescInput');
    const viewTimer = document.getElementById('viewTimer');

    /* ---- 状态 ---- */
    let startTime = null;
    let timerId = null;
    let isTiming = false;
    let pendingMs = 0;
    let roundRecords = [];
    let roundArchived = false;
    let roundTotalMs = 0;
    let MAX_ROUND = 20;
    let workMode = 'single';
    const PER_COL = 5;
    let roundMeta = { title: '', desc: '' };
    let batchResults = [];
    let batchCurIdx = 0;

    /* ---- 计时控制 ---- */
    function resetTimer() {
        clearInterval(timerId);
        timerId = null;
        isTiming = false;
        timeText.textContent = '00:00.00';
    }

    function updateTimer() {
        const diff = Date.now() - startTime;
        timeText.textContent = U.formatTime(diff);
    }

    /* ---- 本轮统计 ---- */
    function updateStat() {
        let totalMs = 0;
        let correctCnt = 0;
        if (workMode === 'batch') {
            totalMs = roundTotalMs;
        } else {
            roundRecords.forEach(item => { totalMs += item.ms; });
        }
        roundRecords.forEach(item => { if (item.result === 'ok') correctCnt++; });
        const total = roundRecords.length;
        const answered = roundRecords.filter(item => item.result !== 'skip').length;
        const rate = answered === 0 ? '0%' : (correctCnt / answered * 100).toFixed(1) + '%';
        sumText.textContent = U.formatTime(totalMs);
        countText.textContent = total;
        maxText.textContent = MAX_ROUND;
        correctText.textContent = correctCnt;
        rateText.textContent = rate;
    }

    /* ---- 记录渲染 ---- */
    function renderRecords() {
        recordWrap.innerHTML = '';
        const colCount = Math.ceil(roundRecords.length / PER_COL);
        for (let c = 0; c < colCount; c++) {
            const colDiv = document.createElement('div');
            colDiv.className = 'record-column';
            const title = document.createElement('div');
            title.className = 'col-title';
            title.innerText = `第${c + 1}组`;
            colDiv.appendChild(title);
            const slice = roundRecords.slice(c * PER_COL, c * PER_COL + PER_COL);
            slice.forEach(rec => {
                const item = document.createElement('div');
                item.className = 'record-item';
                const mark = rec.result === 'ok' ? '✓' : rec.result === 'skip' ? '○' : '✗';
                const markCls = rec.result === 'ok' ? 'mark-ok' : rec.result === 'skip' ? 'mark-skip' : 'mark-ng';
                if (workMode === 'single') {
                    item.innerHTML = `第${rec.no}题：${rec.timeStr} <span class="${markCls}">${mark}</span>`;
                    const markEl = item.querySelector('.mark-ok, .mark-ng, .mark-skip');
                    if (markEl) {
                        markEl.classList.add('mark-toggle');
                        markEl.title = '点击修正本题状态（计时中请先暂停）';
                        markEl.addEventListener('click', (e) => {
                            e.stopPropagation();
                            toggleRecordResult(rec.no);
                        });
                    }
                } else {
                    item.innerHTML = `第${rec.no}题 <span class="${markCls}">${mark}</span>`;
                }
                colDiv.appendChild(item);
            });
            recordWrap.appendChild(colDiv);
        }
    }

    /* 单题模式：修正已记录题目的状态（仅未归档、暂停时可修改） */
    function toggleRecordResult(no) {
        if (workMode !== 'single') return;
        if (roundArchived) return;
        if (isTiming) {
            U.showToast('计时中，请先按空格暂停再修正对错');
            return;
        }
        const rec = roundRecords.find(r => r.no === no);
        if (!rec) return;
        rec.result = rec.result === 'ok' ? 'ng' : rec.result === 'ng' ? 'skip' : 'ok';
        renderRecords();
        updateStat();
    }

    /* ---- 新一轮 ---- */
    function defaultRoundTitle() {
        const d = new Date();
        const modeName = workMode === 'single' ? '单题模式' : '整组模式';
        return `${modeName}-${d.getFullYear()}-${U.pad2(d.getMonth() + 1)}${U.pad2(d.getDate())}-${U.pad2(d.getHours())}:${U.pad2(d.getMinutes())}`;
    }

    function newRound() {
        roundRecords = [];
        roundArchived = false;
        roundTotalMs = 0;
        batchResults = [];
        roundMeta.title = defaultRoundTitle();
        roundTitleInput.value = roundMeta.title;
        renderRecords();
        updateStat();
        newRoundBtn.style.display = 'none';
        if (PQ.categories) PQ.categories.refreshRoundCat();
    }

    /* ---- 归档当前轮为历史记录（异步提交到后端） ---- */
    async function archiveCurrentRound() {
        if (roundRecords.length === 0 || roundArchived) return;
        let totalMs = workMode === 'batch' ? roundTotalMs : roundRecords.reduce((s, i) => s + i.ms, 0);
        let correctCnt = 0;
        roundRecords.forEach(item => { if (item.result === 'ok') correctCnt++; });
        const total = roundRecords.length;
        const answered = roundRecords.filter(item => item.result !== 'skip').length;
        const cat = PQ.categories ? PQ.categories.getRoundCat() : { catId: '', catName: '', subId: '', subName: '' };
        const roundObj = {
            mode: workMode,
            modeName: workMode === 'single' ? '单题模式' : '整组模式',
            title: roundMeta.title.trim(),
            description: roundMeta.desc.trim(),
            finishedAt: U.formatDate(Date.now()),
            maxCount: MAX_ROUND,
            records: roundRecords.map(r => ({ no: r.no, ms: r.ms, cumMs: r.cumMs, timeStr: r.timeStr, result: r.result })),
            totalMs: totalMs,
            correct: correctCnt,
            rate: answered === 0 ? 0 : +(correctCnt / answered * 100).toFixed(1),
            catId: cat.catId,
            catName: cat.catName,
            subId: cat.subId,
            subName: cat.subName
        };
        roundArchived = true;
        try {
            await D.addHistory(roundObj);
            if (PQ.app) PQ.app.updateBadges();
        } catch (e) {
            roundArchived = false;
            U.showToast('归档失败：' + e.message);
        }
    }

    /* ---- 记录一题（单题模式） ---- */
    function saveRecord(result) {
        const no = roundRecords.length + 1;
        roundRecords.push({
            no: no,
            ms: pendingMs,
            cumMs: pendingMs,
            timeStr: U.formatTime(pendingMs),
            result: result
        });
        renderRecords();
        updateStat();
        if (roundRecords.length >= MAX_ROUND) {
            archiveCurrentRound();
            newRoundBtn.style.display = 'inline-block';
            U.showToast(`本轮 ${MAX_ROUND} 题已完成，已归档到历史记录`);
        }
    }

    btnY.onclick = () => {
        saveRecord('ok');
        modalMask.style.display = 'none';
    };
    btnN.onclick = () => {
        saveRecord('ng');
        modalMask.style.display = 'none';
    };
    btnP.onclick = () => {
        saveRecord('skip');
        modalMask.style.display = 'none';
    };

    /* ---- 整组完成：错题标记面板 ---- */
    function openBatchModal() {
        batchResults = new Array(MAX_ROUND).fill(null);
        batchCurIdx = 0;
        renderResultGrid();
        updateResultProgress();
        batchModalMask.style.display = 'flex';
    }

    function closeBatchModal() {
        batchModalMask.style.display = 'none';
    }

    function renderResultGrid() {
        resultGrid.innerHTML = '';
        for (let i = 0; i < MAX_ROUND; i++) {
            const cell = document.createElement('button');
            cell.className = 'result-cell';
            cell.dataset.idx = i;
            cell.innerHTML = `<span class="no">${i + 1}</span><span class="mark"></span>`;
            cell.addEventListener('click', () => cycleCell(i));
            resultGrid.appendChild(cell);
        }
        updateResultCells();
    }

    function cycleCell(i) {
        if (batchResults[i] === 'ng') batchResults[i] = 'skip';
        else if (batchResults[i] === 'skip') batchResults[i] = null;
        else batchResults[i] = 'ng';
        batchCurIdx = i;
        updateResultCells();
        updateResultProgress();
    }

    function setResult(i, val) {
        if (i < 0 || i >= MAX_ROUND) return;
        batchResults[i] = val;
        updateResultCells();
        updateResultProgress();
    }

    function moveSel(delta) {
        batchCurIdx = Math.min(MAX_ROUND - 1, Math.max(0, batchCurIdx + delta));
        updateResultCells();
    }

    function updateResultCells() {
        const cells = resultGrid.children;
        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            const v = batchResults[i];
            c.classList.toggle('ng', v === 'ng');
            c.classList.toggle('skip', v === 'skip');
            c.classList.toggle('selected', i === batchCurIdx);
            c.querySelector('.mark').textContent = v === 'ng' ? '✗' : v === 'skip' ? '○' : '';
        }
    }

    function updateResultProgress() {
        const wrong = batchResults.filter(x => x === 'ng').length;
        const skipped = batchResults.filter(x => x === 'skip').length;
        resultProgress.textContent = `已标错 ${wrong} 题 · 没做 ${skipped} 题（其余默认正确）`;
    }

    function finishBatchRound() {
        const totalMs = roundTotalMs;
        roundRecords = batchResults.map((r, i) => ({
            no: i + 1,
            ms: 0,
            cumMs: 0,
            timeStr: '--:--.--',
            result: r === 'ng' ? 'ng' : r === 'skip' ? 'skip' : 'ok'
        }));
        roundTotalMs = totalMs;
        closeBatchModal();
        renderRecords();
        updateStat();
        archiveCurrentRound();
        newRoundBtn.style.display = 'inline-block';
        const wrongCnt = roundRecords.filter(x => x.result === 'ng').length;
        const skipCnt = roundRecords.filter(x => x.result === 'skip').length;
        U.showToast(`整组完成：共 ${MAX_ROUND} 题，错 ${wrongCnt} 题，没做 ${skipCnt} 题`);
    }

    batchCancelBtn.onclick = () => {
        closeBatchModal();
        resetTimer();
        newRound();
        U.showToast('已取消本轮');
    };

    batchDoneBtn.onclick = finishBatchRound;

    /* ---- 按钮 ---- */
    stopBtn.addEventListener('click', () => { resetTimer(); });

    clearBtn.addEventListener('click', () => {
        if (roundRecords.length > 0 && !roundArchived) {
            archiveCurrentRound();
            U.showToast('本轮已存入历史记录');
        }
        resetTimer();
        newRound();
    });

    newRoundBtn.addEventListener('click', () => {
        if (roundRecords.length > 0 && !roundArchived) {
            archiveCurrentRound();
        }
        resetTimer();
        newRound();
    });

    /* ---- 本轮标题 / 描述 ---- */
    roundTitleInput.addEventListener('input', () => { roundMeta.title = roundTitleInput.value; });
    roundTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            roundTitleInput.blur();
            U.showToast('标题已记录，按空格开始计时');
        }
    });
    roundDescInput.addEventListener('input', () => { roundMeta.desc = roundDescInput.value; });

    /* ---- 整组题量选择 ---- */
    batchCountSelect.onchange = function () {
        if (this.value === 'custom') {
            customBatchInput.style.display = 'inline-block';
            return;
        }
        customBatchInput.style.display = 'none';
        MAX_ROUND = Number(this.value);
        newRound();
    };

    customBatchInput.addEventListener('input', () => {
        const val = Number(customBatchInput.value);
        if (val > 0) MAX_ROUND = val;
        newRound();
    });

    /* ---- 模式切换 ---- */
    function applyMode(mode) {
        workMode = mode;
        if (mode === 'single') {
            modeTitle.textContent = '单题模式';
            modeDesc.textContent = '每题独立计时 · 空格开始 / 结束一题 · Y=对 N=错 P=没做跳过';
        } else {
            modeTitle.textContent = '整组模式';
            modeDesc.textContent = '空格开始整组计时，做完后再次按空格停止并标记错题';
        }
    }

    /* ---- 全局键盘 ---- */
    document.addEventListener('keydown', (e) => {
        // 整组错题标记面板
        if (batchModalMask.style.display === 'flex') {
            const key = e.key.toLowerCase();
            if (key === 'n') { e.preventDefault(); setResult(batchCurIdx, 'ng'); moveSel(1); return; }
            if (key === 'y') { e.preventDefault(); setResult(batchCurIdx, null); moveSel(1); return; }
            if (key === 'p') { e.preventDefault(); setResult(batchCurIdx, 'skip'); moveSel(1); return; }
            if (e.key === 'ArrowLeft') { e.preventDefault(); moveSel(-1); return; }
            if (e.key === 'ArrowRight') { e.preventDefault(); moveSel(1); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); moveSel(-10); return; }
            if (e.key === 'ArrowDown') { e.preventDefault(); moveSel(10); return; }
            if (e.key === 'Enter') { e.preventDefault(); finishBatchRound(); return; }
            if (e.code === 'Space') { e.preventDefault(); finishBatchRound(); return; }
            return;
        }

        // 单题对错弹窗
        if (modalMask.style.display === 'flex') {
            const key = e.key.toLowerCase();
            if (key === 'y') {
                e.preventDefault();
                saveRecord('ok');
                modalMask.style.display = 'none';
                return;
            }
            if (key === 'n') {
                e.preventDefault();
                saveRecord('ng');
                modalMask.style.display = 'none';
                return;
            }
            if (key === 'p') {
                e.preventDefault();
                saveRecord('skip');
                modalMask.style.display = 'none';
                return;
            }
            return;
        }

        // 计时控制：空格（输入框聚焦时不触发，避免影响打字）
        if (e.code !== 'Space') return;
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        if (viewTimer.hidden) return;
        if (roundRecords.length >= MAX_ROUND) return;

        if (!isTiming) {
            isTiming = true;
            startTime = Date.now();
            timerId = setInterval(updateTimer, 20);
        } else {
            if (workMode === 'single') {
                clearInterval(timerId);
                timerId = null;
                isTiming = false;
                pendingMs = Date.now() - startTime;
                resetTimer();
                modalMask.style.display = 'flex';
            } else {
                clearInterval(timerId);
                timerId = null;
                isTiming = false;
                pendingMs = Date.now() - startTime;
                roundTotalMs = pendingMs;
                openBatchModal();
            }
        }
    });

    /* ---- 对外接口 ---- */
    window.PQ = window.PQ || {};
    PQ.timer = {
        applyMode,
        newRound,
        archiveCurrentRound,
        resetTimer,
        saveRecord,
        finishBatchRound,
        get workMode() { return workMode; },
        get roundRecords() { return roundRecords; },
        get archived() { return roundArchived; }
    };
})();