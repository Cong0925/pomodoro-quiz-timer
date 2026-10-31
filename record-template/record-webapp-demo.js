// ============================================================
// record-webapp-demo.js — web-app 核心三模块操作演示录制（方案A 单条视频）
// 范围：计时模式 / 题库练习 / 速算练习（只演示，不碰管理类增删改界面）
// 特性：
//   1. 服务全托管：探测 8888/8889 → 未运行调 start-webapp.ps1 → 录完调 stop-webapp.ps1
//   2. 录制中收集测试数据 id（响应监听），录完统一 DELETE 测后清理（视频不含删除操作）
//   3. 输出 docs/演示视频/ 下 webm（录像自带虚拟光标/点击涟漪/目标高亮/步骤注解）
// 用法：node record-template/record-webapp-demo.js [--keep-services]
//   --keep-services  录完不停止服务（服务已手动启动时用）
// ============================================================
const path = require('path');
const { spawnSync } = require('child_process');
const { createRecorder, playwright } = require('./recorder');

const WEB = 'http://localhost:8889';
const API = 'http://localhost:8888';
const VIDEO_PATH = path.join(__dirname, '..', 'docs', '演示视频', 'web-app-核心三模块演示.webm');

// ---------- 测试数据收集（录后清理用，视频中不出现删除操作） ----------
const created = { rounds: [], practiceSessions: [], mentalSessions: [] };

function watchCleanupIds(page) {
  page.on('response', async (r) => {
    try {
      const req = r.request();
      if (req.method() !== 'POST' || !r.ok()) return;
      const url = r.url();
      const body = await r.json().catch(() => null);
      if (!body) return;
      if (/\/api\/history$/.test(url) && body.id) created.rounds.push(body.id);
      else if (/\/api\/practice\/start$/.test(url) && body.sessionId) created.practiceSessions.push(body.sessionId);
      else if (/\/api\/practice\/\d+\/finish$/.test(url) && body.archived && body.archived.id) created.rounds.push(body.archived.id);
      else if (/\/api\/mental\/start$/.test(url) && body.sessionId) created.mentalSessions.push(body.sessionId);
      else if (/\/api\/mental\/\d+\/finish$/.test(url) && body.archived && body.archived.id) created.rounds.push(body.archived.id);
    } catch (e) {
      // 响应监听只为收集清理 id，失败不影响录制主流程
      console.error('收集清理 id 失败（不影响录制）：', e.message);
    }
  });
}

// ---------- 服务托管（复用 web-app/start-webapp.ps1 与 stop-webapp.ps1） ----------
async function probe(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServices() {
  const beUp = await probe(`${API}/api/health`);
  const feUp = await probe(`${WEB}/`);
  if (beUp && feUp) {
    console.log('[服务] 前后端均已在运行（8888/8889），跳过启动');
    return false; // 非本脚本启动
  }
  console.log('[服务] 检测到服务未运行，调用 start-webapp.ps1 拉起…');
  // 注意：不能用 detached+unref 直接 spawn ps1（本环境会被随父进程回收导致静默失效），
  // 改经 Start-Process 拉起独立进程树（等价双击 启动.bat，窗口标题「web-app 服务」可被 stop-webapp.ps1 按标题回收）
  const ps1 = path.join(__dirname, '..', 'web-app', 'start-webapp.ps1');
  const launch = spawnSync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
    `Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${ps1}' -WindowStyle Minimized`,
  ], { stdio: 'pipe', encoding: 'utf8' });
  if (launch.status !== 0) {
    throw new Error(`拉起 start-webapp.ps1 失败（退出码 ${launch.status}）：${(launch.stderr || '').slice(0, 200)}`);
  }
  for (let i = 1; i <= 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await probe(`${API}/api/health`) && await probe(`${WEB}/`)) {
      console.log('[服务] 前后端就绪');
      return true;
    }
  }
  throw new Error('服务等待超时（40 秒），请检查 web-app 后端/前端日志');
}

// ---------- 预热（录制前用独立浏览器跑一遍三模块路由，等 Vite 依赖优化稳定） ----------
async function warmUp() {
  console.log('[预热] 预加载三模块页面，等待 Vite 依赖优化稳定…');
  const browser = await playwright.chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const targets = [
      [`${WEB}/timer/single`, '.time-display'],
      [`${WEB}/practice`, '.setup-layout'],
      [`${WEB}/mental`, '.type-grid'],
    ];
    for (const [url, sel] of targets) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
          await page.locator(sel).waitFor({ state: 'visible', timeout: 15000 });
          await page.waitForTimeout(800);
          break;
        } catch (e) {
          console.error(`[预热] ${url} 第 ${attempt} 次未就绪，刷新重试：${e.message}`);
          if (attempt === 3) throw new Error(`预热失败：${url}（${e.message}）`);
          await page.waitForTimeout(2500);
        }
      }
    }
    console.log('[预热] 完成');
  } finally {
    await browser.close();
  }
}

