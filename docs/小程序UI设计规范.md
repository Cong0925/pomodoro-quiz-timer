---
description: 小程序 UI 设计规范：Bento 数据现代 + 玻璃浮层，含设计 token、组件、页面蓝图、动效与验收清单
created: 2026-11-08
last_modified: 2026-11-08
---

# 小程序 UI 设计规范（V1）

> 适用版本：`uni-app/`（微信小程序）
> 设计方向：**A · Bento 数据现代 + 玻璃浮层**
> 目标：去掉「渐变头图 + 白卡片」的模板感，建立可复用、可验收、可落地的品牌化视觉系统。
> 原则：所有视觉决策必须能追溯到本规范的 token、组件或参考手法，禁止页面内临时拍脑袋写样式。

---

## 一、设计目标与判断标准

### 1.1 三个必须达到的观感

1. **一眼不像模板**：同一套语言贯穿全端，但每页有独立场景记忆点（计时是「环」、练习是「题卡」、速算是「题型色块」、记录是「时间轴」）。
2. **数据有主角**：每个页面只有一个视觉焦点，大数字/进度环优先，说明文字退后。
3. **动效有节制**：只做「按压、入场、进度、切换」四类，时长 150–320ms，不做炫技式长时间动画。

### 1.2 旧版问题（改造对照）

| 旧做法 | 问题 | 新规范 |
|---|---|---|
| 每页统一渐变 Hero | 同质化、滑动无场景切换 | Hero 只保留首页/模块入口，内页用「页头 + 内容」轻量结构 |
| 白卡片 + 0.06 阴影 | 层级平、像后台 | Bento 大小卡混排 + 三级阴影 + 柔光背景 |
| 正文 28 / 标题 34 | 字号节奏单一 | Display / H1 / H2 / Body / Caption 六级阶梯 |
| 系统 `showActionSheet` 选对错/模式 | 观感廉价、不可定制 | 圆角 Bottom Sheet + 大号选项卡 |
| 只有数字块 + 细柱图 | 缺激励反馈 | 进度环、连续打卡、7 日热力条、结算环 |
| 卡片内边距 24rpx | 局促 | 卡片内边距 32rpx，区块间距 56rpx |

---

## 二、色彩系统

### 2.1 品牌与功能色

| Token | 色值 | 用途 |
|---|---|---|
| `$ink` | `#0F172A` | 主文字、深色底 |
| `$ink-2` | `#475467` | 次级文字 |
| `$ink-3` | `#98A2B3` | 弱文字、占位 |
| `$brand-500` | `#4F86FF` | 主色亮部 |
| `$brand-600` | `#2F6BFF` | 主色（按钮/强调） |
| `$brand-700` | `#1D4ED8` | 渐变末端、按下态 |
| `$brand-50` | `#EEF4FF` | 选中底、浅色标签 |
| `$mint` | `#14B8A6` | 正确、学习时长、辅助强调 |
| `$coral` | `#FF6B6B` | 错误、危险操作 |
| `$amber` | `#FFB020` | 跳过、连续打卡、警示 |
| `$success` | `#12B76A` | 答对 |
| `$danger` | `#F04438` | 答错、删除 |
| `$warning` | `#F79009` | 跳过、注意 |

### 2.2 中性与背景

| Token | 色值 | 用途 |
|---|---|---|
| `$bg-page` | `#F6F8FC` | 页面底色（浅蓝灰，不用纯白） |
| `$bg-card` | `#FFFFFF` | 卡片 |
| `$bg-soft` | `#F1F5FB` | 次级底、分段控件槽 |
| `$line` | `#E8EEF7` | 分割线、描边 |
| `$line-strong` | `#D7E0EE` | 强调描边 |

> 禁止纯 `#000000` 正文；禁止大面积紫色/靛蓝渐变（品牌主色固定蓝系，辅色只用薄荷/珊瑚/琥珀）。

### 2.3 渐变

