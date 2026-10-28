---
description: web-app 版（Vue3+Node 前后端分离）目录结构与启动说明
created: 2026-10-28
last_modified: 2026-10-28
---

# web-app 版本（Vue 3 + TypeScript + Node）

前后端分离，各自独立目录、独立 package.json，分别安装依赖、分别启动。

## 目录结构

```
web-app/
├── frontend/          前端：Vite + Vue 3 + TypeScript + Pinia + Vue Router + Element Plus（开发端口 5173，el-* 组件自动按需导入）
│   └── src/
│       ├── api/       请求封装（http.ts，统一 /api 前缀与错误处理）
│       ├── router/    路由配置
│       ├── stores/    Pinia store（按领域拆分，每个 ≤300 行，后续按模块创建）
│       ├── views/     页面级组件
│       └── components/ 通用组件
└── backend/           后端：Express + MySQL（移植自主版本 server/，端口 3000）
    ├── index.js       服务入口（已移除静态文件托管，仅提供 /api；CORS 白名单制）
    ├── routes/        9 个业务路由（categories/history/favorites/stats/study/memos/practice/mental/data）
    ├── schema.sql     建表脚本（与主版本共用同一个 MySQL 库）
    ├── scripts/       acceptance.js 全量验收脚本（npm run test:acceptance）
    └── .env.example   数据库/CORS 配置模板
```

## 启动方式

```bash
# 后端（先初始化数据库，首次执行）
cd backend
cp .env.example .env   # 按需修改数据库配置
npm install
npm run init-db        # 建库建表（幂等，可重复执行）
npm run dev            # 开发模式（node --watch，端口 3000）

# 前端（另开终端）
cd frontend
npm install
npm run dev            # 开发模式（端口 5173，/api 自动代理到 3000）
```

## 约定

- 前端所有请求走 `src/api/http.ts`，开发环境经 Vite proxy 转发 `/api` → `http://localhost:3000`
- 数据库与主版本共用库 `pomodoro-quiz-timer`（各自独立 `.env`，互不影响）
- 全部版本统一在 `main` 分支管理（2026-10-28 起，历史 `version-vue+node` 分支已并入并删除）；web-app 与主版本改动分开提交、不混提
- 编码规范见根目录 `docs/coding-standards.md` 第三/四/五章（Vue/TS/Pinia）

## 后端接口契约（前端对接必读）

- 错误响应统一 `{ error: '中文描述' }`；分页统一 `{ list, total, page, limit, totalPages }`
- 后端已于 2026-10-28 完成全量验收（91 通过/0 失败）：`cd backend && npm run test:acceptance`（需先启动后端；测试数据自动清理，「清空全部」类接口不执行以保护真实数据）
- CORS 白名单默认仅放行 `http://localhost:5173` 与 `http://127.0.0.1:5173`，通过 `backend/.env` 的 `CORS_ORIGINS` 调整（逗号分隔，`*` 全放行）；经 Vite proxy 同源访问时不受影响
- 关键增补接口：`GET /api/practice/banks/:id`、`POST/DELETE /api/practice/questions/batch`、`DELETE /api/practice/history/:id|/`、`DELETE /api/mental/history/:id|/`、`GET /api/study-daily/range`、`DELETE /api/study-daily?date=`
- mental 作答/跳过必传 `questionId`（practice 同）；题目批量导入/删除单次上限 500 题
