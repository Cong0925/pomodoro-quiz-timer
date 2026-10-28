---
description: Claude 会话备忘：项目理解、多版本架构、web-app 当前进度与待办（每次会话开始读取，任务完成后更新）
created: 2026-10-28
last_modified: 2026-10-28
---

# Claude 会话备忘（project memo）

> **给下次会话的 Claude**：这是你的项目备忘录。会话开始时先读本文件，快速恢复上下文；每次完成用户任务后必须更新「当前进度」和「待办」两节，保持本文件不过期。不要重新从零探索项目——本文件 + CLAUDE.md + docs/coding-standards.md 已覆盖全部关键信息。

## 一、项目是什么

**刷题计时器**：本地学习刷题辅助工具（repo 名 pomodoro-quiz-timer 只是历史命名，实际不是番茄钟，核心是**给做题计时**）。定位「计时 · 统计 · 留痕」，数据存本地 MySQL。

核心功能模块（主版本已全部实现，web-app 版待迁移开发）：
- 计时模式：单题/整组计时、悬浮学习计时（60s 增量上报 + sendBeacon 补尾）
- 练习：题库练习（单选/多选/判断，顺序/随机/错题重练）、速算练习（百化分/分数比较/估算值/平方数，选择+填空）
- 数据：历史记录、错题收藏、学习统计（日/周/月）、分类管理（两级）
- 备忘/系统：日历备忘、设置（JSON 导出/导入）

> ⚠️ 更正（2026-10-28）：此前备忘录中的「宠物模块」系误读 CLAUDE.md 修改记录格式示例（「如『宠物模块』」）脑补而来，**本项目不存在该模块，也无此规划**，已删除。

## 二、多版本架构与分支（单分支模型，2026-10-28 起）

| 版本 | 目录 | 分支 | 技术栈 | 状态 |
|------|------|------|--------|------|
| 主版本 | 仓库根目录 | `main` | 原生 HTML/CSS/JS + Express + MySQL | ✅ 完整，维护中 |
| web-app 版 | `web-app/` | `main` | Vue 3 + TS + Pinia + Router + Element Plus + Express | 🚧 后端完成，前端功能开发中 |
| app 版 | `app/`（未创建） | `main`（未来） | 预留 Rust/Tauri | 未开始 |

- **单分支管理**：历史上的 `version-vue+node` 分支已于 2026-10-28 并入 main 并删除；所有版本统一在 `main` 维护
- **跨版本禁止混提**：一次提交只属于一个版本（web-app 与主版本改动分开提交）
- **禁止私自 commit/push/merge/rebase**：只有用户明确说「提交」才可执行
- **当前会话所在分支**：`main`

## 三、web-app 目录结构（方案A：前后端独立文件夹）

```
web-app/
├── README.md          结构说明与启动方式（已写）
├── frontend/          Vite 9 + Vue 3.5 + TS + Pinia + vue-router + Element Plus（端口 5173）
│   └── src/
│       ├── api/http.ts        统一 fetch 封装（泛型、无 any、中文 console.error）
│       ├── router/index.ts    懒加载路由 + 页面标题
│       ├── types/             auto-imports.d.ts / components.d.ts（插件自动生成）
│       ├── views/HomeView.vue 首页（后端健康检查按钮 + ElMessage 示例）
│       ├── components/        通用组件（空，待开发）
│       └── stores/            Pinia（空，按领域拆分，每个 ≤300 行）
└── backend/           Express + MySQL（移植自主版本 server/，端口 3000）
    ├── index.js       已移除静态托管（纯 API，404 返回 JSON）
    ├── routes/        9 个路由：categories/history/favorites/stats/study/memos/practice/mental/data
    ├── schema.sql     14 张表建表脚本
    ├── .env           本机数据库配置（gitignore，不提交）
    └── package.json   npm run dev / start / init-db / backup / restore / migrate
```

## 四、当前进度（截至 2026-10-28 20:00）

