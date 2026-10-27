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

const TYPE_NAMES = { percent: '百化分', compare: '分数比大小', estimate: '估算值', square: '平方数', mixed: '综合练习' };
const VALID_TYPES = ['percent', 'compare', 'estimate', 'square', 'mixed'];

/* ---- 内置题库：按题型+标签分组补种（该组为空时写入其种子题目，幂等，可增量新增） ---- */
async function ensureSeed() {
    const groups = {};
    SEED_QUESTIONS.forEach(q => {
        const k = q.qtype + '|' + (q.tag || '');
        (groups[k] = groups[k] || []).push(q);
    });
    for (const k of Object.keys(groups)) {
        const sep = k.indexOf('|');
        const qtype = k.slice(0, sep);
        const tag = k.slice(sep + 1);
        const [rows] = await pool.query('SELECT COUNT(*) AS n FROM mental_questions WHERE qtype=? AND IFNULL(tag,"")=?', [qtype, tag]);
        if (rows[0].n > 0) continue;
        const vals = [];
        const params = [];
        groups[k].forEach(q => {
            vals.push('(?,?,?,?,?,?,?,?,?)');
            params.push(q.qtype, q.difficulty, q.stem, JSON.stringify(q.options), String(q.answer), q.tip, q.tag || '', 1, q.fillable ? 1 : 0);
        });
        await pool.query(
            `INSERT INTO mental_questions (qtype, difficulty, stem, options, answer, tip, tag, active, fillable)
             VALUES ${vals.join(',')}`,
            params
        );
    }
}

/* Fisher-Yates 洗牌（返回新数组） */
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

/* 随机抽题：mixed 时三类各取 1/3 轮转，其余按题型抽；
   exclude 传 Set 可排除已出题目（无限流用）；
   fillOnly=true 仅抽可填空题（fillable=1，百化分常规几分之一型）；
   某题型一轮出尽后，只对该题型循环随机补齐（允许与已出重复），不影响其他题型 */
async function pickQuestions(qtype, difficulty, count, exclude, fillOnly) {
    const where = ['active=1'];
    const params = [];
    if (difficulty >= 1 && difficulty <= 3) {
        where.push('difficulty=?');
        params.push(difficulty);
    }
    if (fillOnly) where.push('fillable=1');
    const types = qtype === 'mixed' ? ['percent', 'compare', 'estimate'] : [qtype];
    const per = qtype === 'mixed' ? Math.ceil(count / 3) : count;
    const excl = exclude && exclude.size ? exclude : null;
    let ids = [];
    for (const t of types) {
        const [rows] = await pool.query(
            `SELECT id FROM mental_questions WHERE qtype=? AND ${where.join(' AND ')} ORDER BY RAND() LIMIT 200`,
            [...params, t]
        );
        const all = rows.map(r => r.id);
        if (!all.length) continue;
        const fresh = excl ? all.filter(id => !excl.has(id)) : all.slice();
        const take = Math.min(per, fresh.length);
        ids = ids.concat(fresh.slice(0, take));
        if (take < per) {
            /* 该题型已全部出过：循环随机补齐（排除本批已取，保证批内不重复） */
            const taken = new Set(fresh.slice(0, take));
            const remain = all.filter(id => !taken.has(id));
            ids = ids.concat(shuffle(remain).slice(0, per - take));
        }
    }
    return shuffle(ids).slice(0, count);
}

/* 拉取一批题目详情（保持抽题顺序）；fillOnly 时计算填空题方向与期望答案 */
async function fetchQuestions(ids, fillOnly) {
    if (!ids.length) return [];
    const ph = ids.map(() => '?').join(',');
    const [qs] = await pool.query(
        `SELECT id, qtype, difficulty, stem, options, answer FROM mental_questions WHERE id IN (${ph}) ORDER BY FIELD(id, ${ph})`,
        [...ids, ...ids]
    );
    return qs.map(q => ({
        id: q.id, qtype: q.qtype, difficulty: q.difficulty,
        stem: q.stem, options: fmtRecordOpts(q.options),
        ...(fillOnly ? fillMeta(q) : {})
    }));
}

/* 填空题元信息：由正确答案文本推导
   - 答案形如 "1/8" → fillDir='den'（题干是百分数，填分母，如 12.5% → 8）
   - 答案形如 "14.3%" → fillDir='pct'（题干是分数，填百分数数值，如 1/7 → 14.3，百分号固定）
   - 答案形如 "169" → fillDir='val'（平方数等纯整数答案）
   - 答案形如 "1.7" → fillDir='dec'（幂次估算等小数近似答案，如 1.2³ → 1.7）
   fillExpected 为规范答案字符串（如 "8" / "14.3" / "169" / "1.7"），同时作为 records 快照与判题基准 */
