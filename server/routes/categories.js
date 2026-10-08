/* ============================================================
 * 刷题计时器 - server/routes/categories.js
 * 分类管理 API：大类/小类 增删改查 + 恢复内置
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { uid, str } = require('../utils');
const DEFAULT_CATEGORIES = require('../defaultCategories');

const router = express.Router();

/* 组装完整分类树（大类 + 小类，按 sort_order 排序） */
async function getCategoryTree() {
    const [cats] = await pool.query('SELECT id, name, builtin, sort_order FROM categories ORDER BY sort_order ASC, name ASC');
    const [subs] = await pool.query('SELECT id, cat_id, name, sort_order FROM category_subs ORDER BY sort_order ASC, name ASC');
    const subMap = {};
    subs.forEach(s => {
        if (!subMap[s.cat_id]) subMap[s.cat_id] = [];
        subMap[s.cat_id].push({ id: s.id, name: s.name, sortOrder: s.sort_order });
    });
    return cats.map(c => ({
        id: c.id,
        name: c.name,
        builtin: !!c.builtin,
        subs: subMap[c.id] || []
    }));
}

/* GET /api/categories 全部分类 */
router.get('/', async (req, res) => {
    try {
        res.json(await getCategoryTree());
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* POST /api/categories 新建大类 { name } */
router.post('/', async (req, res) => {
    try {
        const name = str(req.body && req.body.name, 100).trim();
        if (!name) return res.status(400).json({ error: '大类名称不能为空' });
        const id = uid('c');
        const [r] = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM categories');
        await pool.query(
            'INSERT INTO categories (id, name, builtin, sort_order) VALUES (?,?,0,?)',
            [id, name, r[0].n]
        );
        res.status(201).json({ id, name, builtin: false, subs: [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* PUT /api/categories/:id 重命名大类 { name } */
router.put('/:id', async (req, res) => {
    try {
        const name = str(req.body && req.body.name, 100).trim();
        if (!name) return res.status(400).json({ error: '大类名称不能为空' });
        const [r] = await pool.query('UPDATE categories SET name=? WHERE id=?', [name, req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '分类不存在' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* DELETE /api/categories/:id 删除大类（小类级联删除；历史/收藏中的名称快照不受影响） */
router.delete('/:id', async (req, res) => {
    try {
        const [r] = await pool.query('DELETE FROM categories WHERE id=?', [req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '分类不存在' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* POST /api/categories/:id/subs 新建小类 { name } */
router.post('/:id/subs', async (req, res) => {
    try {
        const name = str(req.body && req.body.name, 100).trim();
        if (!name) return res.status(400).json({ error: '小类名称不能为空' });
        const subId = req.params.id + '-' + uid('s').slice(2);
        const [r] = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 AS n FROM category_subs WHERE cat_id=?', [req.params.id]);
        await pool.query(
            'INSERT INTO category_subs (id, cat_id, name, sort_order) VALUES (?,?,?,?)',
            [subId, req.params.id, name, r[0].n]
        );
        res.status(201).json({ id: subId, name });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* PUT /api/categories/:id/subs/:subId 重命名小类 { name } */
router.put('/:id/subs/:subId', async (req, res) => {
    try {
        const name = str(req.body && req.body.name, 100).trim();
        if (!name) return res.status(400).json({ error: '小类名称不能为空' });
        const [r] = await pool.query('UPDATE category_subs SET name=? WHERE id=? AND cat_id=?', [name, req.params.subId, req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '小类不存在' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* DELETE /api/categories/:id/subs/:subId 删除小类 */
router.delete('/:id/subs/:subId', async (req, res) => {
    try {
        const [r] = await pool.query('DELETE FROM category_subs WHERE id=? AND cat_id=?', [req.params.subId, req.params.id]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '小类不存在' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/* POST /api/categories/restore 恢复缺失的内置分类（幂等） */
router.post('/restore', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id FROM categories');
        const existIds = new Set(rows.map(r => r.id));
        let added = 0;
        for (const dc of DEFAULT_CATEGORIES) {
            if (existIds.has(dc.id)) continue;
            await pool.query(
                'INSERT INTO categories (id, name, builtin, sort_order) VALUES (?,?,1,?)',
                [dc.id, dc.name, 999 + added]
            );
            for (const s of dc.subs) {
                await pool.query(
                    'INSERT IGNORE INTO category_subs (id, cat_id, name, sort_order) VALUES (?,?,?,?)',
                    [s.id, dc.id, s.name, 0]
                );
            }
            added++;
        }
        res.json({ ok: true, added });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
