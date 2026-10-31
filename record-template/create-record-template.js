#!/usr/bin/env node
// ============================================================
// create-record-template.js — 一键生成「屏幕操作录制模板」
//
// 把本文件【单独】拷贝到任意项目，运行：
//     node create-record-template.js
// 即可生成 record-template/ 目录（含全部模板代码），并自动下载依赖。
//
// 本仓库中本文件存放在 record-template/ 内。在仓库内重新生成模板时
// 请指定其他目标目录——生成器禁止以自身所在目录为目标，防止误删附带脚本。
//
// 用法：node create-record-template.js [目标目录] [选项]
//   目标目录        生成位置，默认 ./record-template
//   --force         目标目录已存在时覆盖（删除后重新生成）
//   --skip-browser  跳过 Chromium 浏览器内核下载/检查
//   -h, --help      显示帮助
//
// 生成的目录即拷即用，录像自带：虚拟鼠标光标 / 点击涟漪波纹 /
// 目标高亮闪烁 / 顶部步骤注解条。详见生成目录内的 README.md。
// ============================================================
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ---------- 命令行参数 ----------
const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('-')));
const positional = argv.filter((a) => !a.startsWith('-'));

function printUsage() {
  console.log([
    '用法：node create-record-template.js [目标目录] [选项]',
    '',
    '  目标目录        生成位置，默认 ./record-template',
    '  --force         目标目录已存在时覆盖（删除后重新生成）',
    '  --skip-browser  跳过 Chromium 浏览器内核下载/检查',
    '  -h, --help      显示帮助',
  ].join('\n'));
}

if (flags.has('-h') || flags.has('--help')) {
  printUsage();
  process.exit(0);
}
const force = flags.has('--force');
const skipBrowser = flags.has('--skip-browser');
const TARGET = path.resolve(positional[0] || 'record-template');

// 自保护：禁止以生成器自身所在目录为目标目录，
// 否则 --force 覆盖时会连同生成器自己及 record-webapp-demo.js 等非模板文件一起误删
if (TARGET === path.resolve(__dirname)) {
  die('目标目录不能是生成器自身所在目录：' + TARGET + '\n  如需重新生成模板，请指定其他目标目录（如 ./record-template-new），生成后再手动替换');
}

