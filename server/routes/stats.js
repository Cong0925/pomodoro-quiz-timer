/* ============================================================
 * 刷题计时器 - server/routes/stats.js
 * 学习统计 API：今日情况 + 按日/周/月汇总（SQL 聚合）
 * ============================================================ */
const express = require('express');
const pool = require('../db');

const router = express.Router();

function granExpr(col, gran) {
    if (gran === 'month') return `DATE_FORMAT(${col}, '%Y-%m')`;
    if (gran === 'week') return `DATE_FORMAT(DATE_SUB(${col}, INTERVAL (DAYOFWEEK(${col})-2+7)%7 DAY), '%Y-%m-%d')`;
    return `DATE_FORMAT(${col}, '%Y-%m-%d')`;
}

function weekLabel(key) {
    const d = new Date(key + 'T00:00:00');
    const sun = new Date(d);
    sun.setDate(d.getDate() + 6);
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}-${p(d.getDate())} ~ ${p(sun.getMonth() + 1)}-${p(sun.getDate())}`;
}

function labelOf(key, gran) {
    if (gran === 'month') return key + ' 月';
    if (gran === 'week') return weekLabel(key);
    return key;
}

/* GET /api/stats?gran=day|week|month
   返回 { today: {...}, list: [{key,label,rounds,questions,correct,rate,workMs,studyMs}] } */
router.get('/', async (req, res) => {
    try {
        const gran = ['day', 'week', 'month'].includes(req.query.gran) ? req.query.gran : 'day';

        /* 今日情况（rounds 与 records 分开聚合，避免 JOIN 重复计算 correct/total_ms） */
        const [t] = await pool.query(
            `SELECT COUNT(*) AS rounds,
                    COALESCE(SUM(correct),0) AS correct,
                    COALESCE(SUM(total_ms),0) AS workMs
             FROM rounds WHERE DATE(finished_at) = CURDATE()`
        );
        const [tq] = await pool.query(
            `SELECT COUNT(*) AS questions
             FROM records rc JOIN rounds r ON r.id = rc.round_id
             WHERE DATE(r.finished_at) = CURDATE()`
        );
        const [sd] = await pool.query('SELECT ms FROM study_daily WHERE study_date = CURDATE()');
        const todayQuestions = tq[0].questions;
        const today = {
            rounds: t[0].rounds,
            questions: todayQuestions,
            correct: t[0].correct,
            rate: todayQuestions > 0 ? +(t[0].correct / todayQuestions * 100).toFixed(1) : 0,
            workMs: t[0].workMs,
            studyMs: sd.length ? sd[0].ms : 0
        };

        /* 按粒度聚合：rounds 汇总（轮次/答对/做题时长） */
        const [rRows] = await pool.query(
            `SELECT ${granExpr('finished_at', gran)} AS gkey,
                    COUNT(*) AS rounds,
                    COALESCE(SUM(correct),0) AS correct,
                    COALESCE(SUM(total_ms),0) AS workMs
             FROM rounds GROUP BY gkey`
        );

        /* 按粒度聚合：records 计数（做题数），join rounds 取时间归属 */
        const [qRows] = await pool.query(
            `SELECT ${granExpr('r.finished_at', gran)} AS gkey, COUNT(*) AS questions
             FROM records rc JOIN rounds r ON r.id = rc.round_id
             GROUP BY gkey`
        );

        /* 按粒度聚合：学习时长 */
        const [sRows] = await pool.query(
            `SELECT ${granExpr('study_date', gran)} AS gkey, SUM(ms) AS studyMs
             FROM study_daily GROUP BY gkey ORDER BY gkey DESC`
        );
        const roundMap = {};
        rRows.forEach(x => { roundMap[x.gkey] = x; });
        const qMap = {};
        qRows.forEach(x => { qMap[x.gkey] = x.questions; });
        const studyMap = {};
        sRows.forEach(s => { studyMap[s.gkey] = s.studyMs; });

        const allKeys = new Set([...Object.keys(roundMap), ...Object.keys(qMap), ...Object.keys(studyMap)]);
        const list = [];
        allKeys.forEach(key => {
            const r = roundMap[key] || { rounds: 0, correct: 0, workMs: 0 };
            const questions = qMap[key] || 0;
            list.push({
                key,
                label: labelOf(key, gran),
                rounds: r.rounds,
                questions,
                correct: r.correct,
                rate: questions > 0 ? +(r.correct / questions * 100).toFixed(1) : 0,
                workMs: r.workMs,
                studyMs: studyMap[key] || 0
            });
        });
        list.sort((a, b) => a.key < b.key ? 1 : -1);

        res.json({ today, list });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
