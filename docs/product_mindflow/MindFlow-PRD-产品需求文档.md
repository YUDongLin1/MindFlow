# MindFlow 智流日志 — 产品需求文档（PRD）

> **文档版本**: v1.2  
> **最后更新**: 2026-08-06  
> **产品版本**: 1.0.0  


---

## 一、产品概述

### 1.1 产品定位

MindFlow 智流日志是一款**本地优先、隐私开源、AI 驱动**的个人成长记录系统。融合工作日志、学习笔记、生活日记三合一，配合 AI 自动复盘与 Markdown 知识库，帮助用户建立可持续的记录习惯。

### 1.2 产品愿景

> 让「写下来」这件事变得温柔、顺手而有力量。

- **不是日记本**：不是传统日记工具，是个人成长的结构化记录系统
- **不是效率工具**：不追求 GTD 流程，而是帮助用户沉淀思考
- **不是社交产品**：纯本地、无社交、无分享压力

### 1.3 目标用户画像

| 用户类型 | 特征 | 核心需求 |
|----------|------|----------|
| 知识工作者 | 25-40 岁，每日有记录习惯 | 工作复盘 + 知识沉淀 + AI 辅助整理 |
| 学生/学习者 | 18-28 岁，需要记录学习过程 | 学习笔记 + 间隔复习 + 双链知识库 |
| 自我成长者 | 22-35 岁，关注个人发展 | 情绪追踪 + 习惯养成 + 每日总结 |
| 隐私敏感用户 | 任何年龄，重视数据安全 | 本地存储 + 无云端依赖 + 数据可控 |

### 1.4 核心价值主张

1. **本地优先**：所有数据存储在用户设备，离线可用，不依赖云端
2. **AI 是镜子**：AI 只做结构整理，绝不编造、绝不静默定稿
3. **三合一记录**：工作/学习/生活统一入口，降低切换成本
4. **知识自动沉淀**：每条记录自动生成 Markdown + 双链，可带走、可复用

---

## 二、功能架构

### 2.1 功能全景图

```
MindFlow 智流日志
├── 今日记录（Homepage）
│   ├── 多模块记录（日记/工作/学习/自定义）
│   ├── 富文本编辑器（Tiptap）
│   ├── AI 复盘（四段结构 + 溯源校验）
│   ├── 每日待办事项
│   ├── 每日总结卡片
│   ├── 使用时间监控
│   ├── 桌面宠物
│   ├── 元数据自动记录（时间/地点/天气）
│   ├── 语音输入
│   └── 智能标签推荐
├── 成长回顾（Growth）
│   ├── 周回顾（记录分布/模块分布/标签Top5/叙事）
│   ├── 月回顾（统计/热力图/模块分布/标签Top10/待办）
│   ├── 工作周报生成
│   └── 待办完成统计
├── 知识库（Knowledge）
│   ├── 知识树浏览（按年/月分层）
│   ├── AI 知识库问答（local/byok/cloud）
│   ├── 双链图谱可视化
│   ├── 间隔重复复习队列（SM-2）
│   └── Markdown 导出/复制
├── 日历视图（Calendar）
│   ├── 月历网格 + 记录指示
│   ├── 条目详情 + 编辑
│   └── 当日待办显示
├── 隐私与数据（Privacy）
│   ├── 数据存储路径管理
│   ├── AI 模式配置（local/byok/cloud）
│   ├── AI 连接测试
│   ├── E2EE 开关（占位）
│   └── AI 审计日志
└── 设置中心（Settings）
    ├── 主题切换（暖阳/夜幕/追随系统）
    ├── 语言切换（中/英）
    ├── 自动保存开关
    ├── 自定义记录模块管理
    ├── 数据管理（JSON/CSV/MD 导出 + 导入）
    ├── 桌面宠物设置
    └── 关于信息
```

### 2.2 页面路由

