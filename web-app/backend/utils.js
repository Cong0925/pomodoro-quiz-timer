/* ============================================================
 * 刷题计时器 - server/utils.js
 * 服务端公共工具
 * ============================================================ */

/* 简易唯一 id（与旧前端风格一致） */
function uid(prefix) {
    return (prefix || 'c') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* 'YYYY-MM-DD HH:mm:ss' -> MySQL DATETIME（原样字符串即可） */
function nowDateTime() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* 数字安全转义：NaN/Infinity -> 0 */
function num(v) {
    const n = Number(v);
    return isFinite(n) ? n : 0;
}

/* 字符串安全截断 */
function str(v, max) {
    return String(v == null ? '' : v).slice(0, max || 255);
}

/* JSON 列解析：mysql2 对 JSON 类型列会自动解析为对象，
   也可能返回字符串，统一转成数组（解析失败返回空数组） */
function parseJsonArray(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') {
        try {
            const r = JSON.parse(v);
            return Array.isArray(r) ? r : [];
        } catch (e) { return []; }
    }
    return [];
}

/* async 路由包装器：async handler 抛出的错误统一交给
   Express 全局错误中间件（server/index.js）兜底，
   消除各路由重复的 try/catch + res.status(500)。 */
function asyncHandler(fn) {
    return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { uid, nowDateTime, num, str, parseJsonArray, asyncHandler };
