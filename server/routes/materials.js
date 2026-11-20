/* ============================================================
 * 刷题计时器 - server/routes/materials.js
 * 资料管理 API：文件夹 + 上传 / 列表 / 预览 / 下载 / 编辑 / 删除
 * 挂载：/api/materials
 * 数据库只存 /materials/YYYY/MM/uuid.ext 逻辑路径，
 * 实体文件在仓库根 data/materials/...（与行测图片库同一思路）。
 * ============================================================ */
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const pool = require('../db');
const { asyncHandler, num, str } = require('../utils');

const router = express.Router();
const USER_ID = 1; // 主版本为本地单用户，沿用默认 root

const MATERIAL_ROOT = path.join(__dirname, '..', '..', 'data', 'materials');
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

const BLOCKED_EXT = new Set([
    '.html', '.htm', '.xhtml', '.svg', '.xml', '.js', '.mjs', '.cjs',
    '.php', '.jsp', '.asp', '.aspx', '.exe', '.dll', '.com', '.scr',
    '.bat', '.cmd', '.ps1', '.sh', '.msi', '.jar'
]);
const OFFICE_EXT = new Set(['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.wps', '.et', '.dps']);
const ARCHIVE_EXT = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz']);
const TEXT_EXT = new Set(['.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.log', '.yaml', '.yml']);

/* 资料用途分类：知识点资料 / 试卷题目 / 答案解析 / 其他资料 */
const CATEGORY_DEFS = [
    { value: 'knowledge', label: '知识点资料' },
    { value: 'paper', label: '试卷题目' },
    { value: 'answer', label: '答案解析' },
    { value: 'other', label: '其他资料' }
];
const CATEGORY_VALUES = new Set(CATEGORY_DEFS.map(c => c.value));
const CATEGORY_LABELS = Object.fromEntries(CATEGORY_DEFS.map(c => [c.value, c.label]));

function isCategory(v) {
    return CATEGORY_VALUES.has(String(v || ''));
}

/** 根据文件名猜用途；答案/解析优先，避免「模考卷-答案与解析」被当成试卷 */
function guessCategory(name) {
    const s = String(name || '').toLowerCase();
    if (/答案|解析|answer|solution|key\b/.test(s)) return 'answer';
    if (/试卷|套卷|模考|题本|题库|真题|刷题|练习|500题|100题|20题|十套卷|模拟卷/.test(s)) return 'paper';
    if (/知识点|讲义|课件|专题|手册|清单|笔记|考点|冲刺/.test(s)) return 'knowledge';
    return 'other';
}

function resolveCategory(raw, fallback) {
    const v = String(raw == null ? '' : raw).trim();
    if (isCategory(v)) return v;
    return fallback;
}

function previewType(ext, mime) {
    if (ext === '.pdf' || mime === 'application/pdf') return 'pdf';
    if (mime.startsWith('image/') || /^\.(png|jpg|jpeg|gif|webp|bmp|ico|avif)$/.test(ext)) return 'image';
    if (mime.startsWith('audio/') || /^\.(mp3|wav|ogg|m4a|aac|flac)$/.test(ext)) return 'audio';
    if (mime.startsWith('video/') || /^\.(mp4|mov|webm|mkv|avi)$/.test(ext)) return 'video';
    if (mime.startsWith('text/') || TEXT_EXT.has(ext)) return 'text';
    if (OFFICE_EXT.has(ext)) return 'office';
    if (ARCHIVE_EXT.has(ext)) return 'archive';
    return 'other';
}

function safeOriginalName(name) {
    return str(String(name || '').replace(/[/\\]/g, '_').replace(/[\x00-\x1f]/g, ''), 255) || '未命名文件';
}

function absPathFromUrl(filePath) {
    const rel = String(filePath || '').replace(/^\/materials\//, '');
    const abs = path.resolve(MATERIAL_ROOT, rel);
    if (!abs.startsWith(MATERIAL_ROOT + path.sep)) throw new Error('非法文件路径');
    return abs;
}

function sha256File(abs) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(abs);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(hash.digest('hex')));
    });
}

const storage = multer.diskStorage({
    destination(req, file, cb) {
        const d = new Date();
        const y = String(d.getFullYear());
        const m = String(d.getMonth() + 1).padStart(2, '0');
        req._materialRelDir = `${y}/${m}`;
        file._materialRelDir = req._materialRelDir;
        const dir = path.join(MATERIAL_ROOT, y, m);
        fs.mkdir(dir, { recursive: true }, err => cb(err, dir));
    },
    filename(req, file, cb) {
        const ext = path.extname(safeOriginalName(file.originalname)).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: MAX_SIZE, files: 30 },
    defParamCharset: 'utf8',
    fileFilter(req, file, cb) {
        const ext = path.extname(safeOriginalName(file.originalname)).toLowerCase();
        if (BLOCKED_EXT.has(ext)) {
            cb(new Error('出于安全考虑，不支持上传该类型文件'));
            return;
        }
        cb(null, true);
    }
});