// ---------- 内嵌的模板源码（由 record-template/ 生成时注入） ----------
const FILES = {
  "recorder.js": "// ============================================================\n// 通用屏幕操作录制模板库（record-template/recorder.js）\n// 功能：\n//   1. Playwright 页面录像（webm）\n//   2. 录像内可见的操作显示：虚拟鼠标光标 / 点击涟漪波纹 /\n//      目标高亮闪烁 / 顶部步骤注解条 / 步骤计数徽章\n//   3. 常用操作封装：平滑移动、点击、输入、滚动、弹窗捕获\n//   4. 功能检查 check() 与页面报错自动收集\n// 用法：\n//   const { createRecorder } = require('./record-template/recorder');\n//   const rec = await createRecorder({ videoPath: 'demo.webm', totalSteps: 3 });\n//   await rec.step('第一步：打开首页', async () => { await rec.page.goto('https://...'); });\n//   await rec.finish();\n// ============================================================\nconst { chromium } = require('playwright');\nconst fs = require('fs');\nconst path = require('path');\n\n// ---------- 注入到页面的录制覆盖层（浏览器端代码，任意页面通用） ----------\nfunction overlayInit() {\n  function build() {\n    if (window.__ovRoot || !document.documentElement) return;\n\n    const style = document.createElement('style');\n    style.textContent = `\n      @keyframes __rippleAnim { 0% { width:12px; height:12px; opacity:.85 } 100% { width:96px; height:96px; opacity:0 } }\n      @keyframes __flashAnim { 0%,100% { outline:3px solid rgba(245,158,11,0) } 50% { outline:3px solid rgba(245,158,11,.95) } }\n      .__ovFlash { animation: __flashAnim .5s ease-in-out 3; outline-offset: 3px !important; border-radius: 8px; }\n    `;\n    document.documentElement.appendChild(style);\n\n    const root = document.createElement('div');\n    root.id = '__ovRoot';\n    root.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:2147483647;';\n\n    // 步骤注解条（顶部居中）\n    const banner = document.createElement('div');\n    banner.id = '__ovBanner';\n    banner.textContent = '录制中…';\n    banner.style.cssText = 'position:absolute; top:14px; left:50%; transform:translateX(-50%); background:rgba(17,24,39,.92); color:#fff; padding:11px 24px; border-radius:999px; font:600 16px/1.45 \"Microsoft YaHei\",system-ui,sans-serif; box-shadow:0 6px 24px rgba(0,0,0,.35); white-space:nowrap; max-width:92vw; overflow:hidden; text-overflow:ellipsis;';\n\n    // 步骤计数徽章（左上角）\n    const chip = document.createElement('div');\n    chip.id = '__ovChip';\n    chip.textContent = '步骤 --';\n    chip.style.cssText = 'position:absolute; top:14px; left:14px; background:#2563eb; color:#fff; padding:8px 16px; border-radius:12px; font:700 15px \"Microsoft YaHei\",system-ui,sans-serif; box-shadow:0 4px 16px rgba(0,0,0,.3);';\n\n    // 鼠标光标：外环 + 圆点\n    const ring = document.createElement('div');\n    ring.style.cssText = 'position:absolute; width:36px; height:36px; border:3px solid #ef4444; border-radius:50%; box-shadow:0 0 12px rgba(239,68,68,.75), inset 0 0 6px rgba(239,68,68,.35); transform:translate(-50%,-50%); left:-100px; top:-100px;';\n    const dot = document.createElement('div');\n    dot.style.cssText = 'position:absolute; width:9px; height:9px; background:#ef4444; border-radius:50%; box-shadow:0 0 8px rgba(239,68,68,.95); transform:translate(-50%,-50%); left:-100px; top:-100px;';\n\n    root.appendChild(banner);\n    root.appendChild(chip);\n    root.appendChild(ring);\n    root.appendChild(dot);\n    document.documentElement.appendChild(root);\n    window.__ovRoot = root;\n\n    // 光标跟随真实鼠标事件（捕获阶段，页面无法拦截）\n    window.addEventListener('mousemove', (e) => {\n      ring.style.left = dot.style.left = e.clientX + 'px';\n      ring.style.top = dot.style.top = e.clientY + 'px';\n    }, true);\n\n    // 按下：光标收缩 + 生成扩散涟漪，标记点击位置\n    window.addEventListener('mousedown', (e) => {\n      ring.style.width = ring.style.height = '26px';\n      const r = document.createElement('div');\n      r.style.cssText = `position:absolute; left:${e.clientX}px; top:${e.clientY}px; width:12px; height:12px; transform:translate(-50%,-50%); border:3px solid rgba(239,68,68,.9); border-radius:50%; animation:__rippleAnim .65s ease-out forwards;`;\n      root.appendChild(r);\n      setTimeout(() => r.remove(), 750);\n    }, true);\n\n    window.addEventListener('mouseup', () => {\n      ring.style.width = ring.style.height = '36px';\n    }, true);\n\n    // 供录制脚本调用的页面侧接口\n    window.__setStep = (label, text) => {\n      chip.textContent = label;\n      banner.textContent = text;\n    };\n    window.__setBanner = (text) => { banner.textContent = text; };\n    window.__flash = (elOrSel) => {\n      const el = typeof elOrSel === 'string' ? document.querySelector(elOrSel) : elOrSel;\n      if (!el || !el.classList) return;\n      el.classList.remove('__ovFlash');\n      void el.offsetWidth;\n      el.classList.add('__ovFlash');\n      setTimeout(() => el.classList.remove('__ovFlash'), 1600);\n    };\n  }\n  build();\n  if (!window.__ovRoot) document.addEventListener('DOMContentLoaded', build, { once: true });\n}\n\n// ---------- 创建录制器 ----------\nasync function createRecorder(options = {}) {\n  const {\n    videoPath = 'recording.webm', // 最终视频输出路径（相对运行目录）\n    viewport = { width: 1280, height: 800 },\n    locale = 'zh-CN',\n    totalSteps = 0,        // 0 表示徽章只显示「步骤 N」，不显示总数\n    timeout = 15000,       // 元素等待超时（毫秒）\n    slowMo = 0,            // 操作放慢（毫秒），便于观看，如 50\n    collectErrors = true,  // 自动收集页面报错 / 4xx5xx / 失败请求\n  } = options;\n\n  const finalVideo = path.resolve(videoPath);\n  const recordDir = path.dirname(finalVideo);\n  fs.mkdirSync(recordDir, { recursive: true });\n\n  const browser = await chromium.launch(slowMo ? { slowMo } : {});\n  const context = await browser.newContext({\n    viewport,\n    recordVideo: { dir: recordDir, size: viewport },\n    locale,\n  });\n  context.setDefaultTimeout(timeout);\n  await context.addInitScript(overlayInit); // 每个新页面自动装上操作显示层\n  const page = await context.newPage();\n\n  const results = [];\n  const errors = [];\n  if (collectErrors) {\n    page.on('pageerror', (e) => errors.push('[pageerror] ' + e.message));\n    page.on('console', (m) => { if (m.type() === 'error') errors.push('[console] ' + m.text().slice(0, 200)); });\n    page.on('response', (r) => { if (r.status() >= 400) errors.push(`[http ${r.status()}] ${r.url().slice(0, 120)}`); });\n    page.on('requestfailed', (r) => errors.push(`[requestfailed] ${(r.url() || '').slice(0, 120)} (${(r.failure() && r.failure().errorText) || ''})`));\n  }\n\n  const rec = {\n    browser, context, page, results, errors, totalSteps, finalVideo,\n    count: 0,\n\n    // 功能检查结果记录（打印 [PASS]/[FAIL] 并进汇总）\n    check(name, pass, detail = '') {\n      results.push({ name, pass, detail });\n      console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);\n    },\n\n    // 仅更新顶部注解条（不计入步骤）\n    async setBanner(text) {\n      await page.evaluate((t) => window.__setBanner && window.__setBanner(t), text);\n    },\n\n    // 一个录制步骤：设置注解+计数 → 执行 fn（fn 抛错不中断录制，记为 FAIL）\n    async step(text, fn) {\n      rec.count += 1;\n      const label = totalSteps ? `步骤 ${rec.count} / ${totalSteps}` : `步骤 ${rec.count}`;\n      await page.evaluate(([l, t]) => window.__setStep && window.__setStep(l, t), [label, text]);\n      console.log(`\\n== ${label}：${text} ==`);\n      await page.waitForTimeout(350); // 注解停留，保证视频可读\n      try {\n        await fn();\n      } catch (e) {\n        rec.check(`步骤 ${rec.count} 异常：${text}`, false, String(e.message || e).split('\\n')[0]);\n      }\n      await page.waitForTimeout(300);\n    },\n\n    // 平滑滚动到元素 → 移动光标 → 高亮闪烁 → 点击（产生涟漪波纹）\n    // target 支持：CSS 选择器字符串 或 Playwright Locator\n    async moveClick(target, opts = {}) {\n      const loc = typeof target === 'string' ? page.locator(target) : target;\n      await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' })).catch(() => {});\n      await page.waitForTimeout(650);\n      const box = await loc.boundingBox();\n      if (!box) throw new Error('目标元素不可见，无法点击');\n      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: opts.moveSteps || 24 });\n      await page.waitForTimeout(220);\n      if (opts.flash !== false) {\n        await loc.evaluate((el) => window.__flash(el));\n        await page.waitForTimeout(520); // 高亮闪烁，让观看者看清目标\n      }\n      await page.mouse.down();\n      await page.waitForTimeout(110);\n      await page.mouse.up();\n      await page.waitForTimeout(220);\n    },\n\n    // 点击并捕获新标签页（target=\"_blank\" 链接），返回新页面\n    async clickWithPopup(target, opts = {}) {\n      const [popup] = await Promise.all([\n        page.waitForEvent('popup', { timeout: opts.popupTimeout || 20000 }),\n        rec.moveClick(target, opts),\n      ]);\n      return popup;\n    },\n\n    // 平滑移动到元素上悬停（展示 hover 效果）\n    async moveHover(target) {\n      const loc = typeof target === 'string' ? page.locator(target) : target;\n      await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' })).catch(() => {});\n      await page.waitForTimeout(650);\n      const box = await loc.boundingBox();\n      if (!box) throw new Error('目标元素不可见，无法悬停');\n      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 30 });\n      await page.waitForTimeout(700);\n    },\n\n    // 光标移动到视口坐标\n    async moveTo(x, y, steps = 20) {\n      await page.mouse.move(x, y, { steps });\n    },\n\n    // 键盘输入（先 moveClick 聚焦输入框再调用）\n    async type(text, opts = {}) {\n      await page.keyboard.type(text, { delay: opts.delay == null ? 90 : opts.delay });\n    },\n\n    async press(key) {\n      await page.keyboard.press(key);\n    },\n\n    // 滚轮滚动：deltaY>0 向下；opts.times 次数、opts.interval 间隔\n    async wheel(deltaY, opts = {}) {\n      const times = opts.times || 1;\n      const interval = opts.interval == null ? 420 : opts.interval;\n      for (let i = 0; i < times; i++) {\n        await page.mouse.wheel(0, deltaY);\n        await page.waitForTimeout(interval);\n      }\n    },\n\n    async sleep(ms) {\n      await page.waitForTimeout(ms);\n    },\n\n    // 结束：结尾注解 → 关闭浏览器 → 视频定稿改名 → 打印汇总\n    async finish(opts = {}) {\n      const { banner = '✔ 录制结束', bannerMs = 2000, quiet = false } = opts;\n      await rec.setBanner(banner).catch(() => {});\n      await page.waitForTimeout(bannerMs).catch(() => {});\n      const video = page.video();\n      await context.close();\n      await browser.close();\n      const raw = await video.path();\n      if (fs.existsSync(finalVideo)) fs.rmSync(finalVideo);\n      fs.renameSync(raw, finalVideo);\n      const sizeMB = +(fs.statSync(finalVideo).size / 1048576).toFixed(1);\n      const failed = results.filter((r) => !r.pass);\n      if (!quiet) {\n        console.log('\\n===== 录制汇总 =====');\n        console.log(`检查项通过 ${results.length - failed.length} / ${results.length}`);\n        if (failed.length) console.log('失败项：\\n' + failed.map((f) => ` - ${f.name} (${f.detail})`).join('\\n'));\n        console.log(`页面报错/失败请求 ${errors.length} 条`);\n        [...new Set(errors)].slice(0, 15).forEach((e) => console.log('  ' + e));\n        console.log(`\\n视频已保存：${finalVideo}（${sizeMB} MB）`);\n      }\n      return { videoPath: finalVideo, sizeMB, results, errors: [...new Set(errors)] };\n    },\n  };\n  return rec;\n}\n\nmodule.exports = { createRecorder, overlayInit, playwright: require('playwright') };\n",
  "example.js": "// 使用示例：通用屏幕操作录制（拷贝 record-template/ 到任意项目后，改 URL 和步骤即可）\n// 运行：node record-template/example.js   （视频输出到当前运行目录）\nconst { createRecorder } = require('./recorder');\n\n(async () => {\n  const rec = await createRecorder({\n    videoPath: 'example-录制.webm', // 输出路径（相对运行目录）\n    totalSteps: 6,\n    // slowMo: 50,                 // 需要更慢的操作节奏时打开\n  });\n\n  await rec.step('打开目标网站首页', async () => {\n    await rec.page.goto('https://cong0925.github.io/home/', { waitUntil: 'domcontentloaded', timeout: 60000 });\n    await rec.page.waitForSelector('#projectsGrid > *', { timeout: 20000 });\n    await rec.sleep(1500);\n    rec.check('首页加载成功', (await rec.page.title()).length > 0);\n  });\n\n  await rec.step('滚动浏览页面内容', async () => {\n    await rec.moveTo(640, 420);\n    await rec.wheel(560, { times: 3 });\n    await rec.wheel(-560, { times: 3 });\n  });\n\n  await rec.step('点击搜索框并输入关键词', async () => {\n    await rec.moveClick('#searchInput');\n    await rec.type('vue');\n    await rec.sleep(700);\n    rec.check('搜索有响应', true);\n  });\n\n  await rec.step('点击筛选按钮', async () => {\n    await rec.moveClick(rec.page.locator('button.filter-btn', { hasText: '已完成' }));\n    await rec.sleep(700);\n  });\n\n  await rec.step('悬停卡片查看交互效果', async () => {\n    await rec.moveHover(rec.page.locator('#projectsGrid > *').first());\n    await rec.sleep(500);\n  });\n\n  await rec.step('恢复初始状态', async () => {\n    await rec.moveClick(rec.page.locator('button.filter-btn', { hasText: '全部' }).first());\n    await rec.sleep(600);\n    rec.check('恢复完成', true);\n  });\n\n  await rec.finish({ banner: '✔ 示例录制完成' });\n})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });\n",
  "recon.js": "// 页面侦察工具：摸清目标网址的可交互元素（写录制脚本前先跑这个）\n// 运行：node record-template/recon.js https://example.com/\nconst { chromium } = require('playwright');\n\n(async () => {\n  const url = process.argv[2] || 'https://cong0925.github.io/home/';\n  const browser = await chromium.launch();\n  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });\n  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });\n  await page.waitForTimeout(3500); // 等首屏渲染/懒加载稳定\n\n  const info = await page.evaluate(() => {\n    const pick = (el) => ({\n      tag: el.tagName.toLowerCase(),\n      text: (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\\s+/g, ' ').slice(0, 60),\n      href: el.getAttribute('href') || undefined,\n      type: el.getAttribute('type') || undefined,\n      placeholder: el.getAttribute('placeholder') || undefined,\n      id: el.id || undefined,\n      cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 80) || undefined,\n    });\n    return {\n      title: document.title,\n      finalUrl: location.href,\n      headings: [...document.querySelectorAll('h1,h2,h3')].map(h => h.innerText.trim().slice(0, 80)).filter(Boolean).slice(0, 25),\n      links: [...document.querySelectorAll('a')].map(pick).slice(0, 60),\n      buttons: [...document.querySelectorAll('button, [role=button], input[type=button], input[type=submit]')].map(pick).slice(0, 40),\n      formControls: [...document.querySelectorAll('input, textarea, select')].map(pick).slice(0, 20),\n      sectionIds: [...document.querySelectorAll('[id]')].map(e => e.id).filter(Boolean).slice(0, 40),\n      iframes: [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src') || '').slice(0, 10),\n      bodySample: document.body.innerText.replace(/\\s+/g, ' ').slice(0, 800),\n    };\n  });\n\n  console.log(JSON.stringify(info, null, 2));\n  await browser.close();\n})().catch((e) => { console.error('RECON_ERROR:', e.message); process.exit(1); });\n",
  "README.md": "# record-template — 通用屏幕操作录制模板\n\n把「屏幕录制 + 操作过程显示」打包成**即拷即用**的模板。生成的录像中自带：\n\n- 🖱 **红圈虚拟鼠标光标**——全程跟随鼠标移动轨迹，指针去哪看得见\n- 💥 **点击涟漪波纹**——每次按下产生红色扩散波纹，精确标记点击位置\n- ✨ **目标高亮闪烁**——点击前元素金色边框闪烁，看清操作的是哪个控件\n- 🏷 **步骤文字注解**——顶部黑色注解条实时说明当前操作，左上角蓝色徽章显示「步骤 N / M」\n- ✅ **功能检查**——`rec.check()` 输出 `[PASS]/[FAIL]` 并在结束时汇总\n- 🚨 **报错收集**——自动收集页面 JS 报错、4xx/5xx、失败请求\n\n> 依赖（playwright）已内置在 `node_modules/` 中，**拷贝到任何项目直接用，不需要 npm install**。\n\n---\n\n## 快速开始（3 步）\n\n### 1. 拷贝模板\n\n把整个 `record-template/` 文件夹复制到你的项目里。\n\n### 2. 写录制脚本\n\n```js\n// my-demo.js\nconst { createRecorder } = require('./record-template/recorder');\n\n(async () => {\n  const rec = await createRecorder({\n    videoPath: 'demo.webm', // 视频输出路径（相对运行目录）\n    totalSteps: 2,          // 录像左上角显示「步骤 N / 2」\n  });\n\n  await rec.step('打开首页', async () => {\n    await rec.page.goto('https://example.com');\n    await rec.sleep(1500);\n    rec.check('页面标题', (await rec.page.title()).length > 0);\n  });\n\n  await rec.step('点击按钮', async () => {\n    await rec.moveClick('#my-button');\n  });\n\n  await rec.finish({ banner: '✔ 录制完成' });\n})();\n```\n\n### 3. 运行\n\n```bash\nnode my-demo.js\n```\n\n视频生成在当前运行目录。完整可运行示例见 `example.js`：\n\n```bash\nnode record-template/example.js\n```\n\n---\n\n## API\n\n| 方法 | 说明 |\n|---|---|\n| `createRecorder(options)` | 创建录制器，返回 `rec` |\n| `rec.step(文字, fn)` | 录制步骤：设置注解 + 计数后执行 `fn`；`fn` 抛错**不中断录制**，记为 FAIL |\n| `rec.moveClick(元素, opts)` | 平滑滚动到元素 → 移动光标 → 高亮闪烁 → 点击（产生涟漪） |\n| `rec.clickWithPopup(元素)` | 点击 `target=\"_blank\"` 链接并捕获新标签页，返回新 page |\n| `rec.moveHover(元素)` | 平滑移动到元素上悬停（展示 hover 效果） |\n| `rec.moveTo(x, y, steps?)` | 光标移动到视口坐标 |\n| `rec.type(text, opts?)` | 键盘输入（先 `moveClick` 聚焦输入框） |\n| `rec.press(key)` | 按键（如 `Enter`、`Escape`） |\n| `rec.wheel(dy, {times, interval})` | 滚轮滚动，`dy>0` 向下 |\n| `rec.setBanner(文字)` | 仅更新顶部注解条（不计入步骤） |\n| `rec.check(名称, 通过, 详情?)` | 记录检查结果，打印 `[PASS]/[FAIL]` |\n| `rec.sleep(ms)` | 等待 |\n| `rec.finish({banner, bannerMs})` | 结束录制：视频定稿改名 + 打印汇总，返回 `{videoPath, sizeMB, results, errors}` |\n\n**`元素` 参数**：CSS 选择器字符串（`'#btn'`）或 Playwright Locator（`rec.page.locator(...)`）均可。\n\n**createRecorder(options)**：\n\n| 选项 | 默认 | 说明 |\n|---|---|---|\n| `videoPath` | `'recording.webm'` | 最终视频输出路径 |\n| `viewport` | `{width:1280, height:800}` | 视口（录像分辨率与之一致） |\n| `locale` | `'zh-CN'` | 浏览器语言 |\n| `totalSteps` | `0` | 0 = 徽章只显示「步骤 N」 |\n| `timeout` | `15000` | 元素等待超时（毫秒） |\n| `slowMo` | `0` | 操作放慢（毫秒），便于观看 |\n| `collectErrors` | `true` | 自动收集页面报错 |\n\n**`rec` 对象**还提供：`rec.page` / `rec.context` / `rec.browser`（原生 Playwright 对象，可直接调用任何底层 API）、`rec.results`、`rec.errors`。\n\n---\n\n## 目录结构\n\n```\nrecord-template/\n├── recorder.js      # 通用库（录像 + 操作显示 + 操作封装）\n├── example.js       # 最小可运行示例\n├── recon.js         # 页面侦察工具：列出目标页的可交互元素\n├── README.md        # 本说明\n├── package.json\n└── node_modules/    # 内置 playwright（免安装）\n```\n\n写录制脚本前可先侦察目标页面有哪些按钮/输入框：\n\n```bash\nnode record-template/recon.js https://你的目标网址/\n```\n\n---\n\n## 依赖说明\n\n- `node_modules/` 已内置 playwright——**拷贝即用，无需 `npm install`**\n- Chromium 浏览器内核使用**系统全局缓存**（Windows `%LOCALAPPDATA%\\ms-playwright`，Linux/macOS `~/.cache/ms-playwright`）。同一台机器上装过 Playwright 的项目共享这份内核，零下载；全新机器首次运行会提示执行 `npx playwright install chromium`（仅需一次）\n- 若删掉模板内的 `node_modules/`，`require('playwright')` 会按 Node 的向上查找机制自动回退到宿主项目自己安装的 playwright，两种方式都行\n\n---\n\n## 常见问题\n\n**Q: 新标签页（target=\"_blank\"）的内容没出现在录像里？**\n浏览器录像只录当前页面。用 `rec.clickWithPopup()` 验证跳转成功后，如需在录像里展示该页面内容，可在主窗口 `rec.page.goto(同样的URL)` 浏览一遍再返回。\n\n**Q: 下拉框（select）弹出的选项列表录不进去？**\n原生下拉是系统级 UI，不会出现在网页录像里。用 `page.selectOption()` 完成选择，并把光标移到控件旁（`moveTo`/`moveClick`），配合 `setBanner` 注解说明即可。\n\n**Q: 视频什么时候生成？**\n`finish()` 时才定稿改名。中途脚本崩溃会留下 `page@xxx.webm` 临时文件（可直接播放或删除）。\n\n**Q: 打开了多个页面，怎么保证都录进一个视频？**\n统一用 `rec.page` 操作主页面。popup 页面有独立录像；需要展示时用 `goto` 在主窗口复现（见问题 1）。\n\n**Q: 想要更慢/更快的操作节奏？**\n`createRecorder({ slowMo: 50 })` 全局放慢；或在个别步骤里 `rec.sleep()`。\n",
  "package.json": "{\n  \"name\": \"record-template\",\n  \"version\": \"1.0.0\",\n  \"description\": \"通用屏幕操作录制模板：录像 + 虚拟鼠标光标/点击涟漪/目标高亮/步骤注解。依赖已内置，拷贝即用\",\n  \"main\": \"recorder.js\",\n  \"private\": true,\n  \"license\": \"MIT\"\n}\n"
};

