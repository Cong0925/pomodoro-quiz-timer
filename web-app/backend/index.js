/* ============================================================
 * 刷题计时器 - server/index.js（服务入口）
 * Node + Express + MySQL 前后端分离版
 * 启动：npm start  或 双击 启动.bat
 * ============================================================ */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

/* ---- CORS：默认仅放行 Vite dev 前端源，可用 .env 的 CORS_ORIGINS 覆盖（逗号分隔，* 表示全放行） ---- */
const CORS_ORIGINS = process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173';
const corsOriginList = CORS_ORIGINS.split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = CORS_ORIGINS.trim() === '*'
    ? {}
    : {
        origin(origin, callback) {
            /* 无 Origin（同源请求 / curl / 服务端调用）直接放行；
               非白名单源返回 false：不设置 CORS 头，由浏览器拦截，不走 500 错误处理器 */
            if (!origin || corsOriginList.includes(origin)) return callback(null, true);
            callback(null, false);
        }
    };
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' })); // 导入 JSON 可能较大

/* ---- 健康检查 ---- */
app.get('/api/health', async (req, res) => {
    try {
        const [r] = await pool.query('SELECT 1 AS ok');
        res.json({ ok: r[0].ok === 1, db: 'connected' });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

/* ---- 业务路由 ---- */
app.use('/api/categories', require('./routes/categories'));
app.use('/api/history', require('./routes/history'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/study-daily', require('./routes/study'));
app.use('/api/memos', require('./routes/memos'));
app.use('/api/practice', require('./routes/practice'));
app.use('/api/mental', require('./routes/mental'));
app.use('/api', require('./routes/data')); // /api/export  /api/import

/* ---- 前后端分离：不托管静态文件，前端由 Vite dev server 提供，经 proxy 访问 /api ---- */

/* 404 兜底：仅返回 JSON */
app.use((req, res) => {
    res.status(404).json({ error: '接口不存在' });
});

/* ---- 错误兜底 ---- */
app.use((err, req, res, next) => {
    console.error('[server error]', err);
    res.status(500).json({ error: '服务器内部错误：' + err.message });
});

app.listen(PORT, () => {
    console.log('==============================================');
    console.log('  刷题计时器服务已启动');
    console.log('  访问地址：http://localhost:' + PORT);
    console.log('  数据库：' + process.env.DB_NAME);
    console.log('==============================================');
});
