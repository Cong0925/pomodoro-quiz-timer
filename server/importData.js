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
    for (let i = 0; i < rounds.length; i += BATCH) {
        const chunk = rounds.slice(i, i + BATCH);
        const vals = [], params = [];
        chunk.forEach((h, k) => {
            vals.push('(?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            params.push(
                num(h.id) || Date.now() + i + k,
                h.mode === 'batch' ? 'batch' : 'single',
                str(h.modeName, 20) || (h.mode === 'batch' ? '整组模式' : '单题模式'),
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
        const rid = num(h.id) || 0;
        for (let j = 0; j < recs.length; j += BATCH) {
            const chunk = recs.slice(j, j + BATCH);
            const vals = [], params = [];
            chunk.forEach(r => {
                vals.push('(?,?,?,?,?,?)');
                params.push(rid, num(r.no) || 0, num(r.ms), num(r.cumMs),
                    str(r.timeStr, 12), r.result === 'ng' ? 'ng' : 'ok');
            });
            await conn.query(
                'INSERT INTO records (round_id, no, ms, cum_ms, time_str, result) VALUES ' + vals.join(','),
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
                num(f.hid) || 0,
                num(f.no) || 0,
                str(f.title, 100),
                f.mode === 'batch' ? 'batch' : 'single',
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

    return {
        h: rounds.length,
        f: favs.length,
        hasCats: Array.isArray(data.categories) && data.categories.length > 0,
        hasStudy: !!(data.studyDaily && typeof data.studyDaily === 'object'),
        hasMemos: !!(data.memos && typeof data.memos === 'object')
    };
}

module.exports = importData;
