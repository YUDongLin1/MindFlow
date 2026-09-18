# MindFlow 智流日志 — Windows 安装包交付说明

## 一、交付物

| 项目 | 内容 |
|------|------|
| **文件名** | `MindFlow-Setup-1.0.1-x64.exe` |
| **完整路径** | `E:\mindflow-release-build\MindFlow-Setup-1.0.1-x64.exe` |
| **文件大小** | 87.21 MB |
| **版本号** | 1.0.1 |
| **目标平台** | Windows x64 |
| **安装类型** | NSIS（非一键装，可自选安装目录，免管理员权限） |
| **数字签名** | 未签名（首次运行会触发 SmartScreen 提示，选择"更多信息 → 仍要运行"即可） |

> 同目录下 `win-unpacked\` 是免安装绿色版，可直接运行其中的 `MindFlow.exe`。

---

## 二、项目类型与技术栈

| 层次 | 技术 |
|------|------|
| **应用类型** | Electron 桌面应用（双包结构：Vue 渲染进程 + CommonJS 主进程） |
| **桌面框架** | Electron 33.4.11 |
| **前端框架** | Vue 3.5 + TypeScript |
| **构建工具** | Vite 5.4.21 |
| **状态管理** | Pinia（主）+ Vuex 4（兼容层） |
| **样式** | Tailwind CSS 3.4 |
| **富文本** | Tiptap |
| **图表** | ECharts |
| **打包工具** | electron-builder 26.15.3 |
| **Node.js** | 22.22.2 |

---

## 三、打包工具与命令

### 打包工具
**electron-builder 26.15.3**（NSIS target）+ Electron 33.4.11

### 一条命令完成打包

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-win.ps1
```

### 流水线五步

| 步骤 | 命令 | 产出 |
|------|------|------|
| 1 | `npx vite build` | `dist/`（前端静态资源） |
| 2 | `tsc`（cwd = `electron/`） | `electron/dist/`（主进程 JS） |
| 3 | 校验 / 解压 Electron 发行包 | `E:\mindflow-electron-dist` |
| 4 | `electron-builder --win --x64 --dir --config electron-builder-override.json` | `win-unpacked/` |
| 5 | `node scripts/patch-exe.js` | 补写 exe 图标 + 版本资源 |
| 6 | `electron-builder --win --x64 --prepackaged win-unpacked --config electron-builder-override.json` | NSIS 安装包 |

### 打包配置
唯一配置源：**`electron-builder-override.json`**

> ⚠️ 注意：electron-builder 的 `--config` 是**整体替换**而非合并。因此该文件必须包含全部必要配置（`files`、`win`、`nsis`、`directories` 等），不能只写增量。

---

## 四、清洁打包保证

`app.asar` 最终包含 **109 个条目**，顶层目录只有 3 项：

```
app.asar (12.01 MB)
├── dist/            103 个条目（Vite 构建产物）
├── electron/          5 个条目（主进程编译产物）
└── package.json       1 个条目
```

**已确认未打包的内容：**

| 排除项 | 方式 |
|--------|------|
| `node_modules/` | 17 个前端运行时依赖已迁至 `devDependencies`，`dependencies` 为空 |
| `src/` `scripts/` `docs/` | `files` 白名单显式排除 |
| `dist_old_*` 旧构建备份 | 白名单排除 |
| `dist-electron*` / `nsis-*` | 白名单排除 |
| `.git` / `.qoder` / `.vscode` / `.workbuddy` | 白名单排除 |
| 日志 / 临时脚本（`*.log` / `*.ps1` / `*.txt` / `*.md`） | 白名单排除 |
| Source Map（`*.map`） | 白名单排除 |

对比：修复前 `app.asar` 约 **966 MB**（整包误打包）；修复后 **12.01 MB**。

---

## 五、版本号与命名规则

### 版本号唯一事实源
`package.json` → `version` 字段（当前 `1.0.1`）。界面版本号由 `src/utils/appMeta.ts` 从 `package.json` 读取，禁止硬编码。

### 命名规则