```scss
/* 品牌主渐变：用于主按钮、进度环、选中态 */
$grad-brand: linear-gradient(135deg, #5B8CFF 0%, #2F6BFF 52%, #1D4ED8 100%);

/* 柔光极光底：首页/计时页顶部环境光，用大半径 radial 叠加 */
$grad-aurora:
  radial-gradient(120% 90% at 8% 0%, rgba(47, 107, 255, 0.18) 0%, rgba(47, 107, 255, 0) 58%),
  radial-gradient(90% 70% at 100% 8%, rgba(45, 212, 191, 0.14) 0%, rgba(45, 212, 191, 0) 55%),
  radial-gradient(80% 60% at 50% 100%, rgba(255, 176, 32, 0.10) 0%, rgba(255, 176, 32, 0) 60%),
  #F6F8FC;

/* 题型色块（速算四类，低饱和底 + 高饱和字） */
$tile-blue:   linear-gradient(135deg, #EAF1FF, #DCE9FF);
$tile-mint:   linear-gradient(135deg, #E6FAF6, #D5F5EE);
$tile-coral:  linear-gradient(135deg, #FFEDEC, #FFE1DF);
$tile-amber:  linear-gradient(135deg, #FFF5E2, #FFECC7);
```

### 2.4 玻璃浮层配方（自定义 tabBar / 底部抽屉 / 顶部浮动条）

```scss
/* 首选：真磨砂 */
.glass {
  background: linear-gradient(180deg, rgba(255,255,255,.88), rgba(255,255,255,.72));
  border: 1rpx solid rgba(255,255,255,.72);
  backdrop-filter: blur(24rpx) saturate(160%);
  -webkit-backdrop-filter: blur(24rpx) saturate(160%);
  box-shadow: 0 12rpx 40rpx rgba(15, 23, 42, .10);
}

/* 降级：微信部分机型不支持 backdrop-filter，用高不透明底 + 顶部高光模拟 */
.glass-fallback {
  background: rgba(255, 255, 255, .94);
  border: 1rpx solid rgba(255, 255, 255, .8);
  box-shadow: 0 12rpx 40rpx rgba(15, 23, 42, .10);
}
```

> 实现要求：`backdrop-filter` 只允许用在**小面积浮层**（tabBar、抽屉、浮动头），禁止铺满全屏；低端安卓统一走降级样式。

---

## 三、字体与字号

### 3.1 字体栈

```scss
$font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC",
              "HarmonyOS Sans", "Microsoft YaHei", sans-serif;
```

- 全端不引入外部字体文件，保证包体与加载速度。
- 所有数字使用 `font-variant-numeric: tabular-nums;`，避免计时/统计跳动。

### 3.2 字号阶梯（rpx）

| 级别 | 字号/行高 | 字重 | 用途 |
|---|---|---|---|
| Display | 112 / 1.1 | 800 | 计时大数字（唯一使用场景） |
| H1 | 56 / 1.2 | 800 | 页面主标题 |
| H2 | 40 / 1.3 | 700 | 区块标题、结算分数 |
| H3 | 32 / 1.4 | 600 | 卡片标题 |
| Body | 28 / 1.55 | 400 | 正文、选项 |
| Caption | 24 / 1.5 | 500 | 辅助说明、标签 |
| Micro | 20 / 1.4 | 600 | 角标、单位、极小注 |

- 大标题字距 `letter-spacing: -0.5rpx`；正文不加字距。
- 一屏最多出现 1 个 H1 + 2 个 H2；其余降级，避免层级打架。

---

## 四、间距与栅格

- 基准网格：**8rpx**。
- 页面左右留白：`40rpx`。
- 区块间距：`56rpx`（旧版 32rpx 偏挤）。
- 卡片内边距：`32rpx`（紧凑卡 `24rpx`，仅用于列表行）。
- 卡片间距：`20rpx`。
- 行内元素间距：`16rpx`。
- 最小可点击高度：`88rpx`。
- 底部为自定义 tabBar 留白：`190rpx`；结算/答题页 sticky 操作条另加 `env(safe-area-inset-bottom)`。

