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

## 四、当前进度（截至 2026-10-28 14:09）

**已完成**：
1. ✅ 分支切到 `version-vue+node`，web-app 前后端分离骨架（方案A）搭建完毕
2. ✅ 后端移植主版本 server/，接通 MySQL（root@localhost:3306，库 `pomodoro-quiz-timer`，与主版本共用，14 张表已存在），`/api/health` 返回 ok:true
3. ✅ Element Plus 集成（方案A）：element-plus + icons + unplugin-auto-import + unplugin-vue-components 按需导入，el-* 组件免 import 直接用；构建与 dev 均验证通过
4. ✅ `web-app/README.md`、本备忘文件、CLAUDE.md 自动读取/更新约定
5. ✅ 权限弹窗根因修复：会话项目根是 `web-app/`（非仓库根），已新建 `web-app/.claude/settings.json` 全放开配置（ask 保留 git/rm 六类弹窗），并清空 settings.local.json 冗余窄规则——**需新开会话生效**
6. ✅ **后端功能完成（2026-10-28，方案B）**：14 表 × 57 接口盘点查漏，补 13 个接口（practice 单库详情/题目批量导入删除/会话删除/历史筛选；mental 会话删除/历史筛选；study-daily 区间查询/按日删除），契约升级（CORS 白名单制 .env 可配 CORS_ORIGINS、题型枚举校验、memos 参数校验、totalMs 转 number）
7. ✅ **全量验收通过**：`scripts/acceptance.js`（npm run test:acceptance）91 通过/0 失败/4 跳过（跳过为清空全部类破坏性接口）；揪出并修复 practice `GET /history/:id` SQL 漏 WHERE session_id 上游缺陷（**main 分支同款缺陷未修，需在 main 单独处理**）

**待办（建议优先级）**：
1. ⬜ 业务模块迁移开发：计时模式、题库练习、速算、历史、收藏、统计、分类、日历备忘、设置（后端接口已全部就绪，可参照主版本 `public/js/modules/` 逻辑 + 现成 REST API）
2. ⬜ main 分支 practice GET /history/:id 同款 SQL 缺陷待修复（须在 main 分支单独操作）

**关键接口约定（前端对接用）**：
- 错误响应统一 `{ error: '中文描述' }`；分页统一 `{ list, total, page, limit, totalPages }`
- mental 作答/跳过必传 `questionId`（practice 同）；批量导入/删除上限 500 题
- CORS 白名单默认 http://localhost:5173,http://127.0.0.1:5173，可用 backend/.env 的 CORS_ORIGINS 调整（* 全放行）

**提交状态**：2026-10-28 已将 web-app 全部代码 + docs + CLAUDE.md 一次性提交到 `main`（用户指令「传入 main」，方案A），`version-vue+node` 分支已删除；**未 push**（用户未明确指示）。

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