function stopServices() {
  console.log('[服务] 调用 stop-webapp.ps1 停止前后端…');
  const r = spawnSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, '..', 'web-app', 'stop-webapp.ps1')],
    { stdio: 'inherit' });
  if (r.status !== 0) console.error('停止服务脚本返回非零状态：', r.status);
}

// ---------- 测后清理（录制结束后统一删除本次测试数据） ----------
async function cleanupTestData() {
  console.log('\n===== 测后清理 =====');
  const del = async (label, url) => {
    try {
      const res = await fetch(url, { method: 'DELETE' });
      const ok = res.ok;
      console.log(`[${ok ? '已清理' : '清理失败'}] ${label} → ${url}`);
    } catch (e) {
      console.error(`清理请求异常：${label} → ${url}`, e.message);
    }
  };
  for (const id of created.practiceSessions) await del(`练习会话 ${id}`, `${API}/api/practice/history/${id}`);
  for (const id of created.mentalSessions) await del(`速算会话 ${id}`, `${API}/api/mental/history/${id}`);
  for (const id of created.rounds) await del(`归档轮次 ${id}`, `${API}/api/history/${id}`);
  const total = created.practiceSessions.length + created.mentalSessions.length + created.rounds.length;
  console.log(`共清理测试数据 ${total} 条（练习会话 ${created.practiceSessions.length} / 速算会话 ${created.mentalSessions.length} / 归档轮次 ${created.rounds.length}）`);
  console.log('注：练习/速算结算各产生一次当日学习时长上报（study-daily 按天累计无回退接口），微量残留不处理');
}

// ---------- 小工具 ----------
// 弹窗/按钮按可见文字精确定位（过滤同名 tab 等歧义元素）
function btn(page, text, root = 'body') {
  return page.locator(root).getByRole('button', { name: text }).filter({ visible: true }).first();
}

// 做题循环：点选项即判（多选兼容「提交答案」）→ 展示解析 → 下一题/完成
// 已到结算页时直接返回（题库题量可能不足预设题数）
async function answerQuestion(rec, pickIndex) {
  const page = rec.page;
  if (await page.locator('.practice-view .finish-btns').isVisible().catch(() => false)) return;
  const opts = page.locator('.opt-item');
  await opts.first().waitFor({ state: 'visible' });
  const count = await opts.count();
  await rec.moveClick(opts.nth(Math.min(pickIndex, count - 1)));
  await rec.sleep(900);
  // 多选题：勾选后需点「提交答案」才判题
  const submitBtn = btn(page, '提交答案');
  if (await submitBtn.isVisible().catch(() => false)) {
    await rec.moveClick(submitBtn);
  }
  await page.locator('.analysis-box').waitFor({ state: 'visible', timeout: 8000 });
  await rec.sleep(1400); // 停留观看解析
  const nextBtn = btn(page, '下一题');
  const doneBtn = btn(page, '完成');
  if (await nextBtn.isVisible().catch(() => false)) await rec.moveClick(nextBtn);
  else await rec.moveClick(doneBtn);
  await rec.sleep(600);
}

