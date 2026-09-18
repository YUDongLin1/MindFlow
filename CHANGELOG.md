# Changelog

All notable changes to MindFlow 智流日志（前身为 MoodsNote）will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.5/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 📝 Docs

- README（中 / 英）新增产品界面预览：顶部主图 + 6 张截图画廊（今日 / 成长 / 知识库 / 日历 / 隐私 / 深色模式），位于 `docs/screenshots/`
- 移除内部素材 `docs/MiMo-Desktop-内测申请-素材.md` 的全部引用与 `.gitignore` 规则（不公开，文件从未进入 git 历史）

## [1.0.0] - 2026-08-03

### 🎉 MindFlow 智流日志首个版本

基于开源项目 MindFlow（MindFlow/MindFlow，AGPL-3.0）二次开发，从日记应用升级为本地优先、AI 驱动的个人成长记录中枢。

### ✨ Features

- **三模块记录**：日记三问 / 工作日志三字段 / 学习笔记三维度，统一存储、统一检索、统一复盘
- **AI 复盘**：三模式 AI（本地镜像 / 自带 Key / 云端），四段式结构化复盘，12s 超时保护，溯源校验（shingle 覆盖率）防幻觉，采纳/丢弃/还原三态 + 完整审计日志
- **AI 连接测试**：设置/隐私页 models 端点探测（chat 回退，15s 超时）
- **知识库**：自动生成 Markdown（frontmatter + 双链）、Canvas 力导向图谱、SM-2 间隔重复复习、全文检索与 AI 问答
- **追踪与视图**：心情/精力/压力追踪（ECharts 可视化）、每日待办（同步成长页与日历）、日历月视图、每日总结卡片、工作周报
- **数据管理**：导出 JSON 完整备份（API Key 脱敏）/ CSV（UTF-8 BOM）/ Markdown；导入 5 种格式（JSON/TXT/CSV/Markdown/HTML，按内容自动识别）+ 冲突预检
- **桌面宠物**：预设猫/狗/植物 + 自定义上传，点击互动与待办提醒
- **自定义记录模块**：自定义字段与图片附件，AI 复盘同样生效
- **快捷键**：全局 Ctrl+N/F/, + 今日页 Ctrl+S/E/D/L/Shift+A，共 8 个
- **存储位置可配置**：设置页自定义存储路径与恢复默认

### 🔧 技术升级

- Quill → **Tiptap** 富文本迁移；Chart.js → **ECharts**（vue-echarts）可视化迁移
- Vuex → **Pinia** 迁移（保留 Vuex 兼容层），新增 pet store（共 6 个 stores）
- 「纸·墨·流」设计系统，明暗主题 CSS 变量通道化

### 🛠️ 验收修复

- package.json 与 lock 依赖同步（新增 pinia/echarts/vue-echarts/@tiptap 系列等，移除 quill/jspdf/chart.js 等）
- 删除死脚本 electron:serve/electron:build；清理未路由遗留视图（Analytics.vue/DaySummary.vue）与废弃组件、useDataMigration.ts
- electron/package.json 更名 mindflow-electron@1.0.0；主进程菜单品牌化，窗口图标改 extraResources 随包方案，修复前台应用探测 PowerShell 缺陷
- 备份文件名前缀 moodsnote-backup → mindflow-backup；vite sourcemap 关闭，BUILD_DATE 构建时注入
- 清理 18 个 dist_old_* 目录，.gitignore 补充相应规则；mac 打包暂移除 mas target（待签名凭据）

### 📦 Distribution

- Windows：NSIS 安装版（MindFlow Setup 1.0.0.exe）+ 便携版（MindFlow 1.0.0.exe），输出至 dist-electron/

### 🐛 Known Issues

- type-check 存在 11 个预存测试类型错误（happy-dom 声明、vi 引用等）
- 根 package.json 的 homepage/repository/bugs 仍指向 MindFlow/MoodsNote（MindFlow 暂无独立仓库）
- npm audit 存在 15 个预存漏洞；E2EE 加密仍为占位（M3b 规划）

