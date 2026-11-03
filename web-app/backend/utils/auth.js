/* ============================================================
 * 刷题计时器 - server/utils/auth.js
 * 登录态工具：HMAC-SHA256 token 签发/验证、微信 code2session、
 * 从请求解析当前用户（无 token/无效 token 默认 root user_id=1）
 * ============================================================ */
const crypto = require('crypto');
const https = require('https');

const TOKEN_SECRET = process.env.WX_TOKEN_SECRET || 'pomodoro-quiz-timer-local-dev-secret-2026';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天

/**
 * 签发登录 token（payload 含 uid + 过期时间，HMAC-SHA256 签名）
 * @param {number} uid 用户ID
 * @returns {string} token
 */
function signToken(uid) {
    const payload = Buffer.from(JSON.stringify({ uid, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
    const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
    return `${payload}.${sig}`;
}

/**
 * 验证 token，返回 { uid } 或 null
 * @param {string} token
 * @returns {{ uid: number } | null}
 */
function verifyToken(token) {
    try {
        if (!token || !token.includes('.')) return null;
        const [payload, sig] = token.split('.');
        const expect = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
        if (sig !== expect) return null;
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!data || !data.uid || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
        return { uid: Number(data.uid) };
    } catch (err) {
        console.error('【token 验证失败】', err);
        return null;
    }
}

/**
 * 从请求解析当前用户 ID：Bearer token 有效则用 token 的 uid，否则默认 1（root）
 * @param {import('express').Request} req
 * @returns {number} user_id
 */
function getUserId(req) {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
        const info = verifyToken(auth.slice(7));
        if (info) return info.uid;
    }
    return 1; // 无 token / token 失效 → 默认 root（PC 版单用户兼容）
}

/**
 * 微信 code2session：code 换 openid
 * WX_SECRET 未配置时进入 dev 模式：openid = 'dev_' + sha1(code)（稳定可重入，仅本地开发）
 * @param {string} code wx.login 返回的 code
 * @returns {Promise<{ openid: string; unionid?: string }>}
 */
function code2Session(code) {
    const secret = process.env.WX_SECRET || '';
    const appid = process.env.WX_APPID || '';
    if (!secret) {
        const openid = 'dev_' + crypto.createHash('sha1').update(String(code)).digest('hex').slice(0, 24);
        return Promise.resolve({ openid });
    }
    return new Promise((resolve, reject) => {
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
        const req = https.get(url, (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.errcode) {
                        console.error('【微信 code2session 失败】', data.errcode, data.errmsg);
                        reject(new Error('微信登录失败：' + (data.errmsg || data.errcode)));
                        return;
                    }
                    resolve({ openid: data.openid, unionid: data.unionid });
                } catch (err) {
                    console.error('【微信 code2session 响应解析失败】', err);
                    reject(err);
                }
            });
        });
        req.on('error', (err) => {
            console.error('【微信 code2session 网络请求失败】', err);
            reject(err);
        });
        req.setTimeout(8000, () => req.destroy(new Error('微信登录超时')));
    });
}

module.exports = { signToken, verifyToken, getUserId, code2Session };
