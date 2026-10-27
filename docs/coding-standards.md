---
description: 项目代码规范 - 多版本架构说明、强制模块化组件化标准与异常处理日志规范
created: 2026-06-16
last_modified: 2026-10-27
---

# 代码开发规范（强制执行）

> 本规范是 Claude Code 在本项目中的强制约束，所有代码修改必须遵守。

---

## 〇、项目多版本架构与规范适用范围

> 本项目为**一仓多版本**结构。不同版本位于不同目录、由不同分支管理；编码前必须先确认当前操作的是哪个版本。

### 0.1 版本结构总览

| 版本 | 目录 | 分支 | 技术栈 | 状态 |
|------|------|------|--------|------|
| **主版本**（初始版本/原始代码） | 仓库根目录 | `main` | 原生 HTML/CSS/JS + Node.js + Express + MySQL | 已有完整代码，持续维护 |
| **web-app 版本** | `web-app/` | `version-vue+node` | Vue 3 + TypeScript + Node.js（前后端分离） | 目录已建，编码进行中 |
| **app 版本** | `app/`（规划） | 未来新建独立分支 | 规划中（预留 Rust/Tauri 等） | 未创建 |

```
pomodoro-quiz-timer/                 ← 仓库根目录
├── server/  public/  ...            ← 主版本代码（main 分支）
├── web-app/                         ← Vue + Node 版（version-vue+node 分支）
└── app/                             ← app 版（规划中，尚未创建）
```

### 0.2 分支管理策略（强制）

1. **`main` 分支**：只维护主版本（根目录）代码；`web-app/`、`app/` 等子版本目录**不在 main 提交**（由根目录 `.gitignore` 控制）。
2. **`version-vue+node` 分支**：web-app 版本专属分支，Vue + Node 相关代码**只在此分支提交**。
3. **app 版本**：创建后使用独立分支管理（如 `version-app`），目录同样不在 main 提交。
4. **跨版本禁止混提**：一次提交只属于一个版本，禁止将主版本与 web-app / app 的改动混在同一提交。

### 0.3 本规范章节适用范围

| 规范章节 | 适用版本 |
|----------|----------|
| 一、核心原则 | 全部版本 |
| 二、文件行数上限 | 全部版本（按对应文件类型） |
| 三、前端 Vue 规范 | **web-app 版本**（主版本为原生 JS，不适用） |
| 四、TypeScript 规范 | **web-app 版本** |
| 五、Pinia Store 规范 | **web-app 版本** |
| 六、Rust 后端规范 | **app 版本（规划中）预留**，当前主版本与 web-app 均无 Rust 代码 |
| 七、命名约定总表 | 全部版本（按对应技术栈行执行） |
| 八、禁止事项 | 全部版本 |
| 九～十五（异常/日志/变量/注释/异步/格式/红线） | **全部版本（强制）** |
| 十六、代码审查检查清单 | 全部版本（按适用项勾选） |

### 0.4 主版本（根目录）编码补充说明

主版本前端为**原生 JavaScript**（非 Vue / TS），维护时：

1. 适用本规范中**全部通用强制章节**（异常捕获、日志、命名、注释、红线规则等）
2. **不适用** Vue / TypeScript / Pinia / Rust 章节
3. 新增原生 JS 代码：按功能拆分至 `public/js/` 下独立文件，单文件建议不超过 500 行
4. 后端 `server/`：遵循 Node.js 通用实践 + 本规范通用强制章节

---

## 一、核心原则

1. **单一职责**：每个文件只做一件事
2. **模块化**：功能按领域拆分，禁止堆砌
3. **组件化**：UI 逻辑拆分为独立 Vue 组件 + composable
4. **可维护性**：文件必须保持可读、可定位、可修改

---

## 二、文件行数上限

| 文件类型 | 上限 | 超出处理 |
|----------|------|----------|
| `.vue` 单文件组件 | **500 行** | 拆分为子组件 + composable |
| `.ts` / `.js` 工具/逻辑 | **400 行** | 拆分为多个模块 |
| `.ts` Pinia store | **300 行** | 按子领域拆分 store |
| `.rs` Rust 源文件 | **800 行** | 按职责拆分模块 |
| `composable` (use*.ts) | **250 行** | 拆分为更细粒度的 composable |

> **例外**：纯类型定义文件（types.ts）可放宽至 600 行，但应考虑按子领域拆分。

---

## 三、前端 Vue 规范

> **适用版本**：web-app 版本（`web-app/` 目录，`version-vue+node` 分支）。主版本为原生 JS，不适用本章。

### 3.1 组件结构

