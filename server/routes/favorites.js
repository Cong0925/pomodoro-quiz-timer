/* ============================================================
 * 刷题计时器 - server/routes/favorites.js
 * 错题收藏 API：收藏 / 取消 / 改分类 / 分页筛选 / 清空
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { str, num, asyncHandler } = require('../utils');

const router = express.Router();

const rowToFav = r => ({
    id: r.id,
    hid: r.round_id,
    no: r.no,
    title: r.title,
    mode: r.mode,
    modeName: r.mode_name,
    timeStr: r.time_str,
    collectedAt: r.collected_at,
    catId: r.cat_id,
    catName: r.cat_name,
    subId: r.sub_id,
    subName: r.sub_name
});

/* GET /api/favorites?mode=&catId=&subId=&page=&limit= */
router.get('/', asyncHandler(async (req, res) => {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const where = [];
        const params = [];
        if (req.query.mode) { where.push('mode=?'); params.push(req.query.mode); }
        if (req.query.catId) { where.push('cat_id=?'); params.push(req.query.catId); }
        if (req.query.subId) { where.push('sub_id=?'); params.push(req.query.subId); }
        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const [cnt] = await pool.query(`SELECT COUNT(*) AS n FROM favorites ${whereSql}`, params);
        const total = cnt[0].n;

        const [rows] = await pool.query(
            `SELECT id, round_id, no, title, mode, mode_name, time_str,
                    collected_at, cat_id, cat_name, sub_id, sub_name
             FROM favorites ${whereSql}
             ORDER BY collected_at DESC, id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        );

        res.json({
            list: rows.map(rowToFav),
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
}));

/* POST /api/favorites 收藏错题
   body: { roundId, no, title, mode, modeName, timeStr,
           catId, catName, subId, subName } */
router.post('/', asyncHandler(async (req, res) => {
        const b = req.body || {};
        const roundId = num(b.roundId);
        const no = num(b.no);
        if (!roundId || !no) return res.status(400).json({ error: '缺少轮次ID或题号' });

        // 收藏的标题/分类快照优先取自该轮次当前记录，body 值兜底
        const [h] = await pool.query(
            'SELECT title, mode, mode_name, cat_id, cat_name, sub_id, sub_name FROM rounds WHERE id=?',
            [roundId]
        );
        const base = h.length ? h[0] : {};

        const id = Date.now();
        try {
            await pool.query(
                `INSERT INTO favorites
                    (id, round_id, no, title, mode, mode_name, time_str,
                     collected_at, cat_id, cat_name, sub_id, sub_name)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    id,
                    roundId,
                    no,
                    str(b.title, 100) || base.title || '',
                    b.mode === 'batch' ? 'batch' : 'single',
                    str(b.modeName, 20) || base.mode_name || '单题模式',
                    str(b.timeStr, 12),
                    b.collectedAt || new Date().toISOString().slice(0, 19).replace('T', ' '),
                    str(b.catId, 32) || base.cat_id || null,
                    str(b.catName, 100) || base.cat_name || null,
                    str(b.subId, 64) || base.sub_id || null,
                    str(b.subName, 100) || base.sub_name || null
                ]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // 同一毫秒重复 id 极小概率：id+1 重试一次
                await pool.query(
                    `INSERT INTO favorites
                        (id, round_id, no, title, mode, mode_name, time_str,
                         collected_at, cat_id, cat_name, sub_id, sub_name)
                     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                    [id + 1, roundId, no, str(b.title, 100) || base.title || '',
                     b.mode === 'batch' ? 'batch' : 'single', str(b.modeName, 20) || base.mode_name || '单题模式',
                     str(b.timeStr, 12), b.collectedAt || new Date().toISOString().slice(0, 19).replace('T', ' '),
                     str(b.catId, 32) || base.cat_id || null, str(b.catName, 100) || base.cat_name || null,
                     str(b.subId, 64) || base.sub_id || null, str(b.subName, 100) || base.sub_name || null]
                );
            } else {
                throw err;
            }
        }
        res.status(201).json({ ok: true, id });
}));

/* PUT /api/favorites/:id 修改收藏分类
   body: { catId, catName, subId, subName } */
router.put('/:id', asyncHandler(async (req, res) => {
        const b = req.body || {};
        const [r] = await pool.query(
            `UPDATE favorites SET cat_id=?, cat_name=?, sub_id=?, sub_name=? WHERE id=?`,
            [
                str(b.catId, 32) || null,
                str(b.catName, 100) || null,
                str(b.subId, 64) || null,
                str(b.subName, 100) || null,
                req.params.id
            ]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: '收藏不存在' });
        res.json({ ok: true });
}));

/* DELETE /api/favorites/:id 取消收藏 */
router.delete('/:id', asyncHandler(async (req, res) => {
        const [r] = await pool.query('DELETE FROM favorites WHERE id=?', [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '收藏不存在' });
        res.json({ ok: true });
}));

/* DELETE /api/favorites 清空全部收藏 */
router.delete('/', asyncHandler(async (req, res) => {
        await pool.query('DELETE FROM favorites');
        res.json({ ok: true });
}));

module.exports = router;
