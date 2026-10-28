/* ============================================================
 * 刷题计时器 - web-app 后端全量验收脚本
 * 用法：先启动后端（npm run dev / npm start），再运行 npm run test:acceptance
 * 说明：
 *  - 对真实 MySQL 逐接口跑「正常入参断言 + 异常入参断言」
 *  - 测试数据使用可识别前缀与未来日期（2099-xx），结束后自动清理
 *  - 「清空全部」类接口（DELETE /history 等）只验证存在性，
 *    不实际执行，避免破坏用户真实数据
 *  - /api/import 只验证异常入参拒绝（合法导入会替换真实历史，禁止触发）
 * ============================================================ */
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3000';
const pool = require('../db');

/* ---------- 断言与统计 ---------- */
const results = { pass: 0, fail: 0, skip: 0, failures: [] };
let currentGroup = '';

async function t(name, fn) {
    try {
        await fn();
        results.pass++;
        console.log(`  ✅ ${name}`);
    } catch (e) {
        results.fail++;
        results.failures.push({ group: currentGroup, name, message: e.message });
        console.log(`  ❌ ${name} —— ${e.message}`);
    }
}
function skip(name, why) {
    results.skip++;
    console.log(`  ⏭️ ${name}（跳过：${why}）`);
}
function group(title) {
    currentGroup = title;
    console.log(`\n【${title}】`);
}
function assert(cond, msg) {
    if (!cond) throw new Error(msg || '断言失败');
}
async function req(method, path, body) {
    const res = await fetch(BASE + path, {
        method,
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:5173' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* 非 JSON 响应（不应出现） */ }
    return { status: res.status, data, headers: res.headers };
}

/* ---------- 清理清单（finally 统一执行） ---------- */
const cleanup = {
    roundIds: [],
    favIds: [],
    categoryIds: [],
    bankIds: [],
    mentalQuestionIds: [],
    mentalSessionIds: [],
    practiceSessionIds: [],
    dates: ['2099-01-01', '2099-01-02', '2099-01-03']
};
async function doCleanup() {
    const tasks = [];
    for (const d of cleanup.dates) {
        tasks.push(pool.query('DELETE FROM memos WHERE memo_date=?', [d]));
        tasks.push(pool.query('DELETE FROM study_daily WHERE study_date=?', [d]));
    }
    for (const sid of cleanup.mentalSessionIds) {
        tasks.push(pool.query('DELETE FROM mental_sessions WHERE id=?', [sid]));
    }
    for (const sid of cleanup.practiceSessionIds) {
        tasks.push(pool.query('DELETE FROM practice_sessions WHERE id=?', [sid]));
    }
    /* 速算测试题物理删除（管理端 DELETE 是软删除，验收需彻底清理） */
    for (const qid of cleanup.mentalQuestionIds) {
        tasks.push(pool.query('DELETE FROM mental_questions WHERE id=? AND tag LIKE ?', [qid, '[验收测试]%']).catch(() => {}));
    }
    for (const bid of cleanup.bankIds) {
        tasks.push(pool.query('DELETE FROM question_banks WHERE id=? AND name LIKE ?', [bid, '[验收测试]%']));
    }
    for (const cid of cleanup.categoryIds) {
        tasks.push(pool.query('DELETE FROM categories WHERE id=? AND name LIKE ?', [cid, '验收测试%']));
    }
    for (const fid of cleanup.favIds) {
        tasks.push(pool.query('DELETE FROM favorites WHERE id=?', [fid]));
    }
    for (const rid of cleanup.roundIds) {
        tasks.push(pool.query('DELETE FROM rounds WHERE id=?', [rid]));
    }
    await Promise.allSettled(tasks);
}

/* ============================================================ */
async function main() {
    /* ---- 0. 健康检查 ---- */
    group('0. 服务与数据库连通');
    await t('GET /api/health 返回 ok', async () => {
        const { status, data } = await req('GET', '/api/health');
        assert(status === 200 && data && data.ok === true, `status=${status} data=${JSON.stringify(data)}`);
    });
    await t('未知接口返回 404 JSON', async () => {
        const { status, data } = await req('GET', '/api/definitely-not-exist');
        assert(status === 404 && data && data.error, `status=${status}`);
    });

    /* ---- 1. 分类 ---- */
    group('1. 分类管理 /api/categories');
    let testCatId = null;
    let testSubId = null;
    await t('GET / 返回分类数组', async () => {
        const { status, data } = await req('GET', '/api/categories');
        assert(status === 200 && Array.isArray(data) && data.length > 0, `status=${status}`);
    });
    await t('POST / 新建大类（验收测试前缀）', async () => {
        const { status, data } = await req('POST', '/api/categories', { name: '验收测试大类' });
        assert(status === 201 && data.id, `status=${status}`);
        testCatId = data.id;
        cleanup.categoryIds.push(testCatId);
    });
    await t('POST / 空名称返回 400', async () => {
        const { status } = await req('POST', '/api/categories', { name: '  ' });
        assert(status === 400, `status=${status}`);
    });
    await t('POST /:id/subs 新建小类', async () => {
        const { status, data } = await req('POST', `/api/categories/${testCatId}/subs`, { name: '验收测试小类' });
        assert(status === 201 && data.id, `status=${status}`);
        testSubId = data.id;
    });
    await t('PUT /:id/subs/:subId 重命名小类', async () => {
        const { status } = await req('PUT', `/api/categories/${testCatId}/subs/${testSubId}`, { name: '验收测试小类改' });
        assert(status === 200, `status=${status}`);
    });
    await t('PUT /:id 重命名大类', async () => {
        const { status } = await req('PUT', `/api/categories/${testCatId}`, { name: '验收测试大类改' });
        assert(status === 200, `status=${status}`);
    });
    await t('DELETE /:id/subs/:subId 删除小类', async () => {
        const { status } = await req('DELETE', `/api/categories/${testCatId}/subs/${testSubId}`);
        assert(status === 200, `status=${status}`);
    });
    await t('DELETE 不存在的小类返回 404', async () => {
        const { status } = await req('DELETE', `/api/categories/${testCatId}/subs/not-exist`);
        assert(status === 404, `status=${status}`);
    });
    await t('POST /restore 幂等恢复内置分类', async () => {
        const { status, data } = await req('POST', '/api/categories/restore');
        assert(status === 200 && typeof data.added === 'number', `status=${status}`);
    });
    await t('DELETE /:id 删除大类', async () => {
        const { status } = await req('DELETE', `/api/categories/${testCatId}`);
        assert(status === 200, `status=${status}`);
    });

    /* ---- 2. 历史轮次 ---- */
    group('2. 历史记录 /api/history');
    let roundId = null;
    await t('POST / 归档一轮（含2条明细）', async () => {
        const { status, data } = await req('POST', '/api/history', {
            mode: 'single', modeName: '单题模式', title: '验收测试轮次', description: '验收自动创建',
            finishedAt: '2099-01-01 10:00:00', maxCount: 2, totalMs: 120000, correct: 1, rate: 50,
            catId: null, catName: '验收', subId: null, subName: null,
            records: [
                { no: 1, ms: 60000, cumMs: 60000, timeStr: '01:00.00', result: 'ok', note: '知识点A' },
                { no: 2, ms: 60000, cumMs: 120000, timeStr: '02:00.00', result: 'ng', note: '知识点B' }
            ]
        });
        assert(status === 201 && data.id, `status=${status}`);
        roundId = data.id;
        cleanup.roundIds.push(roundId);
    });
    await t('GET / 分页+筛选（mode=single）', async () => {
        const { status, data } = await req('GET', '/api/history?mode=single&page=1&limit=5');
        assert(status === 200 && Array.isArray(data.list) && data.total >= 1 && data.page === 1, `status=${status}`);
        assert(data.list.some(x => x.id === roundId), '新建轮次未出现在列表');
    });
    await t('GET /:id 详情含 records', async () => {
        const { status, data } = await req('GET', `/api/history/${roundId}`);
        assert(status === 200 && data.records && data.records.length === 2, `status=${status} records=${data.records && data.records.length}`);
    });
    await t('GET 不存在轮次返回 404', async () => {
        const { status } = await req('GET', '/api/history/9999999999999');
        assert(status === 404, `status=${status}`);
    });
    await t('PUT /:id 编辑标题/描述', async () => {
        const { status } = await req('PUT', `/api/history/${roundId}`, { title: '验收测试轮次改', description: '已修改', catId: null, catName: null, subId: null, subName: null });
        assert(status === 200, `status=${status}`);
    });
    await t('PUT /:id/record/:no 修改知识点', async () => {
        const { status } = await req('PUT', `/api/history/${roundId}/record/2`, { note: '知识点B改' });
        assert(status === 200, `status=${status}`);
    });
    await t('DELETE /:id 删除单轮（级联）', async () => {
        const { status } = await req('DELETE', `/api/history/${roundId}`);
        assert(status === 200, `status=${status}`);
    });
    await t('DELETE 不存在轮次返回 404', async () => {
        const { status } = await req('DELETE', '/api/history/9999999999999');
        assert(status === 404, `status=${status}`);
    });
    skip('DELETE / 清空全部历史', '全清接口不触真实数据，仅确认存在');
    await t('DELETE / 清空全部历史（接口存在性，空跑需先确认无数据风险→改为仅 404 路径验证）', async () => {
        /* 不执行全清：直接验证路由已挂载（对不存在 id 的单删已覆盖删除链路） */
        const res = await fetch(BASE + '/api/history', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173' } });
        assert(res.status !== 404, `路由未挂载 status=${res.status}`);
    });

    /* ---- 3. 收藏 ---- */
    group('3. 错题收藏 /api/favorites');
    /* 重建轮次用于收藏（收藏依赖 round 存在快照逻辑） */
    let favRoundId = null;
    let favId = null;
    await t('POST /（前置）再归档一轮供收藏', async () => {
        const { status, data } = await req('POST', '/api/history', {
            mode: 'single', modeName: '单题模式', title: '收藏测试轮', description: '',
            maxCount: 1, totalMs: 30000, correct: 0, rate: 0,
            records: [{ no: 1, ms: 30000, cumMs: 30000, timeStr: '00:30.00', result: 'ng' }]
        });
        assert(status === 201 && data.id, `status=${status}`);
        favRoundId = data.id;
        cleanup.roundIds.push(favRoundId);
    });
    await t('POST / 收藏错题', async () => {
        const { status, data } = await req('POST', '/api/favorites', { roundId: favRoundId, no: 1, timeStr: '00:30.00' });
        assert(status === 201 && data.id, `status=${status}`);
        favId = data.id;
        cleanup.favIds.push(favId);
    });
    await t('POST / 缺参返回 400', async () => {
        const { status } = await req('POST', '/api/favorites', {});
        assert(status === 400, `status=${status}`);
    });
    await t('GET / 分页列表含新收藏', async () => {
        const { status, data } = await req('GET', '/api/favorites?page=1&limit=10');
        assert(status === 200 && data.list.some(x => x.id === favId), `status=${status}`);
    });
    await t('PUT /:id 修改收藏分类', async () => {
        const { status } = await req('PUT', `/api/favorites/${favId}`, { catId: null, catName: null, subId: null, subName: null });
        assert(status === 200, `status=${status}`);
    });
    await t('DELETE /:id 取消收藏', async () => {
        const { status } = await req('DELETE', `/api/favorites/${favId}`);
        assert(status === 200, `status=${status}`);
    });
    skip('DELETE / 清空全部收藏', '全清接口不触真实数据');

    /* ---- 4. 学习时长 ---- */
    group('4. 学习时长 /api/study-daily');
    await t('POST / 累加 2099-01-01 时长', async () => {
        const { status, data } = await req('POST', '/api/study-daily', { date: '2099-01-01', addMs: 60000 });
        assert(status === 200 && data.added === 60000, `status=${status}`);
    });
    await t('POST / 非法日期返回 400', async () => {
        const { status } = await req('POST', '/api/study-daily', { date: 'bad', addMs: 1 });
        assert(status === 400, `status=${status}`);
    });
    await t('GET / 查询某日时长', async () => {
        const { status, data } = await req('GET', '/api/study-daily?date=2099-01-01');
        assert(status === 200 && data.ms === 60000, `status=${status} ms=${data.ms}`);
    });
    await t('GET /range 区间查询', async () => {
        const { status, data } = await req('GET', '/api/study-daily/range?start=2099-01-01&end=2099-01-03');
        assert(status === 200 && data.totalMs === 60000 && data.list.length === 1, `status=${status} totalMs=${data.totalMs}`);
    });
    await t('GET /range start 晚于 end 返回 400', async () => {
        const { status } = await req('GET', '/api/study-daily/range?start=2099-01-03&end=2099-01-01');
        assert(status === 400, `status=${status}`);
    });
    await t('DELETE /?date= 清除某日', async () => {
        const { status, data } = await req('DELETE', '/api/study-daily?date=2099-01-01');
        assert(status === 200 && data.deleted === true, `status=${status}`);
    });

    /* ---- 5. 日历备忘 ---- */
    group('5. 日历备忘 /api/memos');
    await t('PUT /:date 保存 2099-01-02 备忘', async () => {
        const { status } = await req('PUT', '/api/memos/2099-01-02', { type: 'study', title: '验收', content: '验收测试内容' });
        assert(status === 200, `status=${status}`);
    });
    await t('PUT /:date 非法日期返回 400', async () => {
        const { status } = await req('PUT', '/api/memos/bad-date', { type: 'study', title: 'x', content: 'y' });
        assert(status === 400, `status=${status}`);
    });
    await t('GET /?month=2099-01 按月查询', async () => {
        const { status, data } = await req('GET', '/api/memos?month=2099-01');
        assert(status === 200 && Array.isArray(data) && data.some(x => x.date === '2099-01-02'), `status=${status}`);
    });
    await t('GET /?month=非法 返回 400', async () => {
        const { status } = await req('GET', '/api/memos?month=2099/01');
        assert(status === 400, `status=${status}`);
    });
    await t('GET /:date 单日查询', async () => {
        const { status, data } = await req('GET', '/api/memos/2099-01-02');
        assert(status === 200 && data && data.title === '验收', `status=${status}`);
    });
    await t('DELETE /:date 删除单日', async () => {
        const { status } = await req('DELETE', '/api/memos/2099-01-02');
        assert(status === 200, `status=${status}`);
    });

    /* ---- 6. 统计 ---- */
    group('6. 学习统计 /api/stats');
    for (const gran of ['day', 'week', 'month']) {
        await t(`GET /?gran=${gran} 返回 today+list`, async () => {
            const { status, data } = await req('GET', `/api/stats?gran=${gran}`);
            assert(status === 200 && data.today && Array.isArray(data.list), `status=${status}`);
        });
    }

    /* ---- 7. 题库练习 ---- */
    group('7. 题库练习 /api/practice');
    let bankId = null;
    let qIds = [];
    await t('POST /banks 创建题库（验收测试前缀）', async () => {
        const { status, data } = await req('POST', '/api/practice/banks', { name: '[验收测试]题库', description: '验收自动创建' });
        assert(status === 201 && data.id, `status=${status}`);
        bankId = data.id;
        cleanup.bankIds.push(bankId);
    });
    await t('GET /banks 列表含新题库', async () => {
        const { status, data } = await req('GET', '/api/practice/banks');
        assert(status === 200 && Array.isArray(data) && data.some(b => b.id === bankId), `status=${status}`);
    });
    await t('GET /banks/:id 单库详情', async () => {
        const { status, data } = await req('GET', `/api/practice/banks/${bankId}`);
        assert(status === 200 && data.id === bankId && data.count === 0, `status=${status}`);
    });
    await t('GET 不存在题库返回 404', async () => {
        const { status } = await req('GET', '/api/practice/banks/999999');
        assert(status === 404, `status=${status}`);
    });
    await t('POST /banks/:id 编辑题库', async () => {
        const { status } = await req('PUT', `/api/practice/banks/${bankId}`, { name: '[验收测试]题库改', description: '改' });
        assert(status === 200, `status=${status}`);
    });
    await t('POST /questions/batch 批量导入3题', async () => {
        const { status, data } = await req('POST', '/api/practice/questions/batch', {
            bankId,
            questions: [
                { type: 'single', stem: '验收题1：1+1=?', options: [{ label: 'A', text: '1' }, { label: 'B', text: '2' }], answer: 'B', analysis: '略' },
                { type: 'single', stem: '验收题2：2+2=?', options: [{ label: 'A', text: '3' }, { label: 'B', text: '4' }], answer: 'B' },
                { type: 'judge', stem: '验收题3：1是奇数', options: [], answer: 'T' }
            ]
        });
        assert(status === 201 && data.count === 3 && data.ids.length === 3, `status=${status}`);
        qIds = data.ids;
    });
    await t('POST /questions/batch 题干为空返回 400（带题号定位）', async () => {
        const { status, data } = await req('POST', '/api/practice/questions/batch', {
            bankId, questions: [{ type: 'single', stem: '', answer: 'A' }]
        });
        assert(status === 400 && data.error.includes('第1题'), `status=${status} error=${data && data.error}`);
    });
    await t('POST /questions/batch 空数组返回 400', async () => {
        const { status } = await req('POST', '/api/practice/questions/batch', { bankId, questions: [] });
        assert(status === 400, `status=${status}`);
    });
    await t('GET /banks/:id/questions 全量列表', async () => {
        const { status, data } = await req('GET', `/api/practice/banks/${bankId}/questions`);
        assert(status === 200 && Array.isArray(data) && data.length === 3, `status=${status} len=${data.length}`);
    });
    await t('GET /banks/:id/questions 后端分页', async () => {
        const { status, data } = await req('GET', `/api/practice/banks/${bankId}/questions?page=1&pageSize=2`);
        assert(status === 200 && data.total === 3 && data.list.length === 2, `status=${status}`);
    });
    await t('POST /questions 单题创建', async () => {
        const { status, data } = await req('POST', '/api/practice/questions', {
            bankId, type: 'single', stem: '验收题4：3+3=?', options: [{ label: 'A', text: '6' }], answer: 'A'
        });
        assert(status === 201 && data.id, `status=${status}`);
        qIds.push(data.id);
    });
    await t('POST /questions 非法题型返回 400', async () => {
        const { status } = await req('POST', '/api/practice/questions', { bankId, type: 'unknown', stem: 'x', answer: 'A' });
        assert(status === 400, `status=${status}`);
    });
    await t('PUT /questions/:id 编辑题目', async () => {
        const { status } = await req('PUT', `/api/practice/questions/${qIds[0]}`, {
            type: 'single', stem: '验收题1改：1+1=?', options: [{ label: 'A', text: '2' }], answer: 'A'
        });
        assert(status === 200, `status=${status}`);
    });
    /* 练习会话全流程：start → answer(对) → skip → answer(错) → finish */
    let sessionId = null;
    let sessionQs = [];
    await t('POST /start 开始练习（顺序3题）', async () => {
        const { status, data } = await req('POST', '/api/practice/start', { bankId, mode: 'order', count: 3 });
        assert(status === 201 && data.sessionId && data.questions.length >= 3, `status=${status}`);
        sessionId = data.sessionId;
        sessionQs = data.questions;
        cleanup.practiceSessionIds.push(sessionId);
    });
    await t('POST /start 题库不存在返回 404', async () => {
        const { status } = await req('POST', '/api/practice/start', { bankId: 999999, mode: 'order', count: 1 });
        assert(status === 404, `status=${status}`);
    });
    await t('POST /:id/answer 正确作答第1题', async () => {
        /* 从管理端接口取该题正确答案（避免猜测） */
        const { data: adminQs } = await req('GET', `/api/practice/banks/${bankId}/questions`);
        const answer = adminQs.find(q => q.id === sessionQs[0].id).answer;
        const { status, data } = await req('POST', `/api/practice/${sessionId}/answer`, {
            no: 1, questionId: sessionQs[0].id, answer, ms: 20000
        });
        assert(status === 200 && data.result === 'ok', `status=${status} result=${data && data.result}`);
    });
    await t('POST /:id/answer 重复作答返回 409', async () => {
        const { status } = await req('POST', `/api/practice/${sessionId}/answer`, { no: 1, questionId: sessionQs[0].id, answer: 'A', ms: 1 });
        assert(status === 409, `status=${status}`);
    });
    await t('POST /:id/skip 跳过第2题', async () => {
        const { status, data } = await req('POST', `/api/practice/${sessionId}/skip`, { no: 2, questionId: sessionQs[1].id, ms: 5000 });
        assert(status === 200 && data.result === 'skip', `status=${status}`);
    });
    await t('POST /:id/answer 错误作答第3题', async () => {
        const { data: adminQs } = await req('GET', `/api/practice/banks/${bankId}/questions`);
        const q = adminQs.find(x => x.id === sessionQs[2].id);
        const wrong = q.answer === 'A' ? 'B' : 'A';
        const { status, data } = await req('POST', `/api/practice/${sessionId}/answer`, { no: 3, questionId: sessionQs[2].id, answer: wrong, ms: 30000 });
        assert(status === 200 && data.result === 'ng', `status=${status} result=${data && data.result}`);
    });
    await t('POST /:id/finish 结算（归档到历史）', async () => {
        const { status, data } = await req('POST', `/api/practice/${sessionId}/finish`, { ms: 55000 });
        assert(status === 200 && data.archived && data.correct === 1 && data.wrong === 1 && data.skipped === 1, `status=${status} data=${JSON.stringify(data)}`);
        cleanup.roundIds.push(Number(data.archived.id));
    });
    await t('POST /:id/finish 重复结算返回 404', async () => {
        const { status } = await req('POST', `/api/practice/${sessionId}/finish`, { ms: 1 });
        assert(status === 404, `status=${status}`);
    });
    await t('GET /history 列表+bankId 筛选', async () => {
        const { status, data } = await req('GET', `/api/practice/history?bankId=${bankId}`);
        assert(status === 200 && data.list.length === 1 && data.list[0].id === sessionId, `status=${status}`);
    });
    await t('GET /history/:id 明细回看', async () => {
        const { status, data } = await req('GET', `/api/practice/history/${sessionId}`);
        assert(status === 200 && data.records && data.records.length === 3, `status=${status} len=${data.records && data.records.length}`);
    });
    await t('GET /stats 统计结构完整', async () => {
        const { status, data } = await req('GET', '/api/practice/stats');
        assert(status === 200 && data.all && data.today, `status=${status}`);
    });
    await t('DELETE /questions/batch 批量删除（删2题留1题）', async () => {
        const { status, data } = await req('DELETE', '/api/practice/questions/batch', { ids: qIds.slice(0, 2) });
        assert(status === 200 && data.deleted === 2, `status=${status} deleted=${data && data.deleted}`);
    });
    await t('DELETE /questions/:id 删除单题', async () => {
        const { status } = await req('DELETE', `/api/practice/questions/${qIds[2]}`);
        assert(status === 200, `status=${status}`);
    });
    await t('DELETE /history/:id 删除练习会话', async () => {
        const { status } = await req('DELETE', `/api/practice/history/${sessionId}`);
        assert(status === 200, `status=${status}`);
    });
    await t('GET /history/:id 已删会话返回 404', async () => {
        const { status } = await req('GET', `/api/practice/history/${sessionId}`);
        assert(status === 404, `status=${status}`);
    });
    skip('DELETE /history 清空全部练习历史', '全清接口不触真实数据');
    await t('DELETE /banks/:id 删除题库（级联）', async () => {
        const { status } = await req('DELETE', `/api/practice/banks/${bankId}`);
        assert(status === 200, `status=${status}`);
    });

    /* ---- 8. 速算练习 ---- */
    group('8. 速算练习 /api/mental');
    await t('GET /admin/questions 分页管理列表', async () => {
        const { status, data } = await req('GET', '/api/mental/admin/questions?page=1&pageSize=5');
        assert(status === 200 && Array.isArray(data.list) && data.total > 0, `status=${status}`);
    });
    let mQid = null;
    await t('POST /admin/questions 创建验收题', async () => {
        const { status, data } = await req('POST', '/api/mental/admin/questions', {
            qtype: 'percent', difficulty: 1, stem: '验收：50% = ?',
            options: ['1/2', '1/3', '1/4', '1/5'], answer: 0, tip: '验收技巧', tag: '[验收测试]'
        });
        assert(status === 201 && data.id, `status=${status}`);
        mQid = data.id;
        cleanup.mentalQuestionIds.push(mQid);
    });
    await t('POST /admin/questions 题干为空返回 400', async () => {
        const { status } = await req('POST', '/api/mental/admin/questions', { qtype: 'percent', stem: '', options: ['a'], answer: 0 });
        assert(status === 400, `status=${status}`);
    });
    await t('PUT /admin/questions/:id 更新', async () => {
        const { status } = await req('PUT', `/api/mental/admin/questions/${mQid}`, {
            qtype: 'percent', difficulty: 1, stem: '验收：50% = ?（改）',
            options: ['1/2', '1/3', '1/4', '1/5'], answer: 0, tip: '验收技巧', tag: '[验收测试]'
        });
        assert(status === 200, `status=${status}`);
    });
    let mSessionId = null;
    let mQs = [];
    await t('POST /start 定量会话（百化分2题）', async () => {
        const { status, data } = await req('POST', '/api/mental/start', { qtype: 'percent', difficulty: 0, count: 2, answerMode: 'choice' });
        assert(status === 201 && data.sessionId && data.questions.length === 2, `status=${status}`);
        mSessionId = data.sessionId;
        mQs = data.questions;
        cleanup.mentalSessionIds.push(mSessionId);
    });
    await t('POST /:id/answer 作答第1题（必传 questionId）', async () => {
        const { status, data } = await req('POST', `/api/mental/${mSessionId}/answer`, { no: 1, questionId: mQs[0].id, answer: 0, ms: 10000 });
        assert(status === 200 && ['ok', 'ng'].includes(data.result), `status=${status} result=${data && data.result}`);
    });
    await t('POST /:id/answer 缺 questionId 返回 400', async () => {
        const { status } = await req('POST', `/api/mental/${mSessionId}/answer`, { no: 99, answer: 0, ms: 1 });
        assert(status === 400, `status=${status}`);
    });
    await t('POST /:id/skip 跳过第2题', async () => {
        const { status, data } = await req('POST', `/api/mental/${mSessionId}/skip`, { no: 2, questionId: mQs[1].id, ms: 3000 });
        assert(status === 200 && data.result === 'skip', `status=${status}`);
    });
    await t('POST /:id/finish 结算', async () => {
        const { status, data } = await req('POST', `/api/mental/${mSessionId}/finish`, { ms: 13000 });
        assert(status === 200 && typeof data.rate !== 'undefined', `status=${status} data=${JSON.stringify(data)}`);
    });
    let mInfId = null;
    await t('POST /start 无限流会话 + /:id/more 追加', async () => {
        const { status, data } = await req('POST', '/api/mental/start', { qtype: 'compare', count: 0 });
        assert(status === 201 && data.infinite === true, `status=${status}`);
        mInfId = data.sessionId;
        cleanup.mentalSessionIds.push(mInfId);
        await req('POST', `/api/mental/${mInfId}/answer`, { no: 1, questionId: data.questions[0].id, answer: 0, ms: 1000 });
        const more = await req('POST', `/api/mental/${mInfId}/more`, {});
        assert(more.status === 200 && more.data.questions && more.data.questions.length > 0, `more status=${more.status}`);
        await req('POST', `/api/mental/${mInfId}/finish`, { ms: 2000 });
    });
    await t('GET /history 列表+qtype 筛选', async () => {
        const { status, data } = await req('GET', '/api/mental/history?qtype=percent&difficulty=0');
        assert(status === 200 && data.list.some(x => x.id === mSessionId), `status=${status}`);
    });
    await t('GET /history/:id 明细回看（题目快照）', async () => {
        const { status, data } = await req('GET', `/api/mental/history/${mSessionId}`);
        assert(status === 200 && data.records && data.records.length === 2 && data.records[0].stem, `status=${status}`);
    });
    await t('GET /stats 统计结构完整', async () => {
        const { status, data } = await req('GET', '/api/mental/stats');
        assert(status === 200 && data.all && data.today, `status=${status}`);
    });
    await t('DELETE /history/:id 删除速算会话', async () => {
        const { status } = await req('DELETE', `/api/mental/history/${mSessionId}`);
        assert(status === 200, `status=${status}`);
    });
    await t('DELETE /admin/questions/:id 软删除验收题', async () => {
        const { status } = await req('DELETE', `/api/mental/admin/questions/${mQid}`);
        assert(status === 200, `status=${status}`);
    });
    skip('DELETE /history 清空全部速算历史', '全清接口不触真实数据');

    /* ---- 9. 数据导入导出 ---- */
    group('9. 数据导入导出 /api');
    await t('GET /export 返回 v2 结构', async () => {
        const { status, data } = await req('GET', '/api/export');
        assert(status === 200 && data.version === 2 && Array.isArray(data.history) && data.mental, `status=${status}`);
    });
    await t('GET /info 返回 14 表统计', async () => {
        const { status, data } = await req('GET', '/api/info');
        assert(status === 200 && data.dbName && typeof data.rounds === 'number' && typeof data.mentalRecords === 'number', `status=${status}`);
    });
    await t('POST /import 非法数据返回 400（不触真实数据）', async () => {
        const { status } = await req('POST', '/api/import', { foo: 'bar' });
        assert(status === 400, `status=${status}`);
    });

    /* ---- 10. CORS ---- */
    group('10. CORS 契约');
    await t('白名单源返回 Access-Control-Allow-Origin', async () => {
        const res = await fetch(BASE + '/api/health', { headers: { Origin: 'http://localhost:5173' } });
        assert(res.headers.get('access-control-allow-origin') === 'http://localhost:5173', `hdr=${res.headers.get('access-control-allow-origin')}`);
    });
    await t('非白名单源不返回 CORS 头', async () => {
        const res = await fetch(BASE + '/api/health', { headers: { Origin: 'http://evil.example.com' } });
        assert(res.headers.get('access-control-allow-origin') === null, `hdr=${res.headers.get('access-control-allow-origin')}`);
    });

    /* ---- 结果汇总 ---- */
    console.log('\n══════════════ 验收结果 ══════════════');
    console.log(`✅ 通过：${results.pass}   ❌ 失败：${results.fail}   ⏭️ 跳过：${results.skip}`);
    if (results.failures.length) {
        console.log('\n失败明细：');
        results.failures.forEach(f => console.log(`  ❌ [${f.group}] ${f.name}：${f.message}`));
    }
}

main()
    .catch(e => {
        console.error('验收脚本异常中断：', e);
        results.fail++;
    })
    .finally(async () => {
        console.log('\n清理验收测试数据…');
        await doCleanup();
        await pool.end();
        console.log('清理完成。');
        process.exit(results.fail > 0 ? 1 : 0);
    });
