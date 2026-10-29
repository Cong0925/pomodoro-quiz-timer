/* ============================================================
 * 刷题计时器 - server/importData.js
 * 数据导入核心逻辑（供 /api/import 路由与 migrate.js 共用）
 * 入参 conn 必须是已开启事务的连接；本函数不负责 commit/rollback
 * ============================================================ */
const { str, num } = require('./utils');

const VALID_TYPES = new Set(['exam', 'meeting', 'study', 'sport', 'birthday', 'travel', 'other']);
const BATCH = 500;

async function importData(conn, data) {
    if (!data || !Array.isArray(data.history)) throw new Error('bad format: history 必须是数组');

    /* 1. 分类合并：文件为准更新/新增，本地有而文件没有的保留 */
    if (Array.isArray(data.categories) && data.categories.length) {
        const [exist] = await conn.query('SELECT id FROM categories');
        const existIds = new Set(exist.map(x => x.id));
        for (let ci = 0; ci < data.categories.length; ci++) {
            const c = data.categories[ci];
            const subs = Array.isArray(c.subs) ? c.subs.filter(s => s && s.id && s.name) : [];
            if (existIds.has(c.id)) {
                await conn.query('UPDATE categories SET name=?, builtin=?, sort_order=? WHERE id=?',
                    [str(c.name, 100), c.builtin ? 1 : 0, ci, c.id]);
                await conn.query('DELETE FROM category_subs WHERE cat_id=?', [c.id]);
            } else {
                await conn.query('INSERT INTO categories (id, name, builtin, sort_order) VALUES (?,?,?,?)',
                    [c.id, str(c.name, 100), c.builtin ? 1 : 0, ci]);
                existIds.add(c.id);
            }
            for (let i = 0; i < subs.length; i++) {
                await conn.query('INSERT INTO category_subs (id, cat_id, name, sort_order) VALUES (?,?,?,?)',
                    [subs[i].id, c.id, str(subs[i].name, 100), i]);
            }
        }
    }

    /* 2. history / favorites 以文件为准替换（records 级联删除） */
    await conn.query('DELETE FROM favorites');
    await conn.query('DELETE FROM rounds');

    const rounds = data.history;
    /* 缺 id 的行预分配稳定回退 id，插入与明细/收藏引用同一值（避免明细挂 0 触发外键失败） */
    const ridMap = new Map();
    rounds.forEach((h, n) => {
        h._rid = num(h.id) || (Date.now() + n);
        if (num(h.id)) ridMap.set(num(h.id), h._rid);
    });
    for (let i = 0; i < rounds.length; i += BATCH) {
        const chunk = rounds.slice(i, i + BATCH);
        const vals = [], params = [];
        chunk.forEach((h, k) => {
            /* 模式白名单：single/batch/practice/mental 原样保留，其余回退 single */
            const mode = ['single', 'batch', 'practice', 'mental'].includes(h.mode) ? h.mode : 'single';
            const modeName = str(h.modeName, 20) ||
                ({ single: '单题模式', batch: '整组模式', practice: '练习模式', mental: '速算练习' }[mode] || '');
            vals.push('(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            params.push(
                h._rid,
                mode,
                modeName,
                str(h.title, 100),
                str(h.desc, 255),
                h.date || '1970-01-01 00:00:00',
                num(h.maxCount) || 20,
                num(h.totalMs),
                num(h.correct),
                num(h.rate),
                str(h.catId, 32) || null,
                str(h.catName, 100) || null,
                str(h.subId, 64) || null,
                str(h.subName, 100) || null
            );
        });
        await conn.query(
            `INSERT INTO rounds (id, mode, mode_name, title, description, finished_at, max_count,
                                 total_ms, correct, rate, cat_id, cat_name, sub_id, sub_name)
             VALUES ${vals.join(',')}`,
            params
        );
    }

    /* records 批量插入 */
    for (let i = 0; i < rounds.length; i++) {
        const h = rounds[i];
        const recs = Array.isArray(h.records) ? h.records : [];
        const rid = h._rid;
        for (let j = 0; j < recs.length; j += BATCH) {
            const chunk = recs.slice(j, j + BATCH);
            const vals = [], params = [];
            chunk.forEach(r => {
                vals.push('(?,?,?,?,?,?,?)');
                params.push(rid, num(r.no) || 0, num(r.ms), num(r.cumMs),
                    str(r.timeStr, 12), r.result === 'ok' || r.result === 'ng' || r.result === 'skip' ? r.result : 'ok',
                    str(r.note, 255));
            });
            await conn.query(
                'INSERT INTO records (round_id, no, ms, cum_ms, time_str, result, note) VALUES ' + vals.join(','),
                params
            );
        }
    }

    /* favorites */
    const favs = Array.isArray(data.favorites) ? data.favorites : [];
    for (let i = 0; i < favs.length; i += BATCH) {
        const chunk = favs.slice(i, i + BATCH);
        const vals = [], params = [];
        chunk.forEach((f, k) => {
            vals.push('(?,?,?,?,?,?,?,?,?,?,?,?)');
            params.push(
                num(f.id) || Date.now() + i + k,
                num(f.hid) ? (ridMap.get(num(f.hid)) || num(f.hid)) : 0,
                num(f.no) || 0,
                str(f.title, 100),
                ['single', 'batch', 'practice', 'mental'].includes(f.mode) ? f.mode : 'single',
                str(f.modeName, 20) || '单题模式',
                str(f.timeStr, 12),
                f.collectedAt || '1970-01-01 00:00:00',
                str(f.catId, 32) || null,
                str(f.catName, 100) || null,
                str(f.subId, 64) || null,
                str(f.subName, 100) || null
            );
        });
        await conn.query(
            `INSERT INTO favorites (id, round_id, no, title, mode, mode_name, time_str,
                                    collected_at, cat_id, cat_name, sub_id, sub_name)
             VALUES ${vals.join(',')}`,
            params
        );
    }

    /* 3. studyDaily 按日取较大值合并 */
    if (data.studyDaily && typeof data.studyDaily === 'object') {
        const keys = Object.keys(data.studyDaily);
        for (let i = 0; i < keys.length; i += BATCH) {
            const chunk = keys.slice(i, i + BATCH);
            const vals = [], params = [];
            chunk.forEach(k => {
                const v = Number(data.studyDaily[k]);
                if (isFinite(v) && v > 0) { vals.push('(?,?)'); params.push(k, v); }
            });
            if (vals.length) {
                await conn.query(
                    `INSERT INTO study_daily (study_date, ms) VALUES ${vals.join(',')}
                     ON DUPLICATE KEY UPDATE ms = GREATEST(ms, VALUES(ms))`,
                    params
                );
            }
        }
    }

    /* 4. memos upsert */
    if (data.memos && typeof data.memos === 'object') {
        const keys = Object.keys(data.memos);
        for (const k of keys) {
            const v = data.memos[k];
            let type = 'other', title = '', text = '';
            if (typeof v === 'string') { text = v.trim(); title = text.slice(0, 4); }
            else if (v && typeof v === 'object') {
                text = typeof v.text === 'string' ? v.text.trim() : '';
                title = typeof v.title === 'string' && v.title ? v.title.slice(0, 4) : text.slice(0, 4);
                type = VALID_TYPES.has(v.type) ? v.type : 'other';
            }
            if (!text) continue;
            await conn.query(
                `INSERT INTO memos (memo_date, type, title, content) VALUES (?,?,?,?)
                 ON DUPLICATE KEY UPDATE type=VALUES(type), title=VALUES(title), content=VALUES(content)`,
                [k, type, title, text]
            );
        }
    }

    /* 5. 练习模式数据（文件为准替换） */
    let pBanks = 0, pQuestions = 0, pSessions = 0;
    if (data.practice && typeof data.practice === 'object') {
        await conn.query('DELETE FROM practice_records');
        await conn.query('DELETE FROM practice_sessions');
        await conn.query('DELETE FROM questions');
        await conn.query('DELETE FROM question_banks');

        const banks = Array.isArray(data.practice.questionBanks) ? data.practice.questionBanks : [];
        /* 缺 id 的题库/题目预分配稳定回退 id，供题目/明细外键引用同一值 */
        const bidMap = new Map();
        banks.forEach((b, n) => {
            b._bid = num(b.id) || (Date.now() + n);
            if (num(b.id)) bidMap.set(num(b.id), b._bid);
        });
        for (let i = 0; i < banks.length; i += BATCH) {
            const chunk = banks.slice(i, i + BATCH);
            const vals = [], params = [];
            chunk.forEach(b => {
                vals.push('(?,?,?,?,?)');
                params.push(b._bid, str(b.name, 100), str(b.catId, 32) || null,
                    str(b.subId, 64) || null, str(b.description, 255));
            });
            await conn.query(
                'INSERT INTO question_banks (id, name, cat_id, sub_id, description) VALUES ' + vals.join(','),
                params);
        }
        pBanks = banks.length;

        const qs = Array.isArray(data.practice.questions) ? data.practice.questions : [];
        const qidMap = new Map();
        qs.forEach((q, n) => {
            q._qid = num(q.id) || (Date.now() + 50000 + n);
            if (num(q.id)) qidMap.set(num(q.id), q._qid);
        });
        for (let i = 0; i < qs.length; i += BATCH) {
            const chunk = qs.slice(i, i + BATCH);
            const vals = [], params = [];
            chunk.forEach(q => {
                vals.push('(?,?,?,?,?,?,?,?,?,?,?)');
                params.push(q._qid, num(q.bankId) ? (bidMap.get(num(q.bankId)) || num(q.bankId)) : 0, str(q.type, 10) || 'single',
                    str(q.stem, 20000), JSON.stringify(q.stemImg || []), JSON.stringify(q.options || []), str(q.answer, 50),
                    str(q.analysis, 20000), Math.min(3, Math.max(1, num(q.difficulty) || 2)),
                    str(q.source, 100), q.isDeleted ? 1 : 0);
            });
            await conn.query(
                `INSERT INTO questions (id, bank_id, type, stem, stem_img, options, answer, analysis, difficulty, source, is_deleted)
                 VALUES ` + vals.join(','), params);
        }
        pQuestions = qs.length;

        const sessions = Array.isArray(data.practice.practiceSessions) ? data.practice.practiceSessions : [];
        sessions.forEach((s, n) => {
            s._sid = num(s.id) || (Date.now() + 100000 + n);
        });
        for (let i = 0; i < sessions.length; i += BATCH) {
            const chunk = sessions.slice(i, i + BATCH);
            const vals = [], params = [];
            chunk.forEach(s => {
                vals.push('(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
                params.push(s._sid, num(s.bankId) ? (bidMap.get(num(s.bankId)) || num(s.bankId)) : 0, str(s.bankName, 100),
                    str(s.mode, 10) || 'order', num(s.totalCount), num(s.doneCount), num(s.correctCount),
                    num(s.wrongCount), num(s.skippedCount), num(s.rate), num(s.totalMs),
                    str(s.catId, 32) || null, str(s.catName, 100) || null, str(s.subId, 64) || null,
                    str(s.subName, 100) || null, s.startedAt || '1970-01-01 00:00:00',
                    s.finishedAt || null);
            });
            await conn.query(
                `INSERT INTO practice_sessions (id, bank_id, bank_name, mode, total_count, done_count,
                    correct_count, wrong_count, skipped_count, rate, total_ms,
                    cat_id, cat_name, sub_id, sub_name, started_at, finished_at)
                 VALUES ` + vals.join(','), params);
        }
        pSessions = sessions.length;

        /* practice_records：按会话插入（自增 id） */
        for (const s of sessions) {
            const recs = Array.isArray(s.records) ? s.records : [];
            const sid = s._sid;
            for (let j = 0; j < recs.length; j += BATCH) {
                const chunk = recs.slice(j, j + BATCH);
                const vals = [], params = [];
                chunk.forEach(r => {
                    vals.push('(?,?,?,?,?,?,?)');
                    const res = r.result === 'ok' || r.result === 'ng' || r.result === 'skip' ? r.result : 'ok';
                    params.push(sid, num(r.questionId) ? (qidMap.get(num(r.questionId)) || num(r.questionId)) : 0, num(r.no) || 0,
                        r.userAnswer == null || r.userAnswer === '' ? null : str(r.userAnswer, 50),
                        res, num(r.ms), null);
                });
                await conn.query(
                    'INSERT INTO practice_records (session_id, question_id, no, user_answer, result, ms, answered_at) VALUES ' + vals.join(','),
                    params);
            }
        }
    }

    /* 6. 速算练习数据（文件为准替换会话/明细；题目表仅当文件含题目时替换） */
    let mQuestions = 0, mSessions = 0;
    if (data.mental && typeof data.mental === 'object') {
        await conn.query('DELETE FROM mental_records');
        await conn.query('DELETE FROM mental_sessions');

        const mqs = Array.isArray(data.mental.mentalQuestions) ? data.mental.mentalQuestions : [];
        /* 缺 id 的题预分配稳定回退 id，供速算明细引用同一值 */
        const midMap = new Map();
        if (mqs.length) {
            await conn.query('DELETE FROM mental_questions');
            mqs.forEach((q, n) => {
                q._mid = num(q.id) || (Date.now() + 200000 + n);
                if (num(q.id)) midMap.set(num(q.id), q._mid);
            });
            for (let i = 0; i < mqs.length; i += BATCH) {
                const chunk = mqs.slice(i, i + BATCH);
                const vals = [], params = [];
                chunk.forEach(q => {
                    vals.push('(?,?,?,?,?,?,?,?,?,?)');
                    params.push(q._mid, str(q.qtype, 16) || 'percent',
                        Math.min(3, Math.max(1, num(q.difficulty) || 2)),
                        str(q.stem, 20000), JSON.stringify(q.options || []), str(q.answer, 50),
                        str(q.tip, 20000), str(q.tag, 50), q.active === false ? 0 : 1,
                        q.fillable ? 1 : 0);
                });
                await conn.query(
                    `INSERT INTO mental_questions (id, qtype, difficulty, stem, options, answer, tip, tag, active, fillable)
                     VALUES ` + vals.join(','), params);
            }
            mQuestions = mqs.length;
        }

        const sessions = Array.isArray(data.mental.mentalSessions) ? data.mental.mentalSessions : [];
        sessions.forEach((s, n) => {
            s._sid = num(s.id) || (Date.now() + 300000 + n);
        });
        for (let i = 0; i < sessions.length; i += BATCH) {
            const chunk = sessions.slice(i, i + BATCH);
            const vals = [], params = [];
            chunk.forEach(s => {
                vals.push('(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
                params.push(s._sid, str(s.qtype, 16) || 'mixed',
                    str(s.qtypeName, 20) || '', Math.min(3, Math.max(0, num(s.difficulty))),
                    s.answerMode === 'fill' ? 'fill' : 'choice',
                    num(s.totalCount), num(s.doneCount), num(s.correctCount),
                    num(s.wrongCount), num(s.skippedCount), num(s.rate), num(s.totalMs),
                    s.startedAt || '1970-01-01 00:00:00', s.finishedAt || null);
            });
            await conn.query(
                `INSERT INTO mental_sessions (id, qtype, qtype_name, difficulty, answer_mode, total_count,
                    done_count, correct_count, wrong_count, skipped_count, rate, total_ms,
                    started_at, finished_at)
                 VALUES ` + vals.join(','), params);
        }
        mSessions = sessions.length;

        /* mental_records：按会话插入（自增 id，题目快照照搬） */
        for (const s of sessions) {
            const recs = Array.isArray(s.records) ? s.records : [];
            const sid = s._sid;
            for (let j = 0; j < recs.length; j += BATCH) {
                const chunk = recs.slice(j, j + BATCH);
                const vals = [], params = [];
                chunk.forEach(r => {
                    vals.push('(?,?,?,?,?,?,?,?,?,?,?,?)');
                    const res = r.result === 'ok' || r.result === 'ng' || r.result === 'skip' ? r.result : 'ok';
                    params.push(sid, num(r.questionId) ? (midMap.get(num(r.questionId)) || num(r.questionId)) : 0, num(r.no) || 0,
                        str(r.qtype, 16) || '', str(r.stem, 20000), JSON.stringify(r.options || []),
                        str(r.answer, 50), str(r.tip, 20000),
                        r.userAnswer == null || r.userAnswer === '' ? null : str(r.userAnswer, 50),
                        res, num(r.ms), null);
                });
                await conn.query(
                    `INSERT INTO mental_records (session_id, question_id, no, qtype, stem, options,
                        answer, tip, user_answer, result, ms, answered_at)
                     VALUES ` + vals.join(','), params);
            }
        }
    }

    return {
        h: rounds.length,
        f: favs.length,
        hasCats: Array.isArray(data.categories) && data.categories.length > 0,
        hasStudy: !!(data.studyDaily && typeof data.studyDaily === 'object'),
        hasMemos: !!(data.memos && typeof data.memos === 'object'),
        practice: { banks: pBanks, questions: pQuestions, sessions: pSessions },
        mental: { questions: mQuestions, sessions: mSessions }
    };
}

module.exports = importData;
