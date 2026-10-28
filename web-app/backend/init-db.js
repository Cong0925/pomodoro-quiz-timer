/* ============================================================
 * 刷题计时器 - server/init-db.js
 * 初始化：自动创建数据库 + 执行 schema.sql 建表（幂等可重复执行）
 * 运行：npm run init-db
 * ============================================================ */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        multipleStatements: true
    });

    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await conn.query(sql);
    console.log('[OK] 数据库与表结构初始化完成');
    console.log('     数据库：' + (process.env.DB_NAME || 'pomodoro-quiz-timer'));
    await conn.end();
})().catch(err => {
    console.error('[FAIL] 初始化失败：', err.message);
    process.exit(1);
});