| 路径 | 页面名称 | 功能简述 |
|------|----------|----------|
| `/` | 今日记录 | 日常记录入口，待办/总结/宠物/记录/复盘 |
| `/growth` | 成长回顾 | 周/月维度的成长数据分析与回顾 |
| `/knowledge` | 知识库 | 知识树浏览、AI问答、双链图谱、复习队列 |
| `/calendar` | 日历视图 | 月历网格、按日查看/编辑记录 |
| `/privacy` | 隐私与数据 | 数据路径、AI配置、连接测试、审计日志 |
| `/settings` | 设置中心 | 主题/语言/模块/数据/宠物/关于 |

---

## 三、功能详细需求

### 3.1 今日记录模块

#### 3.1.1 多模块记录

**需求描述**: 用户可以在同一页面切换不同记录类型，每种类型有专属的三问模板。

**内置模块**:

| 模块 | 字段1 | 字段2 | 字段3 |
|------|-------|-------|-------|
| 日记 | 今天值得记下的 | 此刻的心情 | 想记住的一句话 |
| 工作日志 | 今天做了什么 | 卡在哪里 | 下一步计划 |
| 学习笔记 | 今天学到什么 | 还有哪里没懂 | 想深挖的点 |

**自定义模块**: 用户可在设置中创建自定义记录类型，支持：
- 自定义模块名称
- 自定义字段数量和标签
- 图片附件上传
- AI 复盘功能

**验收标准**:
- [x] 切换模块时清空当前表单
- [x] 自定义模块在模块切换栏显示
- [x] 自定义模块的记录支持 AI 复盘
- [x] 图片附件支持预览和删除

#### 3.1.2 富文本编辑器

**需求描述**: 支持纯文本和富文本两种编辑模式，富文本基于 Tiptap 实现。

**富文本功能**:
- 粗体、斜体、下划线
- 有序/无序列表
- 引用块
- 代码块
- 链接插入
- 标题（H1/H2/H3）
- 撤销/重做

**快捷键**:
| 快捷键 | 功能 |
|--------|------|
| Ctrl+S | 保存当前记录 |
| Ctrl+E | 切换富文本/纯文本模式 |
| Ctrl+Shift+A | 触发 AI 复盘 |
| Ctrl+D | 插入当前日期（纯文本模式） |
| Ctrl+L | 插入双链 `[[]]`（纯文本模式） |

#### 3.1.3 AI 复盘

**需求描述**: 基于用户记录内容，AI 自动生成四段结构化复盘。

**四段结构**:
1. **今日成果** (achievements) — 从用户文本中提取
2. **学习收获** (learnings) — 从用户文本中提取
3. **待改进** (improvements) — 从用户文本中提取
4. **明日行动** (actions) — 从用户文本中提取

**AI 模式**:

| 模式 | 说明 | 配置要求 |
|------|------|----------|
| local | 本地镜像（离线、免Key、纯整理） | 无需配置 |
| byok | 自带Key（Ollama/OpenAI兼容） | API Key + BaseURL + Model |
| cloud | MindFlow订阅云模型 | VITE_MINDFLOW_LLM_ENDPOINT |

**设计红线**:
1. 绝不编造内容 — 只基于用户给定文本
2. 绝不静默替用户定稿 — 输出前必须声明「草稿·需你确认」
3. 每段须能回溯到用户原文 — 溯源校验（coverage >= 0.35）
4. 网络错误/解析失败 → 回退到本地镜像

**溯源校验算法**:
- 3字滑动窗口（shingle）集合比对
- 短文本(<8字)或占位文本免校验
- 模型自报 accuracyFlag=true 但 passed=false 时强制 false

**用户交互**:
- 采纳：将 AI 生成内容写入记录
- 丢弃：清除 AI 生成内容
- 还原：恢复到用户原始输入

#### 3.1.4 每日待办事项

**需求描述**: 在首页显示当日待办事项，支持 CRUD 操作。

**功能点**:
- 添加待办（文本 + 优先级：低/中/高）
- 勾选完成/取消完成
- 删除待办
- 进度条显示完成率
- 30天自动清理已完成待办

**数据模型**:
```typescript
interface TodoItem {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'normal' | 'high'
  date: string           // YYYY-MM-DD
  createdAt: string
  completedAt?: string
}
```

#### 3.1.5 每日总结卡片

