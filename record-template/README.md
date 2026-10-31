# record-template — 通用屏幕操作录制模板

把「屏幕录制 + 操作过程显示」打包成**即拷即用**的模板。生成的录像中自带：

- 🖱 **红圈虚拟鼠标光标**——全程跟随鼠标移动轨迹，指针去哪看得见
- 💥 **点击涟漪波纹**——每次按下产生红色扩散波纹，精确标记点击位置
- ✨ **目标高亮闪烁**——点击前元素金色边框闪烁，看清操作的是哪个控件
- 🏷 **步骤文字注解**——顶部黑色注解条实时说明当前操作，左上角蓝色徽章显示「步骤 N / M」
- ✅ **功能检查**——`rec.check()` 输出 `[PASS]/[FAIL]` 并在结束时汇总
- 🚨 **报错收集**——自动收集页面 JS 报错、4xx/5xx、失败请求

> 依赖（playwright）已内置在 `node_modules/` 中，**拷贝到任何项目直接用，不需要 npm install**。

---

## 快速开始（3 步）

### 1. 拷贝模板

把整个 `record-template/` 文件夹复制到你的项目里。

### 2. 写录制脚本

```js
// my-demo.js
const { createRecorder } = require('./record-template/recorder');

(async () => {
  const rec = await createRecorder({
    videoPath: 'demo.webm', // 视频输出路径（相对运行目录）
    totalSteps: 2,          // 录像左上角显示「步骤 N / 2」
  });

  await rec.step('打开首页', async () => {
    await rec.page.goto('https://example.com');
    await rec.sleep(1500);
    rec.check('页面标题', (await rec.page.title()).length > 0);
  });

  await rec.step('点击按钮', async () => {
    await rec.moveClick('#my-button');
  });

  await rec.finish({ banner: '✔ 录制完成' });
})();
```

### 3. 运行

```bash
node my-demo.js
```

视频生成在当前运行目录。完整可运行示例见 `example.js`：

```bash
node record-template/example.js
```

---

## API

| 方法 | 说明 |
|---|---|
| `createRecorder(options)` | 创建录制器，返回 `rec` |
| `rec.step(文字, fn)` | 录制步骤：设置注解 + 计数后执行 `fn`；`fn` 抛错**不中断录制**，记为 FAIL |
| `rec.moveClick(元素, opts)` | 平滑滚动到元素 → 移动光标 → 高亮闪烁 → 点击（产生涟漪） |
| `rec.clickWithPopup(元素)` | 点击 `target="_blank"` 链接并捕获新标签页，返回新 page |
| `rec.moveHover(元素)` | 平滑移动到元素上悬停（展示 hover 效果） |
| `rec.moveTo(x, y, steps?)` | 光标移动到视口坐标 |
| `rec.type(text, opts?)` | 键盘输入（先 `moveClick` 聚焦输入框） |
| `rec.press(key)` | 按键（如 `Enter`、`Escape`） |
| `rec.wheel(dy, {times, interval})` | 滚轮滚动，`dy>0` 向下 |
| `rec.setBanner(文字)` | 仅更新顶部注解条（不计入步骤） |
| `rec.check(名称, 通过, 详情?)` | 记录检查结果，打印 `[PASS]/[FAIL]` |
| `rec.sleep(ms)` | 等待 |
| `rec.finish({banner, bannerMs})` | 结束录制：视频定稿改名 + 打印汇总，返回 `{videoPath, sizeMB, results, errors}` |

**`元素` 参数**：CSS 选择器字符串（`'#btn'`）或 Playwright Locator（`rec.page.locator(...)`）均可。

**createRecorder(options)**：

| 选项 | 默认 | 说明 |
|---|---|---|
| `videoPath` | `'recording.webm'` | 最终视频输出路径 |
| `viewport` | `{width:1280, height:800}` | 视口（录像分辨率与之一致） |
| `locale` | `'zh-CN'` | 浏览器语言 |
| `totalSteps` | `0` | 0 = 徽章只显示「步骤 N」 |
| `timeout` | `15000` | 元素等待超时（毫秒） |
| `slowMo` | `0` | 操作放慢（毫秒），便于观看 |
| `collectErrors` | `true` | 自动收集页面报错 |

**`rec` 对象**还提供：`rec.page` / `rec.context` / `rec.browser`（原生 Playwright 对象，可直接调用任何底层 API）、`rec.results`、`rec.errors`。

---

## 目录结构

```
record-template/
├── recorder.js      # 通用库（录像 + 操作显示 + 操作封装）
├── example.js       # 最小可运行示例
├── recon.js         # 页面侦察工具：列出目标页的可交互元素
├── README.md        # 本说明
├── package.json
└── node_modules/    # 内置 playwright（免安装）
```

> 本仓库附带 `record-webapp-demo.js`（web-app 核心三模块演示录制脚本）与 `create-record-template.js`（模板一键生成器），二者不属于模板本体，拷贝模板到其他项目时无需带走。

写录制脚本前可先侦察目标页面有哪些按钮/输入框：

```bash
node record-template/recon.js https://你的目标网址/
```

---

## 依赖说明

- `node_modules/` 已内置 playwright——**拷贝即用，无需 `npm install`**
- Chromium 浏览器内核使用**系统全局缓存**（Windows `%LOCALAPPDATA%\ms-playwright`，Linux/macOS `~/.cache/ms-playwright`）。同一台机器上装过 Playwright 的项目共享这份内核，零下载；全新机器首次运行会提示执行 `npx playwright install chromium`（仅需一次）
- 若删掉模板内的 `node_modules/`，`require('playwright')` 会按 Node 的向上查找机制自动回退到宿主项目自己安装的 playwright，两种方式都行

---

## 常见问题

**Q: 新标签页（target="_blank"）的内容没出现在录像里？**
浏览器录像只录当前页面。用 `rec.clickWithPopup()` 验证跳转成功后，如需在录像里展示该页面内容，可在主窗口 `rec.page.goto(同样的URL)` 浏览一遍再返回。

**Q: 下拉框（select）弹出的选项列表录不进去？**
原生下拉是系统级 UI，不会出现在网页录像里。用 `page.selectOption()` 完成选择，并把光标移到控件旁（`moveTo`/`moveClick`），配合 `setBanner` 注解说明即可。

**Q: 视频什么时候生成？**
`finish()` 时才定稿改名。中途脚本崩溃会留下 `page@xxx.webm` 临时文件（可直接播放或删除）。

**Q: 打开了多个页面，怎么保证都录进一个视频？**
统一用 `rec.page` 操作主页面。popup 页面有独立录像；需要展示时用 `goto` 在主窗口复现（见问题 1）。

**Q: 想要更慢/更快的操作节奏？**
`createRecorder({ slowMo: 50 })` 全局放慢；或在个别步骤里 `rec.sleep()`。
