# MindFlow 开源推送 GitHub · 完整执行方案

> 生成日期：2026-09-18 ｜ 面向仓库：`E:\研究生文件\moodnote` ｜ 目标：`https://github.com/YUDongLin1/MindFlow`
> 用途：AI 产品经理求职 · 核心展示项目
> 标记说明：🔍【需补充】= 需要你根据实际情况填写/决策后才能执行

---

## 〇、推送前体检结论（基于本机实际扫描，2026-09-18）

| # | 发现 | 影响 | 处理方案 |
|---|------|------|----------|
| 1 | `origin` 指向上游 `PStarH/MoodNotes` | 直接 push 会推错仓库/无权限 | Step 2.2 重命名+新增远程 |
| 2 | 唯一 commit `87eb993` 作者为上游作者 `Rui <yehruei@163.com>`，本地 git 身份为空 | 你此后所有提交若不配置身份会失败或署名错误 | Step 1.1 配置身份 |
| 3 | README 致谢链接 `github.com/MindFlow/MindFlow` 为 **404 死链** | AGPL 合规瑕疵 + 面试诚信风险 | Step 1.5 / README 草稿已修正为 `PStarH/MoodNotes` |
| 4 | `package.json` 的 homepage/repository/bugs 指向不存在的 `PStarH/MindFlow` | 元数据错误 | Step 1.5 一键修正 |
| 5 | 根目录 **77 个 .ps1 + 57 个 .txt + 6 个 .log** 调试残留（未跟踪） | 极易 `git add .` 误提交 | Step 1.3 归档隔离 |
| 6 | `public/screenshots/*.png` 全部是**上游 MoodNotes 旧版 UI** 截图（beige 风格） | README 会"替上游打广告"，且与现产品不符 | Step 1.4 重拍截图 |
| 7 | `verification-screenshots/` 含个人桌面隐私（QQ、账号昵称、聊天窗口） | 隐私泄露 | 加入 .gitignore，不推送 |
| 8 | `.gitignore` 缺少 `.qoder/`、`.workbuddy/`、`dist-electron2/`、`nsis-3.10/`、`HANDOFF.md` 等 | AI 工作区/内部文档可能入库 | Step 1.2 追加规则 |
| 9 | 版本不一致：README 徽章 `1.0.0` vs `package.json` `1.0.1` | 细节减分 | Step 1.5 统一为 1.0.1 |
| 10 | `docs/MiMo-Desktop-内测申请-素材.md` 疑似内测申请材料 | 可能含内部信息 | ✅ 已删除（作者确认不需要：本地文件已不存在，从未进入 git 历史，`.gitignore` 规则同步移除） |

好消息：全仓库**未发现硬编码 API Key**（已扫 `sk-`/`apiKey` 模式）；`.env.example` 全部为空值；最大跟踪文件仅 1.2MB，**不需要 Git LFS**；跟踪文件仅 162 个，历史只有 1 个 commit，敏感信息扫描范围极小。

---

## 一、推送前准备

### 1.1 配置 Git 身份（必做，5 分钟）

Git 检测到你本地**没有配置 user.name / user.email**，不配置则无法提交。

```powershell
# ① 姓名：用 GitHub 用户名，保证 commit 头像能对上你的 GitHub 账号
git config --global user.name "YUDongLin1"

# ② 邮箱：强烈建议用 GitHub 提供的 noreply 邮箱（隐藏真实邮箱，防骚扰/防社工）
# 查看：GitHub → Settings → Emails → 勾选 "Keep my email addresses private"
#      页面会显示形如 12345678+YUDongLin1@users.noreply.github.com 的地址
git config --global user.email "🔍【需补充：你的 GitHub noreply 邮箱】"

# 验证
git config --global user.name; git config --global user.email
```

> 关于历史 commit：当前唯一 commit 是上游 v1.0.5 快照（作者 Rui），**保留不动是最诚实的做法**——它真实反映"从上游快照二次开发"的起点，你此后所有提交都会署名 YUDongLin1。面试时"commit 历史从哪开始"正好可以讲清项目来源。

