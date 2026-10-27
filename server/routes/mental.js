/* ============================================================
 * 刷题计时器 - server/routes/mental.js
 * 速算练习 API：内置题库抽题 + 练习会话 + 作答/跳过 + 结算归档
 * 挂载路径：/api/mental
 * 结算（finish）时与题库练习一致：事务内归档一条历史记录
 * （rounds mode=mental + records），历史页可见可编辑可收藏。
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { asyncHandler, num, str, nowDateTime } = require('../utils');
const SEED_QUESTIONS = require('../mentalQuestions');

const router = express.Router();

const TYPE_NAMES = { percent: '百化分', compare: '分数比大小', estimate: '估算值', mixed: '综合练习' };
const VALID_TYPES = ['percent', 'compare', 'estimate', 'mixed'];

/* ---- 内置题库：表空时自动写入种子题目（幂等） ---- */
async function ensureSeed() {
    const [rows] = await pool.query('SELECT COUNT(*) AS n FROM mental_questions');
    if (rows[0].n > 0) return;
    const vals = [];
    const params = [];
    SEED_QUESTIONS.forEach(q => {
        vals.push('(?,?,?,?,?,?,?,?)');
        params.push(q.qtype, q.difficulty, q.stem, JSON.stringify(q.options), String(q.answer), q.tip, q.tag || '', 1);
    });
    await pool.query(
        `INSERT INTO mental_questions (qtype, difficulty, stem, options, answer, tip, tag, active)
         VALUES ${vals.join(',')}`,
        params
    );
}

/* 随机抽题：mixed 时三类各取 1/3 轮转，其余按题型抽；
   不足题量时按实际数量（会话 total_count 以实际为准） */
async function pickQuestions(qtype, difficulty, count) {
    const where = ['active=1'];
    const params = [];
    if (difficulty >= 1 && difficulty <= 3) {
        where.push('difficulty=?');
        params.push(difficulty);
    }
    const types = qtype === 'mixed' ? ['percent', 'compare', 'estimate'] : [qtype];
    const per = qtype === 'mixed' ? Math.ceil(count / 3) : count;
    let ids = [];
    for (const t of types) {
        const [rows] = await pool.query(
            `SELECT id FROM mental_questions WHERE qtype=? AND ${where.join(' AND ')} ORDER BY RAND() LIMIT ?`,
            [...params, t, per]
        );
        ids = ids.concat(rows.map(r => r.id));
    }
    // 洗牌并截断到 count；mixed 多取部分裁掉
    for (let i = ids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    }
    return ids.slice(0, count);
}

/* 格式化单题（供历史回看：映射选项下标 → 文本） */
function fmtRecordOpts(opts) {
    if (Array.isArray(opts)) return opts;
    try { const r = JSON.parse(opts); return Array.isArray(r) ? r : []; } catch (e) { return []; }
}

/* ---------- 练习会话 ---------- */

/* POST /api/mental/start { qtype, difficulty, count }
   创建会话并返回抽题（不含答案与技巧，作答接口才返回） */
router.post('/start', asyncHandler(async (req, res) => {
    await ensureSeed();
    const qtype = VALID_TYPES.includes(req.body && req.body.qtype) ? req.body.qtype : 'mixed';
    const difficulty = num(req.body && req.body.difficulty);
    const count = Math.min(30, Math.max(1, num(req.body && req.body.count) || 10));

    const ids = await pickQuestions(qtype, difficulty, count);
    if (ids.length === 0) return res.status(400).json({ error: '该题型暂无题目，请联系开发者补充内置题库' });

    const [r] = await pool.query(
        `INSERT INTO mental_sessions (qtype, qtype_name, difficulty, total_count)
         VALUES (?,?,?,?)`,
        [qtype, TYPE_NAMES[qtype], difficulty, ids.length]
    );
    const sessionId = r.insertId;

    const ph = ids.map(() => '?').join(',');
    const [qs] = await pool.query(
        `SELECT id, qtype, difficulty, stem, options FROM mental_questions WHERE id IN (${ph}) ORDER BY FIELD(id, ${ph})`,
        [...ids, ...ids]
    );
    res.status(201).json({
        sessionId,
        qtype,
        qtypeName: TYPE_NAMES[qtype],
        total: qs.length,
        questions: qs.map(q => ({
            id: q.id, qtype: q.qtype, difficulty: q.difficulty,
            stem: q.stem, options: fmtRecordOpts(q.options)
        }))
    });
}));