### Bento 栅格

- 两列等宽，列间距 `20rpx`；`span-2` 跨全宽。
- 主卡（环形进度/大数字）建议占 `2/3` 宽或整行，副卡做 `1/3` 竖排两枚。
- 同屏卡片高度差不超过 2 档，避免「高低参差」但不形成节奏。

---

## 五、圆角、阴影与层级

| Token | 值 | 用途 |
|---|---|---|
| `$radius-xs` | 12rpx | 小标签、角标 |
| `$radius-sm` | 20rpx | 输入框、次级块 |
| `$radius-md` | 28rpx | 按钮、普通卡片 |
| `$radius-lg` | 40rpx | Bento 主卡、Hero |
| `$radius-sheet` | 48rpx 48rpx 0 0 | 底部抽屉 |
| `$radius-full` | 999rpx | chip、头像、tabBar 胶囊 |

| 阴影 | 值 | 用途 |
|---|---|---|
| L1 | `0 6rpx 20rpx rgba(15,23,42,.05)` | 列表行、次级卡 |
| L2 | `0 14rpx 36rpx rgba(15,23,42,.08)` | 主卡、浮层 |
| L3 | `0 24rpx 60rpx rgba(15,23,42,.14)` | 抽屉、tabBar |
| Glow | `0 12rpx 32rpx rgba(47,107,255,.28)` | 主按钮、激活态 |

> 禁止给每张卡都叠三层阴影；同屏只允许一个 L3 浮层。描边只在需要界定边界时使用 `1rpx $line`。

---

## 六、核心组件规范

### 6.1 Bento 卡片

| 变体 | 结构 | 用途 |
|---|---|---|
| `bento-hero` | 大数字/环 + 标题 + 辅助行 | 今日做题、计时、结算 |
| `bento-stat` | 数字（H2/Number-M）+ Caption | 正确率、学习时长、轮次 |
| `bento-action` | 彩色图标块 + 标题 + 箭头 | 四功能入口 |
| `bento-list` | 标题行 + 内容列表 | 最近练习、记录 |
| `bento-trend` | 标题 + 7 日柱/热力条 | 首页趋势 |

通用：`background: $bg-card; border-radius: $radius-lg; padding: 32rpx; box-shadow: L2`。
交互：`hover-class="card-press"`，按下 `scale(.98)`，120ms。

### 6.2 按钮

| 类型 | 高度 | 样式 | 场景 |
|---|---|---|---|
| Primary | 96rpx | `$grad-brand` + Glow + 白字 600 | 开始练习、开始计时 |
| Secondary | 88rpx | 白底 + `1rpx $line-strong` + 深字 | 次要操作 |
| Ghost | 88rpx | 透明 + 浅描边 | 结果页「再练一组」 |
| Danger | 88rpx | `$coral` 10% 底 + 珊瑚字 | 清空、删除 |
| Icon | 80rpx 圆形 | 玻璃/白底 | 返回、更多 |

禁用态：`opacity: .45`，不改变色相；按下态：`scale(.96)` + 阴影收敛。

### 6.3 分段控件（Segmented）

- 外槽：`$bg-soft`，圆角 full，内边距 `6rpx`。
- 选项：等分，高度 `64rpx`，选中项白底 + L1 阴影 + 主色字，滑动指示器 220ms。
- 用于：题库分类、记录筛选、单题/整组切换、日/周/月切换。

### 6.4 Chip

- 高度 `68rpx`，左右 `30rpx`，圆角 full，白底 `1rpx $line`。
- 选中：`$grad-brand` 白字 + Glow。
- 横向滚动必须 `show-scrollbar=false`，右侧留 `24rpx` 渐隐遮罩。

### 6.5 底部抽屉（Bottom Sheet）

- 顶部圆角 `48rpx`，把手 `72rpx × 8rpx`，`rgba(15,23,42,.2)`。
- 遮罩 `rgba(11,18,32,.45)`，点击关闭。
- 入场：`translateY(100%) → 0`，320ms，`cubic-bezier(.34,1.56,.64,1)`。
- 用于替代系统 ActionSheet：选对错、选练习模式、选抽题数量、题目解析。