### 1.2 补全 .gitignore（必做）

在项目根目录执行以下命令，将补充规则**追加**到现有 `.gitignore` 末尾（不会破坏已有规则）：

```powershell
@'

# ===== OSS 发布补充（2026-09-18）=====
# AI 助手工作区 / 内部交接文档（不对外）
/.qoder/
/.workbuddy/
/HANDOFF.md
# 根目录调试残留（注意：带斜杠前缀只匹配根目录，不影响 scripts/ 下的正式脚本）
/*.ps1
/*.txt
/*.log
/_local_archive/
# 构建产物与本地工具
/dist-electron2/
/nsis-3.10/
/verification-screenshots/
/dist_old_*/
'@ | Add-Content -Encoding utf8 .gitignore

# 验证：以下应无输出（说明根目录 ps1/txt 已被忽略）
git check-ignore app1.ps1 build-log.txt 2>$null
```

> ⚠️ 注意：`build-resources/installer.nsh` 是**正式 NSIS 打包脚本**（已核实内容），会被跟踪，这是正确的，不要忽略。

### 1.3 隔离根目录垃圾文件（必做，可逆操作）

不删除，只移入本地归档目录（已被 .gitignore 排除），随时可移回：

```powershell
New-Item -ItemType Directory -Force _local_archive | Out-Null
Get-ChildItem -File | Where-Object { $_.Name -match '^(app|check|test|verify|fix|build|asar|artifact|compare|patch|rebuild|run|smoke|update|validate)\d*.*\.(ps1|txt|js|log)$' } | Move-Item -Destination _local_archive
Get-ChildItem -File -Filter *.log | Move-Item -Destination _local_archive -ErrorAction SilentlyContinue

# 确认根目录剩余文件（应只剩正式项目文件）
Get-ChildItem -File | Select-Object -ExpandProperty Name
```

> 🔍【需补充】执行后请肉眼确认根目录剩余清单，如发现 `Move-Item` 误移了需要的文件，从 `_local_archive` 移回即可。

### 1.4 敏感信息清理（必做）

**A. 代码级扫描**（历史仅 1 个 commit，扫得非常干净）：

```powershell
# 历史提交全量扫描
git log -p --all | Select-String -Pattern "sk-[A-Za-z0-9]{20,}", "api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{16,}", "secret\s*[:=]", "password\s*[:=]\s*['\"]", "Bearer [A-Za-z0-9]{20,}"

# 工作区源码扫描（排除依赖与构建产物）
Get-ChildItem -Recurse -File src, electron, scripts, .github -Include *.ts,*.vue,*.js,*.yml,*.json |
  Select-String -Pattern "sk-[A-Za-z0-9]{20,}", "AKIA[A-Z0-9]{16}", "ghp_[A-Za-z0-9]{36}", "-----BEGIN"
```

两条命令预期均**无输出**（本次体检已预扫通过）。AI Key 是用户运行时手动输入、存于本机 localforage 的，不在仓库中，架构上就是安全的——这一点可以写进 README 当卖点。

**B. 截图隐私（本次体检的最大隐患）**：

- `public/screenshots/` 下 8 张图全是**上游 MoodNotes 旧 UI**，README 正在引用 → 必须重拍；
- `verification-screenshots/` 含 QQ、个人账号昵称等桌面隐私 → 已在 1.2 中排除，不推送。

重拍清单（运行 `npm run dev`，使用干净的演示数据，窗口最大化 1440×900 截取）：

```powershell
New-Item -ItemType Directory -Force docs/screenshots | Out-Null
# 建议拍摄：① 今日记录页（主界面）② 成长/数据页 ③ 知识库/图谱页 ④ AI 复盘弹层 ⑤ 深色模式任选一张
# 截图放入 docs/screenshots/，README 中以 docs/screenshots/xxx.png 引用
```

