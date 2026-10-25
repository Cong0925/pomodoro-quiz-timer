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

-- ============================================================
-- 扩展预留说明（后续按需追加，不影响现有表）：
--  · 若要支持"历史软删除"，可给 rounds 增加 deleted_at DATETIME NULL
--  · 若要支持"一天多条备忘"，可把 memos 主键改为自增 id + memo_date 索引
--  · 若要支持用户/多端，可增加 users 表并给业务表加 user_id 外键
-- ============================================================