### 6.6 进度环

- 尺寸：主环 `240rpx`，迷你环 `96rpx`。
- 轨道 `$line`，进度 `$grad-brand`，线宽 `18rpx`（迷你环 `8rpx`）。
- 中心：大数字 + Caption；进度变化 600ms 生长动画。
- 用于：今日正确率、结算得分、计时页。

### 6.7 题目选项

- 通栏卡片，最小高 `96rpx`，圆角 `$radius-md`，白底 + `1rpx $line`。
- 左侧字母徽章 `56rpx` 圆形，`$bg-soft` 底 + 深字；选中变主色底白字。
- 状态：默认 / 选中（主色描边 + 8% 主色底）/ 正确（薄荷底 + ✓）/ 错误（珊瑚底 + ✕）。
- 颜色不是唯一信号，必须同时有图标或文字。

### 6.8 数据展示

| 组件 | 规格 |
|---|---|
| 大数字 | Number-M `52rpx/800`；单位 `20rpx` 弱色 |
| 迷你趋势条 | 7 列，宽 `20rpx`，圆角 `8rpx`，高度按最大值归一，主色渐变 |
| 热力格 | `32rpx` 方块，5 档透明度（0/20/40/70/100%） |
| 标签 | 高 `40rpx`，左右 `14rpx`，圆角 full，语义浅底深字 |

### 6.9 列表行

- 高 `112rpx`（带副标题 `128rpx`），左图标/序号 `64rpx`，右箭头或数值。
- 分割线只在行间使用，且 `margin-left` 与内容对齐，不顶格。

### 6.10 空态 / 骨架

- 空态：CSS 几何插画（圆 + 弧 + 点），不用外链图片；标题 H3 + 说明 Caption + 一个 Secondary 按钮。
- 骨架：`linear-gradient(90deg, #EEF2F7 25%, #F8FAFD 37%, #EEF2F7 63%)` 扫光 1.4s，仅用于首屏加载。

### 6.11 自定义 TabBar

- 容器：左右 `24rpx`、底部 `16rpx + safe-area`，高 `112rpx`，`$radius-full`，玻璃配方。
- 4 项等分；未选中：弱色图标 + 20rpx 文案；选中：主色渐变胶囊（`padding 0 24rpx`）+ 白字，220ms 宽度过渡。
- 角标：右上 `-6rpx`，主色底白字，min-width `28rpx`。
- 禁止遮挡内容：页面底部统一预留 `190rpx`。

---

## 七、页面蓝图

### 7.1 首页

1. 顶部柔光背景（`$grad-aurora`）+ 问候语（Caption）+「刷题计时器」H1 + 连续打卡徽章。
2. **今日 Bento**：
   - 主卡（跨 2/3）：进度环（今日做题数）+ 正确率 + 「今日目标」辅助行。
   - 副卡竖排两枚：学习分钟（薄荷）、连续天数（琥珀火焰）。
3. **四功能入口**：2×2 彩色 action 卡（题库/速算/单题/整组），图标块用题型色。
4. **近 7 天趋势**：`bento-trend`，7 列渐变柱 + 星期标签；全 0 时显示空态（已有逻辑保留）。
5. **最近练习**：`bento-list`，题库名 + 模式标签 + 正确率迷你环。
6. 底部玻璃 tabBar。

### 7.2 题库页

1. 轻页头：H1「题库」+ 总题数 Caption，不做大面积渐变。
2. 顶部分段控件：全部 / 公务员 / 其他（按大类动态）。
3. 题库卡：左侧 `8rpx` 主题色竖条或角标，标题 H3 + 描述 Caption + 题量/小类标签 + 完成进度条。
4. 点击题库 → **Bottom Sheet**：顺序/随机、题量 10/20/50、开始按钮；替代 `showActionSheet`。
5. 底部 tabBar。

### 7.3 练习答题页

