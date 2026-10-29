/* ============================================================
 * 刷题计时器 - server/routes/data.js
 * 数据导入导出 API（兼容旧版 data.json 的 version 2 格式）
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const importData = require('../importData');
const { asyncHandler, parseJsonArray } = require('../utils');

const router = express.Router();

/* ---- 分类树（与 categories 路由相同格式） ---- */
async function exportCategories() {
    const [cats] = await pool.query('SELECT id, name, builtin FROM categories ORDER BY sort_order, name');
    const [subs] = await pool.query('SELECT id, cat_id, name FROM category_subs ORDER BY sort_order, name');
    const subMap = {};
    subs.forEach(s => {
        if (!subMap[s.cat_id]) subMap[s.cat_id] = [];
        subMap[s.cat_id].push({ id: s.id, name: s.name });
    });
    return cats.map(c => ({ id: c.id, name: c.name, builtin: !!c.builtin, subs: subMap[c.id] || [] }));
}

/* ---- 全量历史（含 records） ---- */
async function exportHistory() {
    const [h] = await pool.query(
        `SELECT id, mode, mode_name, title, description, finished_at, max_count,
                total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name
         FROM rounds ORDER BY finished_at, id`
    );
    const [recs] = await pool.query(
        `SELECT round_id, JSON_ARRAYAGG(JSON_OBJECT(
            'no', no, 'ms', ms, 'cumMs', cum_ms, 'timeStr', time_str, 'result', result, 'note', note))
            AS records
         FROM records GROUP BY round_id`
    );
    const recMap = {};
    recs.forEach(r => { recMap[r.round_id] = parseJsonArray(r.records); });
    return h.map(r => ({
        id: r.id,
        mode: r.mode,
        modeName: r.mode_name,
        title: r.title,
        desc: r.description,
        date: r.finished_at,
        maxCount: r.max_count,
        records: recMap[r.id] || [],
        totalMs: r.total_ms,
        correct: r.correct,
        rate: r.rate,
        catId: r.cat_id,
        catName: r.cat_name,
        subId: r.sub_id,
        subName: r.sub_name
    }));
}

/* ---- 收藏 / 学习时长 / 备忘 ---- */
async function exportFavorites() {
    const [f] = await pool.query(
        `SELECT id, round_id, no, title, mode, mode_name, time_str, collected_at,
                cat_id, cat_name, sub_id, sub_name
         FROM favorites ORDER BY id`
    );
    return f.map(x => ({
        id: x.id,
        hid: x.round_id,
        no: x.no,
        title: x.title,
        mode: x.mode,
        modeName: x.mode_name,
        timeStr: x.time_str,
        collectedAt: x.collected_at,
        catId: x.cat_id,
        catName: x.cat_name,
        subId: x.sub_id,
        subName: x.sub_name
    }));
}

async function exportStudyDaily() {
    const [s] = await pool.query('SELECT DATE_FORMAT(study_date,"%Y-%m-%d") AS d, ms FROM study_daily');
    const o = {};
    s.forEach(x => { o[x.d] = x.ms; });
    return o;
}

async function exportMemos() {
    const [m] = await pool.query('SELECT DATE_FORMAT(memo_date,"%Y-%m-%d") AS d, type, title, content FROM memos');
    const o = {};
    m.forEach(x => { o[x.d] = { type: x.type, title: x.title, text: x.content || '' }; });
    return o;
}

async function exportPractice() {
    const [qb] = await pool.query('SELECT id, name, cat_id, sub_id, description FROM question_banks ORDER BY id');
    const questionBanks = qb.map(x => ({ id: x.id, name: x.name, catId: x.cat_id, subId: x.sub_id, description: x.description }));
    const [qs] = await pool.query(
        'SELECT id, bank_id, type, stem, stem_img, options, answer, analysis, difficulty, source, is_deleted FROM questions ORDER BY id');
    const questions = qs.map(x => ({
        id: x.id, bankId: x.bank_id, type: x.type, stem: x.stem, stemImg: x.stem_img, options: x.options,
        answer: x.answer, analysis: x.analysis, difficulty: x.difficulty, source: x.source, isDeleted: x.is_deleted
    }));
    const [ps] = await pool.query(
        `SELECT id, bank_id, bank_name, mode, total_count, done_count, correct_count, wrong_count,
                skipped_count, rate, total_ms, cat_id, cat_name, sub_id, sub_name, started_at, finished_at
         FROM practice_sessions ORDER BY id`);
    const [pr] = await pool.query(
        `SELECT session_id, JSON_ARRAYAGG(JSON_OBJECT(
            'no', no, 'questionId', question_id, 'userAnswer', user_answer, 'result', result, 'ms', ms)) AS recs
         FROM practice_records GROUP BY session_id`);
    const prMap = {};
    (pr || []).forEach(x => { prMap[x.session_id] = parseJsonArray(x.recs); });
    const practiceSessions = ps.map(x => ({
        id: x.id, bankId: x.bank_id, bankName: x.bank_name, mode: x.mode,
        totalCount: x.total_count, doneCount: x.done_count, correctCount: x.correct_count,
        wrongCount: x.wrong_count, skippedCount: x.skipped_count, rate: x.rate, totalMs: x.total_ms,
        catId: x.cat_id, catName: x.cat_name, subId: x.sub_id, subName: x.sub_name,
        startedAt: x.started_at, finishedAt: x.finished_at, records: prMap[x.id] || []
    }));
    return { questionBanks, questions, practiceSessions };
}

