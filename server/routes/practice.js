/* ============================================================
 * 刷题计时器 - server/routes/practice.js
 * 练习模式 API：题库管理 + 题目管理 + 练习会话 + 历史/统计
 * 挂载路径：/api/practice
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { asyncHandler, num, str, nowDateTime } = require('../utils');

const router = express.Router();

/* ---------- 题库 ---------- */

/* 题库列表（含分类名称快照 + 题量） */
async function listBanks() {
    const [rows] = await pool.query(`
        SELECT b.id, b.name, b.cat_id, b.sub_id, b.description, b.created_at,
               c.name AS cat_name, s.name AS sub_name,
               (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id) AS count
        FROM question_banks b
        LEFT JOIN categories c ON c.id = b.cat_id
        LEFT JOIN category_subs s ON s.id = b.sub_id
        ORDER BY b.id ASC
    `);
    return rows.map(r => ({
        id: r.id, name: r.name, catId: r.cat_id, subId: r.sub_id,
        description: r.description, catName: r.cat_name, subName: r.sub_name,
        count: r.count, createdAt: r.created_at
    }));
}

/* GET /api/practice/banks */
router.get('/banks', asyncHandler(async (req, res) => {
        res.json(await listBanks());
}));

/* POST /api/practice/banks { name, catId, subId, description } */
router.post('/banks', asyncHandler(async (req, res) => {
        const name = str(req.body && req.body.name, 100).trim();
        if (!name) return res.status(400).json({ error: '题库名称不能为空' });
        const catId = str(req.body.catId, 32) || null;
        const subId = str(req.body.subId, 64) || null;
        const description = str(req.body.description, 255).trim();
        const [r] = await pool.query(
            'INSERT INTO question_banks (name, cat_id, sub_id, description) VALUES (?,?,?,?)',
            [name, catId, subId, description]
        );
        res.status(201).json({ id: r.insertId, name, catId, subId, description });
}));

/* PUT /api/practice/banks/:id */
router.put('/banks/:id', asyncHandler(async (req, res) => {
        const id = num(req.params.id);
        const name = str(req.body && req.body.name, 100).trim();
        if (!name) return res.status(400).json({ error: '题库名称不能为空' });
        const catId = str(req.body.catId, 32) || null;
        const subId = str(req.body.subId, 64) || null;
        const description = str(req.body.description, 255).trim();
        const [r] = await pool.query(
            'UPDATE question_banks SET name=?, cat_id=?, sub_id=?, description=? WHERE id=?',
            [name, catId, subId, description, id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: '题库不存在' });
        res.json({ ok: true });
}));

/* DELETE /api/practice/banks/:id（级联删除题目） */
router.delete('/banks/:id', asyncHandler(async (req, res) => {
        const [r] = await pool.query('DELETE FROM question_banks WHERE id=?', [num(req.params.id)]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '题库不存在' });
        res.json({ ok: true });
}));

/* ---------- 题目 ---------- */

/* GET /api/practice/banks/:id/questions */
router.get('/banks/:id/questions', asyncHandler(async (req, res) => {
        const [rows] = await pool.query(
            'SELECT id, bank_id, type, stem, options, answer, analysis, difficulty, source FROM questions WHERE bank_id=? ORDER BY id ASC',
            [num(req.params.id)]
        );
        res.json(rows);
}));

/* POST /api/practice/questions { bankId, type, stem, options, answer, analysis, difficulty, source } */
router.post('/questions', asyncHandler(async (req, res) => {
        const bankId = num(req.body && req.body.bankId);
        const stem = str(req.body && req.body.stem, 20000).trim();
        if (!bankId) return res.status(400).json({ error: '缺少题库ID' });
        if (!stem) return res.status(400).json({ error: '题干不能为空' });
        const type = str(req.body.type, 10) || 'single';
        const options = JSON.stringify(req.body.options || []);
        const answer = str(req.body.answer, 50).trim();
        if (!answer) return res.status(400).json({ error: '正确答案不能为空' });
        const analysis = str(req.body.analysis, 20000).trim();
        const difficulty = Math.min(3, Math.max(1, num(req.body.difficulty) || 2));
        const source = str(req.body.source, 100).trim();
        const [r] = await pool.query(
            'INSERT INTO questions (bank_id, type, stem, options, answer, analysis, difficulty, source) VALUES (?,?,?,?,?,?,?,?)',
            [bankId, type, stem, options, answer, analysis, difficulty, source]
        );
        res.status(201).json({ id: r.insertId });
}));

