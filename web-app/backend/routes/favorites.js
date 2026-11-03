/* ============================================================
 * 刷题计时器 - server/routes/favorites.js
 * 错题收藏 API：收藏 / 取消 / 改分类 / 分页筛选 / 清空
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { str, num, asyncHandler, nowDateTime } = require('../utils');
const { getUserId } = require('../utils/auth');

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
        const uid = getUserId(req);
        const where = ['user_id=?'];
        const params = [uid];
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
        const uid = getUserId(req);
        const roundId = num(b.roundId);
        const no = num(b.no);
        if (!roundId || !no) return res.status(400).json({ error: '缺少轮次ID或题号' });

        // 收藏的标题/分类快照优先取自该轮次当前记录，body 值兜底（仅限本人轮次）
        const [h] = await pool.query(
            'SELECT title, mode, mode_name, cat_id, cat_name, sub_id, sub_name FROM rounds WHERE id=? AND user_id=?',
            [roundId, uid]
        );
        if (!h.length) return res.status(404).json({ error: '轮次记录不存在' });
        const base = h[0];
        // mode 白名单：练习/速算轮次收藏保留原模式，不再压成 single
        const modeVal = ['single', 'batch', 'practice', 'mental'].includes(b.mode) ? b.mode : 'single';
        const colAt = b.collectedAt || nowDateTime();

        const id = Date.now();
        try {
            await pool.query(
                `INSERT INTO favorites
                    (id, user_id, round_id, no, title, mode, mode_name, time_str,
                     collected_at, cat_id, cat_name, sub_id, sub_name)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    id,
                    uid,
                    roundId,
                    no,
                    str(b.title, 100) || base.title || '',
                    modeVal,
                    str(b.modeName, 20) || base.mode_name || '单题模式',
                    str(b.timeStr, 12),
                    colAt,
                    str(b.catId, 32) || base.cat_id || null,
                    str(b.catName, 100) || base.cat_name || null,
                    str(b.subId, 64) || base.sub_id || null,
                    str(b.subName, 100) || base.sub_name || null
                ]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // 重复收藏同一题（uk_round_no）：返回 409，不再冒充主键冲突重试
                if (String(err.message).includes('uk_round_no')) {
                    return res.status(409).json({ error: '该题已在收藏中' });
                }
                // 同一毫秒重复 id 极小概率：id+1 重试一次
                try {
                    await pool.query(
                        `INSERT INTO favorites
                            (id, user_id, round_id, no, title, mode, mode_name, time_str,
                             collected_at, cat_id, cat_name, sub_id, sub_name)
                         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
                        [id + 1, uid, roundId, no, str(b.title, 100) || base.title || '',
                         modeVal, str(b.modeName, 20) || base.mode_name || '单题模式',
                         str(b.timeStr, 12), colAt,
                         str(b.catId, 32) || base.cat_id || null, str(b.catName, 100) || base.cat_name || null,
                         str(b.subId, 64) || base.sub_id || null, str(b.subName, 100) || base.sub_name || null]
                    );
                } catch (err2) {
                    if (err2.code === 'ER_DUP_ENTRY' && String(err2.message).includes('uk_round_no')) {
                        return res.status(409).json({ error: '该题已在收藏中' });
                    }
                    throw err2;
                }
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
        const uid = getUserId(req);
        const [r] = await pool.query(
            `UPDATE favorites SET cat_id=?, cat_name=?, sub_id=?, sub_name=? WHERE id=? AND user_id=?`,
            [
                str(b.catId, 32) || null,
                str(b.catName, 100) || null,
                str(b.subId, 64) || null,
                str(b.subName, 100) || null,
                req.params.id,
                uid
            ]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: '收藏不存在' });
        res.json({ ok: true });
}));

/* DELETE /api/favorites/:id 取消收藏 */
router.delete('/:id', asyncHandler(async (req, res) => {
        const uid = getUserId(req);
        const [r] = await pool.query('DELETE FROM favorites WHERE id=? AND user_id=?', [req.params.id, uid]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '收藏不存在' });
        res.json({ ok: true });
}));

/* DELETE /api/favorites 清空当前用户全部收藏 */
router.delete('/', asyncHandler(async (req, res) => {
        const uid = getUserId(req);
        await pool.query('DELETE FROM favorites WHERE user_id=?', [uid]);
        res.json({ ok: true });
}));

module.exports = router;
