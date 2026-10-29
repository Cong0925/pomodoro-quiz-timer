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

## 四、当前进度（截至 2026-10-29 17:19）

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
19. ✅ **图片题目存储方案C 全量实现（2026-10-28 20:55）**：`questions` 表加 `stem_img JSON` + `options[].img`；web-app 后端全链路透传+校验（单图 ≤300KB、题干图 ≤20、整包 ≤40MB）+备份兼容；前端 canvas 压缩 `utils/image.ts`、录入多图上传、答题多图渲染+图片选项、回看缩略图；主版本同款同步；冒烟 12/12、build 全绿；**注意：stem_img 约定——GET /banks/:id/questions 返回原始列名下划线 `stem_img`，start/answer/history 映射接口为驼峰 `stemImg`**
20. ✅ **行测真题全量导入（2026-10-28 22:20，仓库 ERRRC/xingcezhenti）**：图片落盘 `data/qi-images/{题目图(6152张), 公式图(33309张)}`（文件名保持仓库原哈希名，部署同构）；DB 存 `/qi-bank/<子目录>/<文件名>`（一次写好永不改）；解析导入工具 `tools/import-xingce/`（parser+import，md5 去重、断点续跑、--force 幂等）；**58890 题 → 去重后 27460 题**入库 9 个「行测真题·」题库（图推50:1818/定义51:1550/类比52:2170/逻辑53:2204/政治54:1084/常识55:4849/言语56:6956/数量57:3223/资料58:3606，分类沿用 gk 大类）；双端 `/qi-bank` 静态服务 + vite proxy；前端渲染改造（web-app PracticeView 题干/解析 v-html + :deep img 约束、PracticeRecords stripHtml；主版本 practice.js innerHTML + stripHtml + style.css img 约束）；build 全绿、node --check 通过、双端已重启（8888 PID 22208 / 8889 PID 16332）、端到端冒烟与数据抽查全过
21. ✅ **题库题逻辑删除 is_deleted（2026-10-29 13:32）**：`questions` 加 `is_deleted TINYINT(1) DEFAULT 0`（0=正常 1=已停用可恢复）；双端 schema 同步并已 ALTER；web-app + 主版本后端全部读题/抽题/题量过滤 `is_deleted=0`、`DELETE /questions[/:id|/batch]` 改软删、新增 `POST /questions/:id/restore`、列表接口加 `includeDeleted=1` 参数；前端「删除」改「停用」+「显示已停用」开关 + 恢复按钮（行灰化/已停用 tag）；历史回看不过滤（已停用题仍正常显示）；build 全绿、node --check 通过、后端已重启（8888 pid 2292）、停用/恢复端到端冒烟 7/7 全过；**该改动在 13:22 push 之后，未提交**
22. ✅ **双端导出/导入链路 is_deleted + stem_img 适配（2026-10-29，适配检查+修复）**：检查结论——业务读写路径与验收脚本均已适配无需改；缺口=导出/导入 6 文件（双端 `routes/data.js`、`exportData.js`、`importData.js`）未含 `is_deleted`，主版本另缺方案C 遗留的 `stem_img`（备份恢复丢图片题）、主版本 mental 导出缺 `fillable`；修复：6 文件补字段（导出 JSON 驼峰 `stemImg`/`isDeleted`，导入读驼峰，旧备份兼容=无字段→`stem_img=[]`/`is_deleted=0`）；双端 backup/restore/migrate 复用 importData/exportData 本体自动受益；验证：web-app `GET /api/export`（27500 题）与主版本 backup.js 命令行导出 + 临时启动 `:3000/api/export` 字段全在（图推题 id=15620 stemImg 保留）、双端 importData 事务回滚验证 PASS（isDeleted=1 写回、旧备份兼容）；后端已重启 8888（pid 21068）、主版本临时进程验证后已停；**未提交（等用户指令）**
23. ✅ **题库模式用户体验优化（2026-10-29，A1+B1+建议1~4 全做）**：① 回看解析自由选题——回看模式题号导航条（对/错/跳着色、点击跳题、当前高亮、上一题/下一题/返回结算）+ 结算页对错分布条（点击色块进该题回看）+ ← → 方向键翻题；② 练习记录回顾——行操作「回顾本场」整场逐题解析弹窗（新组件 PracticeReviewDialog，web-app）/主版本 pRecReviewMask 弹层，展开行每题「解析」单题弹窗；③ 展开行「只看错题」开关；④ 本场错题重练——后端新接口 `POST /api/practice/:id/replay-errors`（双端，取该会话错题开 review 新会话，无错题 400，错题已停用提示），记录行「重练错题」按钮注入会话直接开练（无错题禁用）；验证：web-app build 全绿、主版本 practice.js node --check、后端重启 8888（pid 6388）、replay-errors 冒烟 3 用例 PASS（201/400/404，测试会话已清理）、主版本 3000 临时验证后停；**未提交（等用户指令）**
24. ✅ **回顾解析弹窗限高修复（2026-10-29，截图验收）**：web-app 弹窗（el-dialog）默认 top:15vh + 内容超高无上限 → 撑出全屏滚动条。修复：弹窗 `class="rv-dialog"`（height:96vh、margin:2vh auto 0、flex column，header 固定、body 内部滚动），顶部留白 2vh、不再全屏滚动；主版本弹层已有 max-height 86vh 无此问题；build 全绿；**未提交（等用户指令）**
25. ✅ **题库管理表格状态列 + 三态筛选（2026-10-29，截图验收）**：后端 `GET /banks/:id/questions`（双端）新增 `status` 参数（normal=仅正常默认/deleted=仅已停用/all=全部带 is_deleted，兼容 includeDeleted=1）；web-app 答案列 70→90、难度 80→90 防表头挤行，新增独立「状态」列（正常绿/已停用灰 tag），筛选改 el-select 三态（后端分页过滤）；主版本同步（select 三态、表头加状态列、列宽、p-q-ok-tag 样式）；已停用行操作列「恢复」按钮保留；补充：恢复题目加确认弹窗（双端）、状态列支持排序（web-app el-table sortable / 主版本表头点击排序 ▲▼）；验证：build 全绿、双端 node --check、8888 重启（修复误删 page/pageSize 定义）后冒烟 6 用例 + 停用→过滤→恢复全链路 PASS（临时测试题已删）、主版本 3000 临时验证 4 用例 PASS 后已停；**未提交（等用户指令）**
26. ✅ **练习记录切 tab 不刷新修复（2026-10-29，用户反馈）**：做完题切到练习记录新记录不显示、需刷新页面——根因 web-app `PracticeView` tab 用 `v-show` 常驻，`PracticeRecords` 仅 onMounted 加载一次；修复：子组件抽 `refresh()`（统计+列表，保留当前页）并 defineExpose，父组件 `watch(tab)` 切到 records 时调用；主版本每次切 tab 本就重载无此问题；build 全绿；**未提交（等用户指令）**
27. ✅ **单题/整组模式大类默认「公务员考试」（2026-10-29，用户要求）**：计时视图大类默认选择——原为记忆上次/无记忆时为空，现无记忆或记忆失效时默认回退「公务员考试」（categories id=`gk`），手动选择仍记忆优先；双端（web-app `TimerView` / 主版本 `categories.js`）；build 全绿 + node --check 过；**未提交（等用户指令）**
28. ✅ **速算填空自动聚焦输入框（2026-10-29，用户反馈）**：主版本 mental.js 已有每题 renderQ 后 focus（无此问题）；web-app `MentalFillInput` 缺聚焦逻辑——修复：组件挂载即 nextTick 聚焦 el-input（每题 v-if 重挂载自动覆盖），键盘流程=输入→回车提交→回车下一题→自动聚焦→输入，全程无鼠标；build 全绿；**已随 15:54 两次 commit 提交（见提交状态）**
29. ✅ **web-app 一键启动/停止脚本（2026-10-29 17:19，方案B 单窗口）**：新增 4 文件——`web-app/启动.bat`+`start-webapp.ps1`、`web-app/停止服务.bat`+`stop-webapp.ps1`；.bat 纯 ASCII 入口（规避 cmd UTF-8 解析断行 bug），逻辑全在 .ps1（UTF-8 BOM）；单窗口方案：服务进程隐藏运行，主窗口只显示状态 + 15 秒心跳；日志写 `docs/错误日志/web-app-{backend,frontend}.log`（每次启动覆盖+时间头，交给大模型解读）；启动流程=装依赖→端口探测跳过已运行→拉起→就绪轮询≤30s（超时打日志尾 15 行）→开浏览器 8889→心跳（双 DOWN 2 轮自动退出）；停止三层=关「web-app 服务」窗口整树→按端口 8888/8889 杀→兜底清 node --watch/vite 残留；全链路闭环验证通过（含 .bat 入口复测两轮）；**未提交（等用户指令）**

