/* ============================================================
 * tools/import-xingce/import.js
 * 行测真题仓库 → 本地题库 批量导入（直连 MySQL，断点续跑，幂等）
 * 用法：
 *   node import.js                # 按 progress 跳过已完成模块
 *   node import.js --force        # 清空导入题库后全量重跑
 *   node import.js --module 05    # 只跑指定模块
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cfg = require('./config');
const { parseMd, htmlToText } = require('./parser');

const MYSQL = require(path.join(__dirname, '..', '..', 'web-app', 'backend', 'node_modules', 'mysql2', 'promise'));

/* ---------- 日志 ---------- */
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(cfg.LOG_FILE, line + '\n', 'utf8');
}

/* ---------- 进度 ---------- */
function loadProgress() {
  try { return JSON.parse(fs.readFileSync(cfg.PROGRESS_FILE, 'utf8')); } catch { return { modules: {} }; }
}
function saveProgress(p) {
  fs.writeFileSync(cfg.PROGRESS_FILE, JSON.stringify(p, null, 2), 'utf8');
}

/* ---------- 工具 ---------- */
function walkMd(dir) {
  const r = [];
  for (const f of fs.readdirSync(dir)) {
    if (f === 'README.md') continue;
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) r.push(...walkMd(p));
    else if (f.endsWith('.md')) r.push(p);
  }
  return r;
}
function dedupKey(q) {
  /* 哈希基于题干 HTML（含图 URL）+ 选项文本/图，区分同文字不同图（图推） */
  const base = q.stem.replace(/\s+/g, '') + JSON.stringify(q.options.map(o => (o.text || '') + (o.img || '')));
  return crypto.createHash('md5').update(base).digest('hex');
}

(async () => {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const onlyModule = (() => { const i = args.indexOf('--module'); return i >= 0 ? args[i + 1] : null; })();

  const db = await MYSQL.createConnection(cfg.DB);
  log('连接数据库 ' + cfg.DB.database + ' 成功');

  /* ---------- 题库工具 ---------- */
  const bankCache = {};
  async function getBank(name, subId) {
    if (bankCache[name]) return bankCache[name];
    const [rows] = await db.query('SELECT id FROM question_banks WHERE name = ?', [name]);
    if (rows.length) { bankCache[name] = rows[0].id; return rows[0].id; }
    const [r] = await db.query('INSERT INTO question_banks (name, cat_id, sub_id, description) VALUES (?, ?, ?, ?)',
      [name, 'gk', subId || null, '行测真题批量导入（tools/import-xingce）']);
    bankCache[name] = r.insertId;
    log(`  新建题库: ${name} (id=${r.insertId})`);
    return r.insertId;
  }
  async function assignBank(moduleCfg, q) {
    if (moduleCfg.splitByType) {
      const m = cfg.PD_TYPE_MAP[q.typeLabel];
      const bankName = m ? m.bank : cfg.PD_DEFAULT_BANK;
      const sub = m ? m.sub : 'gk-lj';
      return getBank(bankName, sub);
    }
    return getBank(moduleCfg.bank, moduleCfg.sub);
  }

  /* ---------- 清洗（幂等重跑） ---------- */
  if (force) {
    log('--force：清空所有「行测真题·」题库题目');
    await db.query(`DELETE q FROM questions q JOIN question_banks b ON q.bank_id=b.id WHERE b.name LIKE '行测真题·%'`);
    log('  清洗完成');
  }

  const progress = loadProgress();
  const summary = [];

  for (const m of cfg.MODULES) {
    if (onlyModule && !m.dir.startsWith(onlyModule)) continue;
    if (!force && progress.modules[m.dir] === 'done') { log(`跳过已完成模块 ${m.dir}`); continue; }

    const mdFiles = walkMd(path.join(cfg.SRC_ROOT, m.dir));
    log(`\n== ${m.dir}：${mdFiles.length} 份 md，开始解析`);

    /* 解析 + 去重 */
    const seen = new Map();   // hash → 首次来源
    const rows = [];          // {bankId, q}
    let parseOk = 0, dupSkip = 0, errFiles = 0;
    for (const f of mdFiles) {
      let parsed;
      try { parsed = parseMd(f, m.dir); }
      catch (e) { log(`  解析失败 ${path.basename(f)}: ${e.message}`); errFiles++; continue; }
      for (const q of parsed.questions) {
        const h = dedupKey(q);
        if (seen.has(h)) { dupSkip++; continue; }
        seen.set(h, path.basename(f));
        rows.push({ bankId: null, q });
      }
      parseOk += parsed.questions.length;
    }
    log(`  解析题目 ${parseOk}，去重后 ${rows.length}（跨卷重复 ${dupSkip}）`);

    /* 分配题库 + 批量插入 */
    let inserted = 0, batch = [];
    const doBatch = async () => {
      if (!batch.length) return;
      const values = [];
      const ph = [];
      for (const r of batch) {
        ph.push('(?,?,?,?,?,?,?,?,?)');
        values.push(
          r.bankId,
          r.q.type === 'multi' ? 'multi' : (r.q.type === 'judge' ? 'judge' : 'single'),
          r.q.stem,
          r.q.stemImg.length ? JSON.stringify(r.q.stemImg) : null,
          JSON.stringify(r.q.options),
          r.q.answer,
          r.q.analysis || null,
          2, // 难度默认中
          r.q.meta.试卷 ? (r.q.meta.试卷 + ' q' + r.q.qid).slice(0, 100) : ''
        );
      }
      try {
        await db.query('INSERT INTO questions (bank_id,type,stem,stem_img,options,answer,analysis,difficulty,source) VALUES ' + ph.join(','), values);
        inserted += batch.length;
      } catch (e) {
        log(`  批量插入失败（${batch.length} 条）: ${e.message}`);
        /* 逐条回退找脏数据 */
        for (const r of batch) {
          try {
            await db.query('INSERT INTO questions (bank_id,type,stem,stem_img,options,answer,analysis,difficulty,source) VALUES (?,?,?,?,?,?,?,?,?)',
              [r.bankId, r.q.type === 'multi' ? 'multi' : (r.q.type === 'judge' ? 'judge' : 'single'), r.q.stem,
               r.q.stemImg.length ? JSON.stringify(r.q.stemImg) : null, JSON.stringify(r.q.options), r.q.answer,
               r.q.analysis || null, 2, (r.q.meta.试卷 || '') + ' q' + r.q.qid]);
            inserted++;
          } catch (e2) { log(`  单条插入失败 ${r.q.meta.试卷} q${r.q.qid}: ${e2.message}`); }
        }
      }
      batch = [];
    };

    for (const r of rows) {
      r.bankId = await assignBank(m, r.q);
      batch.push(r);
      if (batch.length >= cfg.BATCH) await doBatch();
    }
    await doBatch();
    log(`  已插入 ${inserted} 题（失败逐条回退处理）`);
    summary.push(`${m.dir}: 解析 ${parseOk} / 去重后 ${rows.length} / 插入 ${inserted} / 重复跳过 ${dupSkip}`);
    progress.modules[m.dir] = 'done';
    saveProgress(progress);
  }

  log('\n===== 导入完成 =====');
  summary.forEach(s => log('  ' + s));
  await db.end();
  process.exit(0);
})().catch(e => { console.error('EXCEPTION', e); process.exit(1); });