**需求描述**: 自动聚合当日所有记录，生成结构化总结。

**展示内容**:
- 今日记录总数
- 模块分布（日记/工作/学习各多少条）
- 总字数统计
- 标签汇总
- 心情汇总
- 关键亮点（前5条记录摘要）
- 去年今日对比

#### 3.1.6 使用时间监控

**需求描述**: 记录用户每日软件使用时长。

**实现方式**:
- **MindFlow 自身**: 通过浏览器 focus/blur 事件追踪
- **外部应用（Electron/Windows）**: 通过 Win32 API 获取前台窗口信息
  - 采样间隔: 4秒
  - 空闲阈值: 5分钟无输入不计入
  - 按日持久化: `userData/usage/usage-YYYY-MM-DD.json`

**展示**: 首页独立卡片，显示 MindFlow 使用时长 + 外部应用排行

#### 3.1.7 桌面宠物

**需求描述**: 在首页右上角显示宠物组件，增加趣味性。

**预设形象**: 猫🐱 / 狗🐶 / 植物🌱 / 自定义上传

**功能**:
- 点击互动：摇尾巴动画 + 随机鼓励语（3秒气泡）
- 每日语录：每日随机显示一条名言
- 待办提醒：显示今日待办完成情况
- 设置面板：左侧边栏可配置宠物名称、形象、功能开关

#### 3.1.8 元数据自动记录

**需求描述**: 记录时自动附加时间、地点、天气信息。

**数据来源**:
- 时间：本地格式化
- 位置：Geolocation API + Nominatim 反向地理编码
- 天气：wttr.in API（中文描述 + 图标映射）

#### 3.1.9 语音输入

**需求描述**: 支持语音转文字输入，基于 Web Speech API。

**特性**:
- 中文识别支持
- 转写文字追加到第一个 prompt 字段
- 实时状态指示（录音中/识别中/完成）

#### 3.1.10 智能标签推荐

**需求描述**: 基于用户输入内容自动推荐标签。

**算法**: TF-IDF 简化版 + 中文2-4字滑动窗口分词 + 停用词过滤

**交互**: 用户可点击推荐标签添加，也可手动输入

---

### 3.2 成长回顾模块

#### 3.2.1 周回顾

**展示内容**:
- **复盘完成度环形图**: 本周采纳复盘数 / 本周总记录数
- **统计卡片**: 本周记录数、复盘采纳数、累计卡片数
- **本周叙事**: 自动生成的文字总结
- **记录分布柱状图**: 周一至周日每天记录数
- **模块分布**: 各模块记录数柱状图
- **标签 Top 5**: 本周最常用标签
- **待办统计**: 本周待办完成率
- **工作周报生成**: 聚合本周工作日志生成 Markdown 周报

#### 3.2.2 月回顾

**展示内容**:
- **月份导航**: 上月/下月/本月切换
- **月统计卡片**: 记录数、活跃天数、总字数、复盘采纳数
- **月叙事**: 自动生成的文字总结
- **每日记录热力图**: 按天显示，颜色深浅表示记录数量
- **模块分布**: 各模块记录数柱状图
- **标签 Top 10**: 本月最常用标签
- **待办完成统计**: 总数/已完成/完成率 + 进度条

---

### 3.3 知识库模块

#### 3.3.1 知识树浏览

**需求描述**: 按年/月分层展示所有记录，支持搜索过滤。

**功能点**:
- 左侧文件树：年 → 月 → 条目
- 右侧预览：选中条目的 Markdown 渲染
- 搜索框：按内容/标签/日期过滤
- 导出：单条下载 / 批量导出 / 复制到剪贴板

#### 3.3.2 AI 知识库问答

**需求描述**: 用户可以用自然语言提问，系统基于记录内容回答。

**实现流程**:
1. 关键词提取（中文滑动窗口分词 + 日期格式识别）
2. 多维度检索（内容×3 + 标签×5 + 日期×10 + 模块名×2）
3. 拼接上下文，调用 AI 生成回答
4. local 模式下使用本地摘要（不依赖 AI）

