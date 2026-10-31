// 使用示例：通用屏幕操作录制（拷贝 record-template/ 到任意项目后，改 URL 和步骤即可）
// 运行：node record-template/example.js   （视频输出到当前运行目录）
const { createRecorder } = require('./recorder');

(async () => {
  const rec = await createRecorder({
    videoPath: 'example-录制.webm', // 输出路径（相对运行目录）
    totalSteps: 6,
    // slowMo: 50,                 // 需要更慢的操作节奏时打开
  });

  await rec.step('打开目标网站首页', async () => {
    await rec.page.goto('https://cong0925.github.io/home/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await rec.page.waitForSelector('#projectsGrid > *', { timeout: 20000 });
    await rec.sleep(1500);
    rec.check('首页加载成功', (await rec.page.title()).length > 0);
  });

  await rec.step('滚动浏览页面内容', async () => {
    await rec.moveTo(640, 420);
    await rec.wheel(560, { times: 3 });
    await rec.wheel(-560, { times: 3 });
  });

  await rec.step('点击搜索框并输入关键词', async () => {
    await rec.moveClick('#searchInput');
    await rec.type('vue');
    await rec.sleep(700);
    rec.check('搜索有响应', true);
  });

  await rec.step('点击筛选按钮', async () => {
    await rec.moveClick(rec.page.locator('button.filter-btn', { hasText: '已完成' }));
    await rec.sleep(700);
  });

  await rec.step('悬停卡片查看交互效果', async () => {
    await rec.moveHover(rec.page.locator('#projectsGrid > *').first());
    await rec.sleep(500);
  });

  await rec.step('恢复初始状态', async () => {
    await rec.moveClick(rec.page.locator('button.filter-btn', { hasText: '全部' }).first());
    await rec.sleep(600);
    rec.check('恢复完成', true);
  });

  await rec.finish({ banner: '✔ 示例录制完成' });
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