/* POST /api/mental/:id/answer { no, questionId, answer, ms }
   服务端判对错，返回正确答案文本与技巧提示；防重复作答 */
router.post('/:id/answer', asyncHandler(async (req, res) => {
    const sessionId = num(req.params.id);
    const no = num(req.body && req.body.no);
    const userAnswer = str(req.body && req.body.answer, 50).trim();
    const ms = num(req.body && req.body.ms);
    const questionId = num(req.body && req.body.questionId);
    if (!no) return res.status(400).json({ error: '缺少题号' });

    const [sRows] = await pool.query('SELECT id FROM mental_sessions WHERE id=?', [sessionId]);
    if (sRows.length === 0) return res.status(404).json({ error: '会话不存在' });
    const [ex] = await pool.query('SELECT id FROM mental_records WHERE session_id=? AND no=?', [sessionId, no]);
    if (ex.length > 0) return res.status(409).json({ error: '该题已作答' });

    const [q] = await pool.query(
        'SELECT id, qtype, stem, options, answer, tip FROM mental_questions WHERE id=?', [questionId]);
    if (q.length === 0) return res.status(400).json({ error: '题目不存在' });

    const correct = userAnswer === str(q[0].answer, 50);
    const result = correct ? 'ok' : 'ng';
    const now = nowDateTime();
    await pool.query(
        `INSERT INTO mental_records
            (session_id, question_id, no, qtype, stem, options, answer, tip, user_answer, result, ms, answered_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sessionId, questionId, no, q[0].qtype, q[0].stem, JSON.stringify(q[0].options),
         str(q[0].answer, 50), q[0].tip || '', userAnswer || null, result, ms, now]
    );
    await pool.query(
        `UPDATE mental_sessions SET done_count = done_count + 1,
         ${correct ? 'correct_count = correct_count + 1' : 'wrong_count = wrong_count + 1'}
         WHERE id=?`, [sessionId]
    );
    const opts = fmtRecordOpts(q[0].options);
    res.json({
        result,
        correctAnswer: opts[num(q[0].answer)] !== undefined ? opts[num(q[0].answer)] : str(q[0].answer, 50),
        tip: q[0].tip || ''
    });
}));

/* POST /api/mental/:id/skip { no, questionId, ms } */
router.post('/:id/skip', asyncHandler(async (req, res) => {
    const sessionId = num(req.params.id);
    const no = num(req.body && req.body.no);
    const ms = num(req.body && req.body.ms);
    const questionId = num(req.body && req.body.questionId);
    if (!no) return res.status(400).json({ error: '缺少题号' });

    const [ex] = await pool.query('SELECT id FROM mental_records WHERE session_id=? AND no=?', [sessionId, no]);
    if (ex.length > 0) return res.status(409).json({ error: '该题已作答' });

    const [q] = await pool.query(
        'SELECT id, qtype, stem, options, answer, tip FROM mental_questions WHERE id=?', [questionId]);
    if (q.length === 0) return res.status(400).json({ error: '题目不存在' });

    const now = nowDateTime();
    await pool.query(
        `INSERT INTO mental_records
            (session_id, question_id, no, qtype, stem, options, answer, tip, user_answer, result, ms, answered_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sessionId, questionId, no, q[0].qtype, q[0].stem, JSON.stringify(q[0].options),
         str(q[0].answer, 50), q[0].tip || '', null, 'skip', ms, now]
    );
    await pool.query('UPDATE mental_sessions SET skipped_count = skipped_count + 1 WHERE id=?', [sessionId]);
    const opts = fmtRecordOpts(q[0].options);
    res.json({
        result: 'skip',
        correctAnswer: opts[num(q[0].answer)] !== undefined ? opts[num(q[0].answer)] : str(q[0].answer, 50),
        tip: q[0].tip || ''
    });
}));

/* POST /api/mental/:id/finish { ms }
   结算会话 + 归档历史（rounds mode=mental + records，与题库练习同构） */