function fillMeta(q) {
    const opts = fmtRecordOpts(q.options);
    const ansTxt = opts[num(q.answer)] !== undefined ? String(opts[num(q.answer)]) : String(q.answer || '');
    const frac = ansTxt.match(/^1\/(\d+)$/);
    if (frac) return { fillDir: 'den', fillExpected: frac[1] };
    const pct = ansTxt.match(/^([\d.]+)%$/);
    if (pct) return { fillDir: 'pct', fillExpected: pct[1] };
    const int = ansTxt.match(/^\d+$/);
    if (int) return { fillDir: 'val', fillExpected: int[0] };
    const dec = ansTxt.match(/^\d+\.\d+$/);
    if (dec) return { fillDir: 'dec', fillExpected: dec[0] };
    return { fillDir: 'pct', fillExpected: ansTxt.replace(/[^\d.]/g, '') || '0' };
}

/* 填空题判对：四舍五入到 1 位小数一致
   - den（填分母）：整数必须精确
   - val（填数值）：整数必须精确（平方数等纯整数答案）
   - pct（填百分数）/ dec（填小数）：round1(输入) === round1(期望) */
function fillCheck(input, q) {
    const { fillDir, fillExpected } = fillMeta(q);
    const n = parseFloat(input);
    if (!isFinite(n)) return false;
    if (fillDir === 'den' || fillDir === 'val') return String(Math.round(n)) === fillExpected;
    const e = parseFloat(fillExpected);
    return Math.round(n * 10) / 10 === Math.round(e * 10) / 10;
}

/* 格式化单题（供历史回看：映射选项下标 → 文本） */
function fmtRecordOpts(opts) {
    if (Array.isArray(opts)) return opts;
    try { const r = JSON.parse(opts); return Array.isArray(r) ? r : []; } catch (e) { return []; }
}

/* ---------- 速算题库管理（管理界面用） ----------
   删除为软删除（active=0 停用）：避免内置种子组被删空后重启补回；
   管理列表可含停用题，恢复即置 active=1 */
const MG_TYPES = ['percent', 'compare', 'estimate', 'square'];

/* GET /api/mental/admin/questions?qtype=&tag=&diff=&kw=&inactive=1&page=&pageSize=
   后端分页：返回 { total, list, groups, allTotal }
   - total   当前筛选下总条数
   - list    当前页数据
   - groups  题型+标签分组计数（随 inactive 过滤，供左侧导航）
   - allTotal 全库总数（含停用） */