---

## [1.0.5] - 2025-10-27

### 🎉 Initial Release

The first public release of MoodsNote - a local-first journaling app built with care.

### ✨ Features

#### Writing Experience
- **Daily Summary Editor**: Rich text editing powered by Quill with mood and weather tagging
- **Custom Sections**: Add personalized sections to organize your thoughts
- **Tags System**: Tag your entries for easy categorization and retrieval
- **Comfort Zone Entry**: Document what takes you out of your comfort zone
- **Sparks**: Quick capture for fleeting thoughts and inspiration
- **Media Support**: Attach images, videos, and audio to your entries
  - Local storage via Electron (10MB per file, 100MB total)
  - Secure file management with validation
- **Export Options**: 
  - JSON (full data backup)
  - CSV (for spreadsheet analysis)
  - Markdown (human-readable format)

#### Time & Views
- **Calendar View**: Visual overview of your journaling journey with mood indicators
- **This Day Last Year**: Reflect on what you were doing one year ago
- **Daily Quote**: Inspirational quotes to start your day

#### Analytics & Insights
- **Mood Trend Chart**: Visualize your emotional patterns over time
- **Energy & Stress Tracking**: Monitor your daily check-in metrics
  - Energy level (1-10)
  - Stress level (1-10)
  - Productivity (1-10)
- **Word Count Statistics**: Track your writing volume by month
- **Habit Tracking**: 
  - Create and monitor daily habits
  - Track completion status (did/partial/not)
  - View streak and trend insights
  - Today's habit completion summary

#### Data & Privacy
- **Local-First Architecture**: All data stored in IndexedDB via LocalForage
- **Offline-Ready**: Works completely offline with no server dependency
- **Backup & Import**:
  - One-click export with versioned format (v2.0.0)
  - Import with conflict preview and resolution
  - Smart merge strategies (merge/replace/skip)
  - Automatic migration from older backup formats
- **Data Validation**: Runtime type guards ensure data integrity

#### User Experience
- **Keyboard Shortcuts**: Extensible keyboard shortcut system
- **Search Functionality**: Find entries quickly by keyword and date
- **Virtual List**: Performance-optimized rendering for large datasets
- **Lazy Loading**: Images load on-demand for better performance
- **Theme Support**: Light and dark modes
- **Internationalization**: 
  - Chinese (简体中文)
  - English
- **Accessibility**: 
  - Focus trap management
  - Keyboard navigation
  - ARIA labels and semantic HTML
  - Screen reader support

#### Technical Highlights
- **Vue 3 + Composition API**: Modern, maintainable codebase
- **TypeScript**: Type-safe development
- **Vite**: Lightning-fast dev server and builds
- **Electron 33**: Secure desktop app with context isolation
- **Chart.js**: Beautiful, interactive data visualizations
- **Tailwind CSS**: Responsive, utility-first styling
- **Vitest**: Comprehensive test coverage

### 🔒 Security
- Content Security Policy (CSP) implementation
- DOMPurify for XSS protection
- Electron security best practices:
  - Context isolation enabled
  - Node integration disabled
  - Secure preload bridge
- Media file validation and size limits

### 📦 Distribution
- Cross-platform support: macOS, Windows, Linux
- Proper app icons (.icns for Mac, .ico for Windows)
- electron-builder configuration for packaging

### 🐛 Known Issues
- PDF export is planned but not yet implemented
- Code signing not included (users will see security warnings)
- Auto-update mechanism not implemented

### 📝 Documentation
- Comprehensive README in Chinese and English
- Installation and development instructions
- Build and test commands
- FAQ section
- Project structure documentation

---

## [Unreleased]

### Planned Features
- Cloud sync (optional, privacy-focused)
- Mobile apps (iOS/Android)
- Advanced search with filters
- Custom themes and styling
- Encrypted backup option
- PDF export
- Audio recording for voice notes
- More chart types and analytics

---

[1.0.5]: https://github.com/MindFlow/MoodsNote/releases/tag/v1.0.5