**已完成**：
1. ✅ 分支切到 `version-vue+node`，web-app 前后端分离骨架（方案A）搭建完毕
2. ✅ 后端移植主版本 server/，接通 MySQL（root@localhost:3306，库 `pomodoro-quiz-timer`，与主版本共用，14 张表已存在），`/api/health` 返回 ok:true
3. ✅ Element Plus 集成（方案A）：element-plus + icons + unplugin-auto-import + unplugin-vue-components 按需导入，el-* 组件免 import 直接用；构建与 dev 均验证通过
4. ✅ `web-app/README.md`、本备忘文件、CLAUDE.md 自动读取/更新约定
5. ✅ 权限弹窗根因修复：会话项目根是 `web-app/`（非仓库根），已新建 `web-app/.claude/settings.json` 全放开配置（ask 保留 git/rm 六类弹窗），并清空 settings.local.json 冗余窄规则——**需新开会话生效**
6. ✅ **后端功能完成（2026-10-28，方案B）**：14 表 × 57 接口盘点查漏，补 13 个接口（practice 单库详情/题目批量导入删除/会话删除/历史筛选；mental 会话删除/历史筛选；study-daily 区间查询/按日删除），契约升级（CORS 白名单制 .env 可配 CORS_ORIGINS、题型枚举校验、memos 参数校验、totalMs 转 number）
7. ✅ **全量验收通过**：`scripts/acceptance.js`（npm run test:acceptance）91 通过/0 失败/4 跳过（跳过为清空全部类破坏性接口）；揪出并修复 practice `GET /history/:id` SQL 漏 WHERE session_id 上游缺陷（**main 分支同款缺陷未修，需在 main 单独处理**）
8. ✅ **Vue 前端全量转化完成（2026-10-28，方案B Element Plus 重构版，public/ 零触碰）**：
   - 架构：`src/{api(8个typed模块), types, utils, stores(4), composables/useTimer, components(8), views(9), router}`，全部业务逻辑对照主版本 `public/js/modules/` 同口径转化
   - 里程碑①：App 外壳（el-menu+徽标）+ 计时模式（空格/Y/N/P 键盘、单题对错弹窗、整组错题标记面板、自动归档）+ 悬浮学习计时（60s上报+beacon+单实例锁）+ 历史/收藏/统计
   - 里程碑②：题库练习（三级选题、做题即判+解析、结算回看、题库管理分页、记录明细）+ 速算（4题型、填空 fillDir 方向、无限流 more/结束、管理端软删恢复、技巧手册三表）
   - 里程碑③：日历备忘（日/选月/选年三级视图、类型标签、4字标题）+ 分类管理（prompt/confirm → El 弹窗）+ 设置（JSON 导出含 showSaveFilePicker/导入合并/数据库信息/关于）
   - 验证：`npm run build`（vue-tsc+vite）全绿；dev 5173 页面 + /api 代理连通 3000 后端冒烟通过；`git status` 确认 public/ server/ 零改动
