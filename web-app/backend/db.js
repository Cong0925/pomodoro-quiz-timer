/* ============================================================
 * 刷题计时器 - server/db.js
 * MySQL 连接池（mysql2/promise）
 * 连接参数全部来自 .env，修改 .env 即可更换账号密码/库名
 * ============================================================ */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pomodoro-quiz-timer',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4_unicode_ci',
    dateStrings: true // 日期以字符串返回，避免时区偏移
});

module.exports = pool;