/* PUT /api/practice/questions/:id */
router.put('/questions/:id', asyncHandler(async (req, res) => {
        const id = num(req.params.id);
        const stem = str(req.body && req.body.stem, 20000).trim();
        if (!stem) return res.status(400).json({ error: '题干不能为空' });
        const type = str(req.body.type, 10) || 'single';
        const options = JSON.stringify(req.body.options || []);
        const answer = str(req.body.answer, 50).trim();
        if (!answer) return res.status(400).json({ error: '正确答案不能为空' });
        const analysis = str(req.body.analysis, 20000).trim();
        const difficulty = Math.min(3, Math.max(1, num(req.body.difficulty) || 2));
        const source = str(req.body.source, 100).trim();
        const [r] = await pool.query(
            'UPDATE questions SET type=?, stem=?, options=?, answer=?, analysis=?, difficulty=?, source=? WHERE id=?',
            [type, stem, options, answer, analysis, difficulty, source, id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: '题目不存在' });
        res.json({ ok: true });
}));

/* DELETE /api/practice/questions/:id */
router.delete('/questions/:id', asyncHandler(async (req, res) => {
        const [r] = await pool.query('DELETE FROM questions WHERE id=?', [num(req.params.id)]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '题目不存在' });
        res.json({ ok: true });
}));

/* ---------- 练习会话 ---------- */

/* 抽题：order=顺序 random=随机 review=该题库历史错题（不足补随机） */
async function pickQuestions(bankId, mode, count) {
    const bank = await pool.query('SELECT * FROM question_banks WHERE id=?', [bankId]);
    if (bank[0].length === 0) return null;
    const limit = Math.max(1, count);
    let ids = [];
    if (mode === 'review') {
        const [wrong] = await pool.query(`
            SELECT q.id FROM practice_records pr
            JOIN practice_sessions s ON s.id = pr.session_id
            JOIN questions q ON q.id = pr.question_id
            WHERE s.bank_id = ? AND pr.result = 'ng'
            GROUP BY q.id ORDER BY MAX(pr.id) DESC LIMIT ?`, [bankId, limit]);
        ids = wrong.map(w => w.id);
    }
    if (ids.length < limit) {
        const need = limit - ids.length;
        const [qs] = await pool.query(
            'SELECT id FROM questions WHERE bank_id=? ORDER BY id ASC LIMIT ?',
            [bankId, need]
        );
        // 排除已选错题
        const exist = new Set(ids);
        const add = qs.filter(q => !exist.has(q.id)).map(q => q.id);
        ids = ids.concat(add);
    }
    return { bank: bank[0][0], ids };
}

/* POST /api/practice/start { bankId, mode, count } */
router.post('/start', asyncHandler(async (req, res) => {
        const bankId = num(req.body && req.body.bankId);
        const mode = ['order', 'random', 'review'].includes(req.body && req.body.mode) ? req.body.mode : 'order';
        const count = num(req.body && req.body.count) || 10;
        const picked = await pickQuestions(bankId, mode, count);
        if (!picked) return res.status(404).json({ error: '题库不存在' });
        const b = picked.bank;
        const qIds = picked.ids;
        if (qIds.length === 0) return res.status(400).json({ error: '该题库暂无题目，请先在题库管理中录入题目' });

        // 查分类快照
        const catName = b.cat_id ? (await pool.query('SELECT name FROM categories WHERE id=?', [b.cat_id]))[0][0]?.name || '' : '';
        const subName = b.sub_id ? (await pool.query('SELECT name FROM category_subs WHERE id=?', [b.sub_id]))[0][0]?.name || '' : '';

        const [r] = await pool.query(
            `INSERT INTO practice_sessions (bank_id, bank_name, mode, total_count, cat_id, cat_name, sub_id, sub_name)
             VALUES (?,?,?,?,?,?,?,?)`,
            [bankId, b.name, mode, qIds.length, b.cat_id, catName, b.sub_id, subName]
        );
        const sessionId = r.insertId;

        // 查题目（不含 answer/analysis）
        const ph = qIds.map(() => '?').join(',');
        const [qs] = await pool.query(
            `SELECT id, type, stem, options, difficulty FROM questions WHERE id IN (${ph}) ORDER BY FIELD(id, ${ph})`,
            [...qIds, ...qIds]
        );
        res.status(201).json({
            sessionId,
            bank: { id: b.id, name: b.name, catName, subName },
            mode,
            questions: qs.map(q => ({ id: q.id, type: q.type, stem: q.stem, options: q.options, difficulty: q.difficulty })),
            total: qs.length
        });
}));

