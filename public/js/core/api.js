/* ============================================================
 * PQ Timer - core/api.js
 * 后端 API 统一封装（fetch）
 * 所有与服务器交互都走这里；错误统一抛异常，由调用方提示
 * ============================================================ */
(function () {
    'use strict';

    async function req(method, url, body) {
        const opts = { method, headers: {} };
        if (body !== undefined) {
            opts.headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify(body);
        }
        let res;
        try {
            res = await fetch(url, opts);
        } catch (e) {
            throw new Error('网络请求失败，请确认服务已启动（启动.bat）');
        }
        let data = null;
        try { data = await res.json(); } catch (e) { /* 非 JSON 响应 */ }
        if (!res.ok) {
            throw new Error((data && data.error) || ('请求失败：' + res.status));
        }
        return data;
    }

    window.PQ = window.PQ || {};
    PQ.api = {
        get: (url) => req('GET', url),
        post: (url, body) => req('POST', url, body),
        put: (url, body) => req('PUT', url, body),
        del: (url) => req('DELETE', url)
    };
})();