1. 顶部：返回 + 进度条（`3/10`）+ 计时（`tabular-nums`）。
2. 题干卡：H3 题干 + 图片自适应（`mode="widthFix"`），卡片白底、内边距 32rpx。
3. 选项：纵向大卡（6.7），多选显示「可多选」Caption。
4. 底部 sticky：`确认答案`/`下一题` 主按钮，安全区留白。
5. 判定反馈：正确=卡片薄荷描边 + 顶部轻提示；错误=珊瑚描边 + 正确答案高亮；同时 `uni.vibrateShort({type:'light'})`。
6. 解析 → Bottom Sheet：结果徽章 + 解析正文 + `下一题`。
7. 结算页：大环得分 + 对/错/跳三枚 stat + 错题列表 + 「错题重练」「再练一组」。

### 7.4 速算配置页

1. Hero：品牌渐变，H1「速算」+ 一句价值说明（保留唯一的大面积渐变入口）。
2. 题型 2×2 色块卡：百化分（蓝）/ 分数比大小（薄荷）/ 估算值（珊瑚）/ 平方数（琥珀），含符号与一句描述。
3. 难度分段控件（不限/易/中/难）+ 题量 stepper（- 10 +）。
4. 主按钮「开始练习」+ Glow；下方「练习记录 / 技巧手册」双 Ghost。

### 7.5 速算答题页

1. 顶部进度 + 连对 streak（琥珀火焰）。
2. 大算式卡：Display 级数字/分数，居中，白底 + 轻描边。
3. 选择模式：2/4 个大选项卡；填空模式：数字键盘 + 输入框（自动聚焦）。
4. 答后即时反馈：正确=薄荷底 + ✓ + tip；错误=珊瑚底 + ✕ + 正确答案 + tip。
5. 底部：`下一题`；无限流不显示总题量，改为「已完成 N 题」。

### 7.6 计时页（单题/整组）

1. 顶部：分段控件切换单题/整组 + 分类 chips。
2. **巨型计时卡**：`$grad-aurora` 底 + 240rpx 进度环（按目标题量/时间）+ Display 计时 + 本轮累计 Caption。
3. 主控：开始/暂停 Primary 大按钮；结束/清空为 Secondary/Danger，按状态禁用。
4. 单题：完成本题 → Bottom Sheet 选「答对/答错/跳过」（替代 ActionSheet）。
5. 整组：结束后 Bottom Sheet 网格标记错题/没做，顶部实时统计。
6. 本轮记录：横向可滑的题号胶囊列表（对/错/跳三色），点击可修正。

### 7.7 记录页（练习/速算/计时）

1. 顶部分段：全部 / 本周 / 本月（或题型筛选）。
2. 时间轴卡：日期分组标题 + 记录卡（题库名、模式标签、正确率迷你环、题量/用时）。
3. 点击 → 详情页：概览 Bento + 逐题列表（题号/用时/结果标签）+ 只看错题开关。
4. 空态：几何插画 + 「去练一组」按钮。

### 7.8 我的

1. 玻璃用户卡：头像（首字圆形渐变）+ 昵称 + 角色/同步状态。
2. 累计 Bento：做题/正确率/轮次/学习小时四宫格。
3. 记录入口列表（3 行，图标 + 副标题 + 箭头）。
4. 数据管理：清空类操作统一 Danger 文字 + 二次确认 Bottom Sheet。
5. 关于：版本号 + 一句 slogan。

---

## 八、动效规范

| 场景 | 效果 | 时长/曲线 |
|---|---|---|
| 按钮按下 | `scale(.96)` + 阴影收敛 | 120ms / ease-out |
| 卡片按下 | `scale(.98)` | 120ms / ease-out |
| 页面入场 | `opacity 0→1` + `translateY(16rpx→0)` | 220ms / `cubic-bezier(.22,1,.36,1)` |
| 列表 stagger | 每项延迟 40ms，最多 6 项 | 同上 |
| 抽屉 | `translateY(100%→0)` | 320ms / `cubic-bezier(.34,1.56,.64,1)` |
| 进度环 | `stroke-dashoffset` 生长 | 600ms / ease-out |
| 数字变化 | 400ms 计数递增 | 400ms / ease-out |
| TabBar 选中 | 胶囊宽度/位移过渡 | 220ms / `cubic-bezier(.22,1,.36,1)` |
| 答对/答错 | 卡片描边色渐变 + 轻震 | 180ms + `vibrateShort` |