9. ✅ **Vue 版界面对齐原版（2026-10-28 16:28）**：配 el-config-provider zhCn 修 el-select 英文"Select" bug；计时页拆卡片+info-bar 两行+停止红/清空灰按钮；练习/速算 tab 改胶囊按钮组+卡片 3/4 列；统计卡片 2×3+tabs 居中；日历改上下布局；分类/设置按钮样式对齐原版；悬浮球绿色保留；build 全绿；未提交
10. ✅ **题库表格放大一号（2026-10-28 18:03，方案A）**：PracticeManage.vue:252、MentalManage.vue:284 两处题库题目表格 `size="small"` → `size="default"`（Element Plus 三档 large/default/small，small 大一号即 default）；表内按钮/标签/分页器、记录表格均未动
11. ✅ **题库行操作改三点下拉菜单（2026-10-28 18:13，方案A）**：PracticeManage 左侧题库列表「编辑/删除」两按钮 → el-dropdown ⋮（MoreFilled）菜单（编辑/删除danger+div隔开，onBankCmd 分发，删除二次确认保留）；顺带修复 MentalRecords/PracticeRecords el-table 重复 row-key（TS1117，删静态留函数版）；build 全绿
12. ✅ **学习统计列表后端分页（2026-10-28 18:51，方案B）**：/api/stats 增 page/limit（钳制 1~100）+ 全段 sum + {today,sum,list,total,page,limit,totalPages}；列表为三表聚合+JS补零，无法 SQL LIMIT/OFFSET，分页在聚合后切页；修复 mysql2 SUM/COUNT 返回字符串致 sum 变拼接的真实 bug（加 Number()）；前端 types/api/StatsView 改造+分页器+总计用后端 sum；build 全绿、实测四场景正确、验收 stats 组全绿；后端已重启（8888）
13. ✅ **悬浮球可拖动改造（2026-10-28 18:59，方案C）**：新建 composables/useDraggable.ts（Pointer Events、>5px 判拖、视口钳制、localStorage 位置记忆、resize 重钳制、拖后吞 click 防误触开关）；StudyFloat 从右下 fixed 改 left/top 注入、初始**右上角** 24px、拖动中 grabbing+禁 transition、touch-action none；build 全绿；主版本悬浮球无拖动（无原版交互可对齐）
14. ✅ **学习统计头部改内联指标条（2026-10-28 19:16，方案A）**：StatsView 今日/总计 12 张 el-card 改为 2 条 .metric-strip（每条 6 指标横排、细分隔线、flex-wrap 窄屏换行），标签去「今日/总」前缀，头部约 600px→180px 明细表进首屏；另周期列 `min-width=140`→固定 `width=150`（19:21），随后明细表 `size=default` + 全 8 列改弹性 `min-width`（19:25，方案A）
15. ✅ **练习选题区改两栏布局（2026-10-28 19:31，方案C）**：PracticeSetupPane 左栏 200px sticky 大类竖排列表（名称+徽标）、右栏小类改流式 chip（名称+题库数徽标）+ 题库卡 auto-fill 自适应列数（名称/题量同行）；props/emits 未变父组件零改动；build 全绿；截图已删；未提交
16. ✅ **错题收藏改单行工具栏（2026-10-28 19:37，方案A）**：FavoritesView 删独立筛选卡+3 张统计卡，合并为一条 toolbar（左筛选下拉/中计数文案「共N条·本页·轮次·单题」/右清空按钮）；头部约 220px→50px；功能逻辑零改动；build 全绿；截图已删；未提交
17. ✅ **弹窗规范审计+空 catch 修复（2026-10-28 19:45，方案B）**：审计确认全项目无原生 alert/confirm/prompt、提示确认面板已 100% 组件库化（11 confirm + 5 el-dialog + 60+ message）；修复 11 处空 catch（取消静默/真异常 console.error 中文日志）；MentalView 结束练习确认补 type:warning；build 全绿；未提交
18. ✅ **ElMessageBox/ElMessage 样式缺失修复（2026-10-28 20:00，方案A）**：根因=按需 resolver 不给服务式 API 注入样式（产物 CSS 中 .el-message-box/.el-message 均为 0），确认框裸渲染左上角无遮罩；main.ts 手动引入 message-box/message 的 style/css（保持按需），产物已验证含规则；build 全绿；未提交