> ✅ **已完成**：6 张截图已放入 `docs/screenshots/`（今日 / 成长 / 知识库 / 日历 / 隐私 / 深色模式），README 顶部主图 + 「界面预览」画廊，中英文 README 均已引用；旧的上游 UI 截图 `public/screenshots/` 已归档至 `_local_archive`，README 中不再引用。

**C. 文档审查**：✅ 已处理 —— `docs/MiMo-Desktop-内测申请-素材.md` 经作者确认不需要，本地文件已删除；该文件从未进入 git 历史（`git log --all` 无记录、未跟踪），`.gitignore` 中的忽略规则与本文档所有引用均已移除。

**D. 专业级复扫（可选但推荐，一行命令装好 gitleaks）**：

```powershell
winget install gitleaks
gitleaks detect --source . --verbose
```

### 1.5 仓库元数据修正（必做）

**A. `package.json`** —— 在项目根目录执行（node 一键改写，保持格式）：

```powershell
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.homepage='https://github.com/YUDongLin1/MindFlow#readme';p.repository={type:'git',url:'https://github.com/YUDongLin1/MindFlow.git'};p.bugs={url:'https://github.com/YUDongLin1/MindFlow/issues'};p.author={name:'YUDongLin1',url:'https://github.com/YUDongLin1'};fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
```

> 🔍【需补充】`author.name` 若想用真实姓名可自行替换；求职场景建议与 GitHub ID 一致。

**B. 版本统一**：确认 `package.json` version 为 `1.0.1`（已是），README 徽章与 Release 均以 **v1.0.1** 为准（README 草稿已修正）。同时检查 `src/utils/appMeta.ts` 是版本唯一事实源，界面无硬编码（项目既有约定，无需改动）。

**C. README 致谢链接**：`github.com/MindFlow/MindFlow`（404）→ `https://github.com/PStarH/MoodNotes`（真实上游，已核实存在且为 AGPL-3.0）。README 草稿已改好。

### 1.6 Commit 规范与分支策略

**Commit 规范（Conventional Commits，英文 type + 中文描述）**：

```
<type>(<scope>?): <一句话中文描述，≤50字>

type 取值：
feat     新功能          fix    缺陷修复
docs     文档            refactor  重构（不改行为）
perf     性能优化        test   测试
chore    构建/工程配置   ci     持续集成
```

**首次推送的提交拆分建议**（重要：按模块拆成有层次的提交，让面试官看到工程过程感。原则：**只拆分真实存在的改动，绝不伪造时间线**）：

```powershell
git add .gitignore package.json package-lock.json
git commit -m "chore: 初始化开源仓库配置，修正仓库元数据与忽略规则"

git add src/stores src/services src/utils src/composables
git commit -m "feat(core): 数据层迁移 Pinia 并实现 AI 复盘客户端与导出服务"

git add src/components src/views
git commit -m "feat(ui): 重建四视图界面与富文本/图表/待办/日历等交互模块"

git add electron/
git commit -m "feat(desktop): Electron 主进程适配系统托盘与 Windows 打包链路"

git add docs/ README.md README.en.md LICENSE
git commit -m "docs: 重写 README 与产品文档，补齐致谢与许可声明"

git add .github/ scripts/ build-resources/
git commit -m "ci: 配置 CI 与 release 工作流及打包脚本"

# 最后确认：git status 应为空
git status --short
```

> 🔍【需补充】以上是建议的分组骨架，请按实际改动微调（比如某目录没有改动就跳过该组）。

**分支策略（个人项目推荐 GitHub Flow，而非 git-flow）**：

```
main        ── 永远处于可发布状态，打 tag 即发布
 └─ feat/*  ── 功能分支，完成后 PR 合回 main（PR 描述写清动机与改动点，是面试展示素材）
```

单人项目用 git-flow 是负担大于收益；简历/面试中能讲清"为什么选 GitHub Flow"本身就是工程判断力的加分项。