**待办（建议优先级）**：
0. ⬜ **2 处点击删除无确认弹窗（2026-10-28 排查发现，方案 A/B 待用户选择）**：`CalendarView.vue clear()` 清空当日备忘直接删；`useTimer.ts cancelBatchRound()` 取消本轮丢弃未归档记录——均无 ElMessageBox.confirm，存在数据丢失风险
0.5. ✅ **图片题目（图形推理）存储（方案C，2026-10-28 实现完成）**：`questions` 加 `stem_img JSON` + `options[].img`，base64 内嵌 ≤300KB/图、前端 canvas 压缩、批量导入/备份透传；web-app 与主版本双端同步实现，冒烟 12/12、build 全绿；**已随 2026-10-29 两次 commit 入库（见提交状态）**
0.6. ✅ **行测真题导入（2026-10-28 完成，见进度第 20 条）**：27460 题入库 9 库 + 39461 张图落盘 `data/qi-images/` + `/qi-bank` 双端静态服务 + 前端渲染改造；**`xingcezhenti-main/` 源仓库与 tools/ 已随 2026-10-29 主版本 commit 入库（用户指定不忽略）**
1. ⬜ 浏览器人工验收：与主版本并排对照操作各模块（键位/弹窗/边界行为），修复体验差异
2. ⬜ main 主版本 practice `GET /history/:id` SQL 缺陷修复（须在该文件所属的 main 历史中单独处理，web-app 版已修）
3. ✅ 已提交（2026-10-28 15:57，方案A 分 2 次）：`139ba20` feat(web-app) 前端全量视图+分层、`aec5db6` docs 备忘录与修改记录；`docs/imgs/` 2 张 Snipaste 截图未入库（未跟踪，待用户决定删除）
4. ✅ 界面对齐改动（第 9 条）+ 题库表格放大（第 10 条）+ 三点下拉菜单（第 11 条）+ 统计分页（第 12 条）+ 悬浮球可拖动（第 13 条）+ 统计头部指标条（第 14 条）+ 练习选题两栏布局（第 15 条）+ 错题收藏单行工具栏（第 16 条）+ 弹窗审计与空 catch 修复（第 17 条）+ message/message-box 样式修复（第 18 条）→ **已随 `2b72025` 提交（2026-10-28 用户指令「提交所有修改」）**；**仍未 push**
5. ⬜ 验收脚本 CORS 用例失败（存量）：backend/.env 白名单已改 8889（用户改了前端端口），而 `scripts/acceptance.js` 硬编码测 5173——需把脚本测试 Origin 改为读 .env 或用 TEST_BASE_URL 推导；另注意后端实际跑在 **8888** 端口（.env PORT），验收须 `TEST_BASE_URL=http://localhost:8888`
6. ⬜ **行测导入待决策**：① `data/qi-images` 256MB 需随部署携带，DB 导出不含图（备份/迁移策略待定）；② 图推/常识等含题图模块可人工抽查做题体验；③ 若调整题库归属/去重口径，`tools/import-xingce/import.js --force --module 05` 可幂等重跑

