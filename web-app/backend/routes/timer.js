/* ============================================================
 * 刷题计时器 - server/routes/timer.js
 * 计时模式 API：单题计时 / 整组计时（归档到 rounds + records）
 * 挂载路径：/api/timer
 * 前端本地计时，结束/逐题分段后一次性上报归档
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { asyncHandler, num, str, nowDateTime } = require('../utils');
const { getUserId } = require('../utils/auth');

const router = express.Router();

/* 归档：把一段计时轮次写入 rounds + records（结构同练习模式 finish 的归档段） */
async function archiveRound(uid, payload) {
    const mode = ['single', 'batch'].includes(payload.mode) ? payload.mode : 'single';
    const modeName = mode === 'single' ? '单题模式' : '整组模式';
    const title = str(payload.title, 100).trim() || modeName;
    const description = str(payload.description, 255).trim();
    const maxCount = Math.min(200, Math.max(1, Math.floor(num(payload.maxCount)) || 20));
    const totalMs = Math.max(0, Math.floor(num(payload.totalMs)));
    const catId = str(payload.catId, 32) || null;
    const catName = str(payload.catName, 100).trim() || null;
    const subId = str(payload.subId, 64) || null;
    const subName = str(payload.subName, 100).trim() || null;

    /* 明细校验：no 从 1 连续递增，ms/result 合法 */
    const raw = Array.isArray(payload.records) ? payload.records : [];
    if (raw.length === 0) return { error: '没有题目明细，无法归档' };
    const records = [];
    for (let i = 0; i < raw.length; i++) {
        const no = num(raw[i].no);
        if (no !== i + 1) return { error: `题号必须从 1 连续递增（第 ${i + 1} 条不合法）` };
        const ms = Math.max(0, Math.floor(num(raw[i].ms)));
        const result = ['ok', 'ng', 'skip'].includes(raw[i].result) ? raw[i].result : 'ok';
        records.push({ no, ms, result });
    }

    const rid = Date.now();
    const correct = records.filter(r => r.result === 'ok').length;
    const rate = +(correct / maxCount * 100).toFixed(1);
    const fmt = t => {
        const totalSec = t / 1000;
        const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const seconds = (totalSec % 60).toFixed(2).padStart(5, '0');
        return minutes + ':' + seconds;
    };

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            `INSERT INTO rounds
                (id, user_id, mode, mode_name, title, description, finished_at, max_count,
                 total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [rid, uid, mode, modeName, title, description, nowDateTime(), maxCount,
             totalMs, correct, rate, catId, catName, subId, subName]
        );
        let cum = 0;
        const vals = [];
        const params = [];
        records.forEach(r => {
            cum += r.ms;
            vals.push('(?,?,?,?,?,?,?)');
            params.push(rid, r.no, r.ms, cum, fmt(cum), r.result, '');
        });
        await conn.query(
            `INSERT INTO records (round_id, no, ms, cum_ms, time_str, result, note) VALUES ${vals.join(',')}`,
            params
        );
        await conn.commit();
        return { id: rid, rate, total: records.length, correct, totalMs };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

/* POST /api/timer/finish { mode, title, description, maxCount, totalMs, catId, catName, subId, subName, records:[{no,ms,result}] } */
router.post('/finish', asyncHandler(async (req, res) => {
    const uid = getUserId(req);
    const r = await archiveRound(uid, req.body || {});
    if (r.error) return res.status(400).json({ error: r.error });
    res.status(201).json(r);
}));

/* GET /api/timer/history?page=&limit=&mode= 计时历史（mode=single|batch，可过滤） */
router.get('/history', asyncHandler(async (req, res) => {
    const page = Math.max(1, Math.floor(num(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, Math.floor(num(req.query.limit)) || 20));
    const offset = (page - 1) * limit;
    const where = ['user_id=?', "mode IN ('single','batch')"];
    const params = [getUserId(req)];
    if (req.query.mode === 'single' || req.query.mode === 'batch') {
        where.push('mode=?');
        params.push(req.query.mode);
    }
    const whereSql = 'WHERE ' + where.join(' AND ');
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM rounds ${whereSql}`, params);
    const [rows] = await pool.query(
        `SELECT r.id, r.mode, r.mode_name, r.title, r.description, r.finished_at, r.max_count,
                r.total_ms, r.correct, r.rate, r.cat_id, r.cat_name, r.sub_id, r.sub_name,
                (SELECT COUNT(*) FROM records rc WHERE rc.round_id = r.id) AS questions
         FROM rounds r ${whereSql} ORDER BY r.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]
    );
    res.json({
        total, page, limit,
        list: rows.map(x => ({
            id: x.id, mode: x.mode, modeName: x.mode_name, title: x.title, description: x.description,
            finishedAt: x.finished_at, maxCount: x.max_count, totalMs: x.total_ms,
            correct: x.correct, rate: x.rate, catId: x.cat_id, catName: x.cat_name,
            subId: x.sub_id, subName: x.sub_name, questions: x.questions
        }))
    });
}));

/* GET /api/timer/history/:id 单轮详情（含逐题明细） */
router.get('/history/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    const uid = getUserId(req);
    const [s] = await pool.query(
        `SELECT id, mode, mode_name, title, description, finished_at, max_count, total_ms, correct, rate,
                cat_id, cat_name, sub_id, sub_name FROM rounds WHERE id=? AND user_id=? AND mode IN ('single','batch')`,
        [id, uid]
    );
    if (s.length === 0) return res.status(404).json({ error: '计时记录不存在' });
    const r = s[0];
    const [recs] = await pool.query(
        'SELECT no, ms, cum_ms, time_str, result, note FROM records WHERE round_id=? ORDER BY no ASC', [id]
    );
    res.json({
        round: {
            id: r.id, mode: r.mode, modeName: r.mode_name, title: r.title, description: r.description,
            finishedAt: r.finished_at, maxCount: r.max_count, totalMs: r.total_ms,
            correct: r.correct, rate: r.rate, catId: r.cat_id, catName: r.cat_name,
            subId: r.sub_id, subName: r.sub_name
        },
        records: recs.map(x => ({ no: x.no, ms: x.ms, cumMs: x.cum_ms, timeStr: x.time_str, result: x.result, note: x.note }))
    });
}));

/* DELETE /api/timer/history/:id */
router.delete('/history/:id', asyncHandler(async (req, res) => {
    const uid = getUserId(req);
    const [r] = await pool.query(
        'DELETE FROM rounds WHERE id=? AND user_id=? AND mode IN (\'single\',\'batch\')',
        [num(req.params.id), uid]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '计时记录不存在' });
    res.json({ ok: true });
}));

/* DELETE /api/timer/history 清空计时历史 */
router.delete('/history', asyncHandler(async (req, res) => {
    const uid = getUserId(req);
    await pool.query("DELETE FROM rounds WHERE user_id=? AND mode IN ('single','batch')", [uid]);
    res.json({ ok: true });
}));

/* GET /api/timer/stats 计时统计（累计 + 今日） */
router.get('/stats', asyncHandler(async (req, res) => {
    const uid = getUserId(req);
    const [[all]] = await pool.query(
        `SELECT COUNT(*) AS rounds,
                (SELECT COUNT(*) FROM records rc WHERE rc.round_id IN
                    (SELECT id FROM rounds WHERE user_id=? AND mode IN ('single','batch'))) AS questions,
                COALESCE(SUM(correct),0) AS correct,
                COALESCE(SUM(total_ms),0) AS total_ms
         FROM rounds WHERE user_id=? AND mode IN ('single','batch')`, [uid, uid]
    );
    const [[today]] = await pool.query(
        `SELECT COUNT(*) AS rounds,
                (SELECT COUNT(*) FROM records rc WHERE rc.round_id IN
                    (SELECT id FROM rounds WHERE user_id=? AND mode IN ('single','batch') AND DATE(finished_at)=CURDATE())) AS questions,
                COALESCE(SUM(correct),0) AS correct,
                COALESCE(SUM(total_ms),0) AS total_ms
         FROM rounds WHERE user_id=? AND mode IN ('single','batch') AND DATE(finished_at)=CURDATE()`, [uid, uid]
    );
    res.json({
        all: { rounds: Number(all.rounds), questions: Number(all.questions), correct: Number(all.correct), totalMs: Number(all.total_ms) },
        today: { rounds: Number(today.rounds), questions: Number(today.questions), correct: Number(today.correct), totalMs: Number(today.total_ms) }
    });
}));

module.exports = router;