---

## 二、推送流程

### 2.1 创建 GitHub 仓库（网页操作，1 分钟）

1. 打开 https://github.com/new
2. Repository name：`MindFlow`（与产品名一致，简历链接干净）
3. 选择 **Public**
4. **不要**勾选任何初始化选项（README/.gitignore/License 都不勾——本地已有，勾了会造成推送冲突）
5. 点击 Create repository，**不要**关闭页面，下一步要用仓库地址

### 2.2 关联远程仓库（每步作用见注释）

```powershell
# ① 把现指向上游的 origin 改名为 upstream —— 保留上游引用，
#    既满足 AGPL 溯源习惯，也方便日后同步上游更新
git remote rename origin upstream

# ② 关闭向 upstream 的推送通道（只许拉不许推，防误推到别人的仓库）
git remote set-url --push upstream DISABLED

# ③ 添加自己的仓库为新的 origin
git remote add origin https://github.com/YUDongLin1/MindFlow.git

# ④ 验证（预期输出：
#    origin    https://github.com/YUDongLin1/MindFlow.git (fetch/push)
#    upstream  https://github.com/PStarH/MoodNotes (fetch) / DISABLED (push)）
git remote -v
```

### 2.3 首次推送

```powershell
# ① 确认分支名为 main
git branch -M main

# ② 推送并建立跟踪关系（-u 以后直接 git push 即可）
git push -u origin main
```

> - HTTPS 方式首次推送会弹出 **Git Credential Manager** 浏览器授权窗口，登录 GitHub 授权即可（Token 由系统凭据管理器保存）。
> - 如果你的 GitHub 开启了双因素认证，授权流程相同，无需手动生成 Token。

### 2.4 日常更新流程（后续迭代的标准循环）

```powershell
# ① 开功能分支
git checkout -b feat/ai-review-prompt-v2

# ② 开发……然后提交（明确列文件，避免 git add . 带入意外文件）
git add src/services/aiClient.ts
git commit -m "feat(ai): 复盘 Prompt 增加溯源校验覆盖率指标"

# ③ 推送分支并在 GitHub 上开 Pull Request → 自查 diff → 合并
git push -u origin feat/ai-review-prompt-v2

# ④ 合并后同步本地 main 并清理分支
git checkout main
git pull origin main
git branch -d feat/ai-review-prompt-v2
```

**发版循环（每次对外发布）**：

```powershell
# 确认 package.json version 已提升，然后：
git checkout main
git pull origin main
git tag -a v1.0.1 -m "MindFlow v1.0.1：Windows NSIS 安装包发布，含托盘常驻/无痕卸载/导出脱敏"
git push origin v1.0.1        # 推送 tag，GitHub 会自动触发 release 工作流（如已配置）
```

**（可选）同步上游更新**：

```powershell
git fetch upstream
git merge upstream/main       # 有冲突则解决后正常提交
```

---

## 三、面向求职的项目包装

### 3.1 README 结构（完整草稿见同目录 `README.draft.md`，已按此结构写好骨架）

求职版 README 的叙事顺序 = 面试官 30 秒扫视的注意力顺序：

1. **首屏**：产品名 + 一句话定位 + 徽章 + 1 张主截图 + 4 个关键数字（🔍【需补充】实测数据）
2. **项目背景与痛点**：从"用户问题"出发而非"技术栈"出发——记了日记不复盘、复盘了不沉淀、AI 工具 privacy 焦虑
3. **目标用户与场景**：2~3 个具象 persona + 使用场景
4. **解决方案与产品架构**：架构图用 **mermaid**（GitHub 原生渲染，无需贴图，还展示工程素养）
5. **AI 能力设计**：三模式（local 镜像 / byok 自带 Key / cloud 订阅）+ 四条设计红线（不编造、不静默定稿、溯源校验 checkProvenance、失败回退）——这一节是 **AI PM 岗位的核心差异化**，要写出"为什么这么设计"的决策依据
6. **核心指标与效果验证**：🔍【需补充】32/32 单测通过、启动耗时、安装包体积、埋点事件数、A/B 实验结论。**诚实原则：没有实测的数字不写**——面试必追问数据来源
7. **我的职责与产出**：用表格明确"上游基线 → 我的改动 → 价值"边界。**面试官对二次开发项目的第一问必然是"你到底做了什么"**，这一节就是标准答案
8. 快速开始 / 致谢与许可 / Roadmap