**关键接口约定（前端对接用）**：
- 错误响应统一 `{ error: '中文描述' }`；分页统一 `{ list, total, page, limit, totalPages }`
- `/api/stats` 为后端切页（列表三表聚合+JS补零，非 SQL LIMIT），额外带 `sum`（全段合计，供总计卡片）；limit 钳制 1~100
- mental 作答/跳过必传 `questionId`（practice 同）；批量导入/删除上限 500 题
- CORS 白名单默认 http://localhost:5173,http://127.0.0.1:5173，可用 backend/.env 的 CORS_ORIGINS 调整（* 全放行）；**当前 .env 已改为 8889 源**
- 后端实际监听端口以 backend/.env 的 PORT 为准（当前 **8888**）

**提交状态**：2026-10-28 已将 web-app 全部代码 + docs + CLAUDE.md 一次性提交到 `main`（用户指令「传入 main」，方案A），`version-vue+node` 分支已删除；同日 15:57 追加 2 次提交（`139ba20` web-app 前端全量视图、`aec5db6` docs）；同日 20:xx 用户指令「提交所有修改」再追加 3 次提交：`2b72025` feat(web-app) 界面排版优化与弹窗样式规范修复（27 文件，含第 9~18 条全部改动）、`ad651de` docs 备忘录/修改记录/界面对齐差异清单、`23a6cf5` chore .shots 对比截图 33 张、`2a70117` docs 提交状态记录；**已 push**（2026-10-28 用户指令「推送」，`584281a..2a70117` → origin/main，本机 7897 代理未开经 `git -c http.proxy= -c https.proxy=` 绕过直连成功）。
**2026-10-29 17:28 提交状态（用户指令「提交所有修改,然后推送」）**：`dd8cd21f` docs 备忘录+修改记录+gitignore 排除 zip（3 文件）、`8c239697` feat(web-app) 一键启停脚本 4 文件；已 push `72778271..8c239697 → origin/main`，工作区干净（仅本条回执与修改记录回执为推送后新增、待下次提交）。
**当前未提交改动（等用户指令）**：docs 回执记录 2 处（本次推送后新增）；`xingcezhenti-main.zip` 已在 .gitignore 排除（用户 10-29 手动添加），本地保留不入库。
**2026-10-29 15:54 提交状态（用户指令「提交并推送」）**：`8aa14893` feat(主版本) is_deleted+导出导入适配+界面优化（11 文件含 docs，覆盖进度第 21~25 条主版本部分）、`72778271` feat(web-app) is_deleted+体验优化+速算记录实时刷新（15 文件，覆盖第 21~28 条 web-app 部分）；已 push `46a04764..72778271 → origin/main`。注：第 21~28 条条目内「未提交」字样为提交前写入，实际已随上述两 commit 入库。