router.get('/admin/questions', asyncHandler(async (req, res) => {
    const where = ['1=1'];
    const params = [];
    const qtype = str(req.query.qtype, 16);
    if (qtype && MG_TYPES.includes(qtype)) { where.push('qtype=?'); params.push(qtype); }
    const tag = str(req.query.tag, 50);
    if (tag) { where.push('tag=?'); params.push(tag); }
    const diff = num(req.query.diff);
    if (diff >= 1 && diff <= 3) { where.push('difficulty=?'); params.push(diff); }
    const inactive = str(req.query.inactive, 2) === '1';
    if (!inactive) where.push('active=1');
    const kw = str(req.query.kw, 100).trim();
    if (kw) { where.push('(stem LIKE ? OR tip LIKE ? OR tag LIKE ?)'); params.push('%' + kw + '%', '%' + kw + '%', '%' + kw + '%'); }
    const whereSql = where.join(' AND ');
    const page = num(req.query.page);
    const pageSize = num(req.query.pageSize);
    const mapper = r => ({
        id: r.id, qtype: r.qtype, difficulty: r.difficulty, stem: r.stem,
        options: fmtRecordOpts(r.options), answer: str(r.answer, 50), tip: r.tip || '',
        tag: r.tag || '', active: !!r.active, fillable: !!r.fillable, updatedAt: r.updated_at
    });
    if (page >= 1 && pageSize >= 1) {
        const [cnt] = await pool.query(`SELECT COUNT(*) c FROM mental_questions WHERE ${whereSql}`, params);
        const [rows] = await pool.query(
            `SELECT id, qtype, difficulty, stem, options, answer, tip, tag, active, fillable, updated_at
             FROM mental_questions WHERE ${whereSql} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
            params
        );
        const [all] = await pool.query('SELECT COUNT(*) c FROM mental_questions');
        const [g] = await pool.query(
            `SELECT qtype, tag, COUNT(*) c FROM mental_questions WHERE ${inactive ? '1=1' : 'active=1'} GROUP BY qtype, tag`
        );
        const groups = {};
        g.forEach(x => {
            const grp = groups[x.qtype] || (groups[x.qtype] = { n: 0, tags: {} });
            grp.n += x.c;
            grp.tags[x.tag || '无标签'] = (grp.tags[x.tag || '无标签'] || 0) + x.c;
        });
        res.json({ total: cnt[0].c, list: rows.map(mapper), groups, allTotal: all[0].c });
    } else {
        const [rows] = await pool.query(
            `SELECT id, qtype, difficulty, stem, options, answer, tip, tag, active, fillable, updated_at
             FROM mental_questions WHERE ${whereSql} ORDER BY id DESC`,
            params
        );
        res.json({ total: rows.length, list: rows.map(mapper), allTotal: rows.length });
    }
}));

/* POST /api/mental/admin/questions { qtype, difficulty, stem, options, answer, tip, tag, fillable }
   填空题：options 规范为 [答案文本] 且 answer='0'，由 fillMeta 推导方向 */
router.post('/admin/questions', asyncHandler(async (req, res) => {
    const qtype = MG_TYPES.includes(req.body && req.body.qtype) ? req.body.qtype : 'percent';
    const difficulty = Math.min(3, Math.max(1, num(req.body && req.body.difficulty) || 2));
    const stem = str(req.body && req.body.stem, 20000).trim();
    if (!stem) return res.status(400).json({ error: '题干不能为空' });
    const fillable = req.body && req.body.fillable ? 1 : 0;
    let options = Array.isArray(req.body && req.body.options) ? req.body.options : [];
    let answer = str(req.body && req.body.answer, 50).trim();
    if (fillable) {
        if (!answer) return res.status(400).json({ error: '填空题需填写规范答案文本（如 1/8、14.3%、169、1.7）' });
        options = [answer];
        answer = '0';
    } else {
        options = options.map(o => str(o, 200));
        if (!options.length || options.some(o => !o)) return res.status(400).json({ error: '请填写全部选项' });
        const ai = num(answer);
        if (options[ai] === undefined) return res.status(400).json({ error: '正确答案需指向一个选项' });
        answer = String(ai);
    }
    const tip = str(req.body && req.body.tip, 20000).trim();
    const tag = str(req.body && req.body.tag, 50).trim();
    const [r] = await pool.query(
        `INSERT INTO mental_questions (qtype, difficulty, stem, options, answer, tip, tag, active, fillable)
         VALUES (?,?,?,?,?,?,?,1,?)`,
        [qtype, difficulty, stem, JSON.stringify(options), answer, tip, tag, fillable]
    );
    res.status(201).json({ id: r.insertId });
}));

/* PUT /api/mental/admin/questions/:id（含 active，可恢复停用） */
router.put('/admin/questions/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    const qtype = MG_TYPES.includes(req.body && req.body.qtype) ? req.body.qtype : 'percent';
    const difficulty = Math.min(3, Math.max(1, num(req.body && req.body.difficulty) || 2));
    const stem = str(req.body && req.body.stem, 20000).trim();
    if (!stem) return res.status(400).json({ error: '题干不能为空' });
    const fillable = req.body && req.body.fillable ? 1 : 0;
    let options = Array.isArray(req.body && req.body.options) ? req.body.options : [];
    let answer = str(req.body && req.body.answer, 50).trim();
    if (fillable) {
        if (!answer) return res.status(400).json({ error: '填空题需填写规范答案文本（如 1/8、14.3%、169、1.7）' });
        options = [answer];
        answer = '0';
    } else {
        options = options.map(o => str(o, 200));
        if (!options.length || options.some(o => !o)) return res.status(400).json({ error: '请填写全部选项' });
        const ai = num(answer);
        if (options[ai] === undefined) return res.status(400).json({ error: '正确答案需指向一个选项' });
        answer = String(ai);
    }
    const tip = str(req.body && req.body.tip, 20000).trim();
    const tag = str(req.body && req.body.tag, 50).trim();
    const active = req.body && req.body.active === false ? 0 : 1;
    const [r] = await pool.query(
        `UPDATE mental_questions SET qtype=?, difficulty=?, stem=?, options=?, answer=?, tip=?, tag=?, active=?, fillable=? WHERE id=?`,
        [qtype, difficulty, stem, JSON.stringify(options), answer, tip, tag, active, fillable, id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ error: '题目不存在' });
    res.json({ ok: true });
}));

/* DELETE /api/mental/admin/questions/:id  软删除（停用，不物理删除） */
router.delete('/admin/questions/:id', asyncHandler(async (req, res) => {
    const [r] = await pool.query('UPDATE mental_questions SET active=0 WHERE id=?', [num(req.params.id)]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '题目不存在' });
    res.json({ ok: true });
}));

/* ---------- 练习会话 ---------- */

/* POST /api/mental/start { qtype, difficulty, count, answerMode }
   count<=0 表示无限流：total_count=0，首批 10 题，答完通过 /:id/more 循环续题；
   定量模式 count 1~30。返回题目不含答案与技巧（作答接口才返回）；
   answerMode=fill 对百化分、平方数生效：抽常规可填空题（fillable=1） */
router.post('/start', asyncHandler(async (req, res) => {
    await ensureSeed();
    const qtype = VALID_TYPES.includes(req.body && req.body.qtype) ? req.body.qtype : 'mixed';
    const difficulty = num(req.body && req.body.difficulty);
    const count = num(req.body && req.body.count);
    const answerMode = (req.body && req.body.answerMode === 'fill' && (qtype === 'percent' || qtype === 'square')) ? 'fill' : 'choice';
    const infinite = count <= 0;
    const want = infinite ? 10 : Math.min(30, Math.max(1, count));
    const fillOnly = answerMode === 'fill';

    const ids = await pickQuestions(qtype, difficulty, want, null, fillOnly);
    if (ids.length === 0) return res.status(400).json({ error: '该题型暂无题目，请联系开发者补充内置题库' });

    const [r] = await pool.query(
        `INSERT INTO mental_sessions (qtype, qtype_name, difficulty, answer_mode, total_count)
         VALUES (?,?,?,?,?)`,
        [qtype, TYPE_NAMES[qtype], difficulty, answerMode, infinite ? 0 : ids.length]
    );
    const sessionId = r.insertId;
    const questions = await fetchQuestions(ids, fillOnly);
    res.status(201).json({
        sessionId,
        qtype,
        qtypeName: TYPE_NAMES[qtype],
        answerMode,
        total: infinite ? 0 : questions.length,
        infinite: !!infinite,
        questions
    });
}));

/* POST /api/mental/:id/more  无限流追加一批（10 题，排除已出，题库轮完循环）
   仅 total_count=0 的无限会话可用 */
router.post('/:id/more', asyncHandler(async (req, res) => {
    const sessionId = num(req.params.id);
    const [s] = await pool.query('SELECT * FROM mental_sessions WHERE id=?', [sessionId]);
    if (s.length === 0) return res.status(404).json({ error: '会话不存在' });
    if (s[0].total_count !== 0) return res.status(400).json({ error: '定量会话无需追加题目' });

    const [used] = await pool.query('SELECT question_id FROM mental_records WHERE session_id=?', [sessionId]);
    const excl = new Set(used.map(x => Number(x.question_id)));
    const fillOnly = s[0].answer_mode === 'fill';
    /* 优先出未做过的；某题型轮完后 pickQuestions 内部自动循环补齐 */
    const ids = await pickQuestions(s[0].qtype, s[0].difficulty, 10, excl, fillOnly);
    if (ids.length === 0) return res.status(400).json({ error: '题库暂无题目，请联系开发者补充内置题库' });

    res.json({ questions: await fetchQuestions(ids, fillOnly) });
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

    const [sRows] = await pool.query('SELECT id, answer_mode FROM mental_sessions WHERE id=?', [sessionId]);
    if (sRows.length === 0) return res.status(404).json({ error: '会话不存在' });
    const fillMode = sRows[0].answer_mode === 'fill';
    const [ex] = await pool.query('SELECT id FROM mental_records WHERE session_id=? AND no=?', [sessionId, no]);
    if (ex.length > 0) return res.status(409).json({ error: '该题已作答' });

    const [q] = await pool.query(
        'SELECT id, qtype, stem, options, answer, tip FROM mental_questions WHERE id=?', [questionId]);
    if (q.length === 0) return res.status(400).json({ error: '题目不存在' });

    const correct = fillMode ? fillCheck(userAnswer, q[0]) : userAnswer === str(q[0].answer, 50);
    const recordAnswer = fillMode ? fillMeta(q[0]).fillExpected : str(q[0].answer, 50);
    const result = correct ? 'ok' : 'ng';
    const now = nowDateTime();
    await pool.query(
        `INSERT INTO mental_records
            (session_id, question_id, no, qtype, stem, options, answer, tip, user_answer, result, ms, answered_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sessionId, questionId, no, q[0].qtype, q[0].stem, JSON.stringify(fillMode ? [] : q[0].options),
         recordAnswer, q[0].tip || '', userAnswer || null, result, ms, now]
    );
    await pool.query(
        `UPDATE mental_sessions SET done_count = done_count + 1,
         ${correct ? 'correct_count = correct_count + 1' : 'wrong_count = wrong_count + 1'}
         WHERE id=?`, [sessionId]
    );
    const opts = fmtRecordOpts(q[0].options);
    res.json(fillMode ? {
        result,
        correctIndex: null,
        correctAnswer: recordAnswer,
        tip: q[0].tip || ''
    } : {
        result,
        correctIndex: num(q[0].answer),
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

    const [sRows] = await pool.query('SELECT id, answer_mode FROM mental_sessions WHERE id=?', [sessionId]);
    const fillMode = sRows.length > 0 && sRows[0].answer_mode === 'fill';
    const [q] = await pool.query(
        'SELECT id, qtype, stem, options, answer, tip FROM mental_questions WHERE id=?', [questionId]);
    if (q.length === 0) return res.status(400).json({ error: '题目不存在' });

    const recordAnswer = fillMode ? fillMeta(q[0]).fillExpected : str(q[0].answer, 50);
    const now = nowDateTime();
    await pool.query(
        `INSERT INTO mental_records
            (session_id, question_id, no, qtype, stem, options, answer, tip, user_answer, result, ms, answered_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [sessionId, questionId, no, q[0].qtype, q[0].stem, JSON.stringify(fillMode ? [] : q[0].options),
         recordAnswer, q[0].tip || '', null, 'skip', ms, now]
    );
    await pool.query('UPDATE mental_sessions SET skipped_count = skipped_count + 1 WHERE id=?', [sessionId]);
    const opts = fmtRecordOpts(q[0].options);
    res.json(fillMode ? {
        result: 'skip',
        correctIndex: null,
        correctAnswer: recordAnswer,
        tip: q[0].tip || ''
    } : {
        result: 'skip',
        correctIndex: num(q[0].answer),
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

        /* 无限流（total_count=0）：按实际作答数结算，并把题量修正为实做题数 */
        const [pre] = await conn.query(
            'SELECT * FROM mental_sessions WHERE id=? AND finished_at IS NULL', [sessionId]);
        if (pre.length === 0) {
            await conn.rollback();
            return res.status(404).json({ error: '会话不存在或已结束' });
        }
        const p = pre[0];
        const totalAns = p.done_count + p.skipped_count;
        const totalBase = p.total_count === 0 ? totalAns : p.total_count;
        const rate = totalBase ? Math.round(p.correct_count / totalBase * 1000) / 10 : 0;
        const newTotal = p.total_count === 0 ? totalAns : p.total_count;
        await conn.query(
            `UPDATE mental_sessions SET total_ms=?, finished_at=?, total_count=?, rate=?
             WHERE id=? AND finished_at IS NULL`,
            [ms, now, newTotal, rate, sessionId]
        );
        const [row] = await conn.query('SELECT * FROM mental_sessions WHERE id=?', [sessionId]);
        const r = row[0];

        /* 归档历史概要（rounds：mode=mental，分类固定为 公务员考试 → 速算） */
        const rid = Date.now();
        const fmt = t => {
            const totalSec = t / 1000;
            const minutes = String(Math.floor(totalSec / 60)).padStart(2, '0');
            const seconds = (totalSec % 60).toFixed(2).padStart(5, '0');
            return minutes + ':' + seconds;
        };
        /* 速算分类：按名称解析（用户在分类管理添加的 公务员考试→速算），解析失败则按未分类归档 */
        const [tagRows] = await conn.query(
            `SELECT cs.id AS sub_id, cs.cat_id, c.name AS cat_name, cs.name AS sub_name
             FROM category_subs cs JOIN categories c ON c.id = cs.cat_id
             WHERE cs.name = '速算' ORDER BY cs.id LIMIT 1`);
        const tag = tagRows[0] || { cat_id: null, cat_name: null, sub_id: null, sub_name: null };
        await conn.query(
            `INSERT INTO rounds
                (id, mode, mode_name, title, description, finished_at, max_count,
                 total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [rid, 'mental', '速算练习', str(r.qtype_name, 100), '', now, r.total_count,
             r.total_ms, r.correct_count, r.rate, tag.cat_id, tag.cat_name, tag.sub_id, tag.sub_name]
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