function runUpload(req, res, next) {
    upload.fields([
        { name: 'files', maxCount: 30 },
        { name: 'file', maxCount: 1 }
    ])(req, res, err => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: '文件超过 100MB 上限' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: '一次最多上传 30 个文件' });
        }
        return res.status(400).json({ error: err.message || '上传失败' });
    });
}

function uploadedFiles(req) {
    const files = req.files && typeof req.files === 'object' ? req.files : {};
    return [...(files.files || []), ...(files.file || [])];
}

async function ensureDefaultFolder(uid) {
    const [rows] = await pool.query(
        'SELECT id, name, sort_order FROM material_folders WHERE user_id=? ORDER BY sort_order, id',
        [uid]
    );
    if (rows.length) return rows;
    await pool.query(
        'INSERT IGNORE INTO material_folders (user_id, name, sort_order) VALUES (?, ?, 0)',
        [uid, '默认资料']
    );
    const [created] = await pool.query(
        'SELECT id, name, sort_order FROM material_folders WHERE user_id=? ORDER BY sort_order, id',
        [uid]
    );
    return created;
}

async function resolveFolder(uid, raw) {
    if (raw === undefined || raw === null || raw === '' || raw === 'null' || raw === '0') return null;
    const id = num(raw);
    if (!id) throw Object.assign(new Error('文件夹参数无效'), { status: 400 });
    const [rows] = await pool.query('SELECT id FROM material_folders WHERE id=? AND user_id=?', [id, uid]);
    if (!rows.length) throw Object.assign(new Error('文件夹不存在'), { status: 400 });
    return id;
}

function mapRow(r) {
    return {
        id: Number(r.id),
        title: r.title,
        description: r.description,
        folderId: r.folder_id == null ? null : Number(r.folder_id),
        folderName: r.folder_name || '未分类',
        originalName: r.original_name,
        filePath: r.file_path,
        fileUrl: r.file_path,
        fileExt: r.file_ext,
        mimeType: r.mime_type,
        sizeBytes: Number(r.size_bytes),
        previewType: r.preview_type,
        category: resolveCategory(r.category, 'other'),
        categoryLabel: CATEGORY_LABELS[resolveCategory(r.category, 'other')],
        downloadCount: Number(r.download_count),
        lastViewedAt: r.last_viewed_at,
        createdAt: r.created_at
    };
}

/* ---- 文件夹 ---- */
router.get('/folders', asyncHandler(async (req, res) => {
    const rows = await ensureDefaultFolder(USER_ID);
    const [counts] = await pool.query(
        'SELECT folder_id, COUNT(*) AS count FROM materials WHERE user_id=? GROUP BY folder_id',
        [USER_ID]
    );
    const map = new Map(counts.map(c => [c.folder_id == null ? null : Number(c.folder_id), Number(c.count)]));
    res.json(rows.map(f => ({
        id: Number(f.id),
        name: f.name,
        sortOrder: Number(f.sort_order || 0),
        count: map.get(Number(f.id)) || 0
    })));
}));

router.post('/folders', asyncHandler(async (req, res) => {
    const name = str(req.body && req.body.name, 80).trim();
    if (!name) return res.status(400).json({ error: '文件夹名称不能为空' });
    try {
        const [r] = await pool.query(
            'INSERT INTO material_folders (user_id, name, sort_order) VALUES (?,?,?)',
            [USER_ID, name, num(req.body && req.body.sortOrder)]
        );
        res.status(201).json({ id: r.insertId, name });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '已存在同名文件夹' });
        throw e;
    }
}));

router.put('/folders/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    const name = str(req.body && req.body.name, 80).trim();
    if (!id || !name) return res.status(400).json({ error: '文件夹参数无效' });
    try {
        const [r] = await pool.query(
            'UPDATE material_folders SET name=?, sort_order=? WHERE id=? AND user_id=?',
            [name, num(req.body && req.body.sortOrder), id, USER_ID]
        );
        if (!r.affectedRows) return res.status(404).json({ error: '文件夹不存在' });
        res.json({ ok: true });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: '已存在同名文件夹' });
        throw e;
    }
}));

router.delete('/folders/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '文件夹参数无效' });
    const [used] = await pool.query(
        'SELECT COUNT(*) AS count FROM materials WHERE folder_id=? AND user_id=?',
        [id, USER_ID]
    );
    if (used[0].count > 0) return res.status(409).json({ error: '文件夹下还有资料，请先移动或删除' });
    const [r] = await pool.query('DELETE FROM material_folders WHERE id=? AND user_id=?', [id, USER_ID]);
    if (!r.affectedRows) return res.status(404).json({ error: '文件夹不存在' });
    res.json({ ok: true });
}));