**日期识别支持**: `8月3日` / `8-3` / `2026-08-03` 等格式

#### 3.3.3 双链图谱可视化

**需求描述**: 将知识条目之间的引用关系可视化为力导向图。

**数据模型**:
```typescript
interface GraphNode {
  id: string
  label: string
  type: 'entry' | 'tag'
  count: number
  date?: string
  module?: string
}
interface GraphEdge {
  source: string
  target: string
}
```

**规则**: 过滤引用>=2次的节点，最多60个节点

#### 3.3.4 间隔重复复习队列

**需求描述**: 基于 SM-2 算法的间隔重复系统，帮助用户复习重要记录。

**数据模型**:
```typescript
interface SRCard {
  entryId: string
  easiness: number      // >=1.3, 默认2.5
  interval: number      // 天数
  repetitions: number   // 连续正确次数
  dueDate: string       // YYYY-MM-DD
  lastReview?: string
}
```

**评分**: 0-5 分，根据评分更新卡片参数

---

### 3.4 日历视图模块

**需求描述**: 月历网格视图，按日查看和编辑记录。

**功能点**:
- 月份导航（上月/下月/本月）
- 日期网格：当月日期 + 上下月填充
- 记录指示点：有记录的日期显示彩色圆点（最多3个 + 计数）
- 点击日期：侧栏显示当日记录列表
- 月统计：总记录数、日记数、工作数、学习数
- 编辑功能：每条记录可点击编辑（弹窗模式，保留富文本）
- 待办显示：当日待办独立区域

---

### 3.5 隐私与数据模块

#### 3.5.1 数据存储路径管理

**需求描述**: 显示当前数据存放路径，支持修改。

**功能点**:
- 显示当前数据路径（Electron 环境通过 IPC 获取）
- 一键复制路径
- 修改路径（手动输入或文件夹选择器）
- 修改后需重启生效提示
- Web 环境降级提示（浏览器 IndexedDB）

#### 3.5.2 AI 模式配置

**需求描述**: 配置 AI 复盘的运行模式和参数。

**配置项**:
- AI 模式选择（local/byok/cloud）
- API Key（byok 模式）
- Base URL（byok 模式，支持 Ollama 和 OpenAI 兼容）
- 模型名称（byok/cloud 模式）
- 连接测试按钮（先 models 端点探测，失败再极小 chat 请求）

#### 3.5.3 E2EE 加密

**当前状态**: 占位，属 M3b 规划

**UI**: 开关按钮，切换时记录审计日志

#### 3.5.4 AI 审计日志

**需求描述**: 记录所有 AI 相关操作，供用户审查。

**记录的操作**:
- 生成复盘
- 采纳/丢弃复盘
- 切换 AI 模式
- 加密开关
- AI 回退本地

---

### 3.6 设置中心模块

#### 3.6.1 主题设置

**三种模式**:
- 暖阳（light）— 浅色主题
- 夜幕（dark） — 深色主题
- 追随系统（auto）— 跟随系统偏好

**持久化**: localStorage `theme`

#### 3.6.2 语言设置

**支持语言**: 中文(zh) / 英文(en)

**持久化**: localforage `settings:language`

#### 3.6.3 自动保存

**功能**: 开启后，关闭应用前自动保存当前编辑内容

#### 3.6.4 自定义记录模块管理

**功能**:
- 创建自定义模块（名称 + 字段列表）
- 编辑已有模块
- 删除模块（已有记录不删除）

#### 3.6.5 数据管理

**导出**:
- JSON 完整备份（密钥脱敏，与 importService 往返兼容）
- CSV（UTF-8 BOM，Excel 直接打开）
- Markdown（单文件全量，Obsidian 可直接打开）

**导入**（支持 5 种源格式）:
- JSON（MindFlow/MindFlow 备份）
- TXT（微信小记）
- TXT/HTML（苹果备忘录）
- CSV（Notion 导出）
- Markdown（Notion 导出）

**冲突处理**: 跳过 / 覆盖 / 追加

---

## 四、数据模型

### 4.1 核心实体

#### JournalEntry（日志条目）