**2026-10-29 提交状态（用户指令「提交所有未提交内容」，方案A 拆 2 次）**：`e6b76cb4` feat(主版本) 练习模块图片题支持 + 行测真题题库与导入工具入库（42441 文件，含 `xingcezhenti-main/` 464M 题库数据、`tools/import-xingce/`、demos、docs）、`46a04764` feat(web-app) 练习模块图片题支持（13 文件）；安全处理：`tools/import-xingce/config.js` 明文 MySQL 密码改 `process.env.DB_PASSWORD || ''`（密码未进历史，`git log -S` 已验证）；**已 push**（13:22 用户指令「直接推送」，首次因 7897 代理未开失败，代理启动后 `03e050ec..46a04764` → origin/main 成功）；用户明确不追加 docs commit（本文件与 10-29 修改记录保持未提交）。
**13:22 push 之后的新未提交改动**：题库题逻辑删除 is_deleted（见进度第 21 条）与双端导出/导入链路适配（第 22 条）与题库模式用户体验优化（第 23 条，含新接口 replay-errors）与弹窗限高修复（第 24 条）与题库管理状态列三态筛选（第 25 条）与记录切 tab 刷新修复（第 26 条）与计时模式大类默认公务员考试（第 27 条）与速算填空自动聚焦（第 28 条），等用户指令提交。

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
