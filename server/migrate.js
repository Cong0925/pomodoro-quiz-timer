/* ============================================================
 * 刷题计时器 - server/migrate.js
 * 数据迁移：把旧版 data.json（version 2）导入 MySQL
 *
 * 用法：
 *   npm run migrate                        # 默认读取 data/data.json
 *   npm run migrate <json路径>             # 指定文件
 *   npm run migrate <json路径> -- --force  # 库中已有数据时强制替换
 *
 * 安全设计：
 *   - 若数据库中已存在历史数据，默认拒绝执行（需 --force 确认），
 *     避免旧文件意外覆盖新项目里新产生的数据
 *   - 库非空时自动先把库内现有数据导出备份到 data/backup-*.json
 * ============================================================ */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const importData = require('./importData');
const { exportAll } = require('./exportData');

/* fallback path of old project data.json (local dev only; other machines pass explicit path) */
const FALLBACK_SRC = 'C:\\Users\\run\\Desktop\\新建文件夹\\pomodoro-quiz-timer\\data\\data.json';


(async () => {
    /* 1. 定位源文件 */
    let src = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'data', 'data.json');
    if (!fs.existsSync(src) && fs.existsSync(FALLBACK_SRC)) src = FALLBACK_SRC;
    if (!fs.existsSync(src)) {
        console.error('[FAIL] 找不到数据源文件：' + src);
        console.error('      用法：npm run migrate [data.json路径]');
        process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(src, 'utf8'));
    if (!Array.isArray(data.history)) {
        console.error('[FAIL] 数据文件格式不正确（缺少 history 数组）');
        process.exit(1);
    }
    console.log('[OK] 读取数据源：' + src + '（历史 ' + data.history.length + ' 轮）');

    /* 2. 连接数据库 */
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'pomodoro-quiz-timer',
        dateStrings: true
    });

    /* 3. 检查库中现有数据（防止旧文件覆盖新数据） */
    const [cnt] = await conn.query('SELECT COUNT(*) AS n FROM rounds');
    const existing = cnt[0].n;
    const force = process.argv.includes('--force');
    if (existing > 0 && !force) {
        console.error('[STOP] 数据库中已有 ' + existing + ' 轮历史数据！');
        console.error('       导入会【替换】历史与收藏，若确认要覆盖，请加 --force 参数：');
        console.error('       npm run migrate <路径> -- --force');
        await conn.end();
        process.exit(1);
    }

    /* 4. 库非空时自动备份现有数据 */
    if (existing > 0) {
        const backupDir = path.join(__dirname, '..', 'data');
        const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
        const backupPath = path.join(backupDir, `backup-${ts}.json`);
        const obj = await exportAll(conn);
        fs.writeFileSync(backupPath, JSON.stringify(obj, null, 2), 'utf8');
        console.log('[OK] 已备份库内现有数据到：' + backupPath);
    }

    /* 5. 导入 */
    await conn.beginTransaction();
    const info = await importData(conn, data);
    await conn.commit();

    console.log('==============================================');
    console.log('  迁移完成：');
    console.log('    历史轮次：' + info.h + ' 轮');
    console.log('    错题收藏：' + info.f + ' 条');
    console.log('    分类：' + (info.hasCats ? '已导入' : '无'));
    console.log('    学习时长：' + (info.hasStudy ? '已合并' : '无'));
    console.log('    日历备忘：' + (info.hasMemos ? '已导入' : '无'));
    console.log('==============================================');
    await conn.end();
})().catch(err => {
    console.error('[FAIL] 迁移失败：', err.message);
    process.exit(1);
});
