/* ============================================================
 * PQ Timer - modules/history.js
 * 历史记录（MySQL 版）：后端分页查询 + 筛选、渲染卡片、
 * 展开明细、编辑标题/描述/分类、收藏错题入口、删除。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;
    const A = PQ.api;

    /* ---- 元素引用 ---- */
    const viewHistory = document.getElementById('viewHistory');
    const historySummary = document.getElementById('historySummary');
    const historyListEl = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');
    const clearHistoryBtn = document.getElementById('clearHistoryBtn');
    const historyModeFilter = document.getElementById('historyModeFilter');
    const historyCatFilter = document.getElementById('historyCatFilter');
    const historySubFilter = document.getElementById('historySubFilter');
    const historyFilterCount = document.getElementById('historyFilterCount');

    const PAGE_LIMIT = 20;

    /* ---- 筛选状态 ---- */
    let filterMode = '';
    let filterCat = '';
    let filterSub = '';

    /* 填充模式下拉（全部 / 单题 / 整组） */
    function fillModeSelect(sel, selected) {
        const opts = [
            { value: '', label: '全部模式' },
            { value: 'single', label: '单题模式' },
            { value: 'batch', label: '整组模式' },
            { value: 'practice', label: '练习模式' }
        ];
        sel.innerHTML = '';
        opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.value;
            opt.textContent = o.label;
            sel.appendChild(opt);
        });
        sel.value = selected || '';
    }

    /* 渲染筛选器（进入视图时调用） */
    function renderFilter() {
        fillModeSelect(historyModeFilter, filterMode);
        if (filterCat && !PQ.categories.findCat(filterCat)) { filterCat = ''; filterSub = ''; }
        if (filterSub && !PQ.categories.findSub(filterCat, filterSub)) filterSub = '';
        PQ.categories.fillCatSelect(historyCatFilter, filterCat, { withAll: true, allLabel: '全部大类' });
        PQ.categories.fillSubSelect(historySubFilter, filterCat, filterSub, { withAll: true, allLabel: '全部小类' });
    }

    historyModeFilter.addEventListener('change', () => {
        filterMode = historyModeFilter.value;
        renderHistory();
    });

    historyCatFilter.addEventListener('change', () => {
        filterCat = historyCatFilter.value;
        filterSub = '';
        PQ.categories.fillSubSelect(historySubFilter, filterCat, '', { withAll: true, allLabel: '全部小类' });
        renderHistory();
    });
    historySubFilter.addEventListener('change', () => {
        filterSub = historySubFilter.value;
        renderHistory();
    });

    /* 分类标签 HTML */
    function catTagHtml(item) {
        const { catName, subName } = PQ.categories.labelOf(item);
        if (!catName && !subName) return '<span class="cat-tag none">未分类</span>';
        let html = `<span class="cat-tag">${U.escapeHtml(catName)}</span>`;
        if (subName) html += `<span class="cat-tag sub">${U.escapeHtml(subName)}</span>`;
        return html;
    }

    /* 收藏状态（当前页数据自带 favNos: [{no,id}]） */
    function isFaved(h, no) {
        return !!(h.favNos || []).find(x => x.no === no);
    }
    function favIdOf(h, no) {
        const f = (h.favNos || []).find(x => x.no === no);
        return f ? f.id : null;
    }

    /* ---- 知识点描述编辑：进入编辑态 ---- */
    function enterNoteEdit(h, r, it) {
        const noteEl = it.querySelector('.di-note');
        if (!noteEl || noteEl.querySelector('input')) return;
        const old = r.note || '';
        noteEl.classList.add('editing');
        noteEl.innerHTML = '<input maxlength="255" placeholder="如：逻辑判断-削弱质疑类 高阶"><button class="note-save">保存</button><button class="note-cancel">取消</button>';
        const input = noteEl.querySelector('input');
        input.value = old;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        const done = async save => {
            const val = input.value.trim();
            if (save && val !== old) {
                try {
                    await D.updateRecordNote(h.id, r.no, val);
                    r.note = val;
                    U.showToast(`已保存 第${r.no}题 知识点`);
                } catch (err) { U.showToast(err.message); }
            }
            renderNoteView(h, r, it);
        };
        noteEl.querySelector('.note-save').addEventListener('click', e2 => { e2.stopPropagation(); done(true); });
        noteEl.querySelector('.note-cancel').addEventListener('click', e2 => { e2.stopPropagation(); done(false); });
        input.addEventListener('keydown', e2 => {
            if (e2.key === 'Enter') { e2.preventDefault(); done(true); }
            if (e2.key === 'Escape') { done(false); }
        });
    }

    /* ---- 知识点描述：局部恢复视图（不重渲染整个列表，保持卡片展开状态） ---- */
    function renderNoteView(h, r, it) {
        const noteEl = it.querySelector('.di-note');
        if (!noteEl) return;
        noteEl.classList.remove('editing');
        const noteText = r.note
            ? `<span class="di-note-text note-${r.result}" title="${U.escapeHtml(r.note)}">${U.escapeHtml(r.note)}</span>`
            : '<span class="di-note-text"><span class="hint">暂无知识点描述</span></span>';
        noteEl.innerHTML = noteText + `<button class="note-edit">${r.note ? '修改' : '添加'}</button>`;
        noteEl.querySelector('.note-edit').addEventListener('click', (e) => {
            e.stopPropagation();
            enterNoteEdit(h, r, it);
        });
    }

    /* ---- 渲染当前页 ---- */
    function renderPage() {
        const page = D.historyPage;
        const list = page.list;
        historyEmpty.style.display = list.length === 0 ? 'block' : 'none';
        historyListEl.style.display = list.length === 0 ? 'none' : 'flex';

        const filtering = filterMode || filterCat || filterSub;
        historyFilterCount.textContent = filtering ? `筛选结果：${list.length} / ${page.total} 条` : `共 ${page.total} 条`;

        /* 概要（基于当前已加载页）：正确率分母为全部题数，跳过按错误计 */
        let totalRounds = list.length;
        let totalQuestions = 0;
        let totalMs = 0;
        let totalCorrect = 0;
        list.forEach(h => {
            const recs = h.records || [];
            totalQuestions += recs.length;
            totalMs += h.totalMs;
            totalCorrect += h.correct;
        });
        const avgRate = totalQuestions === 0 ? '0%' : (totalCorrect / totalQuestions * 100).toFixed(1) + '%';
        historySummary.innerHTML = `
            <div class="history-summary-card"><div class="num">${totalRounds}</div><div class="label">本页轮次</div></div>
            <div class="history-summary-card"><div class="num">${totalQuestions}</div><div class="label">本页题数</div></div>
            <div class="history-summary-card"><div class="num">${U.formatTime(totalMs)}</div><div class="label">本页用时</div></div>
            <div class="history-summary-card"><div class="num">${avgRate}</div><div class="label">本页正确率（跳过计错）</div></div>
        `;

        historyListEl.innerHTML = '';
        list.forEach((h, idx) => {
            const card = document.createElement('div');
            card.className = 'history-card';

            const head = document.createElement('div');
            head.className = 'history-card-head';

            const rateCls = h.rate >= 60 ? '' : ' low';
            const titleHtml = h.title
                ? `<div class="history-title">${U.escapeHtml(h.title)}</div>`
                : `<div class="history-title"><span class="untitled">未命名轮次</span></div>`;
            const descLine = h.desc
                ? `<div class="history-desc-line" title="${U.escapeHtml(h.desc)}">描述：${U.escapeHtml(h.desc)}</div>`
                : '';
            const recs0 = h.records || [];
            const skipped0 = recs0.filter(x => x.result === 'skip').length;
            head.innerHTML = `
                <div class="history-no">${idx + 1}</div>
                <span class="history-mode ${h.mode}">${h.modeName}</span>
                ${catTagHtml(h)}
                ${titleHtml}
                <div class="history-meta">
                    <span>${h.date}</span>
                    <span>${recs0.length} 题</span>
                    <span>用时 ${U.formatTime(h.totalMs)}</span>
                    <span>答对 ${h.correct}/${recs0.length}</span>
                    ${skipped0 ? `<span class="meta-skip">跳过 ${skipped0}</span>` : ''}
                    <span class="rate${rateCls}">${h.rate}%</span>
                </div>
                <div class="history-actions">
                    <button class="history-edit" title="修改标题 / 描述">编辑</button>
                    <button class="history-toggle">展开</button>
                    <button class="history-del" title="删除该条">删除</button>
                </div>
                ${descLine}
            `;

            const body = document.createElement('div');
            body.className = 'history-card-body';
            if (h.desc) {
                const desc = document.createElement('div');
                desc.className = 'history-desc';
                desc.textContent = `描述：${h.desc}`;
                body.appendChild(desc);
            }
            const grid = document.createElement('div');
            grid.className = 'detail-grid';
            (h.records || []).forEach(r => {
                const it = document.createElement('div');
                it.className = 'detail-item';
                const mark = r.result === 'ok' ? '✓' : r.result === 'skip' ? '○' : '✗';
                const markCls = r.result === 'ok' ? 'mark-ok' : r.result === 'skip' ? 'mark-skip' : 'mark-ng';
                const timeHtml = (h.mode === 'single' || h.mode === 'practice') ? `<span class="di-time">${r.timeStr || ''}</span>` : '';
                const starSvg = () => '<svg viewBox="0 0 24 24" class="star-icon"><path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/></svg>';
                const noteText = r.note
                    ? `<span class="di-note-text note-${r.result}" title="${U.escapeHtml(r.note)}">${U.escapeHtml(r.note)}</span>`
                    : '<span class="di-note-text"><span class="hint">暂无知识点描述</span></span>';
                it.innerHTML = `
                    <div class="di-top">
                        <div class="di-info">
                            <span class="di-title">第${r.no}题</span>
                            ${timeHtml}
                        </div>
                        <div class="di-side">
                            <span class="fav-slot"></span>
                            <span class="di-mark ${markCls}">${mark}</span>
                        </div>
                    </div>
                    <div class="di-note">
                        ${noteText}
                        <button class="note-edit">${r.note ? '修改' : '添加'}</button>
                    </div>
                `;
                if (r.result === 'ng') {
                    const favBtn = document.createElement('button');
                    favBtn.className = 'fav-btn' + (isFaved(h, r.no) ? ' on' : '');
                    favBtn.innerHTML = starSvg();
                    favBtn.title = isFaved(h, r.no) ? '取消收藏' : '收藏这道错题';
                    favBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        toggleFav(h, r, favBtn);
                    });
                    it.querySelector('.fav-slot').appendChild(favBtn);
                }
                /* 知识点描述编辑：点击修改/添加 → 输入框 + 保存/取消（保存后仅局部刷新，不重渲染列表） */
                it.querySelector('.note-edit').addEventListener('click', (e) => {
                    e.stopPropagation();
                    enterNoteEdit(h, r, it);
                });
                grid.appendChild(it);
            });
            body.appendChild(grid);
            card.appendChild(head);

            // 编辑表单
            const editForm = document.createElement('div');
            editForm.className = 'history-edit-form';
            editForm.hidden = true;
            editForm.innerHTML = `
                <input class="edit-title" value="${U.escapeHtml(h.title)}" placeholder="标题" maxlength="100">
                <input class="edit-desc" value="${U.escapeHtml(h.desc)}" placeholder="描述（可选）" maxlength="200">
                <div class="edit-cat-row">
                    <span class="edit-cat-label">分类</span>
                    <select class="edit-cat" title="选择大类"></select>
                    <select class="edit-sub" title="选择小类"></select>
                    <span class="edit-cat-hint">不选即为未分类</span>
                </div>
                <div class="edit-actions">
                    <button class="edit-save">保存</button>
                    <button class="edit-cancel">取消</button>
                </div>
            `;
            const editCatSel = editForm.querySelector('.edit-cat');
            const editSubSel = editForm.querySelector('.edit-sub');
            const curCatId = PQ.categories.findCat(h.catId) ? h.catId : '';
            PQ.categories.fillCatSelect(editCatSel, curCatId, { withNone: true, noneLabel: '未分类' });
            const curSubOk = curCatId && PQ.categories.findSub(curCatId, h.subId);
            PQ.categories.fillSubSelect(editSubSel, curCatId, curSubOk ? h.subId : '', { withNone: true, noneLabel: '未分类' });
            editCatSel.addEventListener('change', () => {
                PQ.categories.fillSubSelect(editSubSel, editCatSel.value, '', { withNone: true, noneLabel: '未分类' });
            });
            card.appendChild(editForm);
            card.appendChild(body);

            head.querySelector('.history-edit').addEventListener('click', e => {
                e.stopPropagation();
                editForm.hidden = false;
                editForm.querySelector('.edit-title').focus();
            });
            const doSaveEdit = async () => {
                const nt = editForm.querySelector('.edit-title').value.trim();
                const nd = editForm.querySelector('.edit-desc').value.trim();
                const cat = PQ.categories.findCat(editCatSel.value);
                const sub = cat ? PQ.categories.findSub(cat.id, editSubSel.value) : null;
                const nCat = {
                    catId: cat ? cat.id : '',
                    catName: cat ? cat.name : '',
                    subId: sub ? sub.id : '',
                    subName: sub ? sub.name : ''
                };
                const catChanged = nCat.catId !== (h.catId || '') || nCat.subId !== (h.subId || '');
                if (nt === h.title && nd === h.desc && !catChanged) { editForm.hidden = true; return; }
                try {
                    await D.updateHistory(h.id, { title: nt, description: nd, catId: nCat.catId, catName: nCat.catName, subId: nCat.subId, subName: nCat.subName });
                    h.title = nt;
                    h.desc = nd;
                    h.catId = nCat.catId; h.catName = nCat.catName;
                    h.subId = nCat.subId; h.subName = nCat.subName;
                    // 后端已同步收藏快照；收藏页可见时刷新
                    if (PQ.favorites) PQ.favorites.renderIfVisible();
                    renderPage();
                    U.showToast('已修改标题 / 描述 / 分类');
                } catch (err) { U.showToast(err.message); }
            };
            editForm.querySelector('.edit-save').addEventListener('click', e => { e.stopPropagation(); doSaveEdit(); });
            editForm.querySelector('.edit-cancel').addEventListener('click', e => { e.stopPropagation(); editForm.hidden = true; });
            editForm.querySelectorAll('input').forEach(inp => inp.addEventListener('keydown', e => {
                if (e.key === 'Enter') { e.preventDefault(); doSaveEdit(); }
                if (e.key === 'Escape') { editForm.hidden = true; }
            }));

            head.querySelector('.history-toggle').addEventListener('click', e => {
                e.stopPropagation();
                card.classList.toggle('open');
                const btn = head.querySelector('.history-toggle');
                btn.textContent = card.classList.contains('open') ? '收起' : '展开';
            });

            /* 点击卡片头部（记录信息区域）：收起 ↔ 展开；题目明细区点击不触发折叠 */
            head.addEventListener('click', () => {
                card.classList.toggle('open');
                const btn = head.querySelector('.history-toggle');
                btn.textContent = card.classList.contains('open') ? '收起' : '展开';
            });
            editForm.addEventListener('click', e => e.stopPropagation());

            head.querySelector('.history-del').addEventListener('click', async e => {
                e.stopPropagation();
                if (!confirm(`确定删除「${h.title || '这条记录'}」吗？该轮的收藏也会一并删除。`)) return;
                try {
                    await D.deleteHistory(h.id);
                    if (PQ.app) PQ.app.updateBadges();
                    if (PQ.favorites) PQ.favorites.renderIfVisible();
                    renderPage();
                    U.showToast('已删除该条历史记录');
                } catch (err) { U.showToast(err.message); }
            });

            historyListEl.appendChild(card);
        });

        /* 加载更多按钮 */
        let moreBtn = document.getElementById('historyMoreBtn');
        if (!moreBtn) {
            moreBtn = document.createElement('button');
            moreBtn.id = 'historyMoreBtn';
            moreBtn.className = 'load-more';
            historyListEl.parentNode.insertBefore(moreBtn, historyEmpty);
        }
        const hasMore = page.page < page.totalPages;
        moreBtn.style.display = list.length === 0 ? 'none' : hasMore ? 'block' : 'none';
        moreBtn.textContent = `加载更多（${page.list.length}/${page.total}）`;
        moreBtn.onclick = () => loadMore();
    }

    /* 收藏 / 取消收藏（异步） */
    async function toggleFav(h, r, favBtn) {
        const starSvg = () => '<svg viewBox="0 0 24 24" class="star-icon"><path d="M12 17.27L18.18 21L16.54 13.97L22 9.24L14.81 8.63L12 2L9.19 8.63L2 9.24L7.46 13.97L5.82 21L12 17.27Z"/></svg>';
        try {
            if (isFaved(h, r.no)) {
                const id = favIdOf(h, r.no);
                await D.deleteFavorite(id);
                h.favNos = (h.favNos || []).filter(x => x.no !== r.no);
                if (PQ.app) PQ.app.updateBadges();
                U.showToast(`已取消收藏 第${r.no}题`);
            } else {
                const fav = await D.addFavorite({
                    roundId: h.id,
                    no: r.no,
                    title: h.title || '未命名轮次',
                    mode: h.mode,
                    modeName: h.modeName,
                    timeStr: (h.mode === 'single' || h.mode === 'practice') ? r.timeStr : '',
                    catId: h.catId || '',
                    catName: h.catName || '',
                    subId: h.subId || '',
                    subName: h.subName || ''
                });
                /* 用接口返回的真实收藏 id（假 id 会导致同会话内取消收藏 404） */
                h.favNos = (h.favNos || []).concat([{ no: r.no, id: fav && fav.id ? fav.id : Date.now() }]);
                if (PQ.app) PQ.app.updateBadges();
                U.showToast(`已收藏错题 第${r.no}题`);
            }
            if (favBtn) {
                const on = isFaved(h, r.no);
                favBtn.classList.toggle('on', on);
                favBtn.innerHTML = starSvg();
                favBtn.title = on ? '取消收藏' : '收藏这道错题';
            }
        } catch (err) { U.showToast(err.message); }
    }

    /* 加载更多 */
    async function loadMore() {
        const page = D.historyPage;
        if (page.page >= page.totalPages) return;
        try {
            await D.loadHistoryPage({ mode: filterMode, catId: filterCat, subId: filterSub, page: page.page + 1, limit: PAGE_LIMIT, append: true });
            renderPage();
        } catch (e) { U.showToast(e.message); }
    }

    /* 拉取第一页并渲染 */
    async function renderHistory() {
        try {
            await D.loadHistoryPage({ mode: filterMode, catId: filterCat, subId: filterSub, page: 1, limit: PAGE_LIMIT });
            renderPage();
        } catch (e) {
            U.showToast(e.message);
            historyListEl.style.display = 'none';
            historyEmpty.style.display = 'block';
        }
    }

    clearHistoryBtn.addEventListener('click', async () => {
        if (D.historyPage.total === 0) return;
        if (confirm('确定清空全部历史记录吗？此操作不可恢复，关联的收藏也会一并清空。')) {
            try {
                await D.clearHistory();
                if (PQ.app) PQ.app.updateBadges();
                if (PQ.favorites) PQ.favorites.renderIfVisible();
                renderPage();
                U.showToast('已清空全部历史记录');
            } catch (e) { U.showToast(e.message); }
        }
    });

    window.PQ = window.PQ || {};
    PQ.history = { renderHistory, renderFilter, renderPage, toggleFav, isFaved };
})();