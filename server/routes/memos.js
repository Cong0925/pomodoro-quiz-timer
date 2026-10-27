/* ============================================================
 * 刷题计时器 - server/routes/memos.js
 * 日历备忘 API：按月查询 / 按日保存(upsert) / 删除
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { str, asyncHandler } = require('../utils');

const router = express.Router();

const VALID_TYPES = new Set(['exam', 'meeting', 'study', 'sport', 'birthday', 'travel', 'other']);

/* GET /api/memos?month=YYYY-MM 某月全部备忘 */
router.get('/', asyncHandler(async (req, res) => {
        const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null;
        let rows;
        if (month) {
            [rows] = await pool.query(
                'SELECT DATE_FORMAT(memo_date,"%Y-%m-%d") AS date, type, title, content FROM memos WHERE DATE_FORMAT(memo_date,"%Y-%m")=? ORDER BY memo_date',
                [month]
            );
        } else {
            [rows] = await pool.query('SELECT DATE_FORMAT(memo_date,"%Y-%m-%d") AS date, type, title, content FROM memos ORDER BY memo_date');
        }
        res.json(rows);
}));

/* GET /api/memos/:date 某日备忘 */
router.get('/:date', asyncHandler(async (req, res) => {
        const [rows] = await pool.query(
            'SELECT DATE_FORMAT(memo_date,"%Y-%m-%d") AS date, type, title, content FROM memos WHERE memo_date=?',
            [req.params.date]
        );
        res.json(rows.length ? rows[0] : null);
}));

/* PUT /api/memos/:date 保存备忘 { type, title, content }（upsert；content 空则视为删除） */
router.put('/:date', asyncHandler(async (req, res) => {
        const date = req.params.date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
        const b = req.body || {};
        const type = VALID_TYPES.has(b.type) ? b.type : 'other';
        const title = str(b.title, 20);
        const content = str(b.content == null ? '' : b.content, 1000).trim();

        if (!content && !title) {
            await pool.query('DELETE FROM memos WHERE memo_date=?', [date]);
            res.json({ ok: true, deleted: true });
            return;
        }
        await pool.query(
            `INSERT INTO memos (memo_date, type, title, content)
             VALUES (?,?,?,?)
             ON DUPLICATE KEY UPDATE type=VALUES(type), title=VALUES(title), content=VALUES(content)`,
            [date, type, title, content]
        );
        res.json({ ok: true });
}));

/* DELETE /api/memos/:date 清空某日备忘 */
router.delete('/:date', asyncHandler(async (req, res) => {
        await pool.query('DELETE FROM memos WHERE memo_date=?', [req.params.date]);
        res.json({ ok: true });
}));

module.exports = router;