```typescript
interface JournalEntry {
  id: string                    // UUID
  date: string                  // YYYY-MM-DD
  module: ModuleType            // 'diary' | 'work' | 'study' | 自定义ID
  mood?: string                 // 心情（仅日记模块）
  prompts: JournalPrompt[]      // 结构化内容
  title?: string                // 标题
  tags: string[]                // 标签
  links: string[]               // 双链
  createdAt: string             // ISO 时间戳
  updatedAt: string             // ISO 时间戳
  review?: AIReview             // AI 复盘
  reviewMark?: boolean          // 复习标记
  wikiLinks?: string[]          // [[xxx]] 双链提取
  metadata?: EntryMetadata      // 元数据
}
```

#### TodoItem（待办事项）

```typescript
interface TodoItem {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'normal' | 'high'
  date: string                  // YYYY-MM-DD
  createdAt: string
  completedAt?: string
}
```

#### DaySummary（每日总结）

```typescript
interface DaySummary {
  date: string
  summary: string
  mood: string
  weather: string
  habits: DaySummaryHabit[]
  dailyCheck: {
    energyLevel: number         // 1-10
    stressLevel: number         // 1-10
    productivity: number        // 1-10
  }
  comfortZoneEntry: string
  customSections: CustomSection[]
  tags: string[]
  media: MediaItem[]
  sparks: string[]
}
```

#### CustomModule（自定义模块）

```typescript
interface CustomModule {
  id: string
  name: string
  icon: string                  // lucide 图标名
  prompts: {
    id: string
    label: string
    placeholder: string
  }[]
  createdAt: string
}
```

### 4.2 持久化存储

| 键名 | 存储引擎 | 内容 |
|------|----------|------|
| `mindflow:journal` | IndexedDB | 日志条目 + AI偏好 + 审计日志 + 自定义模块 |
| `mindflow:todos` | IndexedDB | 待办事项 |
| `settings` | IndexedDB | 应用设置 |
| `mindflow:pet` | IndexedDB | 桌面宠物配置 |
| `mindflow:analytics` | IndexedDB | 埋点事件（环形5000条） |
| `mindflow:ab` | IndexedDB | A/B实验分桶 |
| `mindflow:sr_cards` | localStorage | 间隔重复卡片 |
| `mindflow:usage` | IndexedDB | 使用时长数据 |
| `settings:language` | IndexedDB | 语言偏好 |
| `theme` | localStorage | 主题偏好 |

---

## 五、技术架构

### 5.1 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue 3 | ^3.5.10 |
| 构建工具 | Vite | ^5.4.8 |
| CSS 框架 | Tailwind CSS | ^3.4.14 |
| 状态管理 | Pinia (主) + Vuex (兼容层) | Pinia ^4.0.2 / Vuex ^4.1.0 |
| 路由 | vue-router | ^4.4.5 |
| 国际化 | vue-i18n | ^9.14.5 |
| 富文本编辑器 | Tiptap 3 | ^3.29.2 |
| 本地存储 | localforage (IndexedDB) | ^1.10.0 |
| 桌面框架 | Electron | ^33.0.1 |
| 打包工具 | electron-builder | ^26.15.3 |
| 图标库 | lucide-vue-next | ^0.130.0 |
| 测试框架 | Vitest + happy-dom | ^3.2.4 |
| 类型检查 | TypeScript + vue-tsc | ^5.5.3 |

### 5.2 设计系统 —「纸·墨·流」

**设计理念**: 安静纸感背景、深墨字、单一流青强调色