约束：
- 只动画 `transform` / `opacity` / `stroke-dashoffset`，禁止动画 `box-shadow`、`width`、`height`。
- 同屏同时运行的动画不超过 3 组。
- 低端机降级：关闭 stagger 与计数动画，保留状态切换。

---

## 九、微信小程序实现约束

1. 单位统一 `rpx`；页面样式必须 `scoped`；全局 token 只改 `uni.scss` 与 `App.vue` 全局类。
2. `backdrop-filter` 必须有降级；模糊只用于小面积浮层。
3. 图标不使用外部 iconfont；优先 CSS 形状/内联 SVG/base64，控制主包体积。
4. 横向滚动统一 `scroll-view :show-scrollbar="false"`，禁止页面出现原生滚动条。
5. 底部浮层与操作条必须加 `env(safe-area-inset-bottom)`。
6. 图片题 `mode="widthFix"`，限制最大宽度 `100%`，避免撑破卡片。
7. 正文对比度 ≥ 4.5:1；答案对错不能只用颜色区分，必须带图标/文字。
8. 禁止在页面内直接写十六进制色值（统一引用 token），禁止出现 `#000`。
9. 新增组件放 `src/components/`，命名 `BentoCard.vue`、`GlassSheet.vue`、`ProgressRing.vue`、`SegmentedTabs.vue`、`OptionCard.vue` 等 PascalCase。
10. 改版期间保持现有接口与数据结构不变，只动表现层；涉及交互替换（ActionSheet → Bottom Sheet）时保留原逻辑分支。

---

## 十、推荐 Token 落地（uni.scss 增量）

> 以下为规范建议值，正式改版时整体替换旧 token，页面样式跟随迁移；过渡期可保留旧变量别名，避免一次性大爆炸。

```scss
/* 品牌 */
$brand-500: #4F86FF;
$brand-600: #2F6BFF;
$brand-700: #1D4ED8;
$brand-50:  #EEF4FF;
$grad-brand: linear-gradient(135deg, #5B8CFF 0%, #2F6BFF 52%, #1D4ED8 100%);

/* 辅助 */
$mint: #14B8A6;
$coral: #FF6B6B;
$amber: #FFB020;

/* 中性 */
$ink: #0F172A;
$ink-2: #475467;
$ink-3: #98A2B3;
$bg-page: #F6F8FC;
$bg-card: #FFFFFF;
$bg-soft: #F1F5FB;
$line: #E8EEF7;
$line-strong: #D7E0EE;

/* 圆角 */
$radius-xs: 12rpx;
$radius-sm: 20rpx;
$radius-md: 28rpx;
$radius-lg: 40rpx;
$radius-sheet: 48rpx;
$radius-full: 999rpx;

/* 阴影 */
$shadow-l1: 0 6rpx 20rpx rgba(15, 23, 42, .05);
$shadow-l2: 0 14rpx 36rpx rgba(15, 23, 42, .08);
$shadow-l3: 0 24rpx 60rpx rgba(15, 23, 42, .14);
$shadow-glow: 0 12rpx 32rpx rgba(47, 107, 255, .28);

/* 间距 */
$gap-page: 40rpx;
$gap-sec: 56rpx;
$gap-card: 20rpx;
$gap-item: 16rpx;

/* 字号 */
$fs-display: 112rpx;
$fs-h1: 56rpx;
$fs-h2: 40rpx;
$fs-h3: 32rpx;
$fs-body: 28rpx;
$fs-caption: 24rpx;
$fs-micro: 20rpx;
```

---

## 十一、热门效果映射（为什么这样设计）