```vue
<template>
  <!-- 模板区域 -->
</template>

<script setup lang="ts">
// 脚本区域
</script>

<style scoped>
/* 样式区域 */
</style>
```

- 必须使用 `<script setup lang="ts">`
- 样式必须 `scoped`

### 3.2 组件拆分规则

以下情况**必须**拆分为子组件：

1. 模板中出现 **3 层以上**嵌套的区块
2. 同一组件中存在 **2 个以上**独立的交互区域（如列表 + 表单 + 详情）
3. 某个 UI 区块在多处复用
4. 组件需要接收 **5 个以上** props

拆分方式：
```
FeaturePanel.vue          # 父组件（容器，< 250 行）
├── FeatureHeader.vue     # 子组件：头部区域
├── FeatureList.vue       # 子组件：列表区域
├── FeatureForm.vue       # 子组件：表单区域
├── useFeature.ts         # composable：业务逻辑
└── types.ts              # 类型定义
```

### 3.3 Composable 规范

- 文件名：`useXxx.ts`（驼峰，use 前缀）
- 每个 composable 只负责**一个独立关注点**
- composable 内部可以引用其他 composable
- 禁止在 composable 中直接操作 DOM
- 复用逻辑必须抽取，禁止在组件内内联超过 30 行的逻辑块

### 3.4 模块目录结构（以功能模块为单位）

每个功能模块必须遵循以下目录结构：

```
src/
└── modules/
    └── feature-name/
        ├── components/          # Vue 组件
        │   ├── FeaturePanel.vue
        │   ├── FeatureHeader.vue
        │   └── FeatureList.vue
        ├── composables/         # 组合式函数
        │   ├── useFeature.ts
        │   └── useFeatureActions.ts
        ├── types/               # 类型定义
        │   └── index.ts
        ├── config/              # 模块配置
        │   └── index.ts
        ├── stores/              # 模块专属 store（可选）
        │   └── featureStore.ts
        ├── assets/              # 静态资源（可选）
        │   └── icons/
        └── index.ts             # 模块入口（导出公共 API）
```

> **例外**：已有的 `src/views/`、`src/pet/`、`src/components/` 结构保持不变，新功能模块使用上述结构。

---

## 四、TypeScript 规范

> **适用版本**：web-app 版本（`web-app/` 目录，`version-vue+node` 分支）。

### 4.1 类型定义

- 禁止使用 `any`，必须明确类型
- 复杂类型使用 `interface`，简单别名使用 `type`
- 类型定义集中放在模块的 `types/` 目录
- 全局共享类型放在 `src/types/`

### 4.2 导入顺序

```typescript
// 1. 第三方库
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

// 2. 项目内部模块（绝对路径）
import { useFeatureStore } from '@/stores/featureStore'
import type { Feature } from '@/types/feature'

// 3. 相对路径模块
import { helper } from './utils'
```

---

## 五、Pinia Store 规范

> **适用版本**：web-app 版本（`web-app/` 目录，`version-vue+node` 分支）。

- 每个 store 对应一个独立领域
- 文件名：`xxxStore.ts`（驼峰，Store 后缀）
- store 不超过 300 行，超出则拆分 getter/action
- 复杂业务逻辑下沉到 composable，store 只管理状态

---

## 六、Rust 后端规范

> **适用版本**：app 版本（`app/` 目录，规划中）预留。当前主版本与 web-app 均无 Rust 代码；app 版本创建并确定采用 Rust/Tauri 后，本章自动生效。

### 6.1 文件组织

```
src-tauri/src/
├── commands/               # Tauri 命令（IPC 入口）
│   ├── mod.rs
│   ├── files.rs
│   └── feature.rs
├── feature/                # 功能模块
│   ├── mod.rs
│   ├── command.rs          # 命令处理（仅 IPC 路由）
│   ├── service.rs          # 业务逻辑
│   ├── model/
│   │   ├── mod.rs
│   │   ├── types.rs        # 类型定义
│   │   └── database.rs     # 数据库操作
│   └── error.rs            # 错误类型
├── ai/                     # AI 模块
├── lib.rs                  # 入口（仅注册命令）
└── types.rs                # 全局类型
```

### 6.2 拆分规则

- `command.rs`：只做 IPC 路由和参数校验，不包含业务逻辑
- `service.rs`：业务逻辑，不依赖 Tauri 框架
- `model/types.rs`：类型定义
- `error.rs`：模块错误类型定义

### 6.3 命名约定

- 文件名：`snake_case.rs`
- 函数名：`snake_case`
- 类型名：`PascalCase`
- 命令函数：`cmd_` 前缀 + 动词 + 名词（如 `cmd_create_project`）
- 模块目录：`snake_case/`

