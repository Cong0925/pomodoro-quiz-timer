/* ============================================================
 * PQ Timer - core/storage.js
 * 本地偏好存储（仅剩"上次选择的分类"等轻量偏好；
 * 业务数据全部存 MySQL，由 dataModel.js 通过 API 读写）
 * ============================================================ */
(function () {
    'use strict';

    const KEYS = {
        lastCat: 'pq_timer_last_cat_v1'   // 计时视图上次选择的 大类/小类
    };

    /* 读取 JSON，失败 / 空时返回 fallback */
    function loadJSON(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    /* 写入 JSON（静默失败） */
    function saveJSON(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { }
    }

    window.PQ = window.PQ || {};
    PQ.store = { KEYS, loadJSON, saveJSON };
})();
