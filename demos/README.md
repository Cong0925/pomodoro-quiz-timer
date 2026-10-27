# demos — 界面设计演示页

本目录存放项目开发过程中的**静态 Demo HTML**，仅用于界面/交互方案预览，**不参与正式应用运行**（正式入口是 `public/index.html`）。

## 使用方式

用浏览器直接打开对应文件即可，无需启动后端：

```bash
# 双击文件，或
start demos\demo-practice.html
```

## 文件索引

| 文件 | 主题 | 说明 |
|------|------|------|
| `demo-history-detail.html` | 历史明细 5 列布局 | 历史记录明细列表的列布局方案演示 |
| `demo-mental-math.html` | 速算练习界面 | 速算模块整体界面 Demo（侧边栏 + 练习区，含多锚点分区） |
| `demo-practice.html` | 练习模式设计 | 题库练习模式的页面结构与交互设计 Demo |

## 维护约定

1. 新增 demo 一律放本目录，命名 `demo-<功能>.html`，并在上表补一行
2. Demo 定稿、功能正式实现后，对应 demo 可删除或移入 `_backup/`
3. 本目录文件**不接入**正式构建与路由；根目录不再直接放 `demo-*.html`
