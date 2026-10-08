/* ============================================================
 * PQ Timer - modules/categories.js
 * 分类模块（MySQL 版）：两级分类（大类 → 小类）的数据访问、
 * 计时视图分类选择、分类管理页（增删改）、历史/收藏筛选器。
 * 数据操作全部通过 API；内存 categories 由数据层持有。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;
    const A = PQ.api;

    /* 元素引用 */
    const catSelect = document.getElementById('catSelect');
    const subSelect = document.getElementById('subSelect');
    const catManager = document.getElementById('catManager');
    const addCatBtn = document.getElementById('addCatBtn');
    const restoreCatBtn = document.getElementById('restoreCatBtn');

    /* ---- 基础查询（内存） ---- */
    function findCat(catId) {
        if (!catId) return null;
        return D.categories.find(c => c.id === catId) || null;
    }

    function findSub(catId, subId) {
        const cat = findCat(catId);
        if (!cat || !subId) return null;
        return (cat.subs || []).find(s => s.id === subId) || null;
    }

    /* 分类名解析：优先当前分类名（重命名同步），分类被删后用记录里的名称快照 */
    function labelOf(item) {
        const cat = findCat(item.catId);
        const catName = cat ? cat.name : (item.catName || '');
        let subName = '';
        if (cat) {
            const sub = item.subId ? (cat.subs || []).find(s => s.id === item.subId) : null;
            subName = sub ? sub.name : (item.subName || '');
        } else if (item.subName) {
            subName = item.subName;
        }
        return { catId: item.catId || '', catName, subId: item.subId || '', subName };
    }

    /* 记录是否有分类 */
    function hasCat(item) {
        return !!(item.catId && findCat(item.catId)) || !!item.catName;
    }

    /* 某大类下有多少条历史记录（删除确认用；总数来自分页 total 的快照口径） */
    function historyCountOfCat(catId) {
        return D.historyPage.total; // 分页模式下不统计单类，删除确认文案用总条数提示即可
    }

    /* ---- 下拉填充 ---- */
    function fillCatSelect(sel, selected, opts) {
        opts = opts || {};
        sel.innerHTML = '';
        if (opts.withAll) {
            const o = document.createElement('option');
            o.value = '';
            o.textContent = opts.allLabel || '全部大类';
            sel.appendChild(o);
        } else if (opts.withNone !== false) {
            const o = document.createElement('option');
            o.value = '';
            o.textContent = opts.noneLabel || '未选择大类';
            sel.appendChild(o);
        }
        D.categories.forEach(c => {
            const o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.name;
            sel.appendChild(o);
        });
        sel.value = selected || '';
    }

    function fillSubSelect(sel, catId, selected, opts) {
        opts = opts || {};
        sel.innerHTML = '';
        const cat = findCat(catId);
        if (opts.withAll) {
            const o = document.createElement('option');
            o.value = '';
            o.textContent = opts.allLabel || '全部小类';
            sel.appendChild(o);
        } else if (opts.withNone !== false) {
            const o = document.createElement('option');
            o.value = '';
            o.textContent = opts.noneLabel || '未选择小类';
            sel.appendChild(o);
        }
        (cat ? cat.subs : []).forEach(s => {
            const o = document.createElement('option');
            o.value = s.id;
            o.textContent = s.name;
            sel.appendChild(o);
        });
        sel.disabled = !cat || !cat.subs.length;
        sel.value = selected || '';
    }

    /* ============================================================
     * 计时视图：刷题类型选择（记忆上次选择，存本地偏好）
     * ============================================================ */
    function loadLastSel() {
        const o = PQ.store.loadJSON(PQ.store.KEYS.lastCat, {});
        return (o && typeof o === 'object') ? { catId: o.catId || '', subId: o.subId || '' } : { catId: '', subId: '' };
    }
    function saveLastSel(catId, subId) {
        PQ.store.saveJSON(PQ.store.KEYS.lastCat, { catId: catId || '', subId: subId || '' });
    }

    function renderCatSelects() {
        const last = loadLastSel();
        const catExists = !!findCat(last.catId);
        fillCatSelect(catSelect, catExists ? last.catId : '', { withNone: true, noneLabel: '未选择大类' });
        const curCat = catExists ? last.catId : '';
        const subExists = curCat ? !!findSub(curCat, last.subId) : false;
        fillSubSelect(subSelect, curCat, subExists ? last.subId : '', { withNone: true, noneLabel: '未选择小类' });
    }

    function onCatSelectChange() {
        const catId = catSelect.value;
        fillSubSelect(subSelect, catId, '', { withNone: true, noneLabel: '未选择小类' });
        saveLastSel(catId, '');
    }

    catSelect.addEventListener('change', onCatSelectChange);
    subSelect.addEventListener('change', () => {
        saveLastSel(catSelect.value, subSelect.value);
    });

    /* 当前轮次的分类（归档时调用，写名称快照） */
    function getRoundCat() {
        const cat = findCat(catSelect.value);
        const sub = cat ? findSub(cat.id, subSelect.value) : null;
        return {
            catId: cat ? cat.id : '',
            catName: cat ? cat.name : '',
            subId: sub ? sub.id : '',
            subName: sub ? sub.name : ''
        };
    }

    function refreshRoundCat() {
        renderCatSelects();
    }

    /* ============================================================
     * 分类管理页
     * ============================================================ */
    function renderManager() {
        catManager.innerHTML = '';
        if (!D.categories.length) {
            const empty = document.createElement('div');
            empty.className = 'cat-empty';
            empty.textContent = '暂无分类，点击右上角「+ 添加大类」创建';
            catManager.appendChild(empty);
            return;
        }

        D.categories.forEach(cat => {
            const group = document.createElement('div');
            group.className = 'cat-group';
            group.dataset.id = cat.id;

            const head = document.createElement('div');
            head.className = 'cat-group-head';
            const badge = cat.builtin
                ? '<span class="cat-badge builtin">内置</span>'
                : '<span class="cat-badge custom">自定义</span>';
            const nameEl = document.createElement('span');
            nameEl.className = 'cat-name';
            nameEl.textContent = cat.name;
            nameEl.title = cat.name;
            const actions = document.createElement('div');
            actions.className = 'cat-group-actions';
            actions.innerHTML = `
                <button class="cat-btn add-sub" title="添加小类">+ 小类</button>
                <button class="cat-btn rename" title="重命名大类">重命名</button>
                <button class="cat-btn del" title="删除大类">删除</button>
            `;
            head.appendChild(nameEl);
            head.insertAdjacentHTML('beforeend', badge);
            head.appendChild(actions);
            group.appendChild(head);

            const subs = document.createElement('div');
            subs.className = 'cat-subs';
            (cat.subs || []).forEach(s => {
                const chip = document.createElement('span');
                chip.className = 'cat-chip';
                const nm = document.createElement('span');
                nm.className = 'chip-name';
                nm.textContent = s.name;
                nm.title = '点击重命名';
                const x = document.createElement('button');
                x.className = 'chip-del';
                x.textContent = '×';
                x.title = '删除该小类';
                chip.appendChild(nm);
                chip.appendChild(x);
                nm.addEventListener('click', () => renameSub(cat, s));
                x.addEventListener('click', () => delSub(cat, s));
                subs.appendChild(chip);
            });
            if (!cat.subs || !cat.subs.length) {
                const tip = document.createElement('span');
                tip.className = 'cat-no-sub';
                tip.textContent = '暂无小类';
                subs.appendChild(tip);
            }
            group.appendChild(subs);

            actions.querySelector('.add-sub').addEventListener('click', () => addSub(cat));
            actions.querySelector('.rename').addEventListener('click', () => renameCat(cat));
            actions.querySelector('.del').addEventListener('click', () => delCat(cat));

            catManager.appendChild(group);
        });
    }

    async function addCategory() {
        const name = prompt('输入新大类名称：');
        if (name === null) return;
        const t = name.trim();
        if (!t) { U.showToast('名称不能为空'); return; }
        if (D.categories.some(c => c.name === t)) { U.showToast('已存在同名大类'); return; }
        try {
            const r = await A.post('/api/categories', { name: t });
            D.categories.push({ id: r.id, name: t, builtin: false, subs: [] });
            renderManager();
            refreshRoundCat();
            U.showToast(`已添加大类「${t}」`);
        } catch (e) { U.showToast(e.message); }
    }

    async function renameCat(cat) {
        const name = prompt('输入新名称：', cat.name);
        if (name === null) return;
        const t = name.trim();
        if (!t) { U.showToast('名称不能为空'); return; }
        if (D.categories.some(c => c.id !== cat.id && c.name === t)) { U.showToast('已存在同名大类'); return; }
        try {
            await A.put('/api/categories/' + cat.id, { name: t });
            cat.name = t;
            renderManager();
            refreshRoundCat();
            U.showToast(`已重命名为「${t}」`);
        } catch (e) { U.showToast(e.message); }
    }

    async function delCat(cat) {
        const cnt = historyCountOfCat(cat.id);
        const tip = cnt > 0 ? `当前共 ${cnt} 条历史记录（记录不会丢失，仍会保留原分类名显示）。` : '';
        if (!confirm(`确定删除分类「${cat.name}」吗？${tip}删除后无法恢复该分类的选项。`)) return;
        try {
            await A.del('/api/categories/' + cat.id);
            const idx = D.categories.indexOf(cat);
            if (idx >= 0) D.categories.splice(idx, 1);
            renderManager();
            refreshRoundCat();
            U.showToast(`已删除分类「${cat.name}」`);
        } catch (e) { U.showToast(e.message); }
    }

    async function addSub(cat) {
        const name = prompt(`为「${cat.name}」添加小类：`);
        if (name === null) return;
        const t = name.trim();
        if (!t) { U.showToast('名称不能为空'); return; }
        if ((cat.subs || []).some(s => s.name === t)) { U.showToast('已存在同名小类'); return; }
        try {
            const r = await A.post('/api/categories/' + cat.id + '/subs', { name: t });
            if (!Array.isArray(cat.subs)) cat.subs = [];
            cat.subs.push({ id: r.id, name: t });
            renderManager();
            refreshRoundCat();
            U.showToast(`已添加小类「${t}」`);
        } catch (e) { U.showToast(e.message); }
    }

    async function renameSub(cat, sub) {
        const name = prompt('输入新名称：', sub.name);
        if (name === null) return;
        const t = name.trim();
        if (!t) { U.showToast('名称不能为空'); return; }
        if ((cat.subs || []).some(s => s.id !== sub.id && s.name === t)) { U.showToast('已存在同名小类'); return; }
        try {
            await A.put('/api/categories/' + cat.id + '/subs/' + sub.id, { name: t });
            sub.name = t;
            renderManager();
            refreshRoundCat();
            U.showToast(`已重命名为「${t}」`);
        } catch (e) { U.showToast(e.message); }
    }

    async function delSub(cat, sub) {
        if (!confirm(`确定删除小类「${sub.name}」吗？已有历史记录不受影响。`)) return;
        try {
            await A.del('/api/categories/' + cat.id + '/subs/' + sub.id);
            const idx = (cat.subs || []).indexOf(sub);
            if (idx >= 0) cat.subs.splice(idx, 1);
            renderManager();
            refreshRoundCat();
            U.showToast(`已删除小类「${sub.name}」`);
        } catch (e) { U.showToast(e.message); }
    }

    async function restoreBuiltin() {
        try {
            const r = await A.post('/api/categories/restore');
            await D.loadCategories();
            renderManager();
            refreshRoundCat();
            U.showToast(r.added > 0 ? `已恢复 ${r.added} 个内置分类` : '内置分类都已存在');
        } catch (e) { U.showToast(e.message); }
    }

    if (addCatBtn) addCatBtn.addEventListener('click', addCategory);
    if (restoreCatBtn) restoreCatBtn.addEventListener('click', restoreBuiltin);

    /* ============================================================
     * 分类编辑弹窗（供收藏改分类、历史改分类等场景复用）
     * ============================================================ */
    const catModalMask = document.getElementById('catModalMask');
    const catModalCatSelect = document.getElementById('catModalCatSelect');
    const catModalSubSelect = document.getElementById('catModalSubSelect');
    const catModalCancel = document.getElementById('catModalCancel');
    const catModalSave = document.getElementById('catModalSave');
    let catEditorCallback = null;

    function openCatEditor(initial, onConfirm) {
        catEditorCallback = typeof onConfirm === 'function' ? onConfirm : null;
        const init = initial || {};
        const catId = findCat(init.catId) ? init.catId : '';
        fillCatSelect(catModalCatSelect, catId, { withNone: true, noneLabel: '未分类' });
        const subOk = catId && findSub(catId, init.subId);
        fillSubSelect(catModalSubSelect, catId, subOk ? init.subId : '', { withNone: true, noneLabel: '未分类' });
        catModalMask.style.display = 'flex';
    }

    function closeCatEditor() {
        catModalMask.style.display = 'none';
        catEditorCallback = null;
    }

    catModalCatSelect.addEventListener('change', () => {
        fillSubSelect(catModalSubSelect, catModalCatSelect.value, '', { withNone: true, noneLabel: '未分类' });
    });

    catModalCancel.addEventListener('click', closeCatEditor);

    catModalSave.addEventListener('click', () => {
        const cat = findCat(catModalCatSelect.value);
        const sub = cat ? findSub(cat.id, catModalSubSelect.value) : null;
        const result = {
            catId: cat ? cat.id : '',
            catName: cat ? cat.name : '',
            subId: sub ? sub.id : '',
            subName: sub ? sub.name : ''
        };
        const cb = catEditorCallback;
        catEditorCallback = null;
        catModalMask.style.display = 'none';
        if (cb) cb(result);
    });

    /* ============================================================
     * 对外接口
     * ============================================================ */
    window.PQ = window.PQ || {};
    PQ.categories = {
        findCat, findSub, labelOf, hasCat, historyCountOfCat,
        fillCatSelect, fillSubSelect,
        renderCatSelects, refreshRoundCat, getRoundCat,
        renderManager,
        openCatEditor
    };
})();