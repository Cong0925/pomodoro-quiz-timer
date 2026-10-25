/* ============================================================
 * 刷题计时器 - server/routes/history.js
 * 历史记录 API：分页查询 / 归档 / 编辑 / 删除
 * 列表只返回概要，明细（records）单独按轮次查询
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { str, num, parseJsonArray } = require('../utils');

const router = express.Router();

const rowToHistory = (r, withRecords) => {
    const item = {
        id: r.id,
        mode: r.mode,
        modeName: r.mode_name,
        title: r.title,
        desc: r.description,
        date: r.finished_at,
        maxCount: r.max_count,
        totalMs: r.total_ms,
        correct: r.correct,
        rate: r.rate,
        catId: r.cat_id,
        catName: r.cat_name,
        subId: r.sub_id,
        subName: r.sub_name
    };
    if (withRecords) {
        item.records = (r.records || []).map(rec => ({
            no: rec.no,
            ms: rec.ms,
            cumMs: rec.cum_ms,
            timeStr: rec.time_str,
            result: rec.result,
            note: rec.note
        }));
    }
    return item;
};

/* GET /api/history?mode=&catId=&subId=&page=1&limit=20
   返回 { list, total, page, limit, totalPages }
   列表项含 records（题目明细）与 favNos（该轮已收藏的题号），
   便于前端直接渲染展开明细与收藏状态 */
