/* ============================================================
 * 刷题计时器 - server/index.js（服务入口）
 * Node + Express + MySQL 前后端分离版
 * 启动：npm start  或 双击 启动.bat
 * ============================================================ */
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
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

/* ---- 行测真题图片库静态服务：/qi-bank → data/qi-images（与 web-app 同一 URL 规范） ---- */
app.use('/qi-bank', express.static(path.join(__dirname, '..', 'data', 'qi-images'), { maxAge: '7d', fallthrough: true }));

/* ---- 前端静态文件 ---- */
app.use(express.static(path.join(__dirname, '..', 'public'), {
    setHeaders: (res, filePath) => {
        if (/\.(css|js|html)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

/* 404 兜底：API 返回 JSON，页面返回前端入口 */
app.use((req, res) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ error: '接口不存在' });
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
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
