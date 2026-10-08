/* ============================================================
 * 刷题计时器 - server/restore.js
 * 一键恢复：把备份 JSON 文件导入数据库（新电脑恢复 / 覆盖式恢复）
 *
 * 用法：
 *   npm run restore <备份文件.json>
 *
 * 安全设计：
 *   - 导入前自动把库内现有数据备份到 data/backup-restore-*.json，防止误操作丢数据
 *   - 恢复语义：历史 / 收藏以备份文件为准替换，分类合并，学习时长按日取较大值，
 *     备忘按日覆盖 —— 与页面「导入 JSON」完全一致
 *   - 数据库账号密码从 .env 读取（新电脑改 .env 即可，无需改代码）
 * ============================================================ */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const importData = require('./importData');
const { exportAll } = require('./exportData');

(async () => {
    /* 1. 定位备份文件 */
    const src = process.argv[2] ? path.resolve(process.argv[2]) : null;
    if (!src) {
        console.error('[FAIL] 请指定备份文件：npm run restore <备份文件.json>');
        console.error('       例：npm run restore data/backup-2026-09-28-15-00-00.json');
        process.exit(1);
    }
    if (!fs.existsSync(src)) {
        console.error('[FAIL] 找不到备份文件：' + src);
        process.exit(1);
    }
    let data;
    try {
        data = JSON.parse(fs.readFileSync(src, 'utf8'));
    } catch (e) {
        console.error('[FAIL] 备份文件不是有效的 JSON：' + e.message);
        process.exit(1);
    }
    if (!Array.isArray(data.history)) {
        console.error('[FAIL] 备份文件格式不正确（缺少 history 数组）');
        process.exit(1);
    }
    console.log('[OK] 读取备份：' + src + '（历史 ' + data.history.length + ' 轮）');

    /* 2. 连接数据库 */
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pomodoro-quiz-timer',
        dateStrings: true
    });

    /* 3. 恢复前自动备份当前库（防止误操作丢数据） */
    const [cnt] = await conn.query('SELECT COUNT(*) AS n FROM rounds');
    if (cnt[0].n > 0) {
        const backupDir = path.join(__dirname, '..', 'data');
        fs.mkdirSync(backupDir, { recursive: true });
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const backupPath = path.join(backupDir, 'backup-restore-' + ts + '.json');
        const obj = await exportAll(conn);
        fs.writeFileSync(backupPath, JSON.stringify(obj, null, 2), 'utf8');
        console.log('[OK] 已备份当前库到：' + backupPath);
    } else {
        console.log('[OK] 当前库为空，直接导入。');
    }

    /* 4. 导入（事务） */
    await conn.beginTransaction();
    try {
        const info = await importData(conn, data);
        await conn.commit();
        console.log('==============================================');
        console.log('  恢复完成：');
        console.log('    历史轮次：' + info.h + ' 轮');
        console.log('    错题收藏：' + info.f + ' 条');
        console.log('    分类：' + (info.hasCats ? '已导入' : '无'));
        console.log('    学习时长：' + (info.hasStudy ? '已合并' : '无'));
        console.log('    日历备忘：' + (info.hasMemos ? '已导入' : '无'));
        console.log('==============================================');
    } catch (e) {
        await conn.rollback();
        console.error('[FAIL] 导入失败，已回滚：', e.message);
        process.exit(1);
    }
    await conn.end();
})().catch(err => {
    console.error('[FAIL] 恢复失败：', err.message);
    process.exit(1);
});
