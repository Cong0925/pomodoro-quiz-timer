/* ============================================================
 * PQ Timer - core/dataModel.js
 * 数据层（MySQL 版）：全部业务数据通过 API 与后端交互。
 *
 * 内存模型：
 *   - categories  分类全量内存（数据量小，加载一次）
 *   - historyPage 历史分页状态（list/total/page），只保留当前已加载页
 *   - favPage     收藏分页状态
 *   - calMemos    备忘按需加载，按月缓存
 *   - 统计        直接请求 /api/stats，不驻留内存
 *
 * 学习时长：打开页面开始计时，每 60s 上报一次增量，
 * 关闭页面用 sendBeacon 上报剩余，保证不丢。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const A = PQ.api;

    /* ---- 备忘类型（与后端一致） ---- */
    const CAL_TYPES = {
        exam:     { label: '考试', color: '#b91c1c', bg: '#fee2e2' },
        meeting:  { label: '会议', color: '#1d4ed8', bg: '#dbeafe' },
        study:    { label: '学习', color: '#15803d', bg: '#dcfce7' },
        sport:    { label: '运动', color: '#c2410c', bg: '#ffedd5' },
        birthday: { label: '生日', color: '#be185d', bg: '#fce7f3' },
        travel:   { label: '旅行', color: '#0e7490', bg: '#cffafe' },
        other:    { label: '其他', color: '#4b5563', bg: '#f3f4f6' }
    };

    /* ==================== 分类 ==================== */
    let categories = [];

    async function loadCategories() {
        categories = await A.get('/api/categories');
        return categories;
    }

    /* ==================== 历史（分页） ==================== */
    let historyPage = { list: [], total: 0, page: 0, limit: 20, totalPages: 1, filter: {} };

    async function loadHistoryPage(opts) {
        opts = opts || {};
        const params = new URLSearchParams();
        const filter = { mode: opts.mode || '', catId: opts.catId || '', subId: opts.subId || '' };
        if (filter.mode) params.set('mode', filter.mode);
        if (filter.catId) params.set('catId', filter.catId);
        if (filter.subId) params.set('subId', filter.subId);
        const page = opts.page || 1;
        const limit = opts.limit || 20;
        const append = !!opts.append;
        params.set('page', page);
        params.set('limit', limit);
        const data = await A.get('/api/history?' + params.toString());
        historyPage = {
            list: (append && historyPage.page === data.page - 1) ? [...historyPage.list, ...data.list] : data.list,
            total: data.total,
            page: data.page,
            limit: data.limit,
            totalPages: data.totalPages,
            filter
        };
        return historyPage;
    }

    /* 归档一轮：POST 成功后刷新第一页（新记录在最前），徽标同步 */
    async function addHistory(roundObj) {
        const r = await A.post('/api/history', roundObj);
        await loadHistoryPage({ mode: historyPage.filter.mode, catId: historyPage.filter.catId, subId: historyPage.filter.subId, page: 1, limit: historyPage.limit });
        return r;
    }

    async function updateHistory(id, patch) {
        await A.put('/api/history/' + id, patch);
    }

    /* 更新单题知识点描述 */
    async function updateRecordNote(roundId, no, note) {
        await A.put('/api/history/' + roundId + '/record/' + no, { note });
    }

    async function deleteHistory(id) {
        await A.del('/api/history/' + id);
        let page = historyPage.page;
        if (historyPage.list.length === 1 && page > 1) page--;
        await loadHistoryPage({ ...historyPage.filter, page, limit: historyPage.limit });
    }

    async function clearHistory() {
        await A.del('/api/history');
        await loadHistoryPage({ ...historyPage.filter, page: 1, limit: historyPage.limit });
    }

    /* ==================== 收藏（分页） ==================== */
    let favPage = { list: [], total: 0, page: 0, limit: 20, totalPages: 1, filter: {} };

    async function loadFavPage(opts) {
        opts = opts || {};
        const params = new URLSearchParams();
        const filter = { mode: opts.mode || '', catId: opts.catId || '', subId: opts.subId || '' };
        if (filter.mode) params.set('mode', filter.mode);
        if (filter.catId) params.set('catId', filter.catId);
        if (filter.subId) params.set('subId', filter.subId);
        const page = opts.page || 1;
        const limit = opts.limit || 20;
        const append = !!opts.append;
        params.set('page', page);
        params.set('limit', limit);
        const data = await A.get('/api/favorites?' + params.toString());
        favPage = {
            list: (append && favPage.page === data.page - 1) ? [...favPage.list, ...data.list] : data.list,
            total: data.total,
            page: data.page,
            limit: data.limit,
            totalPages: data.totalPages,
            filter
        };
        return favPage;
    }

    async function addFavorite(obj) {
        const r = await A.post('/api/favorites', obj);
        await loadFavPage({ ...favPage.filter, page: 1, limit: favPage.limit });
        return r;
    }

    async function deleteFavorite(id) {
        await A.del('/api/favorites/' + id);
        let page = favPage.page;
        if (favPage.list.length === 1 && page > 1) page--;
        await loadFavPage({ ...favPage.filter, page, limit: favPage.limit });
    }

    async function updateFavorite(id, patch) {
        await A.put('/api/favorites/' + id, patch);
        await loadFavPage({ ...favPage.filter, page: favPage.page, limit: favPage.limit });
    }

    async function clearFavs() {
        await A.del('/api/favorites');
        await loadFavPage({ ...favPage.filter, page: 1, limit: favPage.limit });
    }

    /* ==================== 日历备忘（按月缓存） ==================== */
    let calMemos = {};
    let loadedMonths = {};

    async function loadMemos(month) {
        const list = await A.get('/api/memos?month=' + month);
        const map = {};
        list.forEach(m => { map[m.date] = { type: m.type, title: m.title, text: m.content || '' }; });
        calMemos = { ...calMemos, ...map };
        loadedMonths[month] = true;
        return calMemos;
    }

    async function saveMemo(date, obj) {
        await A.put('/api/memos/' + date, obj);
        if (obj && obj.content) calMemos[date] = { type: obj.type, title: obj.title, text: obj.content };
        else delete calMemos[date];
    }

    async function deleteMemo(date) {
        await A.del('/api/memos/' + date);
        delete calMemos[date];
    }

    /* ==================== 统计 ==================== */
    async function loadStats(gran) {
        return A.get('/api/stats?gran=' + (gran || 'day'));
    }

    /* ==================== 学习时长上报（悬浮窗受控计时） ====================
       学习时长默认打开页面即自动计时（时间只多不少），
       右下角悬浮窗可随时暂停 / 恢复：
       - 打开页面：自动开始计时，每 60s 上报一次增量
       - 点击暂停：立即把已计部分上报并停止
       - 点击恢复：继续计时
       - 关闭页面：仅上报计时中未上报的部分（sendBeacon） */
    let studyRunning = false;      // 是否正在计时（用户控制）
    let lastTick = null;           // 当前连续计时段的起点
    let sessionStudyMs = 0;        // 本次页面运行已上报的累计时长（毫秒）
    let todayBaseMs = 0;           // 今日已入库时长基数（页面加载时读取，不含本次会话）
    let reportTimer = null;

    function todayKeyStr() {
        return U.todayKey(new Date());
    }

    function reportStudy(addMs) {
        if (!addMs || addMs <= 0) return;
        sessionStudyMs += addMs;
        A.post('/api/study-daily', { date: todayKeyStr(), addMs }).catch(() => { });
    }

    /* ---- 单实例计时锁 ----
       防止多个页面同时自动计时导致时长重复累计（多开/刷新时数据库被叠加）。
       谁最后打开页面谁接管计时权；旧页面收到抢占事件后自动暂停并上报已计部分，
       保证任意时刻只有一个页面在计时，时长按真实时间连续累计。 */
    const OWNER_KEY = 'pq_study_owner';
    const HEARTBEAT_MS = 30000;
    let myToken = null;
    let heartbeatTimer = null;

    function claimOwner() {
        myToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(OWNER_KEY, JSON.stringify({ token: myToken, at: Date.now() }));
        clearInterval(heartbeatTimer);
        heartbeatTimer = setInterval(() => {
            if (myToken) {
                localStorage.setItem(OWNER_KEY, JSON.stringify({ token: myToken, at: Date.now() }));
            }
        }, HEARTBEAT_MS);
    }

    function releaseOwner() {
        clearInterval(heartbeatTimer);
        try {
            const raw = localStorage.getItem(OWNER_KEY);
            if (raw) {
                const o = JSON.parse(raw);
                if (o && o.token === myToken) localStorage.removeItem(OWNER_KEY);
            }
        } catch (e) { /* 忽略 */ }
        myToken = null;
    }

    /* 其他页面抢占了计时权 → 本页立即暂停并上报已计部分 */
    window.addEventListener('storage', (e) => {
        if (e.key === OWNER_KEY && e.newValue) {
            try {
                const o = JSON.parse(e.newValue);
                if (o && o.token !== myToken && studyRunning) {
                    pauseStudy();
                }
            } catch (err) { /* 忽略 */ }
        }
    });

    window.addEventListener('pagehide', releaseOwner);

    /* 启动受控计时器：默认自动开始计时（保证学习时长只多不少），
       抢占单实例计时权；用户仍可通过悬浮窗随时暂停 / 恢复 */
    function startSession() {
        claimOwner();
        studyRunning = true;
        lastTick = Date.now();
        clearInterval(reportTimer);
        reportTimer = setInterval(() => {
            if (studyRunning && lastTick) {
                const now = Date.now();
                reportStudy(now - lastTick);
                lastTick = now;
            }
        }, 60000);
    }

    /* 悬浮窗：开始学习计时（重新抢占计时权） */
    function startStudy() {
        if (studyRunning) return;
        claimOwner();
        studyRunning = true;
        lastTick = Date.now();
    }

    /* 悬浮窗：暂停学习计时（立即上报已计部分，并释放计时权） */
    function pauseStudy() {
        if (!studyRunning) return;
        const now = Date.now();
        if (lastTick) reportStudy(now - lastTick);
        studyRunning = false;
        lastTick = null;
        releaseOwner();
    }

    /* 页面关闭：仅上报计时中未上报的部分（sendBeacon 可靠送达） */
    function beaconReport() {
        if (!studyRunning || !lastTick) return;
        const addMs = Date.now() - lastTick;
        if (addMs <= 0) return;
        try {
            navigator.sendBeacon('/api/study-daily',
                new Blob([JSON.stringify({ date: todayKeyStr(), addMs })], { type: 'application/json' }));
        } catch (e) { /* 忽略 */ }
    }

    /* 本次会话尚未上报的时长（仅计时中有效，暂停时为 0） */
    function pendingStudyMs() {
        if (studyRunning && lastTick) return Date.now() - lastTick;
        return 0;
    }

    /* 本次页面运行已计学习时长（已上报 + 未上报） */
    function sessionStudyMsTotal() {
        return sessionStudyMs + pendingStudyMs();
    }

    /* 页面加载时读取今日已入库时长作为基数（与统计面板同源） */
    async function loadTodayBase() {
        try {
            const r = await A.get('/api/stats?gran=day');
            todayBaseMs = (r && r.today) ? Number(r.today.studyMs) : 0;
        } catch (e) {
            todayBaseMs = 0;
        }
    }

    /* 今日总学习时长（悬浮窗显示用，与统计面板完全同步）：
       今日已入库基数 + 本次会话已上报 + 尚未上报 */
    function todayStudyTotal() {
        return todayBaseMs + sessionStudyMs + pendingStudyMs();
    }

    /* ==================== 导入导出 ==================== */
    async function exportJson() {
        return A.get('/api/export');
    }

    async function importJson(obj) {
        const info = await A.post('/api/import', obj);
        await reloadAll();
        return info;
    }

    /* 导入后全量刷新：分类 / 历史第一页 / 收藏第一页 / 当前月备忘 */
    async function reloadAll() {
        await loadCategories();
        await loadHistoryPage({ page: 1, limit: historyPage.limit });
        await loadFavPage({ page: 1, limit: favPage.limit });
        const now = new Date();
        const month = now.getFullYear() + '-' + U.pad2(now.getMonth() + 1);
        await loadMemos(month);
    }

    window.addEventListener('pagehide', beaconReport);

    /* ==================== 对外接口 ==================== */
    window.PQ = window.PQ || {};
    PQ.data = {
        CAL_TYPES,

        /* 分类（getter 保证读到最新引用） */
        get categories() { return categories; },
        loadCategories,

        /* 历史 */
        get historyPage() { return historyPage; },
        loadHistoryPage,
        addHistory,
        updateHistory,
        updateRecordNote,
        deleteHistory,
        clearHistory,

        /* 收藏 */
        get favPage() { return favPage; },
        loadFavPage,
        addFavorite,
        deleteFavorite,
        updateFavorite,
        clearFavs,

        /* 备忘 */
        get calMemos() { return calMemos; },
        loadMemos,
        saveMemo,
        deleteMemo,

        /* 统计 */
        loadStats,

        /* 学习时长（悬浮窗控制开始 / 暂停） */
        startSession,
        startStudy,
        pauseStudy,
        get studyRunning() { return studyRunning; },
        pendingStudyMs,
        sessionStudyMsTotal,
        loadTodayBase,
        todayStudyTotal,

        /* 导入导出 */
        exportJson,
        importJson,
        reloadAll
    };
})();