| 热门手法 | 本项目落点 | 目的 |
|---|---|---|
| Bento Grid | 首页/我的/结算的大小卡混排 | 提升信息密度但不拥挤，形成现代感 |
| Aurora 柔光 | 首页/计时页背景 | 替代单色渐变，制造空间感 |
| Liquid Glass | 自定义 tabBar、底部抽屉、浮动头 | 提升精致度，形成 iOS 级观感 |
| Progress Ring | 今日正确率、结算、计时 | 把「数据」变成可感知的进度 |
| Heatmap / 7 日趋势 | 首页趋势卡 | 强化连续学习激励 |
| Bottom Sheet | 对错标记、模式选择、解析 | 去掉系统弹层的廉价感 |
| Spring Motion | 抽屉、按压、tabBar | 让交互“有回弹”，提升手感 |
| 大数字排版 | 计时、结算、统计 | 数据优先，减少阅读负担 |

---

## 十二、验收清单（改版完成后逐项打勾）

### 视觉

- [ ] 每页只有一个主视觉焦点，H1 不超过 1 个、H2 不超过 2 个。
- [ ] 页面留白 40rpx、区块间距 56rpx，无「贴边」「拥挤」。
- [ ] 同屏阴影不超过 2 级，无三层阴影堆叠。
- [ ] 无纯黑正文、无页面内散落十六进制色值。
- [ ] 图标/插画均为 CSS 或内联资源，无外链图片。

### 交互

- [ ] 所有核心选择不再使用系统 ActionSheet。
- [ ] 主操作按钮始终可见（开始/继续/暂停三态），危险操作有禁用态与二次确认。
- [ ] 按压有回弹，页面入场有 stagger，抽屉有 spring。
- [ ] 答对/答错有颜色 + 图标/文字双重信号。
- [ ] 触感反馈只出现在答题、开始计时等关键节点。

### 技术

- [ ] `backdrop-filter` 有降级，低端安卓不糊不卡。
- [ ] 页面无横向滚动条，底部内容不被 tabBar 遮挡（预留 190rpx + 安全区）。
- [ ] 动画只使用 transform/opacity/stroke，稳定 60fps。
- [ ] iOS / Android 真机各走一遍：首页 → 题库 → 答题 → 结算 → 速算 → 计时 → 记录 → 我的。
- [ ] `npm run build:mp-weixin` 通过，包体无异常增长。

---

## 十三、落地顺序（规范确认后执行）

1. **P0 全局层**：替换 `uni.scss` token + `App.vue` 全局类（背景、按钮、chip、空态、卡片按压）。
2. **P1 外壳**：自定义 tabBar 玻璃化 + 页面底部留白统一。
3. **P2 首页**：Bento 今日卡 + 四入口 + 趋势 + 最近练习。
4. **P3 题库链路**：题库页 → Bottom Sheet 选题 → 答题页 → 解析 → 结算。
5. **P4 速算链路**：配置页 → 答题页 → 结果页。
6. **P5 计时链路**：单题/整组 → 巨型环 → 标记抽屉。
7. **P6 记录 + 我的**：时间轴、累计 Bento、数据管理。
8. **P7 打磨**：动效、骨架屏、空态、真机回归、截图对照。

> 每完成一个 P 阶段，先跑 `npm run build:mp-weixin`，再在微信开发者工具与真机各验一次；未经确认不进入下一阶段。

---

## 十四、与现有实现的兼容说明

- 现有 `pages.json` 已开 `custom: true`，`src/custom-tab-bar/` 为微信原生四件套，本规范只改其样式与选中态，不改变组件结构。
- 现有首页 `hasTrend` 空态逻辑、速算 `fillDir`、计时三态按钮等**行为逻辑保留**，本次只替换视觉与容器。
- 现有接口、字段（`stemImg`/`isDeleted`/`user_id`）不变；改版不触发数据库变更。
- 旧页面中的 `showActionSheet` 逐个替换为 `GlassSheet` 组件，替换时保留原回调分支，避免交互回归。
