/* ============================================================
 * tools/import-xingce/parser.js
 * 解析单个 md：YAML 头 + 题块（题干/选项/答案/解析）+ 资料分析材料块
 * 输出结构化题目对象（图片引用已转为 /qi-bank URL）
 * ============================================================ */
const cfg = require('./config');

/* 把 md 里的相对图片路径 ../90-图片/xxx → /qi-bank/xxx */
function rewriteImgSrc(html) {
  return html.replace(/src="\.\.\/90-图片\/([^"]+)"/g, (m, p) => `src="${cfg.IMG_URL_PREFIX}/${p}"`);
}

/* 提取文本中的所有图片 src 列表（重写为 /qi-bank URL） */
function extractImgSrcs(html) {
  const urls = [];
  html.replace(/src="([^"]+)"/g, (m, u) => { urls.push(u); return m; });
  return urls.filter(u => u.startsWith(cfg.IMG_URL_PREFIX));
}

/* HTML → 纯文本（剥标签，换行保留） */
function htmlToText(html) {
  return (html || '')
    .replace(/<img[^>]*>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/* 解析 YAML 头 */
function parseYaml(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const meta = {};
  if (m) {
    m[1].split('\n').forEach(line => {
      const kv = line.match(/^\s*([^:]+):\s*"?(.*?)"?\s*$/);
      if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^"|"$/g, '');
    });
  }
  return meta;
}

/* 解析选项行列表：- **A**. 内容（✅标记答案） */
function parseOptions(block) {
  const opts = [];
  const re = /-\s*\*\*([A-H])\*\*\.?\s*([\s\S]*?)(?=\n-\s*\*\*[A-H]\*\*|\n\*\*答案\*\*|\n---|$)/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    const label = m[1];
    let raw = m[2];
    const isCorrect = raw.includes('✅');
    const imgs = extractImgSrcs(rewriteImgSrc(raw));
    const text = htmlToText(raw.replace(/✅/g, ''));
    const o = { label };
    if (text) o.text = text;
    if (imgs.length) o.img = imgs[0]; // 选项一般为单图（公式/图）
    opts.push({ o, isCorrect });
  }
  return opts;
}

/* 解析单个 md 文件 → 题目数组 */
function parseMd(filePath, moduleDir) {
  const fs = require('fs');
  const text = fs.readFileSync(filePath, 'utf8');
  const meta = parseYaml(text);
  const questions = [];
  const isZl = moduleDir === '06-资料分析';

  /* 分段：按「材料头」与「题号行」切分，保留标记与内容段（顺序天然对应） */
  const segs = text.split(/(^#{2,3} 第 \d+ 题[^\n]*|^## 材料 \d+[^\n]*)/m);
  let curMat = null; // 当前材料 HTML（资料分析）
  for (let i = 1; i < segs.length; i += 2) {
    const marker = segs[i];
    const content = segs[i + 1] || '';
    if (/^## 材料 \d+/.test(marker)) {
      curMat = content.trim();
      continue;
    }
    /* 题号行：## 第 N 题 / ### 第 N 题 */
    const subM = marker.match(/<sub>qid\s*(\d+)(?:\s*·\s*([^<]+))?<\/sub>/);
    const qid = subM ? subM[1] : null;
    const typeLabel = subM && subM[2] ? subM[2].trim() : '';
    const body = content;

    /* 题干：题块开头到第一个选项行 */
    const stemM = body.match(/^([\s\S]*?)(?=\n-\s*\*\*[A-H]\*\*|\n\*\*答案\*\*)/);
    let stemHtml = (stemM ? stemM[1] : body).trim();
    /* 题干内嵌图片（题目图+公式图）在 HTML 里保留；单独提取题目图 URL 供前端多图渲染 */
    const stemImgs = extractImgSrcs(rewriteImgSrc(stemHtml)).filter(u => u.includes('/题目图/'));
    /* 资料分析：材料 HTML 拼接到题干前（每道小题都可看材料） */
    if (isZl && curMat) {
      stemHtml = curMat + '\n\n' + stemHtml;
    }

    /* 选项与答案 */
    const opts = parseOptions(body);
    const ansM = body.match(/\*\*答案\*\*：\s*([^\n]+)/);
    const answerRaw = ansM ? ansM[1].trim() : '';
    /* 答案归一：取纯字母 */
    let answer = (answerRaw.match(/[A-H]+/) || [''])[0];

    /* 解析 */
    const anaM = body.match(/\*\*官方解析\*\*\s*\n?([\s\S]*?)(?=\n---|$)/);
    let analysis = anaM ? anaM[1].trim() : '';
    analysis = rewriteImgSrc(analysis).replace(/^<p>|<\/p>$/g, '');

    /* 题型：single（单选，答案 1 个字母）/ multi（多选）/ judge（非字母） */
    let type = 'single';
    if (/^[A-H]{2,}$/.test(answer)) type = 'multi';
    else if (!/^[A-H]$/.test(answer) && answer) type = 'judge';

    questions.push({
      qid,
      typeLabel,
      stem: rewriteImgSrc(stemHtml),
      stemImg: stemImgs,
      options: opts.map(x => {
        const o = { label: x.o.label };
        if (x.o.text) o.text = x.o.text;
        if (x.o.img) o.img = x.o.img;
        return o;
      }),
      answer,
      answerRaw,
      analysis,
      type,
      meta,
    });
  }

  return { meta, questions };
}

module.exports = { parseMd, htmlToText, rewriteImgSrc, extractImgSrcs };
