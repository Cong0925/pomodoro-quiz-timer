// 页面侦察工具：摸清目标网址的可交互元素（写录制脚本前先跑这个）
// 运行：node record-template/recon.js https://example.com/
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'https://cong0925.github.io/home/';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500); // 等首屏渲染/懒加载稳定

  const info = await page.evaluate(() => {
    const pick = (el) => ({
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
      href: el.getAttribute('href') || undefined,
      type: el.getAttribute('type') || undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      id: el.id || undefined,
      cls: (el.className && el.className.toString ? el.className.toString() : '').slice(0, 80) || undefined,
    });
    return {
      title: document.title,
      finalUrl: location.href,
      headings: [...document.querySelectorAll('h1,h2,h3')].map(h => h.innerText.trim().slice(0, 80)).filter(Boolean).slice(0, 25),
      links: [...document.querySelectorAll('a')].map(pick).slice(0, 60),
      buttons: [...document.querySelectorAll('button, [role=button], input[type=button], input[type=submit]')].map(pick).slice(0, 40),
      formControls: [...document.querySelectorAll('input, textarea, select')].map(pick).slice(0, 20),
      sectionIds: [...document.querySelectorAll('[id]')].map(e => e.id).filter(Boolean).slice(0, 40),
      iframes: [...document.querySelectorAll('iframe')].map(f => f.getAttribute('src') || '').slice(0, 10),
      bodySample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 800),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})().catch((e) => { console.error('RECON_ERROR:', e.message); process.exit(1); });
