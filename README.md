# 刷题计时器（MySQL 版）

双模式刷题计时 + 历史记录 + 错题收藏 + 学习统计 + 日历备忘。数据全部存储在本地 MySQL 数据库，前端通过 Node 后端接口读写，数据再多也不卡顿。

## 一、怎么启动（日常使用）

双击 `启动.bat`，它会自动：
1. 安装依赖（第一次）
2. 启动后端服务（端口 3000）
3. 打开浏览器进入 `http://localhost:3000`

> 提示：如果双击后浏览器没打开，手动访问 http://localhost:3000 即可。
> 服务窗口请不要关闭，关掉它就等于关掉了程序。停止服务用「停止服务.bat」。

## 二、数据库账号密码在哪里改

配置文件：`.env`（本项目根目录下；`.env.example` 是模板，新电脑复制它改名为 `.env`）

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的数据库密码
DB_NAME=pomodoro-quiz-timer
PORT=3000
```

以后改 MySQL 账号密码，只改这个文件即可，不用动其他任何东西。**`.env` 已在 .gitignore 中，不会上传到 GitHub，密码不会泄露。**

## 三、日常备份与恢复

| 命令 | 作用 |
| --- | --- |
| `npm run backup` | 一键把全部数据导出为 `data/backup-日期.json`（含历史/收藏/分类/学习/备忘） |
| `npm run restore <备份文件>` | 从备份文件恢复数据（导入前自动先备份当前库，防止误操作） |
| 页面「设置 → 本地化保存 → 保存 JSON」 | 在界面上直接下载备份文件到本地 |
| 页面「设置 → 本地化保存 → 导入 JSON」 | 在界面上选择备份文件导入 |

建议每周执行一次 `npm run backup` 或从页面保存一份 JSON。

## 四、迁移到新电脑（完整步骤）

> 前提：新电脑已安装 **Node.js**（LTS 版）和 **MySQL**，并已创建好数据库账号（root 或自建账号均可）。

1. **旧电脑导出数据**：在旧电脑项目目录执行 `npm run backup`，得到 `data/backup-日期.json`。
2. **把备份文件带到新电脑**：通过网盘 / U盘 / 微信等方式传输（备份文件含个人数据，不要传到公开仓库）。
3. **获取代码**：从 GitHub 下载或 `git clone` 本项目到新电脑。
4. **配置数据库**：复制 `.env.example` 为 `.env`，把 `DB_USER` / `DB_PASSWORD` 改成新电脑 MySQL 的账号密码（库名保持 `pomodoro-quiz-timer` 即可，脚本会自动创建）。
5. **安装依赖**：`npm install`。
6. **建库建表**：`npm run init-db`（自动创建数据库和 7 张表，可重复执行）。
7. **恢复数据**：把备份文件放进项目 `data/` 目录，执行 `npm run restore data/backup-日期.json`。
8. **启动**：双击 `启动.bat`，浏览器打开 http://localhost:3000，数据全部就位。

> 提示：`data/` 目录已被 .gitignore 排除，备份文件不会误传到 GitHub；新电脑上用上述步骤导入即可。

## 五、旧项目数据迁移（首次从旧版 JSON 导入）

仅当你有旧版刷题计时器的 `data.json` 需要导入时才用：

```
npm run migrate 旧data.json路径 -- --force
```

- 库中已有数据时默认拒绝，加 `--force` 会先自动备份当前库再替换。
- 分类会合并，历史/收藏以文件为准，学习时长按日取较大值，备忘按日覆盖。

## 六、命令速查

| 命令 | 作用 |
| --- | --- |
| `npm start` | 启动后端服务 |
| `npm run init-db` | 建库建表（幂等，可重复执行） |
| `npm run backup` | 备份全部数据到 data/ 目录 |
| `npm run restore <文件>` | 从备份文件恢复 |
| `npm run migrate <文件> -- --force` | 从旧版 data.json 导入 |

## 七、目录结构

```
├─ server/              后端（Node + Express + MySQL）
│  ├─ index.js          服务入口
│  ├─ schema.sql        建表 SQL（7 张表）
│  ├─ init-db.js        初始化建库建表脚本
│  ├─ backup.js         一键备份脚本
│  ├─ restore.js        一键恢复脚本
│  ├─ migrate.js        旧数据迁移脚本
│  ├─ exportData.js     数据导出公共模块
│  ├─ importData.js     数据导入核心逻辑
│  └─ routes/           API 路由（分类/历史/收藏/统计/备忘/导出导入）
├─ public/              前端（纯 HTML/CSS/JS，浏览器直接运行）
│  ├─ index.html
│  ├─ css/style.css
│  └─ js/
│     ├─ core/          工具、API 封装、数据层
│     └─ modules/       分类/计时/历史/收藏/统计/日历/设置/悬浮窗模块
├─ .env                 数据库配置（改这里；已被 gitignore，不会上传）
├─ .env.example         配置模板（新电脑复制为 .env）
├─ .gitignore           已排除 .env / node_modules / data（数据与密码不上传）
├─ 启动.bat             一键启动（自动装依赖 + 起服务 + 开浏览器）
└─ 停止服务.bat         一键停止
```

## 八、常见问题

- **页面提示"连接后端失败"**：服务没启动，双击「启动.bat」。
- **改过 MySQL 密码后连不上**：把新密码填到 `.env` 的 `DB_PASSWORD`，然后重启服务。
- **想要换端口**：改 `.env` 的 `PORT`。
- **新电脑 restore 报连接失败**：检查 `.env` 账号密码、MySQL 服务是否启动、`npm run init-db` 是否已执行。