---

## 七、命名约定总表

| 类别 | 规则 | 示例 |
|------|------|------|
| Vue 组件文件 | PascalCase | `FeaturePanel.vue` |
| Composable 文件 | camelCase + use 前缀 | `useFeature.ts` |
| Store 文件 | camelCase + Store 后缀 | `featureStore.ts` |
| 类型文件 | camelCase | `types.ts`、`feature.ts` |
| 工具函数文件 | camelCase | `formatDate.ts` |
| CSS class | kebab-case | `.feature-panel` |
| CSS 变量 | kebab-case | `--feature-color` |
| Pinia store id | camelCase | `featureStore` |
| 事件名称 | kebab-case | `feature-update` |
| Rust 文件 | snake_case | `command.rs` |
| Rust 函数 | snake_case | `cmd_create_project` |
| Rust 类型 | PascalCase | `FeatureConfig` |

---

## 八、禁止事项

1. **禁止**单个 `.vue` 文件超过 500 行
2. **禁止**单个 `.rs` 文件超过 500 行
3. **禁止**在组件内内联超过 30 行的逻辑（必须抽取 composable）
4. **禁止**使用 `any` 类型
5. **禁止**在 `command.rs` 中写业务逻辑
6. **禁止**将所有功能写在一个文件中
7. **禁止**在模板中写复杂计算（必须用 computed）
8. **禁止**跨模块直接 import 内部实现（必须通过模块入口 `index.ts`）

---

## 九、异常捕获 try/catch 强制规范（全部强制）

### 9.1 同步代码 try/catch 规则

1. 所有有执行风险的同步代码（JSON.parse 解析、本地缓存读写、复杂计算、DOM 操作、第三方 SDK 调用）**必须**包裹 try/catch，禁止裸奔执行风险代码。
2. catch 块**必须**使用 `console.error` 打印错误信息，禁止使用 `console.log`、`console.warn` 打印异常，禁止空 catch 块。
3. 日志**必须**包含中文业务场景描述 + 原始错误对象。

✅ 正确示例：

```typescript
try {
  const userInfo = JSON.parse(localStorage.getItem('user') ?? '{}')
} catch (err) {
  console.error('【用户信息本地缓存解析失败】', err)
}
```

❌ 错误示例（评审直接驳回）：

```typescript
// 错误1：catch 空块，吞掉报错
try { ... } catch (err) {}

// 错误2：使用 log/warn 打印异常
try { ... } catch (err) { console.log('解析失败', err) }

// 错误3：无中文描述，无法定位业务场景
try { ... } catch (err) { console.error(err) }
```

### 9.2 异步代码 try/catch 规则（async/await）

1. 所有 async/await 异步请求、异步逻辑，**必须**外层包裹 try/catch。
2. catch 内**必须**使用 `console.error`，补充中文接口/业务场景说明。

✅ 正确示例：

```typescript
async function getOrderList() {
  try {
    const res = await axios.get('/api/order/list')
    return res.data
  } catch (err) {
    console.error('【获取订单列表接口请求失败】', err)
    showError('订单数据加载失败，请稍后重试')
  }
}
```

### 9.3 Promise 链式调用异常规范

不使用 async/await 的原生 Promise，**必须**末尾添加 `.catch()` 捕获异常，catch 内遵循中文说明 + `console.error` 规则。

```typescript
axios.get('/api/user/info')
  .then(res => { ... })
  .catch(err => {
    console.error('【获取个人用户信息接口请求失败】', err)
  })
```

---

## 十、全局日志打印 console 统一规范（全部强制）

### 10.1 统一日志分级规则

| 级别 | 用途 | 使用场景 |
|------|------|----------|
| `console.error` | 业务报错、接口异常、try/catch 捕获异常 | **固定使用** |
| `console.warn` | 业务告警、参数缺失、兜底降级提示 | 非致命错误 |
| `console.log` | **禁止提交到线上**，仅用于本地临时调试 | 上线前必须清除 |

### 10.2 日志文案强制要求

1. 所有业务日志**必须**使用中文描述，禁止纯英文、拼音、缩写、无意义变量打印。
2. 日志文案格式：`【模块/业务场景】+ 具体说明`，一眼定位代码位置。
3. 日志**必须**携带原始变量/错误对象，不可只打印静态文案。

✅ 正确示例：

```typescript
console.warn('【表单提交】手机号参数为空，触发参数校验降级', phoneValue)
console.error('【文件上传】图片格式校验失败', file)
```

❌ 错误示例（评审驳回）：

