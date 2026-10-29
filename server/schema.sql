-- ============================================================
-- 刷题计时器 - MySQL 建表脚本
-- 数据库：`pomodoro-quiz-timer`（utf8mb4）
-- 执行方式：先在 DBeaver 中执行建库语句，再执行本脚本；
--           或直接运行  npm run init-db （会自动建库 + 建表）
-- ============================================================

CREATE DATABASE IF NOT EXISTS `pomodoro-quiz-timer`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `pomodoro-quiz-timer`;

-- ------------------------------------------------------------
-- 1. categories 刷题分类-大类
--    对应原 data.json 的 categories 顶层（如 公务员考试 / 考研 …）
--    id 保留原 ID（如 gk / ky），迁移不改变，便于历史数据对齐
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          VARCHAR(32)  NOT NULL                COMMENT '大类ID（保留原ID，如 gk）',
    name        VARCHAR(100) NOT NULL                COMMENT '大类名称',
    builtin     TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '是否内置分类 1=内置 0=自定义',
    sort_order  INT          NOT NULL DEFAULT 0      COMMENT '排序权重，越小越靠前',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='刷题分类-大类';

-- ------------------------------------------------------------
-- 2. category_subs 刷题分类-小类
--    对应原 categories[].subs（如 言语理解 / 图形推理 …）
--    删除大类时级联删除其小类
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category_subs (
    id          VARCHAR(64)  NOT NULL                COMMENT '小类ID（保留原ID，如 gk-yy）',
    cat_id      VARCHAR(32)  NOT NULL                COMMENT '所属大类ID',
    name        VARCHAR(100) NOT NULL                COMMENT '小类名称',
    sort_order  INT          NOT NULL DEFAULT 0      COMMENT '排序权重，越小越靠前',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_cat_id (cat_id),
    CONSTRAINT fk_sub_cat FOREIGN KEY (cat_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='刷题分类-小类';

-- ------------------------------------------------------------
-- 3. rounds 历史轮次（每完成一整轮刷题归档一条）
--    对应原 data.json 的 history[]。
--    - id 保留原 JSON 的 id（Date.now() 数字），迁移不断链
--    - cat_id/sub_id 存 ID 引用，cat_name/sub_name 存名称快照：
--      分类被重命名/删除后，历史仍显示归档时的名称
--    - finished_at 为归档时间（原 date 字段）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rounds (
    id           BIGINT       NOT NULL               COMMENT '轮次ID（保留原JSON的id）',
    mode         VARCHAR(10)  NOT NULL DEFAULT 'single' COMMENT '模式 single=单题 batch=整组',
    mode_name    VARCHAR(20)  NOT NULL DEFAULT ''    COMMENT '模式显示名（单题模式/整组模式）',
    title        VARCHAR(100) NOT NULL DEFAULT ''    COMMENT '轮次标题',
    description  VARCHAR(255) NOT NULL DEFAULT ''    COMMENT '轮次描述（原 desc 字段）',
    finished_at  DATETIME     NOT NULL               COMMENT '归档时间（原 date）',
    max_count    INT          NOT NULL DEFAULT 20    COMMENT '本轮计划题量',
    total_ms     BIGINT       NOT NULL DEFAULT 0     COMMENT '本轮总用时（毫秒）',
    correct      INT          NOT NULL DEFAULT 0     COMMENT '答对题数',
    rate         DECIMAL(5,1) NOT NULL DEFAULT 0     COMMENT '正确率（%，1位小数）',
    cat_id       VARCHAR(32)  NULL                   COMMENT '大类ID（快照）',
    cat_name     VARCHAR(100) NULL                   COMMENT '大类名称快照',
    sub_id       VARCHAR(64)  NULL                   COMMENT '小类ID（快照）',
    sub_name     VARCHAR(100) NULL                   COMMENT '小类名称快照',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_finished_at (finished_at),
    KEY idx_mode (mode),
    KEY idx_cat (cat_id),
    KEY idx_sub (sub_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='历史轮次（每轮刷题）';

-- ------------------------------------------------------------
-- 4. records 题目明细（每轮的每题一条）
--    对应原 rounds.records[]，通过 round_id 关联轮次
--    result: ok=做对 ng=做错
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS records (
    id         BIGINT       NOT NULL AUTO_INCREMENT  COMMENT '自增主键',
    round_id   BIGINT       NOT NULL                COMMENT '所属轮次ID',
    no         INT          NOT NULL                COMMENT '题号（从1开始）',
    ms         BIGINT       NOT NULL DEFAULT 0      COMMENT '本题用时（毫秒）',
    cum_ms     BIGINT       NOT NULL DEFAULT 0      COMMENT '累计用时（毫秒）',
    time_str   VARCHAR(12)  NOT NULL DEFAULT ''     COMMENT '用时显示 mm:ss.xx',
    result     VARCHAR(4)   NOT NULL DEFAULT 'ok'   COMMENT 'ok=对 ng=错 skip=没做',
    note       VARCHAR(255)          DEFAULT NULL   COMMENT '题目知识点描述（可修改）',
    created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_round_no (round_id, no),
    CONSTRAINT fk_rec_round FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='轮次题目明细';

-- ------------------------------------------------------------
-- 5. favorites 错题收藏
--    对应原 data.json 的 favorites[]。
--    - round_id + no 关联到来源轮次的某道题
--    - 删除历史轮次时收藏级联删除（错题来源消失，收藏无意义）
--    - title/time_str/cat_* 为快照，独立于轮次变化
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    id           BIGINT       NOT NULL               COMMENT '收藏ID（保留原ID）',
    round_id     BIGINT       NOT NULL               COMMENT '来源轮次ID',
    no           INT          NOT NULL               COMMENT '题号',
    title        VARCHAR(100) NOT NULL DEFAULT ''    COMMENT '所属轮次标题（快照）',
    mode         VARCHAR(10)  NOT NULL DEFAULT 'single' COMMENT '模式',
    mode_name    VARCHAR(20)  NOT NULL DEFAULT '单题模式' COMMENT '模式显示名',
    time_str     VARCHAR(12)  NOT NULL DEFAULT ''    COMMENT '该题用时 mm:ss.xx',
    collected_at DATETIME     NOT NULL               COMMENT '收藏时间',
    cat_id       VARCHAR(32)  NULL                   COMMENT '大类ID（快照）',
    cat_name     VARCHAR(100) NULL                   COMMENT '大类名称快照',
    sub_id       VARCHAR(64)  NULL                   COMMENT '小类ID（快照）',
    sub_name     VARCHAR(100) NULL                   COMMENT '小类名称快照',
    created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_round_no (round_id, no),
    KEY idx_collected_at (collected_at),
    KEY idx_cat (cat_id),
    CONSTRAINT fk_fav_round FOREIGN KEY (round_id) REFERENCES rounds (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='错题收藏';

-- ------------------------------------------------------------
-- 6. study_daily 每日学习时长
--    对应原 data.json 的 studyDaily {'YYYY-MM-DD': ms}
--    学习时长 = 右下角悬浮窗手动计时（开始 / 暂停，按日累计）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_daily (
    study_date DATE       NOT NULL                COMMENT '日期',
    ms         BIGINT     NOT NULL DEFAULT 0      COMMENT '学习时长（毫秒）',
    created_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (study_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日学习时长';

-- ------------------------------------------------------------
-- 7. memos 日历备忘
--    对应原 data.json 的 memos {'YYYY-MM-DD': {type,title,text}}
--    一天一条备忘，按日期 upsert；type 取预定义枚举值
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS memos (
    memo_date  DATE       NOT NULL                COMMENT '备忘日期',
    type       VARCHAR(20) NOT NULL DEFAULT 'other' COMMENT '类型 exam/meeting/study/sport/birthday/travel/other',
    title      VARCHAR(20) NOT NULL DEFAULT ''    COMMENT '标题（限4字）',
    content    TEXT       NULL                    COMMENT '备忘详细内容',
    created_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (memo_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='日历备忘';

-- ------------------------------------------------------------
-- 8. question_banks 练习题库
--    某分类（大类/小类）下的题目集合，如"公务员考试-资料分析"
--    cat_id/sub_id 引用 categories / category_subs（删除分类不级联题库，
--    由前端管理端约束；题库可独立命名跨分类使用）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS question_banks (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '题库ID',
    name        VARCHAR(100) NOT NULL                COMMENT '题库名称',
    cat_id      VARCHAR(32)  NULL                    COMMENT '关联大类ID',
    sub_id      VARCHAR(64)  NULL                    COMMENT '关联小类ID',
    description VARCHAR(255) NOT NULL DEFAULT ''     COMMENT '题库描述',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_cat (cat_id),
    KEY idx_sub (sub_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='练习题库';

-- ------------------------------------------------------------
-- 9. questions 题目
--    type: single=单选 multi=多选 judge=判断
--    options 存 JSON：[{label:'A',text:'...'}, ...]；判断题为 ['正确','错误'] 或空
--    answer：单选 'A' / 多选 'AB' / 判断 'T'|'F'
--    stem_img 存 JSON 数组（base64 data URL 内嵌）：图形推理等图片题题干多图，如 ["data:image/png;base64,..."]
--    options[].img 存选项图片 base64 data URL（文字+图片可混合）
--    删除题库时级联删除题目；删除题目不影响练习历史（practice_records 存题号快照）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '题目ID',
    bank_id     BIGINT       NOT NULL                COMMENT '所属题库ID',
    type        VARCHAR(10)  NOT NULL DEFAULT 'single' COMMENT '题型 single/multi/judge',
    stem        TEXT         NOT NULL                COMMENT '题干',
    stem_img    JSON         NULL                    COMMENT '题干图片(base64数组，图推多图)',
    options     JSON         NULL                    COMMENT '选项JSON',
    answer      VARCHAR(50)  NOT NULL                COMMENT '正确答案',
    analysis    TEXT         NULL                    COMMENT '答案解析',
    difficulty  TINYINT      NOT NULL DEFAULT 2      COMMENT '难度 1易 2中 3难',
    source      VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '题目来源（可选）',
    is_deleted  TINYINT(1)   NOT NULL DEFAULT 0      COMMENT '逻辑删除/停用 0=正常 1=已停用(软删,可恢复)',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_bank (bank_id),
    CONSTRAINT fk_q_bank FOREIGN KEY (bank_id) REFERENCES question_banks (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='练习题目';

-- ------------------------------------------------------------
-- 10. practice_sessions 练习会话（一次练习 = 类似 rounds）
--     cat_id/cat_name/sub_id/sub_name 存分类快照（分类改名/删除不影响历史）
--     mode: order=顺序 random=随机 review=错题重练
--     rate: 正确率 = 答对数 / 全部题数（跳过计错，与计时模式口径一致）
--     bank_id 不设外键：题库删除后历史记录仍保留
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS practice_sessions (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '会话ID',
    bank_id       BIGINT       NOT NULL                COMMENT '题库ID（不设外键，保留历史）',
    bank_name     VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '题库名称快照',
    mode          VARCHAR(10)  NOT NULL DEFAULT 'order' COMMENT 'order/random/review',
    total_count   INT          NOT NULL DEFAULT 0      COMMENT '本轮题量',
    done_count    INT          NOT NULL DEFAULT 0      COMMENT '已作答题数（对+错，不含跳过）',
    correct_count INT          NOT NULL DEFAULT 0      COMMENT '答对题数',
    wrong_count   INT          NOT NULL DEFAULT 0      COMMENT '答错题数',
    skipped_count INT          NOT NULL DEFAULT 0      COMMENT '跳过题数',
    rate          DECIMAL(5,1) NOT NULL DEFAULT 0      COMMENT '正确率（%，1位小数）',
    total_ms      BIGINT       NOT NULL DEFAULT 0      COMMENT '总用时（毫秒）',
    cat_id        VARCHAR(32)  NULL                    COMMENT '大类ID快照',
    cat_name      VARCHAR(100) NULL                    COMMENT '大类名称快照',
    sub_id        VARCHAR(64)  NULL                    COMMENT '小类ID快照',
    sub_name      VARCHAR(100) NULL                    COMMENT '小类名称快照',
    started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    finished_at   DATETIME     NULL                    COMMENT '结束时间',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_bank (bank_id),
    KEY idx_finished (finished_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='练习会话';

-- ------------------------------------------------------------
-- 11. practice_records 练习明细（每题一条）
--     user_answer 作答内容；NULL=未答（跳过）
--     result: ok=对 ng=错 skip=跳过
--     question_id 不设外键：题目删除后练习明细仍保留（历史可回看题干快照存于客户端渲染）
--     会话删除时级联删除明细
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS practice_records (
    id          BIGINT   NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    session_id  BIGINT   NOT NULL                COMMENT '所属会话ID',
    question_id BIGINT   NOT NULL                COMMENT '题目ID（不设外键）',
    no          INT      NOT NULL                COMMENT '题号（从1开始）',
    user_answer VARCHAR(50) NULL                 COMMENT '作答（NULL=未答）',
    result      VARCHAR(4) NOT NULL DEFAULT 'ok' COMMENT 'ok=对 ng=错 skip=跳过',
    ms          BIGINT   NOT NULL DEFAULT 0      COMMENT '本题用时（毫秒）',
    answered_at DATETIME NULL                    COMMENT '作答时间',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_session_no (session_id, no),
    KEY idx_question (question_id),
    CONSTRAINT fk_pr_session FOREIGN KEY (session_id) REFERENCES practice_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='练习明细';

-- ------------------------------------------------------------
-- 12. mental_questions 速算题目（系统内置题库）
--    qtype: percent=百化分 compare=分数比大小 estimate=估算值
--    options 存 JSON 数组 [{text:"..."}]：比大小 2 项，其余 4 项
--    answer 存正确选项下标（0/1/2/3）
--    tip 为速算技巧提示（答题即时反馈的核心内容）
--    题目由系统预置（mentalQuestions.js 种子），用户不自行录入
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mental_questions (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '题目ID',
    qtype       VARCHAR(16)  NOT NULL COMMENT '题型 percent=百化分 compare=分数比大小 estimate=估算值',
    difficulty  TINYINT      NOT NULL DEFAULT 2 COMMENT '难度 1易 2中 3难',
    stem        TEXT         NOT NULL COMMENT '题干（分数/百分数/算式文本）',
    options     JSON         NOT NULL COMMENT '选项JSON [{text:"..."}]',
    answer      VARCHAR(50)  NOT NULL COMMENT '正确选项下标(0/1/2/3)',
    tip         TEXT         NOT NULL COMMENT '速算技巧提示/解析',
    tag         VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '技巧标签（如 百化分-1/7 / 交叉相乘）',
    active      TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '是否启用 1=启用 0=停用',
    fillable    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否可填空 1=常规几分之一型（仅百化分） 0=仅选择题',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_qtype (qtype),
    KEY idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='速算题目（系统内置）';

-- ------------------------------------------------------------
-- 13. mental_sessions 速算练习会话
--    qtype: percent/compare/estimate/mixed（mixed=综合混练）
--    rate 口径与练习模式一致：答对 / 全部题数，跳过计错
--    difficulty 记录本次难度筛选（0=不限）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mental_sessions (
    id            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '会话ID',
    qtype         VARCHAR(16)  NOT NULL COMMENT '题型 percent/compare/estimate/mixed',
    qtype_name    VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '题型显示名快照（百化分/分数比大小/估算值/综合练习）',
    difficulty    TINYINT      NOT NULL DEFAULT 0 COMMENT '难度筛选 0不限 1易 2中 3难',
    answer_mode   VARCHAR(8)   NOT NULL DEFAULT 'choice' COMMENT '做题类型 choice=选择题 fill=填空题',
    total_count   INT          NOT NULL DEFAULT 0 COMMENT '本轮题量',
    done_count    INT          NOT NULL DEFAULT 0 COMMENT '已作答（对+错，不含跳过）',
    correct_count INT          NOT NULL DEFAULT 0 COMMENT '答对题数',
    wrong_count   INT          NOT NULL DEFAULT 0 COMMENT '答错题数',
    skipped_count INT          NOT NULL DEFAULT 0 COMMENT '跳过题数',
    rate          DECIMAL(5,1) NOT NULL DEFAULT 0 COMMENT '正确率（%，1位小数）',
    total_ms      BIGINT       NOT NULL DEFAULT 0 COMMENT '总用时（毫秒）',
    started_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '开始时间',
    finished_at   DATETIME     NULL COMMENT '结束时间',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    KEY idx_qtype (qtype),
    KEY idx_finished (finished_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='速算练习会话';

-- ------------------------------------------------------------
-- 14. mental_records 速算练习明细（带题目快照）
--    快照 stem/options/answer/tip：题目后续调整/删除不影响历史回看
--    result: ok=对 ng=错 skip=跳过；user_answer 存选项下标，NULL=跳过
--    会话删除时级联删除明细
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mental_records (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '自增主键',
    session_id  BIGINT       NOT NULL COMMENT '所属会话ID',
    question_id BIGINT       NOT NULL COMMENT '题目ID（不设外键，保留历史）',
    no          INT          NOT NULL COMMENT '题号（从1开始）',
    qtype       VARCHAR(16)  NOT NULL DEFAULT '' COMMENT '题型快照',
    stem        TEXT         NOT NULL COMMENT '题干快照',
    options     JSON         NOT NULL COMMENT '选项快照',
    answer      VARCHAR(50)  NOT NULL DEFAULT '' COMMENT '正确答案下标快照',
    tip         TEXT         NOT NULL COMMENT '技巧提示快照',
    user_answer VARCHAR(50)  NULL COMMENT '用户作答下标（NULL=跳过）',
    result      VARCHAR(4)   NOT NULL DEFAULT 'ok' COMMENT 'ok=对 ng=错 skip=跳过',
    ms          BIGINT       NOT NULL DEFAULT 0 COMMENT '本题用时（毫秒）',
    answered_at DATETIME     NULL COMMENT '作答时间',
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_session_no (session_id, no),
    CONSTRAINT fk_mrec_session FOREIGN KEY (session_id) REFERENCES mental_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='速算练习明细（题目快照）';

-- ============================================================
-- 扩展预留说明（后续按需追加，不影响现有表）：
--  · 若要支持"历史软删除"，可给 rounds 增加 deleted_at DATETIME NULL
--  · 若要支持"一天多条备忘"，可把 memos 主键改为自增 id + memo_date 索引
--  · 若要支持用户/多端，可增加 users 表并给业务表加 user_id 外键
-- ============================================================

-- ============================================================
-- 迁移段（幂等）：为已存在的旧表补充新列
-- 通过 information_schema 检查，列不存在时才 ALTER，可重复执行
-- ============================================================
SET @c1 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mental_questions' AND column_name = 'fillable');
SET @s1 := IF(@c1 = 0, 'ALTER TABLE mental_questions ADD COLUMN fillable TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''是否可填空 1=常规几分之一型（仅百化分） 0=仅选择题'' AFTER active', 'SELECT 1');
PREPARE st1 FROM @s1; EXECUTE st1; DEALLOCATE PREPARE st1;

SET @c2 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'mental_sessions' AND column_name = 'answer_mode');
SET @s2 := IF(@c2 = 0, 'ALTER TABLE mental_sessions ADD COLUMN answer_mode VARCHAR(8) NOT NULL DEFAULT ''choice'' COMMENT ''做题类型 choice=选择题 fill=填空题'' AFTER difficulty', 'SELECT 1');
PREPARE st2 FROM @s2; EXECUTE st2; DEALLOCATE PREPARE st2;

SET @c3 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'questions' AND column_name = 'stem_img');
SET @s3 := IF(@c3 = 0, 'ALTER TABLE questions ADD COLUMN stem_img JSON NULL COMMENT ''题干图片(base64数组，图推多图)'' AFTER stem', 'SELECT 1');
PREPARE st3 FROM @s3; EXECUTE st3; DEALLOCATE PREPARE st3;

SET @c4 := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'questions' AND column_name = 'is_deleted');
SET @s4 := IF(@c4 = 0, 'ALTER TABLE questions ADD COLUMN is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''逻辑删除/停用 0=正常 1=已停用(软删,可恢复)'' AFTER source', 'SELECT 1');
PREPARE st4 FROM @s4; EXECUTE st4; DEALLOCATE PREPARE st4;
