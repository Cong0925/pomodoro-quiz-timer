/* ============================================================
 * 刷题计时器 - server/routes/auth.js
 * 登录/用户接口：
 *   POST /api/auth/login  微信登录（code → openid → 查/建用户 → token）
 *   GET  /api/auth/me     当前用户信息（带 token）
 * ============================================================ */
const express = require('express');
const pool = require('../db');
const { signToken, getUserId, code2Session } = require('../utils/auth');

const router = express.Router();

/* ---- POST /api/auth/login：微信静默登录 ---- */
router.post('/login', async (req, res) => {
    try {
        const code = req.body && req.body.code;
        if (!code || typeof code !== 'string') {
            return res.status(400).json({ error: '缺少微信登录 code' });
        }
        const { openid } = await code2Session(code);
        if (!openid) {
            return res.status(500).json({ error: '微信登录失败：未获取到 openid' });
        }
        /* 查用户，不存在则注册（openid 唯一） */
        let [rows] = await pool.query('SELECT id, openid, nickname, avatar, role FROM users WHERE openid = ?', [openid]);
        let user;
        if (!rows.length) {
            const [ins] = await pool.query(
                'INSERT INTO users (openid, nickname) VALUES (?, ?)',
                [openid, '微信用户']
            );
            [rows] = await pool.query('SELECT id, openid, nickname, avatar, role FROM users WHERE id = ?', [ins.insertId]);
            user = rows[0];
        } else {
            user = rows[0];
        }
        const token = signToken(user.id);
        res.json({ token, user });
    } catch (err) {
        console.error('【微信登录接口失败】', err);
        res.status(500).json({ error: '登录失败：' + err.message });
    }
});

/* ---- GET /api/auth/me：当前登录用户 ---- */
router.get('/me', async (req, res) => {
    try {
        const uid = getUserId(req);
        const [rows] = await pool.query('SELECT id, openid, nickname, avatar, role, created_at FROM users WHERE id = ?', [uid]);
        if (!rows.length) {
            return res.status(404).json({ error: '用户不存在' });
        }
        res.json(rows[0]);
    } catch (err) {
        console.error('【获取当前用户失败】', err);
        res.status(500).json({ error: '获取用户失败' });
    }
});

module.exports = router;