**颜色系统** (CSS 变量通道化):
- `--paper`: 纸感背景
- `--surface` / `--surface-2`: 卡片表面
- `--ink` / `--ink-2`: 主文字/次要文字
- `--accent`: 流青强调色 (#2F7E6E)
- `--ember`: 暖琥珀
- `--danger`: 危险红

**设计红线**:
1. 严禁恢复旧 beige/glass-effect/AI 紫蓝渐变
2. 去 AI 味：无 AI 紫/蓝、无霓虹、无玻璃拟态堆叠
3. 单一克制的主色（流青），大量留白，编辑式排版

### 5.3 Electron 主进程能力

**IPC 接口清单**:

| 类别 | 通道 | 功能 |
|------|------|------|
| 媒体 | `media:save/read/delete/list/open/reveal` | 本地媒体文件管理 |
| 存储 | `storage:get-path/set-path/pick-folder` | 数据路径管理 |
| 使用时长 | `usage:get-foreground-app/get-apps/reset-daily` | Windows 应用使用监控 |
| AI | `ai:fetch` | 主进程网络请求转发 |
| 生命周期 | `fromMain` | 应用打包状态通知 |

**安全限制**:
- 单文件上限: 10MB
- 总存储上限: 100MB
- 路径穿越防护 + SHA256 校验和 + 原子写入
- AI fetch URL 白名单: 仅 https:// 或 http://localhost

---

## 六、产品指标

### 6.1 北极星指标

**WAR（周活跃复盘用户）**: 每周至少采纳 1 次 AI 复盘的独立用户数

### 6.2 分层指标

| 层级 | 指标 | 首年基线目标 |
|------|------|-------------|
| **参与** | DAU/MAU | 15-25% |
| **参与** | 人均日记录 | 1.5-3 条 |
| **AI价值** | AI 周触发率 | >= 30% |
| **AI价值** | AI 复盘采纳率 | >= 40-50% |
| **留存** | D7 留存 | >= 30-35% |
| **留存** | D30 留存 | >= 12-18% |
| **资产** | 人均年 MD 文档 | 50-150 篇 |
| **增长** | 付费转化 | 3-8% |

### 6.3 埋点事件（23 个）

| 事件名 | 触发时机 |
|--------|----------|
| `signup` | 用户首次使用 |
| `first_entry_created` | 首次创建记录 |
| `entry_created` | 创建记录 |
| `link_created` | 创建双链 |
| `history_reviewed` | 查看历史记录 |
| `search_query` | 搜索查询 |
| `ai_review_exposure` | AI 复盘曝光 |
| `ai_review_triggered` | 触发 AI 复盘 |
| `ai_review_generated` | AI 复盘生成 |
| `ai_review_viewed` | 查看 AI 复盘 |
| `ai_review_adopted` | 采纳 AI 复盘 |
| `ai_review_dismissed` | 丢弃 AI 复盘 |
| `ai_review_edited` | 编辑 AI 复盘 |
| `ai_review_restored_original` | 还原原始内容 |
| `ai_review_declined_reason` | 丢弃原因 |
| `trust_score_submitted` | 信任评分提交 |
| `weekly_review_generated` | 生成周报 |
| `weekly_review_viewed` | 查看周报 |
| `import_completed` | 导入完成 |
| `export_triggered` | 触发导出 |
| `app_crash` | 应用崩溃 |
| `sync_success` | 同步成功 |
| `sync_fail` | 同步失败 |

### 6.4 A/B 实验

| 实验ID | 名称 | 对照 | 实验组 |
|--------|------|------|--------|
| `exp1_privacy` | 隐私徽标 | 不展示 | 展示「本地·不训练·可关」 |
| `exp2_quote` | 复盘语气 | 纯镜像直引 | 允许轻度结构整理 |
| `exp3_default` | 默认展开 | 手动点击 | 首次自动预填草稿 |

---

## 七、里程碑与发布计划

### 7.1 已完成里程碑

| 里程碑 | 版本 | 完成日期 | 交付内容 |
|--------|------|----------|----------|
| M1 界面重建 | v1.0 | 2026-08-01 | 设计系统 + 四视图 + AI复盘mock + MD导出 |
| M1 收尾工程 | v1.0 | 2026-08-02 | 真实AI客户端 + 埋点(23事件) + A/B(3实验) |
| M2-core | v1.1 | 2026-08-02 | 双链提取 + 工作周报 + 复习队列 + 周回顾 |
| 功能补全 | v1.1 | 2026-08-02 | 日历 + 设置 + 知识库问答 + 无损导入 |
| Pinia迁移+新功能 | v1.1 | 2026-08-02 | Pinia迁移 + 待办 + 天气 + 每日总结 |
| M3a 知识网络 | v1.2 | 2026-08-02 | 双链图谱 + 智能标签 + 间隔重复 + 语音输入 |
| 功能优化批次 | v1.2 | 2026-08-03 | 数据修复 + AI测试 + 使用监控 + 自定义模块 + 宠物 |
| 产品交付 | v1.2 | 2026-08-04 | 月回顾 + 数据路径 + Windows安装包 |

### 7.2 计划里程碑

| 里程碑 | 版本 | 计划日期 | 交付内容 |
|--------|------|----------|----------|
| M3b 多端同步 | v1.3 | 待定 | E2EE落地 + Capacitor移动端 |

### 7.3 发布门槛

| 里程碑 | 门槛指标 |
|--------|----------|
| M1 v1.0 | 崩溃率 < 1% + 激活率 >= 60% |
| M2 v1.1 | 导入成功率 >= 95% + 人均日记录 >= 2 |
| M3a v1.2 | 双链可用 + SQLite迁移零丢失 |
| M3b v1.3 | 同步冲突率 < 1% + E2EE通过安全审计 |

---

## 八、非功能需求

### 8.1 性能

- 首屏加载 < 3s（Vite 懒加载 + 代码分割）
- 虚拟列表支持大量记录（vue-virtual-scroller）
- 图表懒加载（ECharts 动态 import）
- 本地存储环形截断（埋点 5000 条上限）

### 8.2 安全

- CSP 配置：connect-src 支持 https: + http://localhost:* + ws://localhost:*
- AI fetch URL 白名单：仅 https:// 或 http://localhost
- 媒体文件路径穿越防护
- JSON 导出密钥脱敏（aiKey -> '***'）
- Electron contextIsolation + nodeIntegration:false

### 8.3 可访问性

- 焦点陷阱（模态对话框）
- 键盘可达（所有交互元素）
- 语义化 aria 标签
- 减弱动效支持（prefers-reduced-motion）

### 8.4 国际化

- 支持中文/英文
- 所有界面文案使用 $t() 国际化函数
- 语言偏好持久化

---

## 九、已知限制与后续规划

### 9.1 当前限制

1. E2EE 加密为占位（属 M3b 规划）
2. Vuex 兼容层仍存在（旧组件兼容）
3. 埋点/A-B 仅本机存储，不联网上报
4. PDF 导出未实现（jspdf 中文需嵌字体）
5. SQLite 迁移暂缓（IndexedDB 稳定运行）

### 9.2 后续优化方向

1. **E2EE 落地**: 端到端加密同步
2. **Capacitor 移动端**: iOS/Android 原生应用
3. **系统托盘**: 最小化到托盘
4. **开机自启**: 可选开机自动启动
5. **历史趋势图表**: 24h/7d 趋势可视化
6. **AI 多模态**: 图片识别 + 语音复盘

---

## 附录

### A. 快捷键清单

| 快捷键 | 功能 | 作用域 |
|--------|------|--------|
| Ctrl+N | 回到今日新建记录 | 全局 |
| Ctrl+F | 跳转知识库搜索 | 全局 |
| Ctrl+, | 打开设置 | 全局 |
| Ctrl+S | 保存当前记录 | 今日页 |
| Ctrl+E | 切换富文本模式 | 今日页 |
| Ctrl+Shift+A | 触发 AI 复盘 | 今日页 |
| Ctrl+D | 插入当前日期 | 纯文本模式 |
| Ctrl+L | 插入双链 | 纯文本模式 |

### B. 存储路径

- **安装版**: `C:\Users\{用户名}\AppData\Roaming\MindFlow\`
- **便携版**: exe 所在目录下的 `data\` 文件夹
- **macOS**: `~/Library/Application Support/MindFlow/`
- **Linux**: `~/.config/MindFlow/`

### C. 支持的媒体格式

图片: `.jpg, .jpeg, .png, .gif, .webp`  
视频: `.mp4, .webm`  
音频: `.ogg, .mp3, .wav`

单文件上限: 10MB  
总存储上限: 100MB
