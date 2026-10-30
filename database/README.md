# database/ — 数据库一键初始化工具箱

> 用途：在新电脑上一键还原刷题计时器的 MySQL 数据库（建库建表 + 种子数据），
> 让分类、题库、题目、速算题开箱即用，不必重新录入或重跑导入工具。

## 一、文件说明

| 文件 | 说明 |
|------|------|
| `init-all.js` | 一键初始化脚本：建库建表 → 导入种子数据 → 校验行数 → 检查图片目录 |
| `seed-data.sql.gz` | 种子数据（mysqldump 导出，2026-10-30）：5 张基础表全量数据 |

**导入的 5 张表（基础数据）**：

| 表 | 内容 | 行数（导出时） |
|----|------|------|
| `categories` | 刷题分类-大类 | 7 |
| `category_subs` | 刷题分类-小类 | 48 |
| `question_banks` | 题库（含行测真题 9 库） | 17 |
| `questions` | 题目（含图片题、is_deleted 停用标记） | 27500 |
| `mental_questions` | 速算内置题 | 179 |

**不导入的 9 张用户数据表**（初始化后为空，正常使用时自动产生）：
`rounds`、`records`、`favorites`、`study_daily`、`memos`、`practice_sessions`、`practice_records`、`mental_sessions`、`mental_records`

## 二、使用步骤（新电脑加载数据库）

1. **前置条件**：已安装 Node.js 与 MySQL 8.x；mysql2 依赖可用（在 `web-app/backend` 或仓库根目录执行过 `npm install` 即可，脚本会自动探测两处的 node_modules）
2. **配置连接**：脚本按优先级读取 `database/.env` → `web-app/backend/.env` → 仓库根 `.env`（也可用环境变量覆盖）：
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=你的密码
   DB_NAME=pomodoro-quiz-timer
   ```
   密码只放 `.env`（已 gitignore），不要写进任何提交文件。
3. **执行初始化**（仓库根目录下）：
   ```bash
   node database/init-all.js
   ```
   脚本幂等可重复执行：建表用 `CREATE TABLE IF NOT EXISTS`，种子数据用 `REPLACE INTO` 按主键覆盖，不会删除做题记录等用户数据。
4. **拷贝行测图片（必须）**：数据库只存 `/qi-bank/...` 路径引用，图片实体在 `data/qi-images/`（约 256MB / 39461 张）。请从原电脑把 `data/qi-images` 整个目录拷贝到本仓库 `data/` 下，否则行测题目图片无法显示。脚本检测到缺失会打印 `[WARN]` 提示。

## 三、种子数据更新（源库数据变化后重新导出）

在有最新数据的电脑上执行（密码经 `MYSQL_PWD` 传入，不落命令行历史明文亦可改用交互输入）：

```bash
cd web-app/backend && export $(grep -E '^DB_' .env | tr -d '\r' | xargs)
MYSQL_PWD="$DB_PASSWORD" mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
  --no-create-info --replace --complete-insert --skip-add-locks --single-transaction \
  --default-character-set=utf8mb4 --hex-blob --set-gtid-purged=OFF \
  --result-file=../../database/seed-data.sql \
  "$DB_NAME" categories category_subs question_banks questions mental_questions
gzip -9 -k ../../database/seed-data.sql   # 覆盖 seed-data.sql.gz 后可删除未压缩文件
```

注意：导出以**当前库实际数据**为准（含手改的难度、分类等）；若想同时保留未压缩版，把 `seed-data.sql` 放在 `database/` 下即可，脚本优先读 `.sql`、其次读 `.sql.gz`。

## 四、常见问题

- **`未找到 mysql2 依赖`**：先在 `web-app/backend` 执行 `npm install`，或在仓库根目录执行 `npm install`
- **连接失败**：确认 MySQL 服务已启动、`.env` 中账号密码正确、库名一致
- **行测图片裂图**：检查 `data/qi-images` 是否拷贝完整（应含 `题目图/`、`公式图/` 等子目录，与 DB 中 `/qi-bank/<子目录>/<文件名>` 路径对应）
- **表结构变更口径**：结构以 `web-app/backend/schema.sql`（与 `server/schema.sql` 同步维护）为唯一来源，本工具箱只负责执行，不重复维护建表语句