### 3.2 开源协议：保持 AGPL-3.0（不要换）

- 上游 MoodsNote 是 AGPL-3.0，衍生作品**必须**继续以 AGPL-3.0 发布，改 MIT 是违规的；
- 你本来就打算开源，AGPL 的"网络使用也须开源"条款对你零成本；
- 合规三件事（README 草稿已包含前两件）：
  1. 仓库根目录保留原样 `LICENSE` 文件；
  2. README 显著位置声明"基于 MoodsNote (PStarH/MoodNotes, AGPL-3.0) 二次开发"并附真实链接；
  3. 说明哪些部分是修改/新增（"我的职责"表格天然承担此功能）。

### 3.3 仓库简介 / Topics / 主页门面

```text
About（≤160字符，直接复制）:
本地优先的 AI 个人成长记录应用：日记·工作·学习三合一，AI 复盘自动生成 Markdown 知识库，数据 100% 留在本机。

Topics（About 旁齿轮图标添加，建议 12 个）:
vue3  electron  typescript  local-first  privacy  ai  llm
prompt-engineering  knowledge-management  journal  pinia  echarts
```

- **Social preview**：仓库 Settings → General → Social preview 上传 1280×640 横图（可用 landing 页截图）；🔍【需补充】
- **Profile 门面**：建议建 `YUDongLin1/YUDongLin1` 个人主页仓库，将本项目置顶（Profile → Customize your pins 勾选 MindFlow）；
- **简历写法模板**：
  > MindFlow 智流日志（开源，github.com/YUDongLin1/MindFlow）｜ 独立完成产品定义与全栈迭代
  > - 基于 AGPL 开源项目二次开发，独立完成「今日/成长/知识库/隐私」四视图重设计，Vuex→Pinia、Quill→Tiptap、Chart.js→ECharts 三项技术迁移
  > - 设计 AI 复盘「不编造/不代写/可溯源」三红线机制与 local/byok/cloud 三模式降级策略
  > - 交付 Windows NSIS 安装包，单测 32/32 通过，23 类行为埋点 + 3 组 A/B 实验支撑迭代决策
  > （🔍【需补充】三个 bullet 中的量化数字按实测微调）

### 3.4 Release / Tag 规范

- **Tag 命名**：`v1.0.1`（`v` 前缀 + 语义化版本，与 package.json 严格一致）
- **发布节奏**：对外可讲的稳定版本才打 tag；每个 Release 附安装包（NSIS 87MB，远低于 GitHub 2GB 单文件限制）
- **Release notes 三段式模板**（GitHub Releases → Draft a new release → 选 tag）：

```markdown
## ✨ 新增
- 系统托盘常驻：关闭窗口最小化到托盘，右键菜单直达常用功能
- 每日待办与日历联动：未来待办到当日自动同步

## 🛠 修复
- 关闭窗口即退出的行为（现改为最小化到托盘）
- 导出 JSON 备份时 AI Key 未脱敏的问题

## 📦 下载
- [MindFlow-Setup-1.0.1-x64.exe](这里贴 Release 自动上传的产物链接)（Windows 10/11 x64，87 MB）

## 🔍 验证
- 安装 / 启动 / 卸载全链路手工回归通过；单元测试 32/32 通过
```

> 🔍【需补充】按真实 changelog（`docs/product-changelog.md` 已有素材）填写。

---

## 四、推送后检查清单

### A. README 渲染