| 对象 | 规则 | 当前值 |
|------|------|--------|
| **安装包** | `MindFlow-Setup-${version}-${arch}.${ext}` | `MindFlow-Setup-1.0.1-x64.exe` |
| **主程序 exe** | `${productName}.exe` | `MindFlow.exe` |
| **应用产品名** | `MindFlow` | — |
| **应用 ID** | `com.mindflow.app` | — |

---

## 六、构建过程遇到的问题及处置

本次构建**无编译错误、无依赖缺失**，`vite build` 与 `tsc` 均一次通过。但在打通过程中修复了 4 个环境性缺陷：

| # | 问题 | 根因 | 处置 |
|---|------|------|------|
| 1 | `EPERM: rename 'win-unpacked.tmp' -> 'win-unpacked'` | electron-builder 自解压 Electron 时被本机安全软件持有句柄 | 预解压 Electron 到固定目录，用 `electronDist` 指过去 |
| 2 | `UNKNOWN: unknown error, open 'MindFlow.exe'` | 复制完 188 MB exe 后立刻被 Node 重写，句柄竞争 | `signAndEditExecutable:false` + `disableAsarIntegrity:true`，改由独立进程 `patch-exe.js` 补写资源 |
| 3 | `app.asar` 膨胀到 966 MB | `--config` 整体替换配置导致 `files` 白名单丢失；且 electron-builder 无条件打包生产依赖 | 白名单补全到 override 配置 + 依赖迁至 `devDependencies` |
| 4 | 窗口一闪而过（`render-process-gone reason:"killed"`） | 本机 Chromium 渲染沙箱初始化失败 | `electron/main.ts` 顶部对 Windows 关闭渲染沙箱与硬件加速 |

---

## 七、验证结果（全链路）

| 检查项 | 结果 |
|--------|------|
| 前端构建 | ✅ 1130 模块转换，15.03 s |
| 主进程编译 | ✅ `tsc` 无错误 |
| asar 纯净度 | ✅ 109 条目，0 条可疑条目 |
| exe 版本资源 | ✅ `FileVersion` / `ProductVersion` = 1.0.1；`ProductName` / `CompanyName` = MindFlow |
| exe 图标资源 | ✅ 1 个图标组 + 4 个图标尺寸 |
| **无参数启动** | ✅ 输出 `[sandbox] Windows 兼容模式：已关闭渲染沙箱与硬件加速` + `Page finished loading`，**stderr 为空** |
| **静默安装** | ✅ 22 个条目完整落地，含 `Uninstall MindFlow.exe`、快捷方式、注册表项 |
| **安装后启动** | ✅ 4 个进程存活，主窗口标题 `MindFlow 智流日志`，内存约 370 MB |
| **卸载** | ✅ 安装目录、桌面快捷方式、开始菜单、注册表卸载项全部清除 |

---

## 八、安装与使用

### 安装
1. 双击 `MindFlow-Setup-1.0.1-x64.exe`
2. 如出现 SmartScreen 提示 → "更多信息" → "仍要运行"
3. 选择安装目录（默认 `%LOCALAPPDATA%\Programs\MindFlow`）
4. 安装完成后自动创建桌面与开始菜单快捷方式

### 数据目录
- **安装版**：`%APPDATA%\MindFlow`
- **便携版**：exe 同级目录下的 `data\`

> 卸载默认**不删除**用户数据（`deleteAppDataOnUninstall: false`），重装后数据仍在。

### 卸载
开始菜单 → MindFlow → "Uninstall MindFlow"，或控制面板 → 程序和功能。

---

## 九、已知问题与建议

1. **未做代码签名**：Windows SmartScreen 会提示"未知发布者"。对外分发建议购买代码签名证书（OV/EV）。
2. **未在 Windows 10 实机验证**：本次打包在 Windows 11（10.0.26200）x64 完成。
3. **未包含便携版**：本次仅生成 NSIS 安装包。如需便携版，在 `electron-builder-override.json` 的 `win.target` 中加入 `"portable"` 后重新执行打包脚本即可。

---

*文档生成时间：2026-09-17*