**待办（建议优先级）**：
0. ⬜ **2 处点击删除无确认弹窗（2026-10-28 排查发现，方案 A/B 待用户选择）**：`CalendarView.vue clear()` 清空当日备忘直接删；`useTimer.ts cancelBatchRound()` 取消本轮丢弃未归档记录——均无 ElMessageBox.confirm，存在数据丢失风险
1. ⬜ 浏览器人工验收：与主版本并排对照操作各模块（键位/弹窗/边界行为），修复体验差异
2. ⬜ main 主版本 practice `GET /history/:id` SQL 缺陷修复（须在该文件所属的 main 历史中单独处理，web-app 版已修）
3. ✅ 已提交（2026-10-28 15:57，方案A 分 2 次）：`139ba20` feat(web-app) 前端全量视图+分层、`aec5db6` docs 备忘录与修改记录；`docs/imgs/` 2 张 Snipaste 截图未入库（未跟踪，待用户决定删除）
4. ⬜ 界面对齐改动（第 9 条）+ 题库表格放大（第 10 条）+ 三点下拉菜单（第 11 条）+ 统计分页（第 12 条）+ 悬浮球可拖动（第 13 条）+ 统计头部指标条（第 14 条）+ 练习选题两栏布局（第 15 条）+ 错题收藏单行工具栏（第 16 条）+ 弹窗审计与空 catch 修复（第 17 条）+ message/message-box 样式修复（第 18 条）→ **已随 `2b72025` 提交（2026-10-28 用户指令「提交所有修改」）**；**仍未 push**
5. ⬜ 验收脚本 CORS 用例失败（存量）：backend/.env 白名单已改 8889（用户改了前端端口），而 `scripts/acceptance.js` 硬编码测 5173——需把脚本测试 Origin 改为读 .env 或用 TEST_BASE_URL 推导；另注意后端实际跑在 **8888** 端口（.env PORT），验收须 `TEST_BASE_URL=http://localhost:8888`

**关键接口约定（前端对接用）**：
- 错误响应统一 `{ error: '中文描述' }`；分页统一 `{ list, total, page, limit, totalPages }`
- `/api/stats` 为后端切页（列表三表聚合+JS补零，非 SQL LIMIT），额外带 `sum`（全段合计，供总计卡片）；limit 钳制 1~100
- mental 作答/跳过必传 `questionId`（practice 同）；批量导入/删除上限 500 题
- CORS 白名单默认 http://localhost:5173,http://127.0.0.1:5173，可用 backend/.env 的 CORS_ORIGINS 调整（* 全放行）；**当前 .env 已改为 8889 源**
- 后端实际监听端口以 backend/.env 的 PORT 为准（当前 **8888**）

**提交状态**：2026-10-28 已将 web-app 全部代码 + docs + CLAUDE.md 一次性提交到 `main`（用户指令「传入 main」，方案A），`version-vue+node` 分支已删除；同日 15:57 追加 2 次提交（`139ba20` web-app 前端全量视图、`aec5db6` docs）；同日 20:xx 用户指令「提交所有修改」再追加 3 次提交：`2b72025` feat(web-app) 界面排版优化与弹窗样式规范修复（27 文件，含第 9~18 条全部改动）、`ad651de` docs 备忘录/修改记录/界面对齐差异清单、`23a6cf5` chore .shots 对比截图 33 张；**未 push**（用户未明确指示）。

## 五、关键约定（给下次会话的 Claude）

1. 回复开头固定「老板，」；任何需求先复述+列 ≥2 套方案+等用户确认才动工
2. 代码规范：`docs/coding-standards.md`（web-app 适用第〇/一/二/三/四/五/七~十七章；Vue 单文件 ≤500 行、store ≤300 行、禁 any、try/catch + 中文 console.error、禁 console.log 上线）
3. 每次完成需求**自动**更新当天修改记录 `docs/修改记录/{M}月/第N章 修改记录{M}-{D}.md`（带 `[HH:MM]` 时间戳，`date '+%H:%M'` 取时间）
4. `docs/` 下新建文件（除修改记录/图片）必须加 YAML frontmatter（description/created/last_modified）
5. 读 `docs/imgs/` 图片后立即删除；错误日志只读未标 `[已处理]` 的，分析后必改名标记
6. 数据库密码等敏感信息只进 `.env`（已 gitignore），不进任何 git 跟踪文件
7. 主版本历史数据存分类/题库**名称快照**、部分外键故意不设——改表结构要维持该口径

## 六、常用启动命令

```bash
# 后端（3000）
cd web-app/backend && npm run dev

# 前端（5173，/api 自动代理到 3000）
cd web-app/frontend && npm run dev

# 主版本（3000，与 web-app 后端互斥，不能同时跑）
双击根目录 启动.bat
```