/* POST /api/practice/:id/answer { no, answer, ms } */
router.post('/:id/answer', asyncHandler(async (req, res) => {
        const sessionId = num(req.params.id);
        const no = num(req.body && req.body.no);
        const userAnswer = str(req.body && req.body.answer, 50).trim();
        const ms = num(req.body && req.body.ms);
        if (!no) return res.status(400).json({ error: '缺少题号' });

        const [sRows] = await pool.query('SELECT * FROM practice_sessions WHERE id=?', [sessionId]);
        if (sRows.length === 0) return res.status(404).json({ error: '会话不存在' });
        // 防止重复作答同号题
        const [ex] = await pool.query('SELECT id FROM practice_records WHERE session_id=? AND no=?', [sessionId, no]);
        if (ex.length > 0) return res.status(409).json({ error: '该题已作答' });

        const questionId = num(req.body && req.body.questionId);
        const [q] = await pool.query('SELECT id, answer, analysis, stem, options, type FROM questions WHERE id=?', [questionId]);
        if (q.length === 0) return res.status(400).json({ error: '题目不存在' });

        const correct = userAnswer === str(q[0].answer, 50);
        const result = correct ? 'ok' : 'ng';
        const now = nowDateTime();
        await pool.query(
            'INSERT INTO practice_records (session_id, question_id, no, user_answer, result, ms, answered_at) VALUES (?,?,?,?,?,?,?)',
            [sessionId, questionId, no, userAnswer || null, result, ms, now]
        );
        await pool.query(
            `UPDATE practice_sessions SET done_count = done_count + 1,
             ${correct ? 'correct_count = correct_count + 1' : 'wrong_count = wrong_count + 1'}
             WHERE id=?`, [sessionId]
        );
        res.json({ result, correctAnswer: str(q[0].answer, 50), analysis: q[0].analysis, stem: q[0].stem, options: q[0].options });
}));

/* POST /api/practice/:id/skip { no, ms } */
router.post('/:id/skip', asyncHandler(async (req, res) => {
        const sessionId = num(req.params.id);
        const no = num(req.body && req.body.no);
        const ms = num(req.body && req.body.ms);
        if (!no) return res.status(400).json({ error: '缺少题号' });
        const [ex] = await pool.query('SELECT id FROM practice_records WHERE session_id=? AND no=?', [sessionId, no]);
        if (ex.length > 0) return res.status(409).json({ error: '该题已作答' });
        const questionId = num(req.body && req.body.questionId);
        const [q] = await pool.query('SELECT id, answer, analysis FROM questions WHERE id=?', [questionId]);
        if (q.length === 0) return res.status(400).json({ error: '题目不存在' });
        const now = nowDateTime();
        await pool.query(
            'INSERT INTO practice_records (session_id, question_id, no, user_answer, result, ms, answered_at) VALUES (?,?,?,?,?,?,?)',
            [sessionId, questionId, no, null, 'skip', ms, now]
        );
        await pool.query('UPDATE practice_sessions SET skipped_count = skipped_count + 1 WHERE id=?', [sessionId]);
        res.json({ result: 'skip', correctAnswer: str(q[0].answer, 50), analysis: q[0].analysis });
}));

/* POST /api/practice/:id/finish { ms }
   结算练习会话：更新汇总，并把本轮练习归档为一条历史记录
   （rounds + records 同主模式格式；note 留空，历史页可编辑/收藏/删除） */
