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
        },

        /* ---- 标签（Element Tag 风格） ---- */
        /* tag({ text, type: primary/success/warning/danger/info, closable }) → HTML 字符串 */
        tag(o) {
            const type = o.type || 'primary';
            return '<span class="pq-tag pq-tag--' + type + '">' + esc(o.text) +
                (o.closable ? '<span class="pq-tag__close" data-pq-tag-close>' + ICONS.error.replace('width="16"', 'width="12"').replace('height="16"', 'height="12"') + '</span>' : '') +
                '</span>';
        },

        /* ---- 开关（Element Switch 风格） ---- */
        /* switch({ checked, disabled, onchange }) → 已绑定事件的元素 */
        switch(o) {
            const box = document.createElement('span');
            box.className = 'pq-switch' + (o.checked ? ' on' : '');
            box.setAttribute('role', 'switch');
            box.setAttribute('aria-checked', String(!!o.checked));
            if (o.disabled) box.setAttribute('disabled', '');
            box.addEventListener('click', () => {
                if (o.disabled) return;
                const on = !box.classList.contains('on');
                box.classList.toggle('on', on);
                box.setAttribute('aria-checked', String(on));
                if (typeof o.onchange === 'function') o.onchange(on);
            });
            return box;
        },

        /* ---- 可搜索下拉选择（Element Select filterable 风格） ---- */
        /* combobox({ host, value, options, counts, placeholder, onChange })
         * 行为：聚焦展开下拉并展示全部候选项；输入实时过滤（包含匹配）；
         * 点击候选项选中；允许直接输入自定义值（标签可自由命名）。
         * options：候选字符串数组；counts：可选 { 选项: 数量 }，用于右侧数量徽标。
         * 返回实例：{ getValue, setValue, setOptions, open, close, destroy } */
        combobox(o) {
            const host = o.host;
            if (!host) return null;
            let options = Array.isArray(o.options) ? o.options.slice() : [];
            let counts = o.counts || null;
            const onChange = typeof o.onChange === 'function' ? o.onChange : null;
            let hoverIndex = -1;
            let openFlag = false;

            host.classList.add('pq-combobox');
            host.innerHTML =
                '<input class="pq-combobox__input" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(o.placeholder || '') + '">' +
                '<span class="pq-combobox__suffix"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>' +
                '<div class="pq-combobox__dropdown" role="listbox"></div>';
            const input = host.querySelector('.pq-combobox__input');
            const dropdown = host.querySelector('.pq-combobox__dropdown');

            /* 渲染下拉（按输入关键字过滤；hits 为过滤后的选项数组） */
            function render(kw) {
                const q = String(kw || '').trim().toLowerCase();
                const hits = q
                    ? options.filter(x => String(x).toLowerCase().includes(q))
                    : options.slice();
                const cur = input.value.trim();
                if (!hits.length) {
                    dropdown.innerHTML = '<div class="pq-combobox__empty">无匹配数据</div>';
                    hoverIndex = -1;
                    return;
                }
                hoverIndex = hits.findIndex(x => String(x) === cur);
                dropdown.innerHTML = hits.map((x, i) =>
                    '<div class="pq-combobox__option' + (i === hoverIndex ? ' selected' : '') + '" role="option" data-i="' + i + '">' +
                    '<span>' + esc(String(x)) + '</span>' +
                    (counts && counts[x] != null ? '<i>' + counts[x] + '</i>' : '') +
                    '</div>').join('');
                dropdown.querySelectorAll('.pq-combobox__option').forEach(opt => {
                    opt.onmousemove = () => {
                        dropdown.querySelectorAll('.pq-combobox__option').forEach(x2 => x2.classList.remove('hover'));
                        opt.classList.add('hover');
                        hoverIndex = Number(opt.dataset.i);
                    };
                    opt.onmousedown = ev => ev.preventDefault(); // 防止 input 失焦导致先收起
                    opt.onclick = () => {
                        input.value = String(hits[Number(opt.dataset.i)]);
                        close();
                        if (onChange) onChange(input.value.trim());
                    };
                });
            }

            /* 下拉方向：下方空间不足且上方足够时向上展开 */
            function position() {
                const r = host.getBoundingClientRect();
                const ddH = 208;
                const below = window.innerHeight - r.bottom;
                const above = r.top;
                host.classList.toggle('pq-combobox--up', below < ddH + 8 && above > ddH + 8);
            }

            function open() {
                if (openFlag) return;
                openFlag = true;
                host.classList.add('open');
                position();
                render(); // 展开显示全部候选（当前值高亮），输入时才过滤
            }

            function close() {
                if (!openFlag) return;
                openFlag = false;
                host.classList.remove('open');
                hoverIndex = -1;
            }

            const onDocDown = ev => { if (openFlag && !host.contains(ev.target)) close(); };
            document.addEventListener('mousedown', onDocDown);

            input.addEventListener('focus', open);
            /* 选择候选后 input 仍保持焦点，再次点击不会触发 focus；补 click 使其可重新展开 */
            input.addEventListener('click', () => { if (!openFlag) open(); });
            input.addEventListener('input', () => { if (openFlag) render(input.value); });
            input.addEventListener('keydown', ev => {
                const opts = dropdown.querySelectorAll('.pq-combobox__option');
                if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
                    ev.preventDefault();
                    if (!openFlag) { open(); return; }
                    if (!opts.length) return;
                    const dir = ev.key === 'ArrowDown' ? 1 : -1;
                    hoverIndex = (hoverIndex < 0 ? (dir === 1 ? -1 : 0) : hoverIndex) + dir;
                    if (hoverIndex >= opts.length) hoverIndex = opts.length - 1;
                    if (hoverIndex < 0) hoverIndex = 0;
                    opts.forEach((x2, j) => x2.classList.toggle('hover', j === hoverIndex));
                    opts[hoverIndex].scrollIntoView({ block: 'nearest' });
                } else if (ev.key === 'Enter') {
                    if (openFlag) {
                        const hit = opts[hoverIndex];
                        if (hit) { hit.onclick(); }
                        else close();
                        ev.preventDefault();
                    }
                } else if (ev.key === 'Escape') {
                    if (openFlag) { close(); ev.preventDefault(); }
                } else if (ev.key === 'Tab') {
                    close();
                }
            });
            input.addEventListener('blur', close);

            /* 初始值 */
            if (o.value != null && o.value !== '') input.value = String(o.value);

            return {
                getValue() { return input.value; },
                setValue(v) { input.value = v == null ? '' : String(v); hoverIndex = -1; if (openFlag) render(); },
                setOptions(arr, cntMap) { options = (arr || []).slice(); counts = cntMap || null; if (openFlag) render(); },
                open,
                close,
                destroy() {
                    document.removeEventListener('mousedown', onDocDown);
                    host.innerHTML = '';
                    host.classList.remove('pq-combobox', 'open', 'pq-combobox--up');
                }
            };
        },

        /* ---- 分页条（Element Pagination 风格） ---- */
        /* pagination({ host, total, page, pageSize, sizes, onChange, onSizeChange }) */
        pagination(o) {
            const host = o.host;
            if (!host) return;
            const total = o.total || 0;
            const pageSize = o.pageSize || 10;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            const page = Math.min(Math.max(1, o.page || 1), totalPages);
            const sizes = o.sizes || [10, 20, 50, 100];
            host.style.display = total ? '' : 'none';
            host.innerHTML =
                '<span class="pq-pagination__total">共 ' + total + ' 道 · 第 ' + page + ' / ' + totalPages + ' 页</span>' +
                '<select class="pq-select pq-select--small pq-pagination__size">' +
                sizes.map(s => '<option value="' + s + '"' + (s === pageSize ? ' selected' : '') + '>' + s + ' 条/页</option>').join('') +
                '</select>' +
                '<button class="pq-btn pq-btn--small" data-dir="prev"' + (page <= 1 ? ' disabled' : '') + '>上一页</button>' +
                '<button class="pq-btn pq-btn--small" data-dir="next"' + (page >= totalPages ? ' disabled' : '') + '>下一页</button>';
            const sizeSel = host.querySelector('.pq-pagination__size');
            sizeSel.onchange = () => { if (typeof o.onSizeChange === 'function') o.onSizeChange(Number(sizeSel.value)); };
            host.querySelector('[data-dir="prev"]').onclick = () => { if (page > 1 && typeof o.onChange === 'function') o.onChange(page - 1); };
            host.querySelector('[data-dir="next"]').onclick = () => { if (page < totalPages && typeof o.onChange === 'function') o.onChange(page + 1); };
        },

        /* ---- 加载中 ---- */
        spinner(size) {
            const px = size || 18;
            return '<span class="pq-spinner" style="width:' + px + 'px;height:' + px + 'px;border-width:' + Math.max(2, Math.round(px / 9)) + 'px"></span>';
        },

        /* ---- 空状态（Element Empty 风格） ---- */
        empty(text) {
            return '<div class="pq-empty"><span class="pq-empty__icon">' +
                '<svg viewBox="0 0 64 41" width="60" height="40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M23.9 14.4 13.2 26.6 9.5 22.9 0 32.4V41h64V0L48.2 15.8 40.5 8.1 32.3 16.4 23.9 14.4Z" fill="#f0f2f5"/><path d="M0 34.6V41h64v-2.9L48.2 26.1 40.5 33.8l-8.2-8.3-8.4 8.3L16.9 27 0 34.6Z" fill="#dce3ec"/><path d="M15.5 14.8A3.5 3.5 0 1 0 15.5 8a3.5 3.5 0 0 0 0 6.8Z" fill="#c0c4cc"/><path d="M43.3 29.7c-4 0-8.2-3.1-8.2-6.3 0-3.2 3.1-6.7 8.2-6.7 5.2 0 8.3 3.4 8.3 6.7 0 3.2-3.2 6.3-8.3 6.3Z" fill="#c0c4cc"/></svg>' +
                '</span><span>' + esc(text || '暂无数据') + '</span></div>';
        }
    };

    window.PQ = window.PQ || {};
    PQ.ui = UI;
})();