- [ ] 徽章全部正常加载（shields.io 图标显示）
- [ ] 目录锚点逐个点击可跳转（中文标题锚点以 GitHub 实际生成为准）
- [ ] mermaid 架构图正常渲染（不是显示源码）
- [ ] 截图全部显示且为**新 UI**（重点检查：没有出现 MoodNotes 旧界面）
- [ ] 中/英文切换链接互跳正常
- [ ] 手机端（GitHub App 或浏览器）排版不乱

### B. 文件完整性（最关键的一条：全新环境跑通）

```powershell
# 在完全另一个目录克隆一份，模拟面试官/HR 视角
cd E:\temp_clone
git clone https://github.com/YUDongLin1/MindFlow.git
cd MindFlow
npm install
npm run dev        # 必须能启动主界面
npm run test       # 必须全绿（预期 32/32）
```

- [ ] 新克隆环境 dev 启动成功、测试全绿（失败说明有文件遗漏或路径假设）
- [ ] `git ls-files` 核对：src / electron / docs / .github / scripts / build-resources 齐全
- [ ] `git status` 干净，无未跟踪的敏感文件蠢蠢欲动

### C. 历史与敏感信息复查

- [ ] `gitleaks detect --source .` 零告警
- [ ] `git log --all -p | Select-String "sk-","api_key","password","Bearer"` 无命中
- [ ] 逐张检查仓库内所有 .png（GitHub 网页 Code 页浏览即可）：无个人桌面、无真实日记内容、无 MoodNotes 旧 UI
- [ ] commit 作者全部显示为你的 GitHub 头像（upstream 那个上游作者 commit 属正常）

### D. 仓库设置

- [ ] About 描述 + Topics + Social preview 三件套齐全
- [ ] 仓库右侧栏 License 正确显示 **AGPL-3.0**
- [ ] 默认分支为 main；（可选）Settings → Branches 对 main 开启 "Require pull request before merging"（展示工程规范，也可不开，单人项目合理）
- [ ] Actions 页 CI 绿勾；Release 页 v1.0.1 已发布且安装包可下载

### E. 求职链路

- [ ] 简历中的链接可点击直达，且未登录 GitHub 也能看到全部内容
- [ ] GitHub Profile 首页 pin 了本项目
- [ ] 用"HR 视角"从 profile 点进仓库，30 秒内能回答：这是什么、解决什么、你做了什么、数据如何

---

## 附：本次体检扫描证据摘要

- git 历史：1 commit（`87eb993 Bump version to 1.0.5`，作者 Rui <yehruei@163.com>），分支 main
- 跟踪文件 162 个，最大 1.17MB（public/screenshots/setting.png，为上游旧图，将替换）
- 未跟踪 207 个：根目录 77 ps1 / 57 txt / 6 log + .qoder/ .workbuddy/ dist-electron2/ nsis-3.10/ verification-screenshots/ 等
- 密钥扫描（`sk-`、`apiKey 赋值`模式）：源码零命中；`.env.example` 全空值
- 上游验证：`https://github.com/PStarH/MoodNotes` 存在（MoodsNote 晨暮日记，AGPL-3.0）；README 原致谢链接 `MindFlow/MindFlow` 为 404

---

## 附 2：执行记录（2026-09-18 已实际落地）