router.get('/', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const where = [];
        const params = [];
        if (req.query.mode) { where.push('mode=?'); params.push(req.query.mode); }
        if (req.query.catId) { where.push('cat_id=?'); params.push(req.query.catId); }
        if (req.query.subId) { where.push('sub_id=?'); params.push(req.query.subId); }
        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

        const [cnt] = await pool.query(`SELECT COUNT(*) AS n FROM rounds ${whereSql}`, params);
        const total = cnt[0].n;

        const [rows] = await pool.query(
            `SELECT id, mode, mode_name, title, description, finished_at, max_count,
                    total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name
             FROM rounds ${whereSql}
             ORDER BY finished_at DESC, id DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, (page - 1) * limit]
        );

        /* 本页轮次的 records 与收藏状态（一次查询，避免 N+1） */
        const ids = rows.map(r => r.id);
        const recMap = {};
        const favMap = {};
        if (ids.length) {
            const [recs] = await pool.query(
                `SELECT round_id, JSON_ARRAYAGG(JSON_OBJECT(
                    'no', no, 'ms', ms, 'cumMs', cum_ms, 'timeStr', time_str, 'result', result, 'note', note)) AS records
                 FROM records WHERE round_id IN (?) GROUP BY round_id`,
                [ids]
            );
            recs.forEach(r => { recMap[r.round_id] = parseJsonArray(r.records); });
            const [favs] = await pool.query(
                'SELECT round_id, no, id FROM favorites WHERE round_id IN (?)',
                [ids]
            );
            favs.forEach(f => { (favMap[f.round_id] = favMap[f.round_id] || []).push({ no: f.no, id: f.id }); });
        }

        res.json({
            list: rows.map(r => ({
                ...rowToHistory(r, false),
                records: recMap[r.id] || [],
                favNos: favMap[r.id] || []
            })),
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* GET /api/history/:id 单轮详情（含 records 明细） */
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT h.*, COALESCE(
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'no', r.no, 'ms', r.ms, 'cum_ms', r.cum_ms,
                    'time_str', r.time_str, 'result', r.result, 'note', r.note))
                 FROM records r WHERE r.round_id = h.id), JSON_ARRAY()) AS records
             FROM rounds h WHERE h.id=?`,
            [req.params.id]
        );
        if (rows.length === 0) return res.status(404).json({ error: '记录不存在' });
        rows[0].records = parseJsonArray(rows[0].records);
        res.json(rowToHistory(rows[0], true));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* POST /api/history 归档一轮（事务：rounds + records 一起写入）
   body: { mode, modeName, title, description, finishedAt, maxCount,
           totalMs, correct, rate, catId, catName, subId, subName, records[] } */
router.post('/', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const b = req.body || {};
        const id = Date.now(); // 与旧版 id 生成一致
        const recs = Array.isArray(b.records) ? b.records : [];

        await conn.beginTransaction();
        await conn.query(
            `INSERT INTO rounds
                (id, mode, mode_name, title, description, finished_at, max_count,
                 total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
                id,
                b.mode === 'batch' ? 'batch' : 'single',
                str(b.modeName, 20) || (b.mode === 'batch' ? '整组模式' : '单题模式'),
                str(b.title, 100),
                str(b.description, 255),
                b.finishedAt || new Date().toISOString().slice(0, 19).replace('T', ' '),
                num(b.maxCount) || 20,
                num(b.totalMs),
                num(b.correct),
                num(b.rate),
                str(b.catId, 32) || null,
                str(b.catName, 100) || null,
                str(b.subId, 64) || null,
                str(b.subName, 100) || null
            ]
        );
        if (recs.length) {
            const vals = [];
            const params = [];
            recs.forEach((r, i) => {
                vals.push('(?,?,?,?,?,?,?)');
                params.push(
                    id,
                    num(r.no) || i + 1,
                    num(r.ms),
                    num(r.cumMs),
                    str(r.timeStr, 12),
                    r.result === 'ok' || r.result === 'ng' || r.result === 'skip' ? r.result : 'ok',
                    str(r.note, 255)
                );
            });
            await conn.query(
                `INSERT INTO records (round_id, no, ms, cum_ms, time_str, result, note) VALUES ${vals.join(',')}`,
                params
            );
        }
        await conn.commit();
        res.status(201).json({ id });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

/* PUT /api/history/:id 编辑标题/描述/分类（同步更新该轮收藏的快照）
   body: { title, description, catId, catName, subId, subName } */
router.put('/:id', async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const b = req.body || {};
        await conn.beginTransaction();
        const [r] = await conn.query(
            `UPDATE rounds SET
                title=?, description=?, cat_id=?, cat_name=?, sub_id=?, sub_name=?
             WHERE id=?`,
            [
                str(b.title, 100),
                str(b.description, 255),
                str(b.catId, 32) || null,
                str(b.catName, 100) || null,
                str(b.subId, 64) || null,
                str(b.subName, 100) || null,
                req.params.id
            ]
        );
        if (r.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: '记录不存在' });
        }
        // 同步更新该轮收藏的标题与分类快照（与旧版行为一致）
        await conn.query(
            `UPDATE favorites SET title=?, cat_id=?, cat_name=?, sub_id=?, sub_name=? WHERE round_id=?`,
            [
                str(b.title, 100),
                str(b.catId, 32) || null,
                str(b.catName, 100) || null,
                str(b.subId, 64) || null,
                str(b.subName, 100) || null,
                req.params.id
            ]
        );
        await conn.commit();
        res.json({ ok: true });
    } catch (e) {
        await conn.rollback();
        res.status(500).json({ error: e.message });
    } finally {
        conn.release();
    }
});

/* PUT /api/history/:id/record/:no 更新单题知识点描述
   body: { note } */
router.put('/:id/record/:no', async (req, res) => {
    try {
        const [r] = await pool.query(
            'UPDATE records SET note=? WHERE round_id=? AND no=?',
            [str(req.body.note, 255), req.params.id, num(req.params.no)]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: '题目记录不存在' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* DELETE /api/history/:id 删除单轮（records、favorites 级联删除） */
router.delete('/:id', async (req, res) => {
    try {
        const [r] = await pool.query('DELETE FROM rounds WHERE id=?', [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '记录不存在' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* DELETE /api/history 清空全部历史（records、favorites 级联删除） */
router.delete('/', async (req, res) => {
    try {
        await pool.query('DELETE FROM rounds');
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
