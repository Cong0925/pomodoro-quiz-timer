/* ============================================================
 * 刷题计时器 - server/backup.js
 * 一键备份：把数据库全部数据导出为 JSON 文件
 *
 * 用法：
 *   npm run backup                    # 备份到 data/backup-日期时间.json
 *   npm run backup <路径>             # 备份到指定文件
 *
 * 适用：日常定期备份 / 换电脑前导出数据（把生成的 JSON 文件带到新电脑，
 *       在新电脑上执行 npm run restore 即可恢复）
 * ============================================================ */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { exportAll } = require('./exportData');

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pomodoro-quiz-timer',
        dateStrings: true
    });

    /* 输出路径 */
    let out;
    if (process.argv[2]) {
        out = path.resolve(process.argv[2]);
    } else {
        const dir = path.join(__dirname, '..', 'data');
        fs.mkdirSync(dir, { recursive: true });
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        out = path.join(dir, 'backup-' + ts + '.json');
    }

    const obj = await exportAll(conn);
    fs.writeFileSync(out, JSON.stringify(obj, null, 2), 'utf8');
    console.log('==============================================');
    console.log('  备份完成：' + out);
    console.log('    历史轮次：' + obj.history.length + ' 轮');
    console.log('    错题收藏：' + obj.favorites.length + ' 条');
    console.log('    分类：' + obj.categories.length + ' 个');
    console.log('    学习时长：' + Object.keys(obj.studyDaily).length + ' 天');
    console.log('    日历备忘：' + Object.keys(obj.memos).length + ' 条');
    console.log('==============================================');
    console.log('  提示：把此文件带到新电脑，执行 npm run restore 即可恢复全部数据。');
    await conn.end();
})().catch(err => {
    console.error('[FAIL] 备份失败：', err.message);
    process.exit(1);
});