router.post('/:id/finish', asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const sessionId = num(req.params.id);
        const ms = num(req.body && req.body.ms);
        const now = nowDateTime();
        await conn.beginTransaction();
        const [s] = await conn.query(
            `UPDATE practice_sessions SET total_ms = ?, finished_at = ?,
             rate = ROUND(correct_count / total_count * 100, 1)
             WHERE id = ? AND finished_at IS NULL`, [ms, now, sessionId]
        );
        if (s.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: '会话不存在或已结束' });
        }
        const [row] = await conn.query('SELECT * FROM practice_sessions WHERE id=?', [sessionId]);
        const r = row[0];

        // 归档历史概要（rounds）
        const rid = Date.now();
        const fmt = t => {
            const totalSec = t / 1000;
            const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0');
            const seconds = (totalSec % 60).toFixed(2).padStart(5, '0');
            return minutes + ':' + seconds;
        };
        await conn.query(
            `INSERT INTO rounds
                (id, mode, mode_name, title, description, finished_at, max_count,
                 total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [rid, 'practice', '练习模式', str(r.bank_name, 100), '', now, r.total_count,
             r.total_ms, r.correct_count, r.rate, r.cat_id, r.cat_name, r.sub_id, r.sub_name]
        );
        // 归档历史明细（records：累计用时 + 格式化时间）
        const [recs] = await conn.query(
            'SELECT no, ms, result FROM practice_records WHERE session_id=? ORDER BY no ASC', [sessionId]
        );
        if (recs.length) {
            let cum = 0;
            const vals = [];
            const params = [];
            recs.forEach(rr => {
                cum += num(rr.ms);
                vals.push('(?,?,?,?,?,?,?)');
                params.push(rid, rr.no, num(rr.ms), cum, fmt(cum),
                    rr.result === 'ok' || rr.result === 'ng' || rr.result === 'skip' ? rr.result : 'ok', '');
            });
            await conn.query(
                `INSERT INTO records (round_id, no, ms, cum_ms, time_str, result, note) VALUES ${vals.join(',')}`,
                params
            );
        }
        await conn.commit();
        res.json({
            id: r.id, rate: r.rate, total: r.total_count, done: r.done_count,
            correct: r.correct_count, wrong: r.wrong_count, skipped: r.skipped_count, totalMs: r.total_ms,
            archived: { id: rid }
        });
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}));

/* ---------- 历史 / 统计 ---------- */

/* GET /api/practice/history?page=1&limit=20 */
router.get('/history', asyncHandler(async (req, res) => {
        const page = Math.max(1, num(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, num(req.query.limit) || 20));
        const offset = (page - 1) * limit;
        const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM practice_sessions');
        const [rows] = await pool.query(
            `SELECT id, bank_name, mode, total_count, done_count, correct_count, wrong_count, skipped_count,
                    rate, total_ms, cat_name, sub_name, started_at, finished_at
             FROM practice_sessions ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset]
        );
        res.json({ total, page, limit, list: rows });
}));

/* GET /api/practice/history/:id（含每题明细；题目被删时题干显示占位） */
router.get('/history/:id', asyncHandler(async (req, res) => {
        const id = num(req.params.id);
        const [s] = await pool.query('SELECT * FROM practice_sessions WHERE id=?', [id]);
        if (s.length === 0) return res.status(404).json({ error: '会话不存在' });
        const [recs] = await pool.query(`
            SELECT pr.no, pr.question_id, pr.user_answer, pr.result, pr.ms,
                   q.stem, q.answer AS correct_answer, q.analysis, q.options
            FROM practice_records pr
            LEFT JOIN questions q ON q.id = pr.question_id
            ORDER BY pr.no ASC`, [id]);
        res.json({ session: s[0], records: recs.map(r => ({
            no: r.no, questionId: r.question_id, userAnswer: r.user_answer, result: r.result, ms: r.ms,
            stem: r.stem || '（题目已删除）', correctAnswer: r.correct_answer || '', analysis: r.analysis || '',
            options: r.options
        })) });
}));

/* GET /api/practice/stats（累计 + 今日概况） */
router.get('/stats', asyncHandler(async (req, res) => {
        const [[all]] = await pool.query(`
            SELECT COUNT(*) AS sessions,
                   COALESCE(SUM(total_count),0) AS total_q,
                   COALESCE(SUM(done_count),0) AS done_q,
                   COALESCE(SUM(correct_count),0) AS correct_q,
                   COALESCE(SUM(wrong_count),0) AS wrong_q,
                   COALESCE(SUM(skipped_count),0) AS skip_q,
                   COALESCE(SUM(total_ms),0) AS total_ms
            FROM practice_sessions WHERE finished_at IS NOT NULL`);
        const [[today]] = await pool.query(`
            SELECT COUNT(*) AS sessions,
                   COALESCE(SUM(total_count),0) AS total_q,
                   COALESCE(SUM(correct_count),0) AS correct_q,
                   COALESCE(SUM(wrong_count),0) AS wrong_q,
                   COALESCE(SUM(skipped_count),0) AS skip_q,
                   COALESCE(SUM(total_ms),0) AS total_ms
            FROM practice_sessions WHERE finished_at IS NOT NULL AND DATE(finished_at) = CURDATE()`);
        const rate = all.total_q ? Math.round(all.correct_q / all.total_q * 1000) / 10 : 0;
        res.json({
            all: { sessions: all.sessions, totalQ: all.total_q, correctQ: all.correct_q, wrongQ: all.wrong_q, skipQ: all.skip_q, totalMs: all.total_ms, rate },
            today: { sessions: today.sessions, totalQ: today.total_q, correctQ: today.correct_q, wrongQ: today.wrong_q, skipQ: today.skip_q, totalMs: today.total_ms }
        });
}));

module.exports = router;
