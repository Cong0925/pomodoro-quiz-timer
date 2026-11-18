/* ============================================================
 * PQ Timer - modules/studyFloat.js
 * 学习时长悬浮窗：右下角圆形按钮，点击开始 / 暂停学习计时。
 * 仅在计时中累计时长，排除非学习时间，避免学习时长虚高。
 * ============================================================ */
(function () {
    'use strict';

    const U = PQ.utils;
    const D = PQ.data;

    const floatEl = document.getElementById('studyFloat');
    const iconEl = document.getElementById('sfIcon');
    const timeEl = document.getElementById('sfTime');
    const labelEl = document.getElementById('sfLabel');

    const ICON_PLAY = '<path d="M8 5v14l11-7z" fill="currentColor"/>';
    const ICON_PAUSE = '<path d="M7 5h3.6v14H7zM13.4 5H17v14h-3.6z" fill="currentColor"/>';

    /* 时长显示：与统计面板使用同一个 U.formatDuration（同格式、同取整规则） */
    function fmt(ms) {
        const s = U.formatDuration(ms);
        return s === '不足 1 分钟' ? '0 分' : s;
    }

    function render() {
        const running = D.studyRunning;
        floatEl.classList.toggle('running', running);
        iconEl.innerHTML = running ? ICON_PAUSE : ICON_PLAY;
        timeEl.textContent = fmt(D.todayStudyTotal());
        labelEl.textContent = running ? '学习计时中' : '今日学习';
        floatEl.title = running ? '学习中 ' + fmt(D.todayStudyTotal()) + '，点击暂停' : '已暂停，点击开始学习计时';
        floatEl.setAttribute('aria-label', running ? '暂停学习计时' : '开始学习计时');
    }

    function toggle() {
        if (D.studyRunning) {
            D.pauseStudy();
            U.showToast('学习计时已暂停');
        } else {
            D.startStudy();
            U.showToast('开始学习计时');
        }
        render();
    }

    floatEl.addEventListener('click', toggle);
    floatEl.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggle();
    });

    /* 每秒刷新显示 */
    setInterval(render, 1000);
    render();
})();