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

/* 题库列表（含分类名称快照 + 题量；题量只计未停用题目） */
async function listBanks() {
    const [rows] = await pool.query(`
        SELECT b.id, b.name, b.cat_id, b.sub_id, b.description, b.created_at,
               c.name AS cat_name, s.name AS sub_name,
               (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id AND q.is_deleted = 0) AS count
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

/* ---------- 图片题目（方案C）：base64 内嵌，单图 ≤300KB，整包 ≤40MB ---------- */
const MAX_IMG_BYTES = 300 * 1024;
const MAX_IMG_COUNT = 20;
const MAX_TOTAL_IMG_KB = 40 * 1024;
const IMG_RE = /^data:image\/(png|jpeg|jpg|gif|webp|svg\+xml);base64,/;
const imgKB = s => Math.round(s.length * 0.75 / 1024);

/* 校验题干图数组：合法返回 { value: JSON字符串|null }，非法返回 { error } */
function parseStemImg(v) {
    if (v === undefined || v === null || v === '') return { value: null };
    if (!Array.isArray(v)) return { error: 'stemImg 必须是数组' };
    if (v.length === 0) return { value: null };
    if (v.length > MAX_IMG_COUNT) return { error: `题干图最多 ${MAX_IMG_COUNT} 张` };
    for (const s of v) {
        if (typeof s !== 'string' || !IMG_RE.test(s)) return { error: '题干图必须是 data:image base64 字符串' };
        const kb = imgKB(s);
        if (kb > MAX_IMG_BYTES / 1024) return { error: `单张题干图不能超过 300KB（当前约 ${kb}KB）` };
    }
    return { value: JSON.stringify(v) };
}

/* 校验选项数组（options[].img 同约束）：合法返回 { value: JSON字符串 }，非法返回 { error } */
function parseOptions(v) {
    const arr = Array.isArray(v) ? v : [];
    for (const o of arr) {
        if (o && typeof o === 'object' && o.img) {
            if (typeof o.img !== 'string' || !IMG_RE.test(o.img)) return { error: '选项图片必须是 data:image base64 字符串' };
            const kb = imgKB(o.img);
            if (kb > MAX_IMG_BYTES / 1024) return { error: `选项图片不能超过 300KB（当前约 ${kb}KB）` };
        }
    }
    return { value: JSON.stringify(arr) };
}

/* 整包图片载荷估算（题干图 + 选项图 base64 总长度 → KB），超 40MB 拒绝；批量导入遍历 questions[] */
function totalImgKB(body) {
    let chars = 0;
    const b = body || {};
    const countOne = (x) => {
        if (!x || typeof x !== 'object') return;
        if (Array.isArray(x.stemImg)) for (const s of x.stemImg) chars += s.length;
        if (Array.isArray(x.options)) for (const o of x.options) if (o && typeof o === 'object' && o.img) chars += o.img.length;
    };
    countOne(b);
    if (Array.isArray(b.questions)) for (const q of b.questions) countOne(q);
    return Math.round(chars * 0.75 / 1024);
}

/* GET /api/practice/banks/:id/questions?page=&pageSize=&includeDeleted=1
   后端分页：传 page/pageSize 返回 { total, list }，否则返回全量数组（供编辑弹窗使用）
   默认只返回未停用题目（is_deleted=0）；includeDeleted=1 时返回全部并带 is_deleted 字段（管理已停用列表用） */
router.get('/banks/:id/questions', asyncHandler(async (req, res) => {
        const bankId = num(req.params.id);
        /* status: normal=仅正常(默认) deleted=仅已停用 all=全部(带 is_deleted)；兼容旧参数 includeDeleted=1（等价 all） */
        let status = str(req.query.status) || 'normal';
        if (req.query.includeDeleted === '1') status = 'all';
        if (!['normal', 'deleted', 'all'].includes(status)) status = 'normal';
        const showIsDeleted = status !== 'normal';
        const statusWhere = status === 'normal' ? 'AND q.is_deleted = 0' : status === 'deleted' ? 'AND q.is_deleted = 1' : '';
        const page = Math.floor(num(req.query.page));
        const pageSize = Math.floor(num(req.query.pageSize));
        const cols = 'q.id, q.bank_id, q.type, q.stem, q.stem_img, q.options, q.answer, q.analysis, q.difficulty, q.source' + (showIsDeleted ? ', q.is_deleted' : '');
        if (page >= 1 && pageSize >= 1) {
            const [cnt] = await pool.query(`SELECT COUNT(*) c FROM questions q WHERE q.bank_id=? ${statusWhere}`, [bankId]);
            const [rows] = await pool.query(
                `SELECT ${cols}
                 FROM questions q WHERE q.bank_id=? ${statusWhere} ORDER BY q.id ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
                [bankId]
            );
            return res.json({ total: cnt[0].c, list: rows });
        }
        const [rows] = await pool.query(
            `SELECT ${cols} FROM questions q WHERE q.bank_id=? ${statusWhere} ORDER BY q.id ASC`,
            [bankId]
        );
        res.json(rows);
}));

