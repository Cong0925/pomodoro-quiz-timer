/* ============================================================
 * 刷题计时器 - database/init-all.js
 * 一键初始化数据库（跨电脑加载用）：
 *   1. 建库 + 建表（执行 web-app/backend/schema.sql，含幂等列迁移）
 *   2. 导入种子数据（seed-data.sql.gz：分类 / 题库 / 题目 / 速算题）
 *   3. 校验行数 + 检查行测图片目录
 * 不导入用户数据（做题记录/收藏/备忘/学习时长等 9 张表保持为空）。
 * 运行：node database/init-all.js
 * 幂等：可重复执行（REPLACE INTO 按主键覆盖种子数据，不删用户数据）。
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ---------- 依赖解析：mysql2 依次尝试 database/ → web-app/backend/ → 仓库根 ---------- */
function loadMysql() {
    const candidates = [
        () => require('mysql2/promise'),
        () => require(path.join(__dirname, '..', 'web-app', 'backend', 'node_modules', 'mysql2', 'promise')),
        () => require(path.join(__dirname, '..', 'node_modules', 'mysql2', 'promise'))
    ];
    for (const load of candidates) {
        try { return load(); } catch (err) { /* 尝试下一个候选路径 */ }
    }
    console.error('[FAIL] 未找到 mysql2 依赖，请先执行：npm install（在 web-app/backend 或仓库根目录）');
    process.exit(1);
}

/* ---------- 配置：process.env 优先，其次 database/.env → web-app/backend/.env → 根 .env ---------- */
function parseEnvFile(file) {
    const conf = {};
    try {
        const text = fs.readFileSync(file, 'utf8');
        for (const line of text.split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
            if (m) conf[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    } catch (err) { /* 文件不存在则跳过 */ }
    return conf;
}

function resolveConfig() {
    const files = [
        path.join(__dirname, '.env'),
        path.join(__dirname, '..', 'web-app', 'backend', '.env'),
        path.join(__dirname, '..', '.env')
    ];
    const merged = {};
    for (const file of files) Object.assign(merged, parseEnvFile(file));
    const pick = (key, fallback) => process.env[key] || merged[key] || fallback;
    return {
        host: pick('DB_HOST', 'localhost'),
        port: Number(pick('DB_PORT', 3306)),
        user: pick('DB_USER', 'root'),
        password: pick('DB_PASSWORD', ''),
        dbName: pick('DB_NAME', 'pomodoro-quiz-timer')
    };
}

/* ---------- 按「分号+换行」切分 mysqldump 语句（dump 内字符串换行均已转义，切分安全） ---------- */
function splitStatements(sql) {
    return sql.split(/;\r?\n/).map(s => s.trim()).filter(s => {
        if (!s) return false;
        const code = s.split(/\r?\n/).filter(l => l.trim() !== '' && !/^\s*--/.test(l)).join('');
        return code !== '';
    });
}

async function main() {
    const mysql = loadMysql();
    const cfg = resolveConfig();

    /* 1. 建库建表：执行 schema.sql（库名按 cfg.dbName 重写以支持自定义） */
    const schemaPath = [
        path.join(__dirname, '..', 'web-app', 'backend', 'schema.sql'),
        path.join(__dirname, '..', 'server', 'schema.sql')
    ].find(p => fs.existsSync(p));
    if (!schemaPath) {
        console.error('[FAIL] 未找到 schema.sql（期望位置：web-app/backend/schema.sql 或 server/schema.sql）');
        process.exit(1);
    }
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');
    if (cfg.dbName !== 'pomodoro-quiz-timer') {
        schemaSql = schemaSql.split('`pomodoro-quiz-timer`').join('`' + cfg.dbName + '`');
    }
    const conn = await mysql.createConnection({
        host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, multipleStatements: true
    });
    await conn.query(schemaSql);
    console.log('[OK] 建库建表完成：' + cfg.dbName + '（14 张表）');

    /* 2. 行测图片目录检查（DB 只存 /qi-bank 路径引用，图片需另行拷贝） */
    const imgDir = path.join(__dirname, '..', 'data', 'qi-images');
    if (fs.existsSync(imgDir)) {
        console.log('[OK] 行测图片目录存在：data/qi-images');
    } else {
        console.warn('[WARN] 未找到 data/qi-images（约 256MB）——行测题目图片将无法显示。');
        console.warn('       请从原电脑拷贝 data/qi-images 目录到本仓库 data/ 下，详见 database/README.md');
    }

    /* 3. 导入种子数据（优先 seed-data.sql，其次 seed-data.sql.gz） */
    const sqlPath = path.join(__dirname, 'seed-data.sql');
    const gzPath = path.join(__dirname, 'seed-data.sql.gz');
    let seedSql;
    if (fs.existsSync(sqlPath)) {
        seedSql = fs.readFileSync(sqlPath, 'utf8');
    } else if (fs.existsSync(gzPath)) {
        seedSql = zlib.gunzipSync(fs.readFileSync(gzPath)).toString('utf8');
    } else {
        console.error('[FAIL] 未找到种子数据文件（期望 database/seed-data.sql 或 seed-data.sql.gz）');
        process.exit(1);
    }
    const statements = splitStatements(seedSql);
    let done = 0;
    for (const stmt of statements) {
        await conn.query(stmt);
        done += 1;
        if (done % 25 === 0 || done === statements.length) {
            console.log('[..] 种子数据导入中：' + done + '/' + statements.length + ' 条语句');
        }
    }
    console.log('[OK] 种子数据导入完成（分类 / 题库 / 题目 / 速算题）');

    /* 4. 校验 5 张种子表行数 */
    const seedTables = ['categories', 'category_subs', 'question_banks', 'questions', 'mental_questions'];
    console.log('[OK] 校验结果：');
    for (const table of seedTables) {
        const [rows] = await conn.query('SELECT COUNT(*) AS n FROM `' + table + '`');
        console.log('     ' + table + '：' + rows[0].n + ' 行');
    }
    const [tables] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ?', [cfg.dbName]
    );
    console.log('     表总数：' + tables[0].n + '（用户数据表初始化后为空，正常使用时自动产生）');
    await conn.end();
    console.log('[DONE] 数据库初始化全部完成');
}

main().catch(err => {
    console.error('[FAIL] 数据库初始化失败：', err.message);
    process.exit(1);
});
