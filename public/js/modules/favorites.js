/* ============================================================
 * PQ Timer - modules/favorites.js
 * 错题收藏（MySQL 版）：后端分页查询 + 筛选、渲染卡片、
 * 改分类、移除、清空。收藏动作在历史明细中触发（history.js）。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;
    const A = PQ.api;

    /* ---- 元素引用 ---- */
    const viewFavorites = document.getElementById('viewFavorites');
    const favSummary = document.getElementById('favSummary');
    const favListEl = document.getElementById('favList');
    const favEmpty = document.getElementById('favEmpty');
    const clearFavBtn = document.getElementById('clearFavBtn');
    const favModeFilter = document.getElementById('favModeFilter');
    const favCatFilter = document.getElementById('favCatFilter');
    const favSubFilter = document.getElementById('favSubFilter');
    const favFilterCount = document.getElementById('favFilterCount');

    const PAGE_LIMIT = 20;

    /* ---- 筛选状态 ---- */
    let filterMode = '';
    let filterCat = '';
    let filterSub = '';

    function fillModeSelect(sel, selected) {
        const opts = [
            { value: '', label: '全部模式' },
            { value: 'single', label: '单题模式' },
            { value: 'batch', label: '整组模式' }
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

    function renderFilter() {
        fillModeSelect(favModeFilter, filterMode);
        if (filterCat && !PQ.categories.findCat(filterCat)) { filterCat = ''; filterSub = ''; }
        if (filterSub && !PQ.categories.findSub(filterCat, filterSub)) filterSub = '';
        PQ.categories.fillCatSelect(favCatFilter, filterCat, { withAll: true, allLabel: '全部大类' });
        PQ.categories.fillSubSelect(favSubFilter, filterCat, filterSub, { withAll: true, allLabel: '全部小类' });
    }

    favModeFilter.addEventListener('change', () => {
        filterMode = favModeFilter.value;
        renderFavs();
    });

    favCatFilter.addEventListener('change', () => {
        filterCat = favCatFilter.value;
        filterSub = '';
        PQ.categories.fillSubSelect(favSubFilter, filterCat, '', { withAll: true, allLabel: '全部小类' });
        renderFavs();
    });
    favSubFilter.addEventListener('change', () => {
        filterSub = favSubFilter.value;
        renderFavs();
    });

    function catTagHtml(item) {
        const { catName, subName } = PQ.categories.labelOf(item);
        if (!catName && !subName) return '<span class="cat-tag none">未分类</span>';
        let html = `<span class="cat-tag">${U.escapeHtml(catName)}</span>`;
        if (subName) html += `<span class="cat-tag sub">${U.escapeHtml(subName)}</span>`;
        return html;
    }

    function renderPage() {
        const page = D.favPage;
        const list = page.list;
        favEmpty.style.display = list.length === 0 ? 'block' : 'none';
        favListEl.style.display = list.length === 0 ? 'none' : 'flex';

        const filtering = filterMode || filterCat || filterSub;
        favFilterCount.textContent = filtering ? `筛选结果：${list.length} / ${page.total} 条` : `共 ${page.total} 条`;

        favSummary.innerHTML = `
            <div class="history-summary-card"><div class="num">${list.length}</div><div class="label">本页收藏</div></div>
            <div class="history-summary-card"><div class="num">${new Set(list.map(f => f.hid)).size}</div><div class="label">来源轮次</div></div>
            <div class="history-summary-card"><div class="num">${list.filter(f => f.mode === 'single').length}</div><div class="label">单题模式</div></div>
        `;

        favListEl.innerHTML = '';
        list.forEach(f => {
            const card = document.createElement('div');
            card.className = 'fav-card';
            const timeHtml = f.timeStr ? ` · 用时 ${f.timeStr}` : '';
            card.innerHTML = `
                <div class="fav-no">${f.no}</div>
                <div class="fav-info">
                    <div class="fav-title" title="${U.escapeHtml(f.title)}">${U.escapeHtml(f.title)}</div>
                    <div class="fav-meta">${f.modeName}${timeHtml} · 收藏于 ${f.collectedAt}</div>
                </div>
                ${catTagHtml(f)}
                <button class="fav-cat-edit" title="修改这道错题的分类">改分类</button>
                <button class="fav-del" title="移除收藏">移除</button>
            `;
            card.querySelector('.fav-cat-edit').addEventListener('click', () => {
                PQ.categories.openCatEditor({ catId: f.catId, subId: f.subId }, async (res) => {
                    try {
                        await D.updateFavorite(f.id, res);
                        f.catId = res.catId; f.catName = res.catName;
                        f.subId = res.subId; f.subName = res.subName;
                        renderPage();
                        U.showToast('已修改该错题的分类');
                    } catch (e) { U.showToast(e.message); }
                });
            });
            card.querySelector('.fav-del').addEventListener('click', async () => {
                try {
                    await D.deleteFavorite(f.id);
                    if (PQ.app) PQ.app.updateBadges();
                    renderPage();
                    U.showToast('已移除收藏');
                } catch (e) { U.showToast(e.message); }
            });
            favListEl.appendChild(card);
        });

        /* 加载更多 */
        let moreBtn = document.getElementById('favMoreBtn');
        if (!moreBtn) {
            moreBtn = document.createElement('button');
            moreBtn.id = 'favMoreBtn';
            moreBtn.className = 'load-more';
            favListEl.parentNode.insertBefore(moreBtn, favEmpty);
        }
        const hasMore = page.page < page.totalPages;
        moreBtn.style.display = list.length === 0 ? 'none' : hasMore ? 'block' : 'none';
        moreBtn.textContent = `加载更多（${page.list.length}/${page.total}）`;
        moreBtn.onclick = async () => {
            if (D.favPage.page >= D.favPage.totalPages) return;
            try {
                await D.loadFavPage({ mode: filterMode, catId: filterCat, subId: filterSub, page: D.favPage.page + 1, limit: PAGE_LIMIT, append: true });
                renderPage();
            } catch (e) { U.showToast(e.message); }
        };
    }

    async function renderFavs() {
        try {
            await D.loadFavPage({ mode: filterMode, catId: filterCat, subId: filterSub, page: 1, limit: PAGE_LIMIT });
            renderPage();
        } catch (e) {
            U.showToast(e.message);
            favListEl.style.display = 'none';
            favEmpty.style.display = 'block';
        }
    }

    clearFavBtn.addEventListener('click', async () => {
        if (D.favPage.total === 0) return;
        if (confirm('确定清空全部错题收藏吗？')) {
            try {
                await D.clearFavs();
                if (PQ.app) PQ.app.updateBadges();
                renderPage();
                U.showToast('已清空全部收藏');
            } catch (e) { U.showToast(e.message); }
        }
    });

    /* 收藏视图可见时刷新（被历史编辑等联动调用） */
    function renderIfVisible() {
        if (viewFavorites.hidden === false) renderFavs();
    }

    window.PQ = window.PQ || {};
    PQ.favorites = { renderFavs, renderFilter, renderIfVisible, isFaved: () => false };
})();