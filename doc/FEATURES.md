# Roam Timeline App - 功能文档

> 最后更新: 2026-01-18

## 项目简介

一个用于 Roam Research 的时间追踪 Web 应用，帮助用户记录每天的活动和时间分配。

**在线地址**: https://roam-timeline.vercel.app/

**技术栈**:
- 前端: React 19 + TypeScript + Vite + TailwindCSS
- 后端: Express.js (BFF 层)
- 部署: Vercel

---

## 已实现功能

### 1. 核心日记记录

| 功能 | 说明 | 状态 |
|------|------|------|
| 时间输入 | 开始时间和结束时间手动输入 | ✅ |
| 自动计算时长 | 自动计算时间差（格式: `1h30'` 或 `45'`） | ✅ |
| 实时时钟 | 结束时间自动更新为当前时间 | ✅ |
| 经过时间显示 | 显示从开始到现在经过的时长 | ✅ |
| Timeline 展示 | 页面下方显示今日时间轴条目 | ✅ |
| 跨天支持 | 读取昨天的最后结束时间 | ✅ |

### 2. Roam Research 集成

| 功能 | 说明 | 状态 |
|------|------|------|
| API 认证 | 服务器端存储 token，前端只存 graphName | ✅ |
| 自动创建页面 | 以日期命名（如 `January 18th, 2026`） | ✅ |
| Timeline 块管理 | 自动创建/查找 Timeline 块 | ✅ |
| 历史条目查询 | 查询今天/昨天 Timeline 下所有条目 | ✅ |
| 负载均衡 | 自动跟随 308 重定向到不同 peer | ✅ |

### 3. 富文本编辑

| 功能 | 说明 | 状态 |
|------|------|------|
| Markdown 格式 | 支持加粗、斜体、下划线、删除线、行内代码 | ✅ |
| contentEditable | 富文本输入框 | ✅ |

### 4. #标签和@页面自动完成

| 功能 | 说明 | 状态 |
|------|------|------|
| 标签补全 | 输入 `#` 触发分类自动完成 | ✅ |
| 页面引用 | 输入 `@` 触发页面自动完成 | ✅ |
| 模糊搜索 | 使用 Fuse.js 实现模糊匹配 | ✅ |
| 键盘导航 | 上下箭头选择，回车/Tab 确认，Esc 关闭 | ✅ |

### 5. 图片上传

| 功能 | 说明 | 状态 |
|------|------|------|
| Cloudinary 集成 | 上传图片到 Cloudinary | ✅ |
| Markdown 插入 | 自动生成 `![](url)` 格式 | ✅ |
| 配置验证 | 检查 Cloudinary 配置 | ✅ |

### 6. 设置功能

| 功能 | 说明 | 状态 |
|------|------|------|
| Graph 名称配置 | 配置 Roam Research graph 名称 | ✅ |
| Cloudinary 配置 | 配置 cloud name 和 upload preset | ✅ |

---

## 待开发功能

### 高优先级

| 功能 | 描述 | 难度 |
|------|------|------|
| 删除/编辑条目 | Timeline 中支持修改或删除已有条目 | 中 |
| 分类选择器集成 | JournalEntry 中使用 CategorySelector 组件 | 低 |

### 中优先级

| 功能 | 描述 | 难度 |
|------|------|------|
| 多天历史浏览 | 允许浏览今天以外的历史记录 | 中 |
| 统计功能 | 时间统计、分类统计等 | 中 |
| 快捷键支持 | 全局快捷键（如 Cmd+Enter 提交） | 低 |
| 拖拽排序 | Timeline 条目拖拽调整顺序 | 中 |

### 低优先级

| 功能 | 描述 | 难度 |
|------|------|------|
| 批量导入/导出 | CSV 或 Markdown 格式导入导出 | 中 |
| 离线支持 | Service Worker 实现离线功能 | 中 |
| 主题切换 | 亮色/暗色主题切换 | 低 |
| 本地备份 | 本地存储备份功能 | 低 |

---

## 组件架构

```
App.tsx (主容器)
├── useRoam hook (Roam API 集成)
│   ├── saveConfig/clearConfig - 配置管理
│   ├── addEntry - 添加日记条目
│   ├── getTimelineEntries - 获取时间轴条目
│   ├── getLastEntryEndTime - 获取最后结束时间
│   ├── getCategories - 获取分类列表
│   ├── createChildNode - 创建子节点
│   └── formatTodayPage - 格式化页面
│
├── JournalEntryForm (日记输入组件)
│   ├── 时间输入 (startTime, endTime)
│   ├── 格式化工具栏 (FormatButton)
│   ├── 图片上传
│   ├── #/@ 自动完成下拉
│   └── contentEditable 编辑器
│
├── Timeline (时间轴展示)
│   └── 显示所有日记条目
│
├── Settings (设置页面)
│   ├── Roam 配置
│   └── Cloudinary 配置
│
└── FormatButton (格式化按钮)
```

---

## API 端点

### 服务器端 (server.mjs)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/roam/:graphName` | POST | 通用 Roam API 代理（查询/写入） |
| `/api/roam/categories` | POST | 获取分类列表 (Time Categories 页面) |
| `/api/roam/pages` | POST | 获取所有页面列表 |

---

## 启动方式

```bash
# 安装依赖
npm install

# 启动后端服务 (端口 3000，nodemon 自动重启)
npm run server

# 启动前端开发服务器 (端口 5173，带 API 代理)
npm run dev

# 构建生产版本
npm run build
```

**注意**: 前端开发服务器已配置代理，`/api/roam/*` 请求会自动转发到 `localhost:3000`。

---

## 配置说明

### Roam Research

- **Graph Name**: 你的 Roam graph 名称（如 `Mineworld`）
- **API Token**: 在 server.mjs 中配置（`ROAM_API_TOKEN`）

### Cloudinary (可选)

- **Cloud Name**: Cloudinary 账号的 cloud name
- **Upload Preset**: 上传预设（需要配置为 unsigned）

---

## 文件结构

```
roam-journal-app/
├── api/
│   └── roam/
│       └── pages.ts          # Pages API 端点
├── src/
│   ├── components/
│   │   ├── JournalEntry.tsx  # 日志输入组件
│   │   ├── Timeline.tsx      # 时间轴展示
│   │   ├── Settings.tsx      # 设置页面
│   │   ├── FormatButton.tsx  # 格式化按钮
│   │   ├── CategorySelector.tsx  # 分类选择器
│   │   ├── Autocomplete.tsx  # 自动完成组件
│   │   └── Dropdown.tsx      # 下拉菜单
│   ├── hooks/
│   │   └── useRoam.ts        # Roam API 集成
│   ├── utils/
│   │   ├── formatter.ts      # 时间格式化
│   │   └── imageUploader.ts  # 图片上传
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── App.tsx               # 主应用
│   └── main.tsx              # 入口文件
├── server.mjs                # Express 后端
├── vite.config.ts            # Vite 配置
├── CLAUDE.md                 # 开发规范
└── package.json
```