/* POST /api/practice/questions { bankId, type, stem, stemImg, options, answer, analysis, difficulty, source } */
router.post('/questions', asyncHandler(async (req, res) => {
        const bankId = num(req.body && req.body.bankId);
        const stem = str(req.body && req.body.stem, 20000).trim();
        if (!bankId) return res.status(400).json({ error: '缺少题库ID' });
        const stemImgRes = parseStemImg(req.body && req.body.stemImg);
        if (stemImgRes.error) return res.status(400).json({ error: stemImgRes.error });
        if (!stem && !stemImgRes.value) return res.status(400).json({ error: '题干文字或题干图至少填一项' });
        const optRes = parseOptions(req.body && req.body.options);
        if (optRes.error) return res.status(400).json({ error: optRes.error });
        if (totalImgKB(req.body) > MAX_TOTAL_IMG_KB) return res.status(400).json({ error: '图片总大小不能超过 40MB，请压缩图片后重试' });
        const type = str(req.body.type, 10) || 'single';
        const options = optRes.value;
        const answer = str(req.body.answer, 50).trim();
        if (!answer) return res.status(400).json({ error: '正确答案不能为空' });
        const analysis = str(req.body.analysis, 20000).trim();
        const difficulty = Math.min(3, Math.max(1, num(req.body.difficulty) || 2));
        const source = str(req.body.source, 100).trim();
        const [r] = await pool.query(
            'INSERT INTO questions (bank_id, type, stem, stem_img, options, answer, analysis, difficulty, source) VALUES (?,?,?,?,?,?,?,?,?)',
            [bankId, type, stem, stemImgRes.value, options, answer, analysis, difficulty, source]
        );
        res.status(201).json({ id: r.insertId });
}));

/* PUT /api/practice/questions/:id */
router.put('/questions/:id', asyncHandler(async (req, res) => {
        const id = num(req.params.id);
        const stem = str(req.body && req.body.stem, 20000).trim();
        const stemImgRes = parseStemImg(req.body && req.body.stemImg);
        if (stemImgRes.error) return res.status(400).json({ error: stemImgRes.error });
        if (!stem && !stemImgRes.value) return res.status(400).json({ error: '题干文字或题干图至少填一项' });
        const optRes = parseOptions(req.body && req.body.options);
        if (optRes.error) return res.status(400).json({ error: optRes.error });
        if (totalImgKB(req.body) > MAX_TOTAL_IMG_KB) return res.status(400).json({ error: '图片总大小不能超过 40MB，请压缩图片后重试' });
        const type = str(req.body.type, 10) || 'single';
        const options = optRes.value;
        const answer = str(req.body.answer, 50).trim();
        if (!answer) return res.status(400).json({ error: '正确答案不能为空' });
        const analysis = str(req.body.analysis, 20000).trim();
        const difficulty = Math.min(3, Math.max(1, num(req.body.difficulty) || 2));
        const source = str(req.body.source, 100).trim();
        const [r] = await pool.query(
            'UPDATE questions SET type=?, stem=?, stem_img=?, options=?, answer=?, analysis=?, difficulty=?, source=? WHERE id=?',
            [type, stem, stemImgRes.value, options, answer, analysis, difficulty, source, id]
        );
        if (r.affectedRows === 0) return res.status(404).json({ error: '题目不存在' });
        res.json({ ok: true });
}));

/* DELETE /api/practice/questions/:id 停用（逻辑删除）题目，可随时恢复 */
router.delete('/questions/:id', asyncHandler(async (req, res) => {
        const [r] = await pool.query('UPDATE questions SET is_deleted = 1 WHERE id=?', [num(req.params.id)]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '题目不存在' });
        res.json({ ok: true });
}));

/* POST /api/practice/questions/:id/restore 恢复（取消停用） */
router.post('/questions/:id/restore', asyncHandler(async (req, res) => {
        const [r] = await pool.query('UPDATE questions SET is_deleted = 0 WHERE id=?', [num(req.params.id)]);
        if (r.affectedRows === 0) return res.status(404).json({ error: '题目不存在' });
        res.json({ ok: true });
}));

/* ---------- 练习会话 ---------- */

