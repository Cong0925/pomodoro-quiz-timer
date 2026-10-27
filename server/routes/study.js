/* ============================================================
 * 刷题计时器 - server/routes/study.js
 * 学习时长 API：前端定期上报会话时长，按日累加
 * 前端打开页面时开始计时，每 60s 上报一次增量，
 * 关闭页面时用 sendBeacon 上报剩余时长，保证不丢
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { num, asyncHandler } = require('../utils');

const router = express.Router();

/* POST /api/study-daily { date: 'YYYY-MM-DD', addMs: 毫秒 } 累加某日学习时长 */
router.post('/', asyncHandler(async (req, res) => {
        const date = req.body && req.body.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
        const addMs = num(req.body.addMs);
        if (addMs <= 0) return res.json({ ok: true, added: 0 });

        await pool.query(
            `INSERT INTO study_daily (study_date, ms) VALUES (?,?)
             ON DUPLICATE KEY UPDATE ms = ms + VALUES(ms)`,
            [date, addMs]
        );
        res.json({ ok: true, added: addMs });
}));

/* GET /api/study-daily?date=YYYY-MM-DD 查询某日学习时长 */
router.get('/', asyncHandler(async (req, res) => {
        const date = req.query.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
        const [rows] = await pool.query('SELECT ms FROM study_daily WHERE study_date=?', [date]);
        res.json({ date, ms: rows.length ? rows[0].ms : 0 });
}));

module.exports = router;
