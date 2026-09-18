<!-- ============================================================
README 求职版草稿 —— 确认内容后替换根目录 README.md 即可
🔍【需补充】标记处需要你填写实测数据/截图后删除标记
注意：保留英文版 README.en.md 同步更新（可后置）
============================================================ -->

<div align="center">
  <img src="./public/icon.png" alt="MindFlow" width="110" />
</div>

# MindFlow 智流日志

<div align="center">

**本地优先的 AI 个人成长记录中枢 —— 记录 · 复盘 · 沉淀，三位一体**

简体中文 | [English](./README.en.md)

</div>

<p align="center">
  <img src="https://img.shields.io/badge/license-AGPL--3.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/version-1.0.1-green" alt="Version" />
  <img src="https://img.shields.io/badge/Electron-33-blue?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?logo=vue.js" alt="Vue" />
  <img src="https://img.shields.io/badge/tests-32%2F32%20passing-brightgreen" alt="Tests" />
</p>

<!-- 🔍【需补充：替换为新 UI 主截图，建议 docs/screenshots/today.png】
<p align="center">
  <img src="./docs/screenshots/today.png" width="820" alt="MindFlow 今日视图" />
</p>
-->

<p align="center">
🔍【需补充：一行数据条，示例 →】
<b>32/32</b> 单元测试 · <b>87MB</b> 一键安装包 · <b>23 类</b>行为埋点 · <b>100%</b> 数据本地化
</p>

---

## 1️⃣ 项目背景与痛点

记录工具很多，但「记了不复盘、复盘不沉淀、沉淀难复用」的断点普遍存在：

| 痛点 | 现状 | MindFlow 的回答 |
|------|------|-----------------|
| 日记、工作日志、学习笔记分散在 3+ 个 App | 上下文割裂，回顾成本高 | 三模块一体化记录，统一时间线与知识库 |
| 写完就归档，从未产生"第二次阅读" | 记录变成沉没成本 | AI 复盘 + 双链图谱 + SM-2 间隔重复复习队列，让旧记录主动"回来" |
| 云端 AI 笔记的隐私焦虑 | 原文被上传、被训练 | **Local-First 架构：数据 100% 留在本机**，AI 可选离线镜像模式，断网全功能可用 |
| AI 输出"一本正经地编造" | 用户不敢采信 | 溯源校验机制：每段 AI 输出必须能回溯到原文，否则标红 |

## 2️⃣ 目标用户与场景

- **研究生 / 自学者**：文献笔记 + 实验日志分散，需要"学习三维度"模板与知识库问答串联旧笔记
- **职场新人**：工作日报、周报重复劳动，需要一键工作周报与"上周卡点→本周计划"自动衔接
- **注重隐私的个人成长者**：愿意记录真实心绪，但拒绝原文上云

## 3️⃣ 解决方案与产品架构

**核心闭环：记录 → AI 复盘 → 知识沉淀 → 复习回访**

```mermaid
flowchart LR
    subgraph Record[记录层]
        A[今日页<br/>三模板引导提问<br/>Tiptap 富文本/语音输入]
        A2[自动元数据<br/>时间·地点·天气]
    end
    subgraph Grow[成长层]
        B[AI 复盘镜像<br/>草稿·需你确认]
        C[数据洞察<br/>ECharts 月回顾/热力图]
    end
    subgraph Settle[沉淀层]
        D[双链图谱<br/>[[wiki-link]]]
        E[智能标签 TF-IDF]
        F[复习队列 SM-2]
    end
    subgraph Infra[底座]
        G[(localforage<br/>IndexedDB 本地存储)]
        H[导出 JSON/CSV/MD<br/>自动 Markdown 知识库]
    end
    Record --> Grow --> Settle --> H
    Record --> G
    Grow --> G
    Settle --> G
```

技术栈：Vue 3.5 + TypeScript + Vite 5 + Pinia + Tiptap + ECharts + Tailwind 3.4 + Electron 33，状态管理已由 Vuex 迁移至 Pinia（保留兼容层），可视化由 Chart.js 迁移至 ECharts。

## 4️⃣ AI 能力设计（为什么这么做，而不是做什么）

**三模式渐进可用，隐私与智能可自选**：

| 模式 | 原理 | 适用 |
|------|------|------|
| `local` | 规则引擎离线生成"镜像式复盘"，免 Key、免网络 | 默认模式，隐私敏感用户 |
| `byok` | 用户自带 Key，接入 Ollama 本地模型或任意 OpenAI 兼容 API | 想要真 AI 的用户，Key 只存本机 |
| `cloud` | 订阅云模型端点（预留） | 后续商业化 |

