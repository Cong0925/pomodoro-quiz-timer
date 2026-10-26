/* ============================================================
 * PQ Timer - core/ui.js
 * 自建 UI 组件库（视觉仿 Element Plus）
 * 组件：showToast（消息提示）、confirm（确认弹框）
 * 后续新组件（alert / notification / dropdown 等）在此文件追加，
 * 对应样式统一写在 css/components.css
 * ============================================================ */
(function () {
    'use strict';

    const ICONS = {
        success: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>',
        warning: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        error: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        info: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
        question: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const UI = {

        /* ---- 消息提示：顶部居中、多条堆叠、3 秒自动消失、点击关闭 ---- */
        showToast(msg, type) {
            const wrap = document.getElementById('toast-wrap');
            if (!wrap) return;
            type = type || 'info';
            const item = document.createElement('div');
            item.className = 'pq-toast pq-toast--' + type;
            item.innerHTML = '<span class="pq-toast-icon">' + (ICONS[type] || ICONS.info) + '</span><span class="pq-toast-msg">' + esc(msg) + '</span>';
            wrap.appendChild(item);
            requestAnimationFrame(() => item.classList.add('in'));
            const close = () => {
                if (item.classList.contains('out')) return;
                item.classList.remove('in');
                item.classList.add('out');
                setTimeout(() => item.remove(), 280);
            };
            const timer = setTimeout(close, 3000);
            item.addEventListener('click', () => { clearTimeout(timer); close(); });
        },

        /* ---- 确认弹框：仿 Element MessageBox，resolve(true/false) ---- */
        confirm(options) {
            const o = Object.assign({
                title: '提示',
                message: '',
                confirmText: '确定',
                cancelText: '取消',
                danger: true
            }, options || {});
            return new Promise(resolve => {
                const mask = document.createElement('div');
                mask.className = 'pq-confirm-mask';
                mask.innerHTML =
                    '<div class="pq-confirm" role="dialog">' +
                    '<button class="pq-confirm-close" aria-label="关闭">' + ICONS.error.replace('width="16"', 'width="12"').replace('height="16"', 'height="12"') + '</button>' +
                    '<div class="pq-confirm-head"><span class="pq-confirm-icon ' + (o.danger ? 'danger' : 'normal') + '">' + ICONS.question + '</span><span class="pq-confirm-title">' + esc(o.title) + '</span></div>' +
                    '<div class="pq-confirm-body">' + esc(o.message) + '</div>' +
                    '<div class="pq-confirm-ftr">' +
                    '<button class="pq-btn-cancel">' + esc(o.cancelText) + '</button>' +
                    '<button class="pq-btn-ok ' + (o.danger ? 'danger' : 'primary') + '">' + esc(o.confirmText) + '</button>' +
                    '</div></div>';
                document.body.appendChild(mask);
                requestAnimationFrame(() => mask.classList.add('in'));
                let done = false;
                const close = val => {
                    if (done) return;
                    done = true;
                    mask.classList.remove('in');
                    mask.classList.add('out');
                    setTimeout(() => mask.remove(), 220);
                    document.removeEventListener('keydown', escKey);
                    resolve(val);
                };
                const escKey = e => { if (e.key === 'Escape') close(false); };
                mask.querySelector('.pq-confirm-close').addEventListener('click', () => close(false));
                mask.querySelector('.pq-btn-cancel').addEventListener('click', () => close(false));
                mask.querySelector('.pq-btn-ok').addEventListener('click', () => close(true));
                mask.addEventListener('click', e => { if (e.target === mask) close(false); });
                document.addEventListener('keydown', escKey);
            });
        }
    };

    window.PQ = window.PQ || {};
    PQ.ui = UI;
})();
