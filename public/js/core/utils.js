/* ============================================================
 * PQ Timer - core/utils.js
 * 通用工具函数（无业务状态，showToast 仅依赖 toast 元素）
 * ============================================================ */
(function () {
    'use strict';

    const toastWrap = document.getElementById('toast-wrap');
    const TOAST_ICONS = {
        success: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>',
        warning: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        error: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    /* 消息提示：仿 Element Plus Message，顶部居中、多条堆叠、3 秒自动消失 */
    function showToast(msg, type) {
        if (!toastWrap) return;
        type = type || 'info';
        const item = document.createElement('div');
        item.className = 'pq-toast pq-toast--' + type;
        item.innerHTML = '<span class="pq-toast-icon">' + (TOAST_ICONS[type] || TOAST_ICONS.info) + '</span><span class="pq-toast-msg">' + msg + '</span>';
        toastWrap.appendChild(item);
        requestAnimationFrame(() => item.classList.add('in'));
        const close = () => {
            if (item.classList.contains('out')) return;
            item.classList.remove('in');
            item.classList.add('out');
            setTimeout(() => item.remove(), 280);
        };
        const timer = setTimeout(close, 3000);
        item.addEventListener('click', () => { clearTimeout(timer); close(); });
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
