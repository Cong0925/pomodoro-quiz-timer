/* ============================================================
 * PQ Timer - modules/stats.js
 * 学习统计（MySQL 版）：今日情况 + 按日/周/月汇总，
 * 数据全部由后端 SQL 聚合返回。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;

    /* ---- 元素引用 ---- */
    const viewStats = document.getElementById('viewStats');
    const statsTabs = document.querySelectorAll('.stats-tab');
    const statsToday = document.getElementById('statsToday');
    const statsSummary = document.getElementById('statsSummary');
    const statsTable = document.getElementById('statsTable');
    const statsBody = document.getElementById('statsBody');
    const statsEmpty = document.getElementById('statsEmpty');

    let statsGran = 'day';   // 'day' | 'week' | 'month'

    async function renderStats() {
        try {
            const data = await D.loadStats(statsGran);
            const rows = data.list;
            const empty = rows.length === 0;
            statsTable.style.display = empty ? 'none' : '';
            statsEmpty.hidden = !empty;

            /* 今日情况（两行：做题数/正确率 → 做题时长/笔记时长/学习时长）
               笔记时长 = 学习时长 - 做题时长（无独立笔记数据，差值即为笔记时间） */
            const t = data.today;
            const tRate = t.questions === 0 ? '—' : (t.correct / t.questions * 100).toFixed(1) + '%';
            const todayLearn = D.todayStudyTotal();
            const todayWork = Number(t.workMs);
            const todayNote = Math.max(0, todayLearn - todayWork);
            statsToday.innerHTML = `
                <div class="stats-row cols-2">
                    <div class="stats-summary-card today"><div class="num">${t.questions}</div><div class="label">今日做题数</div></div>
                    <div class="stats-summary-card today"><div class="num">${tRate}</div><div class="label">今日正确率</div></div>
                </div>
                <div class="stats-row cols-3">
                    <div class="stats-summary-card today"><div class="num">${U.formatDuration(todayWork)}</div><div class="label">今日做题时长</div></div>
                    <div class="stats-summary-card today"><div class="num">${U.formatDuration(todayNote)}</div><div class="label">今日笔记时长</div></div>
                    <div class="stats-summary-card today"><div class="num">${U.formatDuration(todayLearn)}</div><div class="label">今日学习时长</div></div>
                </div>
            `;

            /* 当前周期范围合计（两行：做题数/正确率 → 做题时长/笔记时长/学习时长） */
            let questions = 0, correct = 0, workMs = 0, studyMs = 0;
            rows.forEach(r => { questions += Number(r.questions); correct += Number(r.correct); workMs += Number(r.workMs); studyMs += Number(r.studyMs); });
            const sumRate = questions === 0 ? '—' : (correct / questions * 100).toFixed(1) + '%';
            const sumNote = Math.max(0, studyMs - workMs);
            statsSummary.innerHTML = `
                <div class="stats-row cols-2">
                    <div class="stats-summary-card"><div class="num">${questions}</div><div class="label">总做题数</div></div>
                    <div class="stats-summary-card"><div class="num">${sumRate}</div><div class="label">总正确率</div></div>
                </div>
                <div class="stats-row cols-3">
                    <div class="stats-summary-card"><div class="num">${U.formatDuration(workMs)}</div><div class="label">总做题时长</div></div>
                    <div class="stats-summary-card"><div class="num">${U.formatDuration(sumNote)}</div><div class="label">总笔记时长</div></div>
                    <div class="stats-summary-card"><div class="num">${U.formatDuration(studyMs)}</div><div class="label">总学习时长</div></div>
                </div>
            `;

            /* 明细行 */
            statsBody.innerHTML = '';
            rows.forEach(r => {
                const rateStr = r.questions === 0 ? '—' : (r.correct / r.questions * 100).toFixed(1) + '%';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${r.label}</td>
                    <td>${r.rounds}</td>
                    <td>${r.questions}</td>
                    <td>${r.correct}</td>
                    <td>${rateStr}</td>
                    <td>${U.formatDuration(r.workMs)}</td>
                    <td>${U.formatDuration(r.studyMs)}</td>
                `;
                statsBody.appendChild(tr);
            });
        } catch (e) {
            U.showToast(e.message);
        }
    }

    statsTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            statsTabs.forEach(t => t.classList.toggle('active', t === tab));
            statsGran = tab.dataset.gran;
            renderStats();
        });
    });

    // 统计视图可见时，每 30 秒刷新一次（今日学习时长实时增长）
    setInterval(() => {
        if (!viewStats.hidden) renderStats();
    }, 30000);

    /* 数据保存后联动刷新（由数据层调用） */
    function renderIfVisible() {
        if (!viewStats.hidden) renderStats();
    }

    window.PQ = window.PQ || {};
    PQ.stats = { renderStats, renderIfVisible };
})();