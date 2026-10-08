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
            'no', no, 'ms', ms, 'cumMs', cum_ms, 'timeStr', time_str, 'result', result)) AS records
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

    return { version: 2, categories, history, favorites, studyDaily, memos };
}

module.exports = { exportAll };