| 项 | 状态 | 说明 |
|----|------|------|
| 根目录调试残留 | ✅ | 141 个文件（.ps1/.txt/.log/nsis-3.10.zip/proc-check.csv）移入 `_local_archive/`，未删除，可随时移回 |
| `.gitignore` 补充 | ✅ | 新增 AI 工作区、内部文档、构建产物、根目录残留、一次性验收测试共 5 类规则 |
| package.json 元数据 | ✅ | homepage / repository / bugs / author / license(AGPL-3.0) / author.email 全部补齐 |
| git 身份 | ✅ | `user.name=YUDongLin1`，`user.email=155050346+YUDongLin1@users.noreply.github.com` |
| README 中/英 | ✅ | 404 致谢链接→PStarH/MoodNotes；版本统一 1.0.1；新增六大求职向板块；补下载链接与 CI 徽章 |
| 上游旧 UI 截图 | ✅ | `public/screenshots/`（8 张 MoodNotes 旧界面）移入 `_local_archive/` |
| 测试收敛 | ✅ | 核心 5 文件 32/32 全绿，其余一次性验收测试按「只公开核心测试」决策移出公开仓库 |
| 首次推送 | ✅ | `main -> main`，已设置 upstream tracking；HEAD = `3f58038` |
| 仓库简介 + 标签 | ✅ | 简介 1 条 + 12 个 topics（ai / llm / local-first / privacy / prompt-engineering / vue3 / electron / pinia / typescript / echarts / journal / knowledge-management） |
| Release v1.0.1 | ✅ | 已发布，并上传 `MindFlow-Setup-1.0.1-x64.exe`（87.2 MB） |
| CI 全绿 | ✅ | 首次运行暴露 3 个「本地能跑、全新环境跑不了」的问题，已全部修复（见附 3） |
| 推送后检查 | ✅ | 见附 4，全部通过 |

### 测试处理（用户决策：只公开核心测试）

- 实测：全仓库 98 个用例；核心 5 个文件 **32/32 全绿**（abTest / aiClient / analytics / journal / weeklyReport）
- 已修复的测试侧缺陷（35 失败 → 13）：
  - `src/test/setup.ts` 增加 `RouterLink` / `RouterView` 全局 stub（一处修复，interface-layout 由 21 失败降至 8）
  - `calendar-todo.test.ts` 补 `import localforage`；按下标的断言改为按文本查找（store 用 `unshift`，新项在数组头部）
  - `document-cleanup.test.ts` 三处 fixture 自相矛盾（mock 内容含 MoodNotes 却断言不含），改为「已清理」内容
- 未纳入公开仓库（已写入 .gitignore，文件保留在本地，修好后删除对应行即可重新纳入）：
  `tray.test.ts`、`calendar-todo.test.ts`、`interface-layout.test.ts`、`document-cleanup.test.ts`、`localforage-mock.ts`、`deliverables-summary.md`、`test-execution-plan.md`、`test-report-template.md`
- 已知待修根因（供后续修复参考）：
  - `tray.test.ts`：`vi.mock('electron')` 对 node_modules 外部模块不生效，需在 vitest 配置 `server.deps.inline: ['electron']` 或加 alias 指向 mock 文件
  - `interface-layout.test.ts` 剩余 8 项：断言按理想规格书写（设置图标高亮/导航、UserAccount 登录文案、`console.log('Login clicked')`），需与真实实现二选一对齐
  - `calendar-todo.test.ts` 剩余 3 项：待办自动同步与旧待办清理逻辑
  - `document-cleanup.test.ts` 剩余 2 项：注释/字符串中的旧品牌词断言

## 附 3：CI 首次运行暴露的 5 个问题（已修复）

> 这三个问题**本地都不会出现**，因为本地有 `electron/node_modules`、有历史安装缓存。这正是「全新克隆验证」必须做的原因。

| # | 现象 | 根因 | 修复 |
|---|------|------|------|
| 1 | `npm run build` 报 TS2687 / TS2717 | 全新环境没有 `electron/node_modules`，tsc 回落到根目录 `@types/node`（版本与 electron 33 的 `electron.d.ts` 不一致） | `electron/tsconfig.json` 增加 `"skipLibCheck": true` |
| 2 | `npm run test:coverage` 失败 | `vitest.config.ts` 配了 `provider: 'v8'`，但 `@vitest/coverage-v8` 从未写进 devDependencies | `npm i -D @vitest/coverage-v8@^3.2.4` |
| 3 | Build and Release 在 Linux 打包中断 | electron-builder 打 deb 要求 `package.json` 的 `author` 含 `email` | 补 `author.email`；同时给 matrix 加 `fail-fast: false`，单平台失败不再取消其余平台 |
| 4 | Create Release 报 `Resource not accessible by integration` | 默认 `GITHUB_TOKEN` 只有 `contents: read`，softprops/action-gh-release 无法写 Release | workflow 顶层声明 `permissions: contents: write` |
| 5 | CI 产物名 `MindFlow Setup 1.0.1.exe` 与本地/ README 不一致 | nsis 未指定 `artifactName` | `build.nsis.artifactName = MindFlow-Setup-${version}-${arch}.${ext}` |

