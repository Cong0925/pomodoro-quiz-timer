/* ============================================================
 * 刷题计时器 - server/exportData.js
 * 公共数据导出模块：把 MySQL 库内全部数据导出为 v2 JSON 结构
 * （供 backup.js 备份、restore.js 恢复前备份、migrate.js 强制迁移前备份共用）
 * ============================================================ */
const { parseJsonArray } = require('./utils');

async function exportAll(conn) {
    const [h] = await conn.query(
        `SELECT id, mode, mode_name, title, description, finished_at, max_count,
                total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name
         FROM rounds ORDER BY finished_at, id`
    );
    const [recs] = await conn.query(
        `SELECT round_id, JSON_ARRAYAGG(JSON_OBJECT(
            'no', no, 'ms', ms, 'cumMs', cum_ms, 'timeStr', time_str, 'result', result, 'note', note)) AS records
         FROM records GROUP BY round_id`
    );
    const recMap = {};
    recs.forEach(r => { recMap[r.round_id] = parseJsonArray(r.records); });
    const history = h.map(r => ({
        id: r.id, mode: r.mode, modeName: r.mode_name, title: r.title, desc: r.description,
        date: r.finished_at, maxCount: r.max_count, records: recMap[r.id] || [],
        totalMs: r.total_ms, correct: r.correct, rate: r.rate,
        catId: r.cat_id, catName: r.cat_name, subId: r.sub_id, subName: r.sub_name
    }));

    const [cats] = await conn.query('SELECT id, name, builtin FROM categories ORDER BY sort_order, name');
    const [subs] = await conn.query('SELECT id, cat_id, name FROM category_subs ORDER BY sort_order, name');
    const subMap = {};
    subs.forEach(s => { (subMap[s.cat_id] = subMap[s.cat_id] || []).push({ id: s.id, name: s.name }); });
    const categories = cats.map(c => ({ id: c.id, name: c.name, builtin: !!c.builtin, subs: subMap[c.id] || [] }));

    const [f] = await conn.query(
        `SELECT id, round_id, no, title, mode, mode_name, time_str, collected_at,
                cat_id, cat_name, sub_id, sub_name FROM favorites ORDER BY id`
    );
    const favorites = f.map(x => ({
        id: x.id, hid: x.round_id, no: x.no, title: x.title, mode: x.mode,
        modeName: x.mode_name, timeStr: x.time_str, collectedAt: x.collected_at,
        catId: x.cat_id, catName: x.cat_name, subId: x.sub_id, subName: x.sub_name
    }));

    const [s] = await conn.query('SELECT DATE_FORMAT(study_date,"%Y-%m-%d") AS d, ms FROM study_daily');
    const studyDaily = {};
    s.forEach(x => { studyDaily[x.d] = x.ms; });

    const [m] = await conn.query('SELECT DATE_FORMAT(memo_date,"%Y-%m-%d") AS d, type, title, content FROM memos');
    const memos = {};
    m.forEach(x => { memos[x.d] = { type: x.type, title: x.title, text: x.content || '' }; });

    /* 练习模式数据 */
    const [qb] = await conn.query('SELECT id, name, cat_id, sub_id, description FROM question_banks ORDER BY id');
    const questionBanks = qb.map(x => ({
        id: x.id, name: x.name, catId: x.cat_id, subId: x.sub_id, description: x.description
    }));
    const [qs] = await conn.query(
        'SELECT id, bank_id, type, stem, options, answer, analysis, difficulty, source FROM questions ORDER BY id');
    const questions = qs.map(x => ({
        id: x.id, bankId: x.bank_id, type: x.type, stem: x.stem, options: x.options,
        answer: x.answer, analysis: x.analysis, difficulty: x.difficulty, source: x.source
    }));
    const [ps] = await conn.query(
        `SELECT id, bank_id, bank_name, mode, total_count, done_count, correct_count, wrong_count,
                skipped_count, rate, total_ms, cat_id, cat_name, sub_id, sub_name, started_at, finished_at
         FROM practice_sessions ORDER BY id`);
    const [pr] = await conn.query(
        `SELECT session_id, JSON_ARRAYAGG(JSON_OBJECT(
            'no', no, 'questionId', question_id, 'userAnswer', user_answer, 'result', result, 'ms', ms)) AS recs
         FROM practice_records GROUP BY session_id`);
    const prMap = {};
    pr.forEach(r => { prMap[r.session_id] = parseJsonArray(r.recs); });
    const practiceSessions = ps.map(x => ({
        id: x.id, bankId: x.bank_id, bankName: x.bank_name, mode: x.mode,
        totalCount: x.total_count, doneCount: x.done_count, correctCount: x.correct_count,
        wrongCount: x.wrong_count, skippedCount: x.skipped_count, rate: x.rate, totalMs: x.total_ms,
        catId: x.cat_id, catName: x.cat_name, subId: x.sub_id, subName: x.sub_name,
        startedAt: x.started_at, finishedAt: x.finished_at, records: prMap[x.id] || []
    }));

    /* 速算练习数据 */
    const [mq] = await conn.query(
        'SELECT id, qtype, difficulty, stem, options, answer, tip, tag, active, fillable FROM mental_questions ORDER BY id');
    const mentalQuestions = mq.map(x => ({
        id: x.id, qtype: x.qtype, difficulty: x.difficulty, stem: x.stem,
        options: x.options, answer: x.answer, tip: x.tip, tag: x.tag, active: !!x.active, fillable: !!x.fillable
    }));
    const [ms] = await conn.query(
        `SELECT id, qtype, qtype_name, difficulty, answer_mode, total_count, done_count, correct_count,
                wrong_count, skipped_count, rate, total_ms, started_at, finished_at
         FROM mental_sessions ORDER BY id`);
    const [mr] = await conn.query(
        `SELECT session_id, JSON_ARRAYAGG(JSON_OBJECT(
            'no', no, 'questionId', question_id, 'qtype', qtype, 'stem', stem,
            'options', options, 'answer', answer, 'tip', tip, 'userAnswer', user_answer,
            'result', result, 'ms', ms)) AS recs
         FROM mental_records GROUP BY session_id`);
    const mrMap = {};
    mr.forEach(r => { mrMap[r.session_id] = parseJsonArray(r.recs); });
    const mentalSessions = ms.map(x => ({
        id: x.id, qtype: x.qtype, qtypeName: x.qtype_name, difficulty: x.difficulty,
        answerMode: x.answer_mode,
        totalCount: x.total_count, doneCount: x.done_count, correctCount: x.correct_count,
        wrongCount: x.wrong_count, skippedCount: x.skipped_count, rate: x.rate, totalMs: x.total_ms,
        startedAt: x.started_at, finishedAt: x.finished_at, records: mrMap[x.id] || []
    }));

    return { version: 2, categories, history, favorites, studyDaily, memos,
             practice: { questionBanks, questions, practiceSessions },
             mental: { mentalQuestions, mentalSessions } };
}

module.exports = { exportAll };