/* ---- 资料列表 ---- */
router.get('/', asyncHandler(async (req, res) => {
    const page = Math.max(1, num(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, num(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const q = str(req.query.q, 100).trim();
    const type = str(req.query.type, 16).trim();
    const category = str(req.query.category, 24).trim();
    const folder = str(req.query.folderId, 20).trim();

    let where = 'm.user_id=?';
    const args = [USER_ID];
    if (folder) {
        if (folder === 'none') where += ' AND m.folder_id IS NULL';
        else if (folder !== 'all') {
            where += ' AND m.folder_id=?';
            args.push(num(folder));
        }
    }
    if (type && type !== 'all') {
        where += ' AND m.preview_type=?';
        args.push(type);
    }
    if (category && category !== 'all') {
        if (!isCategory(category)) return res.status(400).json({ error: '资料分类参数无效' });
        where += ' AND m.category=?';
        args.push(category);
    }
    if (q) {
        where += ' AND (m.title LIKE ? OR m.original_name LIKE ? OR m.description LIKE ?)';
        const like = `%${q}%`;
        args.push(like, like, like);
    }

    const [rows] = await pool.query(
        `SELECT m.*, f.name AS folder_name
         FROM materials m
         LEFT JOIN material_folders f ON f.id=m.folder_id
         WHERE ${where}
         ORDER BY m.created_at DESC, m.id DESC
         LIMIT ? OFFSET ?`,
        [...args, limit, offset]
    );
    const [totalRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM materials m WHERE ${where}`,
        args
    );
    const total = Number(totalRows[0].total);
    res.json({
        list: rows.map(mapRow),
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit))
    });
}));

/* ---- 资料分类计数（随当前文件夹变化） ---- */
router.get('/categories', asyncHandler(async (req, res) => {
    const folder = str(req.query.folderId, 20).trim();
    let where = 'm.user_id=?';
    const args = [USER_ID];
    if (folder) {
        if (folder === 'none') where += ' AND m.folder_id IS NULL';
        else if (folder !== 'all') {
            where += ' AND m.folder_id=?';
            args.push(num(folder));
        }
    }
    const [rows] = await pool.query(
        `SELECT m.category, COUNT(*) AS count FROM materials m WHERE ${where} GROUP BY m.category`,
        args
    );
    const map = new Map(rows.map(r => [resolveCategory(r.category, 'other'), Number(r.count)]));
    res.json(CATEGORY_DEFS.map(c => ({ ...c, count: map.get(c.value) || 0 })));
}));

/* ---- 上传：单文件或多文件 ---- */
router.post('/', runUpload, asyncHandler(async (req, res) => {
    const files = uploadedFiles(req);
    if (!files.length) return res.status(400).json({ error: '请选择要上传的文件' });

    const description = str(req.body && req.body.description, 500).trim();
    const onlyOne = files.length === 1;
    const customTitle = onlyOne ? str(req.body && req.body.title, 200).trim() : '';
    const requestedCategory = str(req.body && req.body.category, 24).trim();
    const fixedCategory = requestedCategory && requestedCategory !== 'auto'
        ? resolveCategory(requestedCategory, null) : null;
    if (requestedCategory && requestedCategory !== 'auto' && !fixedCategory) {
        await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
        return res.status(400).json({ error: '资料分类参数无效' });
    }
    let conn;
    const created = [];

    try {
        const folderId = await resolveFolder(USER_ID, req.body && req.body.folderId);
        conn = await pool.getConnection();
        await conn.beginTransaction();

        for (const file of files) {
            const abs = file.path;
            const originalName = safeOriginalName(file.originalname);
            const ext = path.extname(originalName).toLowerCase();
            const title = customTitle || originalName.replace(/\.[^.]+$/, '');
            const relPath = `/materials/${String(file._materialRelDir || req._materialRelDir || '').replace(/\\/g, '/')}/${file.filename}`;
            const checksum = await sha256File(abs);
            const pType = previewType(ext, file.mimetype || '');
            const category = fixedCategory || guessCategory(originalName);
            const [r] = await conn.query(
                `INSERT INTO materials
                 (user_id, folder_id, title, description, original_name, file_path, file_ext,
                  mime_type, size_bytes, checksum_sha256, preview_type, category)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                    USER_ID, folderId, title, description, originalName, relPath, ext,
                    str(file.mimetype, 120) || 'application/octet-stream',
                    file.size, checksum, pType, category
                ]
            );
            created.push({
                id: Number(r.insertId), title, description, folderId,
                originalName, filePath: relPath, fileUrl: relPath,
                fileExt: ext, sizeBytes: file.size, previewType: pType,
                category, categoryLabel: CATEGORY_LABELS[category]
            });
        }

        await conn.commit();
        const payload = { list: created, count: created.length };
        if (onlyOne) Object.assign(payload, created[0]);
        res.status(201).json(payload);
    } catch (e) {
        if (conn) await conn.rollback().catch(() => {});
        await Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {})));
        throw e;
    } finally {
        if (conn) conn.release();
    }
}));