/* 抽题：order=顺序 random=随机 review=该题库历史错题（不足补随机）；只从未停用题目中抽 */
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
            WHERE s.bank_id = ? AND pr.result = 'ng' AND q.is_deleted = 0
            GROUP BY q.id ORDER BY MAX(pr.id) DESC LIMIT ?`, [bankId, limit]);
        ids = wrong.map(w => w.id);
    }
    if (ids.length < limit) {
        const need = limit - ids.length;
        // 补题：SQL 直接排除已选并补足数量（LIMIT 后再去重会导致补题不足）；order 按题号顺序，random/review 补题随机
        const excl = ids.length ? ` AND id NOT IN (${ids.map(() => '?').join(',')})` : '';
        const order = mode === 'order' ? 'ORDER BY id ASC' : 'ORDER BY RAND()';
        const [qs] = await pool.query(
            `SELECT id FROM questions WHERE bank_id=? AND is_deleted = 0${excl} ${order} LIMIT ?`,
            [bankId, ...ids, need]
        );
        ids = ids.concat(qs.map(q => q.id));
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
            `SELECT id, type, stem, stem_img, options, difficulty FROM questions WHERE id IN (${ph}) ORDER BY FIELD(id, ${ph})`,
            [...qIds, ...qIds]
        );
        res.status(201).json({
            sessionId,
            bank: { id: b.id, name: b.name, catName, subName },
            mode,
            questions: qs.map(q => ({ id: q.id, type: q.type, stem: q.stem, stemImg: q.stem_img || null, options: q.options, difficulty: q.difficulty })),
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
        if (sRows[0].finished_at) return res.status(400).json({ error: '该会话已结算，不能再作答' });
        // 防止重复作答同号题
        const [ex] = await pool.query('SELECT id FROM practice_records WHERE session_id=? AND no=?', [sessionId, no]);
        if (ex.length > 0) return res.status(409).json({ error: '该题已作答' });

        const questionId = num(req.body && req.body.questionId);
        const [q] = await pool.query('SELECT id, answer, analysis, stem, stem_img, options, type FROM questions WHERE id=?', [questionId]);
        if (q.length === 0) return res.status(400).json({ error: '题目不存在' });

        /* 判分归一：多选按字母集合比较（容忍顺序差异），判断题 A/B 与 T/F 互通，其余严格全等 */
        const normAns = (t, a) => {
            const s = String(a == null ? '' : a).replace(/\s+/g, '').toUpperCase();
            if (t === 'judge') return (s === 'A' || s === 'T' || s === '1') ? 'T' : (s === 'B' || s === 'F' || s === '0') ? 'F' : s;
            if (t === 'multi') return s.split('').filter(c => c >= 'A' && c <= 'Z').sort().join('');
            return s;
        };
        const correct = normAns(q[0].type, userAnswer) === normAns(q[0].type, q[0].answer);
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
        res.json({ result, correctAnswer: str(q[0].answer, 50), analysis: q[0].analysis, stem: q[0].stem, stemImg: q[0].stem_img || null, options: q[0].options });
}));

/* POST /api/practice/:id/skip { no, ms } */
router.post('/:id/skip', asyncHandler(async (req, res) => {
        const sessionId = num(req.params.id);
        const no = num(req.body && req.body.no);
        const ms = num(req.body && req.body.ms);
        if (!no) return res.status(400).json({ error: '缺少题号' });
        const [sRows] = await pool.query('SELECT id, finished_at FROM practice_sessions WHERE id=?', [sessionId]);
        if (sRows.length === 0) return res.status(404).json({ error: '会话不存在' });
        if (sRows[0].finished_at) return res.status(400).json({ error: '该会话已结算，不能再操作' });
        const [ex] = await pool.query('SELECT id FROM practice_records WHERE session_id=? AND no=?', [sessionId, no]);
        if (ex.length > 0) return res.status(409).json({ error: '该题已作答' });
        const questionId = num(req.body && req.body.questionId);
        const [q] = await pool.query('SELECT id, answer, analysis, stem, stem_img, options, type FROM questions WHERE id=?', [questionId]);
        if (q.length === 0) return res.status(400).json({ error: '题目不存在' });
        const now = nowDateTime();
        await pool.query(
            'INSERT INTO practice_records (session_id, question_id, no, user_answer, result, ms, answered_at) VALUES (?,?,?,?,?,?,?)',
            [sessionId, questionId, no, null, 'skip', ms, now]
        );
        await pool.query('UPDATE practice_sessions SET skipped_count = skipped_count + 1 WHERE id=?', [sessionId]);
        res.json({ result: 'skip', correctAnswer: str(q[0].answer, 50), analysis: q[0].analysis, stem: q[0].stem, stemImg: q[0].stem_img || null });
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

/* POST /api/practice/:id/replay-errors 本场错题重练：取该会话错题开新会话（mode=review），错题已停用则跳过 */
router.post('/:id/replay-errors', asyncHandler(async (req, res) => {
        const sessionId = num(req.params.id);
        const [s] = await pool.query('SELECT * FROM practice_sessions WHERE id=?', [sessionId]);
        if (s.length === 0) return res.status(404).json({ error: '会话不存在' });
        const [raw] = await pool.query(
            'SELECT question_id FROM practice_records WHERE session_id=? AND result = ? ORDER BY no ASC', [sessionId, 'ng']);
        const rawCount = raw.length;
        const [wrong] = await pool.query(`
            SELECT pr.question_id AS id FROM practice_records pr
            JOIN questions q ON q.id = pr.question_id
            WHERE pr.session_id = ? AND pr.result = 'ng' AND q.is_deleted = 0
            ORDER BY pr.no ASC`, [sessionId]);
        const qIds = wrong.map(w => w.id);
        if (qIds.length === 0) {
            return res.status(400).json({ error: rawCount > 0 ? '本场错题已全部停用，无可重练题目' : '本场没有错题' });
        }
        const src = s[0];
        const [r] = await pool.query(
            `INSERT INTO practice_sessions (bank_id, bank_name, mode, total_count, cat_id, cat_name, sub_id, sub_name)
             VALUES (?,?,?,?,?,?,?,?)`,
            [src.bank_id, src.bank_name, 'review', qIds.length, src.cat_id, src.cat_name, src.sub_id, src.sub_name]
        );
        const newId = r.insertId;
        const ph = qIds.map(() => '?').join(',');
        const [qs] = await pool.query(
            `SELECT id, type, stem, stem_img, options, difficulty FROM questions WHERE id IN (${ph}) ORDER BY FIELD(id, ${ph})`,
            [...qIds, ...qIds]
        );
        res.status(201).json({
            sessionId: newId,
            bank: { id: src.bank_id, name: src.bank_name, catName: src.cat_name, subName: src.sub_name },
            mode: 'review',
            questions: qs.map(q => ({ id: q.id, type: q.type, stem: q.stem, stemImg: q.stem_img || null, options: q.options, difficulty: q.difficulty })),
            total: qs.length
        });
}));

/* GET /api/practice/history?page=1&limit=20&bankId=&mode= */
router.get('/history', asyncHandler(async (req, res) => {
        const page = Math.max(1, Math.floor(num(req.query.page)) || 1);
        const limit = Math.min(50, Math.max(1, Math.floor(num(req.query.limit)) || 20));
        const offset = (page - 1) * limit;
        const where = [];
        const params = [];
        if (num(req.query.bankId)) { where.push('bank_id=?'); params.push(num(req.query.bankId)); }
        if (req.query.mode) { where.push('mode=?'); params.push(str(req.query.mode, 10)); }
        const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM practice_sessions ${whereSql}`, params);
        const [rows] = await pool.query(
            `SELECT id, bank_name, mode, total_count, done_count, correct_count, wrong_count, skipped_count,
                    rate, total_ms, cat_name, sub_name, started_at, finished_at
             FROM practice_sessions ${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]
        );
        res.json({ total, page, limit, list: rows });
}));

/* GET /api/practice/history/:id（含每题明细；题目被真删时题干显示占位，已停用题正常显示） */
router.get('/history/:id', asyncHandler(async (req, res) => {
        const id = num(req.params.id);
        const [s] = await pool.query('SELECT * FROM practice_sessions WHERE id=?', [id]);
        if (s.length === 0) return res.status(404).json({ error: '会话不存在' });
        const [recs] = await pool.query(`
            SELECT pr.no, pr.question_id, pr.user_answer, pr.result, pr.ms,
                   q.stem, q.stem_img, q.answer AS correct_answer, q.analysis, q.options
            FROM practice_records pr
            LEFT JOIN questions q ON q.id = pr.question_id
            WHERE pr.session_id = ?
            ORDER BY pr.no ASC`, [id]);
        res.json({ session: s[0], records: recs.map(r => ({
            no: r.no, questionId: r.question_id, userAnswer: r.user_answer, result: r.result, ms: r.ms,
            stem: r.stem || '（题目已删除）', stemImg: r.stem_img || null, correctAnswer: r.correct_answer || '', analysis: r.analysis || '',
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
        /* mysql2 SUM 返回字符串，必须 Number() 后再参与运算/返回（防字符串拼接与类型契约错位） */
        const rate = all.total_q ? Math.round(Number(all.correct_q) / Number(all.total_q) * 1000) / 10 : 0;
        res.json({
            all: { sessions: Number(all.sessions), totalQ: Number(all.total_q), correctQ: Number(all.correct_q), wrongQ: Number(all.wrong_q), skipQ: Number(all.skip_q), totalMs: Number(all.total_ms), rate },
            today: { sessions: Number(today.sessions), totalQ: Number(today.total_q), correctQ: Number(today.correct_q), wrongQ: Number(today.wrong_q), skipQ: Number(today.skip_q), totalMs: Number(today.total_ms) }
        });
}));

module.exports = router;