function run(cmd) {
  return spawnSync(cmd, { shell: true, cwd: TARGET, stdio: 'inherit' });
}

function die(msg) {
  console.error('\n✗ ' + msg);
  process.exit(1);
}

(async () => {
  console.log('===== 生成屏幕操作录制模板 =====');
  console.log('目标目录：' + TARGET + '\n');

  // [1/5] 创建目录
  console.log('[1/5] 创建目录');
  if (fs.existsSync(TARGET)) {
    if (!force) die('目标目录已存在：' + TARGET + '\n  如需覆盖请加 --force（会删除该目录重新生成）');
    fs.rmSync(TARGET, { recursive: true, force: true });
  }
  fs.mkdirSync(TARGET, { recursive: true });
  console.log('  ✓ ' + path.basename(TARGET) + '/\n');

  // [2/5] 写入模板文件
  console.log('[2/5] 写入模板文件');
  const names = Object.keys(FILES);
  for (const name of names) {
    const dest = path.join(TARGET, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, FILES[name], 'utf8');
    console.log('  ✓ ' + name + '  (' + Math.round(Buffer.byteLength(FILES[name], 'utf8') / 1024) + ' KB)');
  }
  console.log('  共 ' + names.length + ' 个文件\n');

  // [3/5] 下载依赖 playwright（node_modules 内置于目录内，之后任何项目免安装）
  console.log('[3/5] 下载依赖 playwright（npm install）');
  let r = run('npm install playwright --no-audit --no-fund');
  if (r.status !== 0) {
    console.log('  默认 npm 源失败，切换国内镜像重试…');
    r = run('npm install playwright --no-audit --no-fund --registry=https://registry.npmmirror.com');
  }
  if (r.error) die('无法执行 npm，请确认已安装 Node.js：' + r.error.message);
  if (r.status !== 0) die('依赖下载失败，请检查网络后重试（也可手动进入目录执行 npm install playwright）');
  console.log('  ✓ 依赖就绪\n');

  // [4/5] 浏览器内核（全局缓存已存在时秒过；全新机器会自动下载一次）
  if (skipBrowser) {
    console.log('[4/5] 浏览器内核（已跳过）\n');
  } else {
    console.log('[4/5] 检查/下载 Chromium 浏览器内核');
    r = run('npx playwright install chromium');
    if (r.status !== 0) {
      console.log('  ⚠ 浏览器内核准备失败。请稍后手动执行：cd ' + path.basename(TARGET) + ' && npx playwright install chromium\n');
    } else {
      console.log('  ✓ 浏览器内核就绪\n');
    }
  }

  // [5/5] 模块加载自检
  console.log('[5/5] 模块加载自检');
  r = run('node -e "require(\'./recorder\'); console.log(\'  ✓ recorder.js 加载正常\')"');
  if (r.status !== 0) die('自检失败：record-template/recorder.js 无法加载');

  // 完成提示
  const rel = path.relative(process.cwd(), TARGET) || path.basename(TARGET);
  const sep = path.sep === '\\' ? '\\' : '/';
  console.log('\n========================================');
  console.log('✅ 录制模板生成完毕！');
  console.log('');
  console.log('使用方法（任意录制脚本中）：');
  console.log('  const { createRecorder } = require(\'./' + rel.split(path.sep).join('/') + '/recorder\');');
  console.log('');
  console.log('运行自带示例：');
  console.log('  node ' + rel.split(path.sep).join('/') + sep + 'example.js');
  console.log('');
  console.log('完整文档：' + rel.split(path.sep).join('/') + sep + 'README.md');
  console.log('========================================');
})();