**四条不可协商的产品红线**（写入代码注释与测试用例）：

1. **绝不编造** —— AI 只基于用户原文组织语言，禁止补写事实；
2. **绝不静默定稿** —— 所有 AI 输出标注「草稿·需你确认」，采纳/丢弃/还原三态齐备，AI 是镜子不是写手；
3. **可溯源** —— `checkProvenance` 对每个输出片段回溯原文，覆盖率不达标即标红；
4. **优雅降级** —— 网络/解析失败自动回退本地镜像（`source='local-fallback'`），功能不中断。

> 这套红线的本质是**信任设计**：AI 记录工具一旦编造一次，用户就再也不会打开它。🔍【需补充：可放一张 AI 复盘界面截图】

## 5️⃣ 核心指标与效果验证

🔍【需补充：以下为已确认项与待测项，只保留实测数据】

- ✅ 单元测试 **32/32 通过**（Vitest，覆盖 aiClient / 数据迁移 / 冲突预检等核心链路）
- ✅ Windows 全链路交付：NSIS 安装包 87.21MB，安装/启动/卸载手工回归通过
- ✅ 行为埋点 **23 类事件** + **3 组 A/B 实验**框架落地，支撑迭代决策
- 🔍 冷启动耗时：___s ｜ 空闲内存：___MB ｜ 导出 1000 条记录耗时：___s
- 🔍 小规模可用性测试：___ 人，核心任务完成率 ___%

## 6️⃣ 我的职责与产出

本项目基于开源项目 [MoodsNote（PStarH/MoodNotes）](https://github.com/PStarH/MoodNotes)（AGPL-3.0）二次开发，以下为**我的独立产出**：

| 模块 | 上游基线 | 我的改动 | 价值 |
|------|----------|----------|------|
| 产品定位 | 单一心情日记 | 重新定义为「工作/学习/日记」三合一成长中枢 | 从记录工具升级为成长系统 |
| 界面架构 | 旧版仪表盘 | 全量重设计「今日/成长/知识库/隐私」四视图 + 设计系统「纸·墨·流」 | 🔍【需补充：截图对比】 |
| 状态管理 | Vuex 4 | 迁移至 Pinia（保留兼容层），统一 localforage 配置 | 可维护性，为 M3 同步铺路 |
| 编辑器 | Quill | 迁移至 Tiptap，富文本/纯文本一键切换 | 扩展性更好，双链语法原生支持 |
| 可视化 | Chart.js | 迁移至 ECharts，新增月度热力图/模块分布/标签 Top10 | 洞察密度提升 |
| AI 复盘 | 无 | 设计 local/byok/cloud 三模式 + 四条产品红线 + 溯源校验 | 差异化核心，见第 4 节 |
| 知识沉淀 | 无 | 双链图谱 + 智能标签 + SM-2 间隔重复复习队列 | 记录产生复利 |
| 桌面体验 | 无 | 系统托盘常驻、全局快捷键（Ctrl+N/F/, 等）、日历待办联动 | 日活留存抓手 |
| 数据能力 | 基础备份 | 5 格式无损导入 + 冲突预检、JSON/CSV/MD 导出、导出脱敏 AI Key | 迁移无门槛，隐私兜底 |
| 质量与交付 | 无 CI 产物 | 32 用例、CI 工作流、Windows NSIS 打包链路（含 EXE 资源补写、沙箱修复） | 可安装的完整产品 |

## 7️⃣ 快速开始

```bash
# 环境要求：Node.js 18+，Windows / macOS / Linux
git clone https://github.com/YUDongLin1/MindFlow.git
cd MindFlow
npm install
npm run dev          # 开发模式（Vite + Electron 热重载）
npm run test         # 运行 32 个单元测试
npm run package:win  # 打包 Windows 安装包
```

## 8️⃣ Roadmap

- [ ] M3b：端到端加密（E2EE）多端同步
- [ ] 移动端（Capacitor）适配
- [ ] AI 复盘 Prompt 配置化与效果评测集

## 9️⃣ 致谢与许可

- 上游项目：[MoodsNote 晨暮日记](https://github.com/PStarH/MoodNotes) —— 感谢 [@PStarH](https://github.com/PStarH) 的出色基座
- 本项目所有修改与新增功能同样以 **AGPL-3.0** 协议开源，详见 [LICENSE](./LICENSE)
