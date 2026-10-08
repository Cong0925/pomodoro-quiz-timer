/* ============================================================
 * PQ Timer - modules/settings.js
 * 设置（MySQL 版）：本地化保存（JSON 导出/导入）、
 * 数据库信息、关于。导出/导入逻辑由 app.js 迁入。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;
    const A = PQ.api;

    /* ---- 元素引用 ---- */
    const viewSettings = document.getElementById('viewSettings');
    const settingsTabs = document.querySelectorAll('.settings-tab');
    const settingsPanels = {
        backup: document.getElementById('settingsPanelBackup'),
        db: document.getElementById('settingsPanelDb'),
        about: document.getElementById('settingsPanelAbout')
    };
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    const dbInfoGrid = document.getElementById('dbInfoGrid');

    /* ---- 小菜单切换 ---- */
    function switchSettingsTab(tab) {
        settingsTabs.forEach(t => t.classList.toggle('active', t.dataset.settingsTab === tab));
        Object.keys(settingsPanels).forEach(k => { settingsPanels[k].hidden = k !== tab; });
        if (tab === 'db') renderDbInfo();
    }

    settingsTabs.forEach(tab => {
        tab.addEventListener('click', () => switchSettingsTab(tab.dataset.settingsTab));
    });

    /* ---- 本地化保存：导出全部数据 ---- */
    exportDataBtn.addEventListener('click', async () => {
        try {
            U.showToast('正在导出全部数据…');
            const json = JSON.stringify(await D.exportJson(), null, 2);
            if (window.showSaveFilePicker) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: 'data.json',
                        types: [{ description: 'JSON 数据文件', accept: { 'application/json': ['.json'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(json);
                    await writable.close();
                    U.showToast('已保存到：' + handle.name);
                    return;
                } catch (e) {
                    if (e && e.name === 'AbortError') return;
                }
            }
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const d = new Date();
            a.href = url;
            a.download = 'data-' + d.getFullYear() + '-' + U.pad2(d.getMonth() + 1) + U.pad2(d.getDate()) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            U.showToast('已下载 JSON 文件');
        } catch (e) {
            U.showToast(e.message);
        }
    });

    importDataBtn.addEventListener('click', () => {
        importFileInput.click();
    });

    /* ---- 本地化保存：导入合并 ---- */
    importFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            U.showToast('正在导入数据…');
            const info = await D.importJson(data);
            if (PQ.app) PQ.app.updateBadges();
            // 刷新各视图
            const v = { timer: document.getElementById('viewTimer'), history: document.getElementById('viewHistory'), favorites: document.getElementById('viewFavorites'), stats: document.getElementById('viewStats'), calendar: document.getElementById('viewCalendar'), categories: document.getElementById('viewCategories') };
            if (!v.timer.hidden) PQ.categories.refreshRoundCat();
            if (!v.history.hidden) { PQ.history.renderFilter(); PQ.history.renderHistory(); }
            if (!v.favorites.hidden) { PQ.favorites.renderFilter(); PQ.favorites.renderFavs(); }
            if (!v.stats.hidden) PQ.stats.renderStats();
            if (!v.calendar.hidden) PQ.calendar.renderCalendar();
            if (!v.categories.hidden) PQ.categories.renderManager();
            if (!viewSettings.hidden) renderSettings();
            U.showToast('已导入：' + info.h + ' 条历史、' + info.f + ' 条收藏' + (info.hasCats ? '、分类' : '') + (info.hasStudy ? '、学习时长' : '') + (info.hasMemos ? '、日历备忘' : ''));
        } catch (err) {
            U.showToast('导入失败：' + err.message);
        }
        e.target.value = '';
    });

    /* ---- 数据库信息 ---- */
    async function renderDbInfo() {
        dbInfoGrid.innerHTML = '<div class="db-info-loading">正在读取…</div>';
        try {
            const info = await A.get('/api/info');
            const fmtMs = U.formatDuration(Number(info.studyMs));
            const items = [
                { label: '数据库名', value: info.dbName },
                { label: '数据库地址', value: info.host },
                { label: '分类（大类 / 小类）', value: info.categories + ' / ' + info.categorySubs },
                { label: '历史轮次', value: info.rounds + ' 轮' },
                { label: '题目明细', value: info.records + ' 题' },
                { label: '错题收藏', value: info.favorites + ' 条' },
                { label: '日历备忘', value: info.memos + ' 条' },
                { label: '学习时长', value: info.studyDays + ' 天，共 ' + fmtMs }
            ];
            dbInfoGrid.innerHTML = '';
            items.forEach(it => {
                const cell = document.createElement('div');
                cell.className = 'db-info-item';
                cell.innerHTML = '<span class="db-info-label">' + it.label + '</span><span class="db-info-value">' + U.escapeHtml(String(it.value)) + '</span>';
                dbInfoGrid.appendChild(cell);
            });
        } catch (e) {
            dbInfoGrid.innerHTML = '<div class="db-info-loading">读取失败：' + U.escapeHtml(e.message) + '</div>';
        }
    }

    /* ---- 进入设置视图 ---- */
    function renderSettings() {
        // 保持当前选中的小菜单，若无则默认「本地化保存」
        const active = document.querySelector('.settings-tab.active');
        const tab = active ? active.dataset.settingsTab : 'backup';
        switchSettingsTab(tab);
    }

    window.PQ = window.PQ || {};
    PQ.settings = { renderSettings, switchSettingsTab };
})();