/* ---- 单条详情 ---- */
router.get('/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '资料ID无效' });
    const [rows] = await pool.query(
        `SELECT m.*, f.name AS folder_name
         FROM materials m LEFT JOIN material_folders f ON f.id=m.folder_id
         WHERE m.id=? AND m.user_id=?`,
        [id, USER_ID]
    );
    if (!rows.length) return res.status(404).json({ error: '资料不存在' });
    res.json(mapRow(rows[0]));
}));

/* ---- 下载：按原始文件名，计数 +1 ---- */
router.get('/:id/download', asyncHandler(async (req, res, next) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '资料ID无效' });
    const [rows] = await pool.query(
        'SELECT original_name, file_path FROM materials WHERE id=? AND user_id=?',
        [id, USER_ID]
    );
    if (!rows.length) return res.status(404).json({ error: '资料不存在' });
    let abs;
    try { abs = absPathFromUrl(rows[0].file_path); } catch (e) { return res.status(400).json({ error: e.message }); }
    if (!fs.existsSync(abs)) return res.status(404).json({ error: '文件实体不存在，请检查 data/materials 目录' });
    await pool.query('UPDATE materials SET download_count=download_count+1 WHERE id=?', [id]);
    res.download(abs, rows[0].original_name, err => {
        if (err && !res.headersSent) next(err);
    });
}));

/* ---- 打开预览：记录最近查看时间 ---- */
router.post('/:id/view', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '资料ID无效' });
    await pool.query('UPDATE materials SET last_viewed_at=NOW() WHERE id=? AND user_id=?', [id, USER_ID]);
    res.json({ ok: true });
}));

/* ---- 编辑标题 / 说明 / 文件夹 ---- */
router.put('/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '资料ID无效' });
    const b = req.body || {};
    const title = str(b.title, 200).trim();
    if (!title) return res.status(400).json({ error: '标题不能为空' });
    const description = str(b.description, 500).trim();
    const folderId = await resolveFolder(USER_ID, b.folderId);
    let category = null;
    if (b.category !== undefined) {
        category = resolveCategory(b.category, null);
        if (!category) return res.status(400).json({ error: '资料分类参数无效' });
    }
    const [r] = await pool.query(
        'UPDATE materials SET title=?, description=?, folder_id=?, category=COALESCE(?, category) WHERE id=? AND user_id=?',
        [title, description, folderId, category, id, USER_ID]
    );
    if (!r.affectedRows) return res.status(404).json({ error: '资料不存在' });
    res.json({ ok: true });
}));

/* ---- 直接调整资料所属文件夹 ---- */
router.put('/:id/folder', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '资料ID无效' });
    const raw = req.body && req.body.folderId;
    const folderId = await resolveFolder(USER_ID, raw);
    const [r] = await pool.query(
        'UPDATE materials SET folder_id=? WHERE id=? AND user_id=?',
        [folderId, id, USER_ID]
    );
    if (!r.affectedRows) return res.status(404).json({ error: '资料不存在' });
    res.json({ ok: true, folderId });
}));

/* ---- 直接调整资料用途分类 ---- */
router.put('/:id/category', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '资料ID无效' });
    const category = resolveCategory(req.body && req.body.category, null);
    if (!category) return res.status(400).json({ error: '资料分类参数无效' });
    const [r] = await pool.query(
        'UPDATE materials SET category=? WHERE id=? AND user_id=?',
        [category, id, USER_ID]
    );
    if (!r.affectedRows) return res.status(404).json({ error: '资料不存在' });
    res.json({ ok: true, category, categoryLabel: CATEGORY_LABELS[category] });
}));

/* ---- 删除：先删记录，再清实体文件 ---- */
router.delete('/:id', asyncHandler(async (req, res) => {
    const id = num(req.params.id);
    if (!id) return res.status(400).json({ error: '资料ID无效' });
    const [rows] = await pool.query(
        'SELECT file_path FROM materials WHERE id=? AND user_id=?',
        [id, USER_ID]
    );
    if (!rows.length) return res.status(404).json({ error: '资料不存在' });
    await pool.query('DELETE FROM materials WHERE id=? AND user_id=?', [id, USER_ID]);
    try {
        await fs.promises.unlink(absPathFromUrl(rows[0].file_path));
    } catch (e) {
        if (e.code !== 'ENOENT') console.warn('[materials] 删除文件实体失败：', e.message);
    }
    res.json({ ok: true });
}));

module.exports = router;
module.exports.MATERIAL_ROOT = MATERIAL_ROOT;
module.exports.MAX_SIZE = MAX_SIZE;
