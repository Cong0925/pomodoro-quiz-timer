/* ============================================================
 * PQ Timer - app.js（入口，MySQL 版）
 * 应用入口：异步初始化（从后端加载数据）、视图切换、菜单、
 * 数据文件导入 / 导出（调 API）。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;

    /* ---- 元素引用 ---- */
    const viewTimer = document.getElementById('viewTimer');
    const viewHistory = document.getElementById('viewHistory');
    const viewFavorites = document.getElementById('viewFavorites');
    const viewStats = document.getElementById('viewStats');
    const viewCalendar = document.getElementById('viewCalendar');
    const viewPractice = document.getElementById('viewPractice');
    const viewMental = document.getElementById('viewMental');
    const viewCategories = document.getElementById('viewCategories');
    const viewSettings = document.getElementById('viewSettings');
    const historyBadge = document.getElementById('historyBadge');
    const favBadge = document.getElementById('favBadge');
    const menuItems = document.querySelectorAll('.menu-item');
    const dataFileStatus = document.getElementById('dataFileStatus');

    /* ---- 徽标（总数来自后端分页 total） ---- */
    function updateBadges() {
        historyBadge.textContent = D.historyPage.total;
        historyBadge.hidden = D.historyPage.total === 0;
        favBadge.textContent = D.favPage.total;
        favBadge.hidden = D.favPage.total === 0;
    }

    function updateDataFileUI() {
        dataFileStatus.textContent = '存储：MySQL 数据库';
    }

    /* ---- 菜单高亮 / 视图切换 ---- */
    function setMenuActive(view, mode) {
        menuItems.forEach(item => {
            let active = false;
            if (view === 'timer') {
                active = item.dataset.view === 'timer' && item.dataset.mode === mode;
            } else {
                active = item.dataset.view === view;
            }
            item.classList.toggle('active', active);
        });
    }

    function switchView(view) {
        viewTimer.hidden = view !== 'timer';
        viewHistory.hidden = view !== 'history';
        viewFavorites.hidden = view !== 'favorites';
        viewStats.hidden = view !== 'stats';
        viewCalendar.hidden = view !== 'calendar';
        viewPractice.hidden = view !== 'practice';
        viewMental.hidden = view !== 'mental';
        viewCategories.hidden = view !== 'categories';
        viewSettings.hidden = view !== 'settings';
        setMenuActive(view, PQ.timer.workMode);
        if (view === 'history') { PQ.history.renderFilter(); PQ.history.renderHistory(); }
        if (view === 'favorites') { PQ.favorites.renderFilter(); PQ.favorites.renderFavs(); }
        if (view === 'stats') PQ.stats.renderStats();
        if (view === 'calendar') PQ.calendar.renderCalendar();
        if (view === 'practice') PQ.practice.enter();
        if (view === 'mental') PQ.mental.enter();
        if (view === 'categories') PQ.categories.renderManager();
        if (view === 'settings') PQ.settings.renderSettings();
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            const mode = item.dataset.mode;
            if (view === 'timer') {
                // 切模式前先归档当前轮（有记录且未归档时）
                if (PQ.timer.workMode !== mode && PQ.timer.roundRecords.length > 0 && !PQ.timer.archived) {
                    PQ.timer.archiveCurrentRound();
                    U.showToast('本轮已存入历史记录');
                }
                if (PQ.timer.workMode !== mode) {
                    PQ.timer.resetTimer();
                    PQ.timer.applyMode(mode);
                    PQ.timer.newRound();
                }
                switchView('timer');
            } else {
                switchView(view);
            }
        });
    });

    /* ---- 初始化（异步加载后端数据） ---- */
    async function init() {
        try {
            await D.loadCategories();
            await D.loadHistoryPage({ page: 1, limit: 20 });
            await D.loadFavPage({ page: 1, limit: 20 });
            await D.loadTodayBase();
            D.startSession();
            /* 3 秒后校准今日基数：吸收关闭旧页面时 sendBeacon 延迟到账的时长 */
            setTimeout(() => { D.loadTodayBase(); }, 3000);
            PQ.timer.applyMode('single');
            PQ.timer.newRound();
            PQ.categories.renderCatSelects();
            PQ.calendar.initCalendar();
            updateBadges();
            updateDataFileUI();
        } catch (e) {
            dataFileStatus.textContent = '连接后端失败：' + e.message + '（请双击「启动.bat」启动服务）';
            U.showToast('连接后端失败：' + e.message);
        }
    }

    init();

    /* 暴露给其他模块的入口级工具 */
    PQ.app = { updateBadges, switchView };
})();