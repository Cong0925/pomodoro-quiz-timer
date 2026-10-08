/* ============================================================
 * PQ Timer - modules/calendar.js
 * 日历备忘（MySQL 版）：大日历渲染、类型选择、备忘保存/清空。
 * 备忘按月从后端加载（内存按月缓存），保存/删除调 API。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;
    const CAL_TYPES = D.CAL_TYPES;

    /* ---- 元素引用 ---- */
    const calGrid = document.getElementById('calGrid');
    const calTitle = document.getElementById('calTitle');
    const calPrev = document.getElementById('calPrev');
    const calNext = document.getElementById('calNext');
    const calToday = document.getElementById('calToday');
    const calEditorTitle = document.getElementById('calEditorTitle');
    const calMemoTitle = document.getElementById('calMemoTitle');
    const calMemoInput = document.getElementById('calMemoInput');
    const calMemoSave = document.getElementById('calMemoSave');
    const calMemoClear = document.getElementById('calMemoClear');
    const calTypeBtns = document.querySelectorAll('.cal-type-btn');

    const CAL_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
    const CAL_WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'];

    let calYear = 0, calMonth = 0;        // 当前显示的年 / 月（month: 0-11）
    let calSelected = null;               // 选中日期 'YYYY-MM-DD'
    let calSelectedType = 'other';        // 编辑区当前选中的类型

    /* 输入框实时限制为 4 个字（字符计数） */
    calMemoTitle.addEventListener('input', () => {
        const v = calMemoTitle.value;
        const t = Array.from(v).slice(0, 4).join('');
        if (t !== v) calMemoTitle.value = t;
    });

    calTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            calTypeBtns.forEach(b => b.classList.toggle('active', b === btn));
            calSelectedType = btn.dataset.type;
        });
    });

    function setCalType(type) {
        calSelectedType = CAL_TYPES[type] ? type : 'other';
        calTypeBtns.forEach(b => b.classList.toggle('active', b.dataset.type === calSelectedType));
    }

    function calShowMonth(y, m) {
        calYear = y;
        calMonth = m;
        renderCalendar();
    }

    function keyOfDate(y, m, d) {
        const dt = new Date(y, m, d);
        return U.todayKey(dt);
    }

    /* 确保某月备忘已从后端加载（幂等：已加载直接返回） */
    async function ensureMonthLoaded(y, m) {
        const month = y + '-' + U.pad2(m + 1);
        // 若该月已加载且有数据或已标记加载过，跳过请求
        const hasLocal = Object.keys(D.calMemos).some(k => k.startsWith(month + '-'));
        if (hasLocal) return;
        try {
            await D.loadMemos(month);
        } catch (e) { U.showToast(e.message); }
    }

    async function renderCalendar() {
        calTitle.textContent = `${calYear} 年 ${calMonth + 1} 月`;

        const first = new Date(calYear, calMonth, 1);
        const lead = (first.getDay() + 6) % 7;
        const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        const daysInPrev = new Date(calYear, calMonth, 0).getDate();

        const cells = [];
        for (let i = lead - 1; i >= 0; i--) {
            cells.push({ day: daysInPrev - i, key: keyOfDate(calYear, calMonth - 1, daysInPrev - i), other: true });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({ day: d, key: keyOfDate(calYear, calMonth, d), other: false });
        }
        let nextD = 1;
        while (cells.length % 7 !== 0) {
            cells.push({ day: nextD, key: keyOfDate(calYear, calMonth + 1, nextD), other: true });
            nextD++;
        }

        await ensureMonthLoaded(calYear, calMonth);

        const tk = U.todayKey(new Date());
        calGrid.innerHTML = '';
        CAL_WEEKDAYS.forEach(w => {
            const wd = document.createElement('div');
            wd.className = 'cal-weekday';
            wd.textContent = w;
            calGrid.appendChild(wd);
        });
        cells.forEach(cell => {
            const el = document.createElement('div');
            el.className = 'cal-day' + (cell.other ? ' other' : '');
            if (cell.key === tk) el.classList.add('today');
            if (cell.key === calSelected) el.classList.add('selected');
            const memo = D.calMemos[cell.key];
            if (memo) el.classList.add('has-memo');
            const num = document.createElement('span');
            num.className = 'cal-day-num';
            num.textContent = cell.day;
            el.appendChild(num);
            if (memo) {
                const t = CAL_TYPES[memo.type] || CAL_TYPES.other;
                const tag = document.createElement('span');
                tag.className = 'cal-tag';
                tag.style.color = t.color;
                tag.style.background = t.bg;
                tag.textContent = t.label;
                tag.title = memo.text;
                el.appendChild(tag);
                if (memo.title) {
                    const mt = document.createElement('span');
                    mt.className = 'cal-memo-title';
                    mt.textContent = memo.title;
                    mt.title = memo.text;
                    el.appendChild(mt);
                }
            }
            el.addEventListener('click', () => {
                if (cell.other) {
                    const d = new Date(cell.key + 'T00:00:00');
                    calShowMonth(d.getFullYear(), d.getMonth());
                }
                calSelected = cell.key;
                renderCalendar();
            });
            calGrid.appendChild(el);
        });

        renderCalEditor();
    }

    function renderCalEditor() {
        if (!calSelected) {
            calEditorTitle.textContent = '请选择日期';
            calMemoTitle.value = '';
            calMemoInput.value = '';
            setCalType('other');
            return;
        }
        const d = new Date(calSelected + 'T00:00:00');
        calEditorTitle.textContent = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 周${CAL_WEEKDAY_CN[d.getDay()]}`;
        const memo = D.calMemos[calSelected];
        calMemoTitle.value = memo ? (memo.title || '') : '';
        calMemoInput.value = memo ? memo.text : '';
        setCalType(memo ? memo.type : 'other');
    }

    calMemoSave.addEventListener('click', async () => {
        if (!calSelected) return;
        const v = calMemoInput.value.trim();
        try {
            await D.saveMemo(calSelected, {
                type: calSelectedType,
                title: U.normCalTitle(calMemoTitle.value),
                content: v
            });
            renderCalendar();
            U.showToast(v ? '已保存备忘' : '已清空备忘');
        } catch (e) { U.showToast(e.message); }
    });

    calMemoClear.addEventListener('click', async () => {
        if (!calSelected) return;
        try {
            await D.deleteMemo(calSelected);
            calMemoTitle.value = '';
            calMemoInput.value = '';
            renderCalendar();
            U.showToast('已清空该日备忘');
        } catch (e) { U.showToast(e.message); }
    });

    calPrev.addEventListener('click', () => calShowMonth(calMonth === 0 ? calYear - 1 : calYear, calMonth === 0 ? 11 : calMonth - 1));
    calNext.addEventListener('click', () => calShowMonth(calMonth === 11 ? calYear + 1 : calYear, calMonth === 11 ? 0 : calMonth + 1));
    calToday.addEventListener('click', () => {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        calSelected = U.todayKey(now);
        renderCalendar();
    });

    /* 初始化：日历默认显示当月并选中今天 */
    function initCalendar() {
        const now = new Date();
        calYear = now.getFullYear();
        calMonth = now.getMonth();
        calSelected = U.todayKey(now);
    }

    window.PQ = window.PQ || {};
    PQ.calendar = { initCalendar, renderCalendar };
})();