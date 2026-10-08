/* ============================================================
 * PQ Timer - core/utils.js
 * 通用工具函数（无业务状态，showToast 仅依赖 toast 元素）
 * ============================================================ */
(function () {
    'use strict';

    const toastEl = document.getElementById('toast');
    let toastTimer = null;

    function showToast(msg) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
    }

    /* mm:ss.xx */
    function formatTime(ms) {
        const totalSec = ms / 1000;
        const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const seconds = (totalSec % 60).toFixed(2).padStart(5, '0');
        return `${minutes}:${seconds}`;
    }

    /* YYYY-MM-DD HH:mm:ss */
    function formatDate(ts) {
        const d = new Date(ts);
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function pad2(n) { return String(n).padStart(2, '0'); }

    /* 日期键 YYYY-MM-DD */
    function todayKey(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

    /* "YYYY-MM-DD HH:mm:ss" -> Date（本地时区） */
    function parseDateStr(s) {
        const parts = String(s).split(' ');
        if (parts.length < 2) return new Date(NaN);
        const d = parts[0].split('-').map(Number);
        const t = parts[1].split(':').map(Number);
        return new Date(d[0], d[1] - 1, d[2], t[0] || 0, t[1] || 0, t[2] || 0);
    }

    /* 某日期所在周的周一（周一为一周开始） */
    function mondayOf(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
        d.setDate(d.getDate() + diff);
        return d;
    }

    /* 时长显示：分钟 / X小时Y分 */
    function formatDuration(ms) {
        const totalMin = Math.round(ms / 60000);
        if (totalMin < 1) return '不足 1 分钟';
        if (totalMin < 60) return totalMin + ' 分钟';
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        return m === 0 ? h + ' 小时' : h + ' 小时 ' + m + ' 分';
    }

    /* 备忘标题规范化：限 4 字（字符计数） */
    function normCalTitle(s) {
        const t = String(s || '').trim();
        return Array.from(t).slice(0, 4).join('');
    }

    /* 简易唯一 id（自定义分类 / 小类使用） */
    function uid(prefix) {
        return (prefix || 'c') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    window.PQ = window.PQ || {};
    PQ.utils = {
        showToast, formatTime, formatDate, escapeHtml, pad2, todayKey,
        parseDateStr, mondayOf, formatDuration, normCalTitle, uid
    };
})();
