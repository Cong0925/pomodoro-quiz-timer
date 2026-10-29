/* ============================================================
 * tools/import-xingce/config.js
 * 行测真题仓库 → 本地题库 解析导入 配置
 * 图片路径规范：数据库存 Web 相对 URL `/qi-bank/...`，部署无关
 * ============================================================ */
const path = require('path');

module.exports = {
  /* 源仓库根目录（只读） */
  SRC_ROOT: path.join(__dirname, '..', '..', 'xingcezhenti-main'),
  /* 图片库物理目录（data/qi-images，static 映射 /qi-bank） */
  IMG_ROOT: path.join(__dirname, '..', '..', 'data', 'qi-images'),
  /* 数据库图片 URL 前缀（与后端静态映射一致，部署无关） */
  IMG_URL_PREFIX: '/qi-bank',

  /* 模块 → 题库/sub 映射（非判断推理：一模块一题库；判断推理按题型标签拆 4 个） */
  MODULES: [
    { dir: '01-政治理论',     bank: '行测真题·政治理论', sub: 'gk-zz' },
    { dir: '02-常识判断',     bank: '行测真题·常识判断', sub: 'gk-cs' },
    { dir: '03-言语理解与表达', bank: '行测真题·言语理解', sub: 'gk-yy' },
    { dir: '04-数量关系',     bank: '行测真题·数量关系', sub: 'gk-sl' },
    { dir: '05-判断推理',     bank: null, sub: null, splitByType: true },
    { dir: '06-资料分析',     bank: '行测真题·资料分析', sub: 'gk-zl' },
  ],

  /* 判断推理：题型标签 → 题库/sub（md 标题 <sub>qid xxx · 题型</sub>） */
  PD_TYPE_MAP: {
    '图形推理': { bank: '行测真题·图形推理', sub: 'gk-tx' },
    '定义判断': { bank: '行测真题·定义判断', sub: 'gk-dy' },
    '类比推理': { bank: '行测真题·类比推理', sub: 'gk-bl' },
    '逻辑判断': { bank: '行测真题·逻辑判断', sub: 'gk-lj' },
  },
  PD_DEFAULT_BANK: '行测真题·逻辑判断', // 未识别题型兜底

  /* MySQL 连接（复用 web-app backend 配置；密码只从环境变量读取，禁止明文入库） */
  DB: { host: 'localhost', port: 3306, user: 'root', password: process.env.DB_PASSWORD || '', database: 'pomodoro-quiz-timer', charset: 'utf8mb4' },

  /* 导入行为 */
  BATCH: 500,                 // 每批插入条数
  CLEAN_IMPORTED_FIRST: true, // 重跑时先清空本工具导入的题库题目（按 bank 名前缀识别），幂等
  PROGRESS_FILE: path.join(__dirname, 'logs', 'progress.json'),
  LOG_FILE: path.join(__dirname, 'logs', 'import.log'),
};
