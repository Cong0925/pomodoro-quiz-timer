// ============================================================
// 通用屏幕操作录制模板库（record-template/recorder.js）
// 功能：
//   1. Playwright 页面录像（webm）
//   2. 录像内可见的操作显示：虚拟鼠标光标 / 点击涟漪波纹 /
//      目标高亮闪烁 / 顶部步骤注解条 / 步骤计数徽章
//   3. 常用操作封装：平滑移动、点击、输入、滚动、弹窗捕获
//   4. 功能检查 check() 与页面报错自动收集
// 用法：
//   const { createRecorder } = require('./record-template/recorder');
//   const rec = await createRecorder({ videoPath: 'demo.webm', totalSteps: 3 });
//   await rec.step('第一步：打开首页', async () => { await rec.page.goto('https://...'); });
//   await rec.finish();
// ============================================================
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// ---------- 注入到页面的录制覆盖层（浏览器端代码，任意页面通用） ----------
function overlayInit() {
  function build() {
    if (window.__ovRoot || !document.documentElement) return;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes __rippleAnim { 0% { width:12px; height:12px; opacity:.85 } 100% { width:96px; height:96px; opacity:0 } }
      @keyframes __flashAnim { 0%,100% { outline:3px solid rgba(245,158,11,0) } 50% { outline:3px solid rgba(245,158,11,.95) } }
      .__ovFlash { animation: __flashAnim .5s ease-in-out 3; outline-offset: 3px !important; border-radius: 8px; }
    `;
    document.documentElement.appendChild(style);

    const root = document.createElement('div');
    root.id = '__ovRoot';
    root.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:2147483647;';

    // 步骤注解条（顶部居中）
    const banner = document.createElement('div');
    banner.id = '__ovBanner';
    banner.textContent = '录制中…';
    banner.style.cssText = 'position:absolute; top:14px; left:50%; transform:translateX(-50%); background:rgba(17,24,39,.92); color:#fff; padding:11px 24px; border-radius:999px; font:600 16px/1.45 "Microsoft YaHei",system-ui,sans-serif; box-shadow:0 6px 24px rgba(0,0,0,.35); white-space:nowrap; max-width:92vw; overflow:hidden; text-overflow:ellipsis;';

    // 步骤计数徽章（左上角）
    const chip = document.createElement('div');
    chip.id = '__ovChip';
    chip.textContent = '步骤 --';
    chip.style.cssText = 'position:absolute; top:14px; left:14px; background:#2563eb; color:#fff; padding:8px 16px; border-radius:12px; font:700 15px "Microsoft YaHei",system-ui,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,.3);';

    // 鼠标光标：外环 + 圆点
    const ring = document.createElement('div');
    ring.style.cssText = 'position:absolute; width:36px; height:36px; border:3px solid #ef4444; border-radius:50%; box-shadow:0 0 12px rgba(239,68,68,.75), inset 0 0 6px rgba(239,68,68,.35); transform:translate(-50%,-50%); left:-100px; top:-100px;';
    const dot = document.createElement('div');
    dot.style.cssText = 'position:absolute; width:9px; height:9px; background:#ef4444; border-radius:50%; box-shadow:0 0 8px rgba(239,68,68,.95); transform:translate(-50%,-50%); left:-100px; top:-100px;';

    root.appendChild(banner);
    root.appendChild(chip);
    root.appendChild(ring);
    root.appendChild(dot);
    document.documentElement.appendChild(root);
    window.__ovRoot = root;

    // 光标跟随真实鼠标事件（捕获阶段，页面无法拦截）
    window.addEventListener('mousemove', (e) => {
      ring.style.left = dot.style.left = e.clientX + 'px';
      ring.style.top = dot.style.top = e.clientY + 'px';
    }, true);

    // 按下：光标收缩 + 生成扩散涟漪，标记点击位置
    window.addEventListener('mousedown', (e) => {
      ring.style.width = ring.style.height = '26px';
      const r = document.createElement('div');
      r.style.cssText = `position:absolute; left:${e.clientX}px; top:${e.clientY}px; width:12px; height:12px; transform:translate(-50%,-50%); border:3px solid rgba(239,68,68,.9); border-radius:50%; animation:__rippleAnim .65s ease-out forwards;`;
      root.appendChild(r);
      setTimeout(() => r.remove(), 750);
    }, true);

    window.addEventListener('mouseup', () => {
      ring.style.width = ring.style.height = '36px';
    }, true);

    // 供录制脚本调用的页面侧接口
    window.__setStep = (label, text) => {
      chip.textContent = label;
      banner.textContent = text;
    };
    window.__setBanner = (text) => { banner.textContent = text; };
    window.__flash = (elOrSel) => {
      const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;
      if (!el || !el.classList) return;
      el.classList.remove('__ovFlash');
      void el.offsetWidth;
      el.classList.add('__ovFlash');
      setTimeout(() => el.classList.remove('__ovFlash'), 1600);
    };
  }
  build();
  if (!window.__ovRoot) document.addEventListener('DOMContentLoaded', build, { once: true });
}

// ---------- 创建录制器 ----------
async function createRecorder(options = {}) {
  const {
    videoPath = 'recording.webm', // 最终视频输出路径（相对运行目录）
    viewport = { width: 1280, height: 800 },
    locale = 'zh-CN',
    totalSteps = 0,        // 0 表示徽章只显示「步骤 N」，不显示总数
    timeout = 15000,       // 元素等待超时（毫秒）
    slowMo = 0,            // 操作放慢（毫秒），便于观看，如 50
    collectErrors = true,  // 自动收集页面报错 / 4xx5xx / 失败请求
  } = options;

  const finalVideo = path.resolve(videoPath);
  const recordDir = path.dirname(finalVideo);
  fs.mkdirSync(recordDir, { recursive: true });

  const browser = await chromium.launch(slowMo ? { slowMo } : {});
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: recordDir, size: viewport },
    locale,
  });
  context.setDefaultTimeout(timeout);
  await context.addInitScript(overlayInit); // 每个新页面自动装上操作显示层
  const page = await context.newPage();

  const results = [];
  const errors = [];
  if (collectErrors) {
    page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)); });
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url().slice(0, 120)}`); });
    page.on('requestfailed', (r) => errors.push(`[requestfailed] ${(r.url() || '').slice(0, 120)} (${(r.failure() && r.failure().errorText) || ''})`));
  }

  const rec = {
    browser, context, page, results, errors, totalSteps, finalVideo,
    count: 0,

    // 功能检查结果记录（打印 [PASS]/[FAIL] 并进汇总）
    check(name, pass, detail = '') {
      results.push({ name, pass, detail });
      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
    },

    // 仅更新顶部注解条（不计入步骤）
    async setBanner(text) {
      await page.evaluate((t) => window.__setBanner && window.__setBanner(t), text);
    },

    // 一个录制步骤：设置注解+计数 → 执行 fn（fn 抛错不中断录制，记为 FAIL）
    async step(text, fn) {
      rec.count += 1;
      const label = totalSteps ? `步骤 ${rec.count} / ${totalSteps}` : `步骤 ${rec.count}`;
      await page.evaluate(([l, t]) => window.__setStep && window.__setStep(l, t), [label, text]);
      console.log(`\n== ${label}：${text} ==`);
      await page.waitForTimeout(350); // 注解停留，保证视频可读
      try {
        await fn();
      } catch (e) {
        rec.check(`步骤 ${rec.count} 异常：${text}`, false, String(e.message || e).split('\n')[0]);
      }
      await page.waitForTimeout(300);
    },

    // 平滑滚动到元素 → 移动光标 → 高亮闪烁 → 点击（产生涟漪波纹）
    // target 支持：CSS 选择器字符串 或 Playwright Locator
    async moveClick(target, opts = {}) {
      const loc = typeof target === 'string' ? page.locator(target) : target;
      await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' })).catch(() => {});
      await page.waitForTimeout(650);
      const box = await loc.boundingBox();
      if (!box) throw new Error('目标元素不可见，无法点击');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: opts.moveSteps || 24 });
      await page.waitForTimeout(220);
      if (opts.flash !== false) {
        await loc.evaluate((el) => window.__flash(el));
        await page.waitForTimeout(520); // 高亮闪烁，让观看者看清目标
      }
      await page.mouse.down();
      await page.waitForTimeout(110);
      await page.mouse.up();
      await page.waitForTimeout(220);
    },

    // 点击并捕获新标签页（target="_blank" 链接），返回新页面
    async clickWithPopup(target, opts = {}) {
      const [popup] = await Promise.all([
        page.waitForEvent('popup', { timeout: opts.popupTimeout || 20000 }),
        rec.moveClick(target, opts),
      ]);
      return popup;
    },

    // 平滑移动到元素上悬停（展示 hover 效果）
    async moveHover(target) {
      const loc = typeof target === 'string' ? page.locator(target) : target;
      await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' })).catch(() => {});
      await page.waitForTimeout(650);
      const box = await loc.boundingBox();
      if (!box) throw new Error('目标元素不可见，无法悬停');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });
      await page.waitForTimeout(700);
    },

    // 光标移动到视口坐标
    async moveTo(x, y, steps = 20) {
      await page.mouse.move(x, y, { steps });
    },

    // 键盘输入（先 moveClick 聚焦输入框再调用）
    async type(text, opts = {}) {
      await page.keyboard.type(text, { delay: opts.delay == null ? 90 : opts.delay });
    },

    async press(key) {
      await page.keyboard.press(key);
    },

    // 滚轮滚动：deltaY>0 向下；opts.times 次数、opts.interval 间隔
    async wheel(deltaY, opts = {}) {
      const times = opts.times || 1;
      const interval = opts.interval == null ? 420 : opts.interval;
      for (let i = 0; i < times; i++) {
        await page.mouse.wheel(0, deltaY);
        await page.waitForTimeout(interval);
      }
    },

    async sleep(ms) {
      await page.waitForTimeout(ms);
    },

    // 结束：结尾注解 → 关闭浏览器 → 视频定稿改名 → 打印汇总
    async finish(opts = {}) {
      const { banner = '✔ 录制结束', bannerMs = 2000, quiet = false } = opts;
      await rec.setBanner(banner).catch(() => {});
      await page.waitForTimeout(bannerMs).catch(() => {});
      const video = page.video();
      await context.close();
      await browser.close();
      const raw = await video.path();
      if (fs.existsSync(finalVideo)) fs.rmSync(finalVideo);
      fs.renameSync(raw, finalVideo);
      const sizeMB = +(fs.statSync(finalVideo).size / 1048576).toFixed(1);
      const failed = results.filter((r) => !r.pass);
      if (!quiet) {
        console.log('\n===== 录制汇总 =====');
        console.log(`检查项通过 ${results.length - failed.length} / ${results.length}`);
        if (failed.length) console.log('失败项：\n' + failed.map((f) => ` - ${f.name} (${f.detail})`).join('\n'));
        console.log(`页面报错/失败请求 ${errors.length} 条`);
        [...new Set(errors)].slice(0, 15).forEach((e) => console.log('  ' + e));
        console.log(`\n视频已保存：${finalVideo}（${sizeMB} MB）`);
      }
      return { videoPath: finalVideo, sizeMB, results, errors: [...new Set(errors)] };
    },
  };
  return rec;
}

module.exports = { createRecorder, overlayInit, playwright: require('playwright') };