修复后全新目录复验：`npm install` → `npm run test:run`（32/32）→ `npm run test:coverage` → `npm run build` **全部 EXIT=0**。

## 附 4：推送后检查清单结果（第 4 章）

| 检查项 | 结果 |
|--------|------|
| README 相对链接 | 0 处失效 |
| README 锚点目录 | 0 处失效 |
| Mermaid 图 | 1 块，代码围栏配对完整 |
| 敏感信息扫描 | **0 命中**（10 条规则：OpenAI Key / Bearer / ghp_ / github_pat_ / AKID / 私钥 / 手机号 / 身份证 / 内网 IP / 代理端口） |
| 提交历史作者邮箱 | 4 个：3 个上游作者 + 本人 noreply，**无个人邮箱、无密钥、无 QQ 号** |
| 提交历史 | 58 个提交，完整保留上游 MoodNotes 历史（AGPL-3.0 署名合规） |
| 推送文件 | 217 个 / 4.21 MB，无调试残留、无 `_local_archive`、无 `verification-screenshots` |
| 全新环境复现 | `C:\tmp\mf-verify` 全新解包 → install → test → coverage → build 全部通过 |
| GitHub Actions | CI = success（Test + Build）；Build and Release = success（macOS / Ubuntu / Windows 三平台打包 + Create Release） |
| Release v1.0.1 资产 | dmg 172.9 MB / AppImage 104.8 MB / `MindFlow-Setup-1.0.1-x64.exe` 78.4 MB / 便携版 78.2 MB / deb 82.7 MB，共 5 个 |

## 附 5：剩余待你操作（我无法代做）

### 已完成（本次补做）

1. ✅ **UI 截图**：6 张（今日 / 成长 / 知识库 / 日历 / 隐私 / 深色模式）已放入 `docs/screenshots/`（为兼容 GitHub 相对路径，文件名统一为 ASCII：`main-today.png` / `growth.png` / `knowledge.png` / `calendar.png` / `privacy.png` / `dark-mode.png`）；README 顶部加主图，新增「界面预览」画廊，中英文 README 同步。
2. ✅ **MiMo 内测申请素材**：按你的要求全部删除 —— 本地文件、`.gitignore` 忽略规则、本文档引用，三处清理完毕；该文件从未进入 git 历史，无需改写历史。

### 仍需你操作

1. 仓库 Settings → General → Social preview 上传 1280×640 横图（可用 `docs/landing-preview.png` 裁切，或从 `docs/screenshots/main-today.png` 裁切）。
2. 个人主页 pin 该仓库。
3. 可选：把 4 个被移出的验收测试修好后再纳入（根因已记录在附 2 下方）。

### 后续更新常用命令

```bash
# 日常提交（Conventional Commits）
git add -A
git commit -m "feat(scope): 一句话描述"
git push origin main

# 发新版本
git tag -a v1.0.2 -m "MindFlow v1.0.2：xxx"
git push origin v1.0.2      # 会触发 Build and Release 自动打包三平台
```

> ⚠️ 本机 git 走 `http://127.0.0.1:63888` 代理时会吞掉凭据，推送报 `No anonymous write access`。
> 解决：显式带上认证头推送
> `git -c http.extraHeader="Authorization: Basic <base64(x-access-token:TOKEN)>" push origin main`

**测试处理（用户决策：只公开核心测试）**