router.post('/:id/finish', asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const sessionId = num(req.params.id);
        const ms = num(req.body && req.body.ms);
        const now = nowDateTime();
        await conn.beginTransaction();

        const [s] = await conn.query(
            `UPDATE mental_sessions SET total_ms=?, finished_at=?,
             rate = ROUND(correct_count / total_count * 100, 1)
             WHERE id=? AND finished_at IS NULL`, [ms, now, sessionId]
        );
        if (s.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ error: '会话不存在或已结束' });
        }
        const [row] = await conn.query('SELECT * FROM mental_sessions WHERE id=?', [sessionId]);
        const r = row[0];

        /* 归档历史概要（rounds：mode=mental，分类为空） */
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
            [rid, 'mental', '速算练习', str(r.qtype_name, 100), '', now, r.total_count,
             r.total_ms, r.correct_count, r.rate, null, null, null, null]
        );
        /* 归档历史明细（records：累计用时 + 格式化时间） */
        const [recs] = await conn.query(
            'SELECT no, ms, result FROM mental_records WHERE session_id=? ORDER BY no ASC', [sessionId]
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
            correct: r.correct_count, wrong: r.wrong_count, skipped: r.skipped_count,
            totalMs: r.total_ms, archived: { id: rid }
        });
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}));

/* ---------- 历史 / 统计 ---------- */

/* GET /api/mental/history?page=1&limit=20 */
router.get('/history', asyncHandler(async (req, res) => {
    const page = Math.max(1, num(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, num(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM mental_sessions');
    const [rows] = await pool.query(
        `SELECT id, qtype, qtype_name, difficulty, total_count, done_count, correct_count,
                wrong_count, skipped_count, rate, total_ms, started_at, finished_at
         FROM mental_sessions ORDER BY id DESC LIMIT ? OFFSET ?`, [limit, offset]
    );
    res.json({ total, page, limit, list: rows });
}));

/* GET /api/mental/history/:id 单场明细（题目快照直接读取，无需联表） */
router.get('/history/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    const [s] = await pool.query('SELECT * FROM mental_sessions WHERE id=?', [id]);
    if (s.length === 0) return res.status(404).json({ error: '会话不存在' });
    const [recs] = await pool.query(
        'SELECT no, qtype, stem, options, answer, tip, user_answer, result, ms FROM mental_records WHERE session_id=? ORDER BY no ASC',
        [id]
    );
    res.json({
        session: s[0],
        records: recs.map(r => ({
            no: r.no, qtype: r.qtype, stem: r.stem,
            options: fmtRecordOpts(r.options), answer: r.answer,
            tip: r.tip || '', userAnswer: r.user_answer, result: r.result, ms: r.ms
        }))
    });
}));

/* GET /api/mental/stats（累计 + 今日概况） */
router.get('/stats', asyncHandler(async (req, res) => {
    const [[all]] = await pool.query(`
        SELECT COUNT(*) AS sessions,
               COALESCE(SUM(total_count),0) AS total_q,
               COALESCE(SUM(done_count),0) AS done_q,
               COALESCE(SUM(correct_count),0) AS correct_q,
               COALESCE(SUM(wrong_count),0) AS wrong_q,
               COALESCE(SUM(skipped_count),0) AS skip_q,
               COALESCE(SUM(total_ms),0) AS total_ms
        FROM mental_sessions WHERE finished_at IS NOT NULL`);
    const [[today]] = await pool.query(`
        SELECT COUNT(*) AS sessions,
               COALESCE(SUM(total_count),0) AS total_q,
               COALESCE(SUM(correct_count),0) AS correct_q,
               COALESCE(SUM(wrong_count),0) AS wrong_q,
               COALESCE(SUM(skipped_count),0) AS skip_q,
               COALESCE(SUM(total_ms),0) AS total_ms
        FROM mental_sessions WHERE finished_at IS NOT NULL AND DATE(finished_at) = CURDATE()`);
    const totalQ = Number(all.total_q || 0);
    const rate = totalQ ? Math.round(Number(all.correct_q) / totalQ * 1000) / 10 : 0;
    res.json({
        all: { sessions: all.sessions, totalQ: totalQ, correctQ: Number(all.correct_q), wrongQ: Number(all.wrong_q), skipQ: Number(all.skip_q), totalMs: Number(all.total_ms), rate },
        today: { sessions: today.sessions, totalQ: Number(today.total_q), correctQ: Number(today.correct_q), wrongQ: Number(today.wrong_q), skipQ: Number(today.skip_q), totalMs: Number(today.total_ms) }
    });
}));

module.exports = router;