```typescript
console.log('phone is empty', phone)   // 禁止纯英文
console.warn(phone)                     // 禁止无中文场景说明
console.error('bdck error', err)        // 禁止缩写/拼音
```

### 10.3 线上环境日志约束

所有业务代码禁止遗留无用调试 `console.log`，打包上线前必须清空调试日志。需要保留线上监控日志时，统一使用 `error`/`warn` 分级日志。

---

## 十一、变量与函数编码规范（强制）

### 11.1 变量命名

- 统一使用小驼峰命名法，禁止拼音、中文、无意义单字母变量（`a`、`b`、`c`、`tmp`）
- 常量全大写 + 下划线分割：`const MAX_UPLOAD_SIZE = 1024`
- 布尔值统一以 `is`/`has`/`should` 开头：`isShowDialog`、`hasPermission`

### 11.2 函数规范

- 函数名见名知意，动词开头：`getUserInfo`、`submitForm`、`checkParams`
- 工具函数、公共方法**必须**添加 JSDoc 中文注释，说明入参、出参、功能
- 禁止过长函数，单个函数代码行数不超过 80 行，单一职责原则

### 11.3 空值判断规范

禁止使用 `==`、`!=` 做判断，统一使用 `===`、`!==`。空字符串、`undefined`、`null` 做精准判断，避免隐式类型转换带来的隐性 bug。

---

## 十二、注释编写规范（强制）

1. 所有业务复杂逻辑、特殊兜底逻辑、第三方兼容代码，**必须**添加中文单行注释，说明代码编写原因
2. 公共组件、公共工具函数、接口请求方法，**必须**添加块级中文注释
3. 禁止堆码无注释，禁止过期无效注释遗留代码中
4. 注释**统一使用中文**编写

---

## 十三、异步与定时器专项规范（强制）

1. `setTimeout`、`setInterval` 定时器，页面销毁/组件卸载时**必须**清除定时器，避免内存泄漏
2. 接口请求统一封装公共请求拦截器，拦截器内部异常统一打印中文 error 日志
3. 禁止回调地狱，多层异步嵌套**必须**改用 async/await

---

## 十四、代码格式与空格规范（推荐）

- 统一使用 2 个空格缩进，项目开启 eslint + prettier 自动格式化
- `if`/`for`/`function` 关键字后统一加空格，运算符前后加空格
- 一行只写一条代码语句，禁止多行代码合并一行

---

## 十五、禁止编码行为（红线规则，直接驳回）

| 序号 | 禁止行为 |
|------|----------|
| 1 | 禁止空 catch 块，禁止吞掉任何代码异常 |
| 2 | 禁止无中文说明的原始日志打印 |
| 3 | 禁止线上代码遗留调试用 `console.log` |
| 4 | 禁止裸写异步代码不捕获异常 |
| 5 | 禁止使用 `var` 声明变量，统一使用 `let`/`const` |

---

## 十六、代码审查检查清单

每次代码修改后，Claude Code **必须**自检以下项：

### 架构与结构

- [ ] 所有新增/修改的 `.vue` 文件不超过 500 行
- [ ] 所有新增/修改的 `.rs` 文件不超过 800 行
- [ ] 组件职责单一，可复用部分已抽取
- [ ] 复杂逻辑已抽取为 composable
- [ ] 类型定义完整，无 `any`
- [ ] Store 按领域拆分，不超过 300 行
- [ ] 命名符合约定
- [ ] Rust 命令处理与业务逻辑分离

### 异常捕获与日志

- [ ] 所有风险代码均有 try/catch 捕获，无空 catch 块
- [ ] catch 内统一使用 `console.error`，携带中文场景描述 + 原始错误
- [ ] 所有日志均为中文说明，无英文/无意义日志
- [ ] 无遗留 `console.log` 调试代码
- [ ] async/await、Promise 均完整捕获异常

### 编码规范

- [ ] 变量函数命名规范，无无意义变量、拼音命名
- [ ] 复杂逻辑、公共方法补充中文注释
- [ ] 使用 `===`/`!==` 而非 `==`/`!=`
- [ ] 使用 `let`/`const` 而非 `var`

---

## 十七、补充说明

1. **历史存量旧代码**：无需大规模重构，新增代码、修改代码必须严格遵守本规范
2. **紧急热更代码**：也必须遵守异常捕获和日志打印两条红线规则
3. **后续可配套 eslint 规则**，自动校验空 catch 块、非法日志、英文日志，减少人工评审成本
4. **多版本协作**：修改代码前先对照第〇章确认版本与分支；跨版本改动必须分提交、分分支处理
5. **规范同步**：web-app / app 版本的专属规范仅在对应分支维护时同步更新本文件，避免各分支规范漂移