// ---------- 主流程 ----------
(async () => {
  const keepServices = process.argv.includes('--keep-services');
  await ensureServices();
  await warmUp();

  const rec = await createRecorder({
    videoPath: VIDEO_PATH,
    totalSteps: 10,
    timeout: 15000,
    // 速度适中：不全局放慢，靠步骤间 sleep 控制节奏
  });
  watchCleanupIds(rec.page);
  const page = rec.page;

  // ===== 一、计时模式 =====
  await rec.step('打开应用 · 计时模式界面导览', async () => {
    await page.goto(WEB, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('.time-display').waitFor({ state: 'visible' });
    await rec.sleep(1200);
    rec.check('计时页加载完成', await page.locator('.time-display').isVisible());
    // 悬浮球挪到左下角，避免遮挡右上角操作区
    const float = page.locator('.study-float');
    if (await float.isVisible().catch(() => false)) {
      const b = await float.boundingBox();
      if (b) {
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 });
        await page.mouse.down();
        await page.mouse.move(80, 740, { steps: 24 });
        await page.mouse.up();
        await rec.sleep(400);
      }
    }
    // 悬停导览：分类选择 / 信息卡 / 模式说明
    await rec.moveHover(page.locator('.cat-select').first());
    await rec.sleep(700);
    await rec.moveHover(page.locator('.mode-desc'));
    await rec.sleep(700);
    rec.check('界面导览完成', true);
  });

  await rec.step('单题计时：对 / 错 / 跳过 各演示一题', async () => {
    // 第 1 题（对）：先移除输入框焦点（否则空格被输入框拦截），确保计时快捷键生效
    await page.evaluate(() => {
      const el = document.activeElement;
      if (el && typeof el.blur === 'function') el.blur();
    });
    await rec.moveTo(640, 260);
    await rec.press('Space');
    await rec.setBanner('单题计时中…… 空格停止一题');
    await rec.sleep(2200);
    const ticking = (await page.locator('.time-display').textContent()) !== '00:00.00';
    rec.check('空格开始计时生效', ticking);
    await rec.press('Space');
    await page.locator('button').filter({ hasText: '对（Y）' }).first().waitFor({ state: 'visible' });
    await rec.sleep(800);
    await rec.moveClick(page.locator('button').filter({ hasText: '对（Y）' }).first());
    await rec.sleep(1000);
    // 第 2 题（错）
    await rec.press('Space');
    await rec.sleep(1800);
    await rec.press('Space');
    await page.locator('button').filter({ hasText: '错（N）' }).first().waitFor({ state: 'visible' });
    await rec.sleep(800);
    await rec.moveClick(page.locator('button').filter({ hasText: '错（N）' }).first());
    await rec.sleep(1000);
    // 第 3 题（跳过）
    await rec.press('Space');
    await rec.sleep(1600);
    await rec.press('Space');
    await page.locator('button').filter({ hasText: '跳过（P）' }).first().waitFor({ state: 'visible' });
    await rec.sleep(800);
    await rec.moveClick(page.locator('button').filter({ hasText: '跳过（P）' }).first());
    await rec.sleep(1000);
    rec.check('记录区生成 3 条记录', await page.locator('.record-item').count() === 3);
    await rec.moveHover(page.locator('.info-bar'));
    await rec.sleep(900);
  });

  await rec.step('清空本轮 · 归档到历史记录', async () => {
    await rec.moveClick(btn(page, '清空本轮'));
    await rec.sleep(1800); // 观看 ElMessage「本轮已存入历史记录」
    rec.check('本轮归档完成', true);
  });

  // ===== 二、题库练习 =====
  await rec.step('进入题库练习 · 选题区导览', async () => {
    await rec.moveClick(page.locator('.sidebar').getByText('题库练习'));
    await page.locator('.practice-view .setup-layout').waitFor({ state: 'visible' });
    await rec.sleep(1200);
    rec.check('练习选题区加载完成', await page.locator('.setup-layout .rail-item').count() > 0);
    await rec.moveHover(page.locator('.setup-layout .rail-item').first());
    await rec.sleep(800);
    await rec.moveHover(page.locator('.sub-chip').first());
    await rec.sleep(800);
    await rec.moveHover(page.locator('.pick-card.bank').first());
    await rec.sleep(800);
    // 练习方式：随机抽题
    await rec.moveClick(page.locator('.mode-chip').filter({ hasText: '随机抽题' }));
    await rec.sleep(800);
    rec.check('选题区导览完成', true);
  });

  await rec.step('开始练习 · 逐题作答（即答即判 + 解析）', async () => {
    await rec.moveClick(page.locator('.start-row').getByRole('button', { name: '开始练习' }));
    await page.locator('.practice-view .q-no').waitFor({ state: 'visible' });
    await rec.sleep(1000);
    for (let i = 0; i < 5; i++) {
      if (await page.locator('.practice-view .finish-btns').isVisible().catch(() => false)) break;
      await rec.setBanner(`题库练习：第 ${i + 1} 题作答演示`);
      await answerQuestion(rec, i % 3);
    }
    await page.locator('.practice-view .finish-btns').waitFor({ state: 'visible' });
    rec.check('练习作答完成并进入结算', true);
  });

  await rec.step('练习结算页展示', async () => {
    await page.locator('.practice-view .finish-btns').waitFor({ state: 'visible' });
    await rec.sleep(800);
    await rec.moveHover(page.locator('.finish-dots'));
    await rec.sleep(1200);
    rec.check('结算页展示完成', true);
    await rec.moveClick(btn(page, '返回选题', '.practice-view'));
    await page.locator('.setup-layout').waitFor({ state: 'visible' });
    await rec.sleep(600);
  });

  // ===== 三、速算练习 =====
  await rec.step('进入速算练习 · 题型与设置导览', async () => {
    await rec.moveClick(page.locator('.sidebar').getByText('速算练习'));
    await page.locator('.mental-view .type-grid').waitFor({ state: 'visible' });
    await rec.sleep(1200);
    rec.check('速算开始界面加载完成', await page.locator('.type-card').count() >= 5);
    await rec.moveHover(page.locator('.type-card').filter({ hasText: '分数比大小' }));
    await rec.sleep(1000);
    await rec.moveHover(page.locator('.type-card').filter({ hasText: '估算值' }));
    await rec.sleep(1000);
    rec.check('题型导览完成', true);
  });

  await rec.step('速算填空演示：百化分 · 无限流', async () => {
    await rec.moveClick(page.locator('.type-card').filter({ hasText: '百化分' }).first());
    await rec.sleep(700);
    await rec.moveClick(page.getByText('∞').first());
    await rec.sleep(700);
    await rec.moveClick(page.locator('.start-row').getByRole('button', { name: '开始练习' }));
    await page.locator('.mental-view .q-no').waitFor({ state: 'visible' });
    await rec.sleep(1000);
    for (let i = 0; i < 2; i++) {
      await rec.setBanner(`速算填空：第 ${i + 1} 题（输入数字回车提交）`);
      await rec.moveClick(page.locator('.fill-input'));
      await rec.type(i === 0 ? '8' : '11.1');
      await rec.press('Enter'); // 提交
      await rec.sleep(1500); // 观看技巧提示
      await rec.press('Enter'); // 下一题
      await rec.sleep(800);
    }
    rec.check('填空 2 题演示完成', true);
    // 结束无限流
    await rec.moveClick(btn(page, '结束练习', '.mental-view'));
    await page.locator('.el-message-box').waitFor({ state: 'visible' });
    await rec.sleep(800);
    await rec.moveClick(page.locator('.el-message-box button').filter({ hasText: /^结束$/ }).first());
    await page.locator('.mental-view .finish-btns').waitFor({ state: 'visible' });
    await rec.sleep(1200);
    await rec.moveClick(btn(page, '返回选题', '.mental-view'));
    await page.locator('.type-grid').waitFor({ state: 'visible' });
    await rec.sleep(600);
  });

  await rec.step('速算选择演示：分数比大小 · 无限流', async () => {
    await rec.moveClick(page.locator('.type-card').filter({ hasText: '分数比大小' }).first());
    await rec.sleep(700);
    await rec.moveClick(page.getByText('∞').first());
    await rec.sleep(700);
    await rec.moveClick(page.locator('.start-row').getByRole('button', { name: '开始练习' }));
    await page.locator('.mental-view .q-no').waitFor({ state: 'visible' });
    await rec.sleep(1000);
    for (let i = 0; i < 2; i++) {
      await rec.setBanner(`速算选择：第 ${i + 1} 题（点选项即判）`);
      const opts = page.locator('.mental-view .opt-item');
      await opts.nth(i).waitFor({ state: 'visible' });
      await rec.moveClick(opts.nth(i));
      await rec.sleep(1500);
      await rec.moveClick(btn(page, '下一题', '.mental-view').filter({ hasText: '下一题' }));
      await rec.sleep(800);
    }
    rec.check('选择 2 题演示完成', true);
    await rec.moveClick(btn(page, '结束练习', '.mental-view'));
    await page.locator('.el-message-box').waitFor({ state: 'visible' });
    await rec.sleep(800);
    await rec.moveClick(page.locator('.el-message-box button').filter({ hasText: /^结束$/ }).first());
    await page.locator('.mental-view .finish-btns').waitFor({ state: 'visible' });
    await rec.sleep(1000);
  });

  await rec.step('收尾 · 回到计时模式首页', async () => {
    await rec.moveClick(page.locator('.sidebar').getByText('单题模式'));
    await page.locator('.time-display').waitFor({ state: 'visible' });
    await rec.sleep(1200);
    rec.check('演示流程全部完成', true);
  });

  const result = await rec.finish({ banner: '✔ web-app 核心功能演示完毕', bannerMs: 2500 });

  // 测后清理（视频定稿后执行，不出现在录像里）
  await cleanupTestData();
  if (!keepServices) {
    stopServices();
  } else {
    console.log('[服务] --keep-services 已指定，保持服务运行');
  }
  console.log(`\n演示视频：${result.videoPath}（${result.sizeMB} MB）`);
})().catch((e) => {
  console.error('录制脚本异常：', e.message || e);
  process.exit(1);
});