/* ---- 速算练习数据 ---- */
async function exportMental() {
    const [mq] = await pool.query(
        'SELECT id, qtype, difficulty, stem, options, answer, tip, tag, active, fillable FROM mental_questions ORDER BY id');
    const mentalQuestions = mq.map(x => ({
        id: x.id, qtype: x.qtype, difficulty: x.difficulty, stem: x.stem,
        options: x.options, answer: x.answer, tip: x.tip, tag: x.tag, active: !!x.active, fillable: !!x.fillable
    }));
    const [ms] = await pool.query(
        `SELECT id, qtype, qtype_name, difficulty, answer_mode, total_count, done_count, correct_count,
                wrong_count, skipped_count, rate, total_ms, started_at, finished_at
         FROM mental_sessions ORDER BY id`);
    const [mr] = await pool.query(
        `SELECT session_id, JSON_ARRAYAGG(JSON_OBJECT(
            'no', no, 'questionId', question_id, 'qtype', qtype, 'stem', stem,
            'options', options, 'answer', answer, 'tip', tip, 'userAnswer', user_answer,
            'result', result, 'ms', ms)) AS recs
         FROM mental_records GROUP BY session_id`);
    const mrMap = {};
    (mr || []).forEach(x => { mrMap[x.session_id] = parseJsonArray(x.recs); });
    const mentalSessions = ms.map(x => ({
        id: x.id, qtype: x.qtype, qtypeName: x.qtype_name, difficulty: x.difficulty, answerMode: x.answer_mode,
        totalCount: x.total_count, doneCount: x.done_count, correctCount: x.correct_count,
        wrongCount: x.wrong_count, skippedCount: x.skipped_count, rate: x.rate, totalMs: x.total_ms,
        startedAt: x.started_at, finishedAt: x.finished_at, records: mrMap[x.id] || []
    }));
    return { mentalQuestions, mentalSessions };
}

/* GET /api/export 导出全部数据（旧版 v2 JSON 格式） */
router.get('/export', asyncHandler(async (req, res) => {
        res.json({
            version: 2,
            categories: await exportCategories(),
            history: await exportHistory(),
            favorites: await exportFavorites(),
            studyDaily: await exportStudyDaily(),
            memos: await exportMemos(),
            practice: await exportPractice(),
            mental: await exportMental()
        });
}));

/* GET /api/info 数据库信息（设置页展示用） */
router.get('/info', asyncHandler(async (req, res) => {
        const [cats] = await pool.query('SELECT COUNT(*) n FROM categories');
        const [subs] = await pool.query('SELECT COUNT(*) n FROM category_subs');
        const [rounds] = await pool.query('SELECT COUNT(*) n FROM rounds');
        const [records] = await pool.query('SELECT COUNT(*) n FROM records');
        const [favs] = await pool.query('SELECT COUNT(*) n FROM favorites');
        const [memos] = await pool.query('SELECT COUNT(*) n FROM memos');
        const [study] = await pool.query('SELECT COUNT(*) n, COALESCE(SUM(ms),0) ms FROM study_daily');
        const [pb] = await pool.query('SELECT COUNT(*) n FROM question_banks');
        const [pq] = await pool.query('SELECT COUNT(*) n FROM questions');
        const [ps] = await pool.query('SELECT COUNT(*) n FROM practice_sessions');
        const [pp] = await pool.query('SELECT COUNT(*) n FROM practice_records');
        const [mq] = await pool.query('SELECT COUNT(*) n FROM mental_questions');
        const [ms] = await pool.query('SELECT COUNT(*) n FROM mental_sessions');
        const [mrp] = await pool.query('SELECT COUNT(*) n FROM mental_records');
        res.json({
            dbName: process.env.DB_NAME || 'pomodoro-quiz-timer',
            host: (process.env.DB_HOST || 'localhost') + ':' + (process.env.DB_PORT || 3306),
            categories: cats[0].n,
            categorySubs: subs[0].n,
            rounds: rounds[0].n,
            records: records[0].n,
            favorites: favs[0].n,
            memos: memos[0].n,
            studyDays: study[0].n,
            studyMs: study[0].ms,
            questionBanks: pb[0].n,
            questions: pq[0].n,
            practiceSessions: ps[0].n,
            practiceRecords: pp[0].n,
            mentalQuestions: mq[0].n,
            mentalSessions: ms[0].n,
            mentalRecords: mrp[0].n
        });
}));

/* POST /api/import 导入合并数据（兼容旧版 v2 JSON）
   规则（与旧版一致）：
   - history / favorites 以文件为准替换
   - categories 以文件为准更新/新增，本地有而文件没有的保留
   - studyDaily 按日取较大值合并
   - memos 按日 upsert */
router.post('/import', asyncHandler(async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const data = req.body || {};
        if (!Array.isArray(data.history)) return res.status(400).json({ error: '不是有效的 JSON 数据文件' });

        await conn.beginTransaction();
        const info = await importData(conn, data);
        await conn.commit();
        res.json({ ok: true, ...info });
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}));

module.exports = router;
