/* ============================================================
 * 刷题计时器 - server/routes/stats.js
 * 学习统计 API：今日情况 + 按日/周/月汇总（SQL 聚合）
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { asyncHandler } = require('../utils');

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

function fmtDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* 生成从 start 到 end 的连续粒度 key 序列（含首尾），粒度周/月与 SQL 聚合口径一致 */
function buildKeys(gran, start, end) {
    const keys = [];
    const e = new Date(end + 'T00:00:00');
    if (gran === 'month') {
        const cur = new Date(start.slice(0, 4) + '-' + start.slice(5, 7) + '-01T00:00:00');
        while (cur <= e) {
            keys.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`);
            cur.setMonth(cur.getMonth() + 1);
        }
    } else if (gran === 'week') {
        const cur = new Date(start + 'T00:00:00');
        cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7)); // 回退到本周一
        while (cur <= e) {
            keys.push(fmtDate(cur));
            cur.setDate(cur.getDate() + 7);
        }
    } else {
        const cur = new Date(start + 'T00:00:00');
        while (cur <= e) {
            keys.push(fmtDate(cur));
            cur.setDate(cur.getDate() + 1);
        }
    }
    return keys;
}

/* GET /api/stats?gran=day|week|month
   返回 { today: {...}, list: [{key,label,rounds,questions,correct,rate,workMs,studyMs}] } */
router.get('/', asyncHandler(async (req, res) => {
        const gran = ['day', 'week', 'month'].includes(req.query.gran) ? req.query.gran : 'day';

        /* 今日情况（rounds 与 records 分开聚合，避免 JOIN 重复计算 correct/total_ms） */
        const [t] = await pool.query(
            `SELECT COUNT(*) AS rounds,
                    COALESCE(SUM(correct),0) AS correct,
                    COALESCE(SUM(total_ms),0) AS workMs
             FROM rounds WHERE DATE(finished_at) = CURDATE()`
        );
        const [tq] = await pool.query(
            `SELECT COUNT(*) AS questions, COALESCE(SUM(result='skip'),0) AS skipped
             FROM records rc JOIN rounds r ON r.id = rc.round_id
             WHERE DATE(r.finished_at) = CURDATE()`
        );
        const [sd] = await pool.query('SELECT ms FROM study_daily WHERE study_date = CURDATE()');
        const todayQuestions = tq[0].questions;
        const todaySkipped = tq[0].skipped;
        const today = {
            rounds: Number(t[0].rounds),
            questions: Number(todayQuestions),
            correct: Number(t[0].correct),
            skipped: Number(todaySkipped),
            rate: todayQuestions > 0 ? +(Number(t[0].correct) / Number(todayQuestions) * 100).toFixed(1) : 0,
            workMs: Number(t[0].workMs),
            studyMs: Number(sd.length ? sd[0].ms : 0)
        };

        /* 按粒度聚合：rounds 汇总（轮次/答对/做题时长） */
        const [rRows] = await pool.query(
            `SELECT ${granExpr('finished_at', gran)} AS gkey,
                    COUNT(*) AS rounds,
                    COALESCE(SUM(correct),0) AS correct,
                    COALESCE(SUM(total_ms),0) AS workMs
             FROM rounds GROUP BY gkey`
        );

        /* 按粒度聚合：records 计数（做题数）与跳过数，join rounds 取时间归属 */
        const [qRows] = await pool.query(
            `SELECT ${granExpr('r.finished_at', gran)} AS gkey, COUNT(*) AS questions,
                    COALESCE(SUM(result='skip'),0) AS skipped
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
        qRows.forEach(x => { qMap[x.gkey] = { q: x.questions, s: x.skipped }; });
        const studyMap = {};
        sRows.forEach(s => { studyMap[s.gkey] = s.studyMs; });

        /* 日期连续性：起点 = 最早有数据日期（rounds 或 study_daily），终点 = 今天；
           缺失粒度（未登录的日子/周/月）补 0，保证日期不断档 */
        const [bnd] = await pool.query(
            `SELECT MIN(d) AS m FROM (
                SELECT MIN(DATE(finished_at)) AS d FROM rounds
                UNION ALL
                SELECT MIN(study_date) FROM study_daily
             ) t`
        );
        const startKey = bnd[0].m || fmtDate(new Date());
        const endKey = fmtDate(new Date());
        const keys = buildKeys(gran, startKey, endKey).reverse(); // 新 → 旧
        const list = keys.map(key => {
            const r = roundMap[key] || { rounds: 0, correct: 0, workMs: 0 };
            const q = qMap[key] || { q: 0, s: 0 };
            return {
                key,
                label: labelOf(key, gran),
                rounds: Number(r.rounds),
                questions: Number(q.q),
                correct: Number(r.correct),
                skipped: Number(q.s),
                rate: q.q > 0 ? +(Number(r.correct) / Number(q.q) * 100).toFixed(1) : 0,
                workMs: Number(r.workMs),
                studyMs: Number(studyMap[key] || 0)
            };
        });

        /* 全段合计（与 web-app 契约一致，供前端「总计」卡片；mysql2 SUM 返回字符串已 Number 化） */
        const sum = list.reduce((acc, r) => {
            acc.rounds += r.rounds;
            acc.questions += r.questions;
            acc.correct += r.correct;
            acc.skipped += r.skipped;
            acc.workMs += r.workMs;
            acc.studyMs += r.studyMs;
            return acc;
        }, { rounds: 0, questions: 0, correct: 0, skipped: 0, workMs: 0, studyMs: 0 });

        /* 可选分页：传 page/limit 时切页（与 web-app 契约一致），不传返回全量兼容旧前端 */
        if (req.query.page !== undefined || req.query.limit !== undefined) {
            const lim = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit)) || 20));
            const pg = Math.max(1, Math.floor(Number(req.query.page)) || 1);
            const total = list.length;
            const totalPages = Math.max(1, Math.ceil(total / lim));
            const pageList = list.slice((pg - 1) * lim, pg * lim);
            return res.json({ today, sum, list: pageList, total, page: pg, limit: lim, totalPages });
        }
        res.json({ today, sum, list });
}));

module.exports = router;
