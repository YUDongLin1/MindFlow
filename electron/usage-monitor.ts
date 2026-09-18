/**
 * usage-monitor.ts
 * 全电脑应用使用时长监测（仅 Windows 平台启用，其他平台优雅跳过）。
 *
 * 实现方式（参考开源项目 usagetime 的设计思路，自行实现）：
 * - 常驻单个 PowerShell 子进程：spawn 一次
 *   `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File usage-sample.ps1`，
 *   脚本内 Add-Type(user32/kernel32 P/Invoke) 只编译一次，随后进入无限循环，
 *   每 SAMPLE_INTERVAL_SEC 秒向 stdout 输出一行 JSON（JSON Lines 协议），
 *   彻底消除旧实现"每 5 秒 execSync 冷启动 PowerShell 全量枚举进程"阻塞主进程事件循环的问题。
 * - 采样内容：GetForegroundWindow() 取真正前台窗口句柄 → GetWindowTextW 取标题
 *   → GetWindowThreadProcessId 取 PID → Get-Process -Id 取进程名与 exe 路径，
 *   并用 GetLastInputInfo + GetTickCount 计算系统空闲秒数。
 * - 子进程异常退出自动重启（指数退避，上限 MAX_RESTART_DELAY_MS）。
 * - 协议稳定性备注：若后续出现 stdout 协议问题，可降级为 child_process.execFile
 *   异步调用 + 运行中标志防重入 + 3~5 秒间隔；绝不允许 execSync / spawnSync。
 *
 * 统计口径：
 * - 覆盖所有自然日（含周末与节假日），不存在任何跳过/排除逻辑。
 * - 空闲超过 IDLE_THRESHOLD_SEC 秒（300，可导出调整）时不计入任何应用（记为 idle）。
 * - 按本地日期（getFullYear/getMonth/getDate，不用 toISOString）判断跨日并自动清零。
 * - 每日汇总持久化到 userData/usage/usage-YYYY-MM-DD.json（本地日期命名），历史可查。
 *
 * 生命周期：
 * - start()/stop() 由主进程在 whenReady / before-quit 调用；
 * - pause()/resume() 由 powerMonitor 的 lock-screen/suspend 与 unlock/resume 事件调用；
 * - stop() 会显式 kill 常驻子进程并同步落盘当日数据。
 */

import { app } from 'electron';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';

// ---------------- 常量（导出便于调整） ----------------

/** 空闲阈值（秒）：系统空闲超过该值时不计入任何应用 */
export const IDLE_THRESHOLD_SEC = 300;

/** 采样间隔（秒）：常驻 PowerShell 脚本内部的循环间隔 */
export const SAMPLE_INTERVAL_SEC = 4;

/** 窗口标题长度低于该值视为无意义窗口，忽略 */
const MIN_TITLE_LEN = 2;

/** 单次归因的最大毫秒数（防止异常间隔导致的错误累计，超出部分按一个采样间隔计） */
const MAX_ATTRIBUTION_MS = SAMPLE_INTERVAL_SEC * 1000 * 3;

/** 定期落盘间隔（毫秒） */
const FLUSH_INTERVAL_MS = 60_000;

/** 子进程重启退避上限（毫秒） */
const MAX_RESTART_DELAY_MS = 30_000;

// ---------------- 系统进程忽略清单（进程名小写） ----------------

const IGNORED_PROCESSES = new Set<string>([
  // 系统核心/会话进程
  'system', 'idle', 'registry', 'smss', 'csrss', 'wininit', 'services', 'lsass',
  'svchost', 'winlogon', 'logonui', 'fontdrvhost', 'dwm', 'sihost', 'taskhostw',
  'ctfmon', 'wudfhost', 'wmiprvse', 'dllhost', 'conhost', 'spoolsv',
  // Windows Shell / 开始菜单 / 输入法等非用户主动使用的前台
  'searchui', 'searchapp', 'searchhost', 'shellexperiencehost', 'startmenuexperiencehost',
  'applicationframehost', 'systemsettings', 'textinputhost', 'lockapp',
  'runtimebroker', 'explorer', // explorer 桌面态由 desktop 标志单独处理，此处兜底
  // 安全/维护类
  'smartscreen', 'securityhealthsystray', 'securityhealthservice',
  'msmpeng', 'nisvcloc', 'sppsvc', 'trustedinstaller',
  // 脚本宿主自身（采样进程本身可能短暂成为前台）
  'powershell', 'pwsh', 'windowspowershell',
  // MindFlow / Electron 自身（自身时长由渲染层 focus/blur 单独统计，避免重复）
  'mindflow', 'electron',
]);

/** 自身进程 exe 文件名（小写），用于排除 MindFlow/electron 自身 */
const SELF_EXE_NAMES = new Set<string>(['mindflow.exe', 'electron.exe']);

// ---------------- exe → 中文友好显示名映射（exe 文件名小写，30+ 条） ----------------

const APP_NAME_MAP: Record<string, string> = {
  // 浏览器
  'chrome.exe': 'Chrome 浏览器',
  'msedge.exe': 'Edge 浏览器',
  'firefox.exe': 'Firefox 浏览器',
  'brave.exe': 'Brave 浏览器',
  'opera.exe': 'Opera 浏览器',
  // Office / WPS
  'winword.exe': 'Word',
  'excel.exe': 'Excel',
  'powerpnt.exe': 'PowerPoint',
  'outlook.exe': 'Outlook',
  'onenote.exe': 'OneNote',
  'msaccess.exe': 'Access',
  'wps.exe': 'WPS 文字',
  'et.exe': 'WPS 表格',
  'wpp.exe': 'WPS 演示',
  // 即时通讯 / 协作
  'wechat.exe': '微信',
  'wechatappex.exe': '微信小程序',
  'qq.exe': 'QQ',
  'tim.exe': 'TIM',
  'dingtalk.exe': '钉钉',
  'wxwork.exe': '企业微信',
  'feishu.exe': '飞书',
  'lark.exe': 'Lark',
  'telegram.exe': 'Telegram',
  'discord.exe': 'Discord',
  'slack.exe': 'Slack',
  'teams.exe': 'Microsoft Teams',
  // 会议
  'zoom.exe': 'Zoom',
  'wemeetapp.exe': '腾讯会议',
  // 开发工具
  'code.exe': 'VS Code',
  'cursor.exe': 'Cursor',
  'devenv.exe': 'Visual Studio',
  'idea64.exe': 'IntelliJ IDEA',
  'pycharm64.exe': 'PyCharm',
  'webstorm64.exe': 'WebStorm',
  'goland64.exe': 'GoLand',
  'studio64.exe': 'Android Studio',
  'hbuilderx.exe': 'HBuilderX',
  'sublime_text.exe': 'Sublime Text',
  'notepad++.exe': 'Notepad++',
  'notepad.exe': '记事本',
  'windowsterminal.exe': 'Windows Terminal',
  'cmd.exe': '命令提示符',
  'dbeaver.exe': 'DBeaver',
  'navicat.exe': 'Navicat',
  'postman.exe': 'Postman',
  // 笔记 / 写作
  'obsidian.exe': 'Obsidian',
  'typora.exe': 'Typora',
  // 影音 / 娱乐
  'spotify.exe': 'Spotify',
  'cloudmusic.exe': '网易云音乐',
  'qqmusic.exe': 'QQ 音乐',
  'kugou.exe': '酷狗音乐',
  'potplayermini64.exe': 'PotPlayer',
  'potplayermini.exe': 'PotPlayer',
  'vlc.exe': 'VLC',
  'obs64.exe': 'OBS Studio',
  'steam.exe': 'Steam',
  // 图形设计
  'photoshop.exe': 'Photoshop',
  'lightroom.exe': 'Lightroom',
  'figma.exe': 'Figma',
  'blender.exe': 'Blender',
  // 工具
  'explorer.exe': '文件资源管理器',
  'winrar.exe': 'WinRAR',
  '7zfm.exe': '7-Zip',
  'everything.exe': 'Everything',
  'listary.exe': 'Listary',
  'snipaste.exe': 'Snipaste',
};

// ---------------- 内部状态 ----------------

interface FgSample {
  title: string;
  pid: number;
  proc: string;
  exe: string;
  desktop: boolean;
  idle: number;
  error?: boolean;
}

interface AppAccum {
  app: string;
  exe: string;
  seconds: number;
}

interface DailyFile {
  date: string;
  updatedAt: string;
  idleSeconds: number;
  apps: Array<{ app: string; exe: string; seconds: number }>;
}

let started = false;
let stopping = false;
let paused = false;
let child: ChildProcessWithoutNullStreams | null = null;
let restartTimer: ReturnType<typeof setTimeout> | null = null;
let restartAttempts = 0;
let usageDir = '';

let currentDate = '';
let accum = new Map<string, AppAccum>();
let idleSeconds = 0;
let currentApp = '';
let dirty = false;
let lastFlushCheck = Date.now();

// 上一个采样点的状态：归因"上一采样区间"的时长给当时处于前台的应用
let lastSampleAt: number | null = null;
let lastSampleKey: string | null = null; // null 表示空闲/忽略态
let lastSampleExe = '';

// ---------------- 工具函数 ----------------

/** 本地日期字符串 YYYY-MM-DD（刻意不使用 toISOString，避免时区偏移导致跨日错误） */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dailyFilePath(dateStr: string): string {
  return path.join(usageDir, `usage-${dateStr}.json`);
}

function friendlyName(exe: string, proc: string): string {
  if (exe) {
    const mapped = APP_NAME_MAP[path.basename(exe).toLowerCase()];
    if (mapped) return mapped;
  }
  if (proc) {
    const mapped = APP_NAME_MAP[`${proc.toLowerCase()}.exe`];
    if (mapped) return mapped;
  }
  return proc || exe || '未知应用';
}

function isIgnored(sample: FgSample): boolean {
  const proc = (sample.proc || '').toLowerCase();
  if (IGNORED_PROCESSES.has(proc)) return true;
  if (sample.exe && SELF_EXE_NAMES.has(path.basename(sample.exe).toLowerCase())) return true;
  return false;
}

// ---------------- 持久化 ----------------

function flushDailyFile(): void {
  if (!usageDir || !currentDate) return;
  const data: DailyFile = {
    date: currentDate,
    updatedAt: new Date().toISOString(),
    idleSeconds: Math.round(idleSeconds),
    apps: Array.from(accum.values()).map(a => ({
      app: a.app,
      exe: a.exe,
      seconds: Math.round(a.seconds),
    })),
  };
  try {
    writeFileSync(dailyFilePath(currentDate), JSON.stringify(data, null, 2), 'utf8');
    dirty = false;
  } catch (e) {
    console.warn('[usage-monitor] flush failed:', e);
  }
}

/** 启动时加载当日已有文件，跨应用重启继续累计 */
function loadTodayFile(): void {
  try {
    const raw = readFileSync(dailyFilePath(currentDate), 'utf8');
    const data = JSON.parse(raw) as DailyFile;
    if (data && Array.isArray(data.apps)) {
      accum = new Map();
      for (const a of data.apps) {
        if (a && typeof a.app === 'string' && typeof a.seconds === 'number') {
          accum.set(a.app, { app: a.app, exe: typeof a.exe === 'string' ? a.exe : '', seconds: a.seconds });
        }
      }
      idleSeconds = typeof data.idleSeconds === 'number' ? data.idleSeconds : 0;
    }
  } catch {
    // 文件不存在或损坏：从空数据开始
  }
}

/** 跨日检测：本地日期变化时落盘昨日数据并清零（覆盖所有自然日，含周末与节假日） */
function rolloverIfNeeded(): void {
  const today = localDateStr(new Date());
  if (today === currentDate) return;
  flushDailyFile();
  currentDate = today;
  accum = new Map();
  idleSeconds = 0;
  currentApp = '';
  lastSampleAt = null;
  lastSampleKey = null;
  lastSampleExe = '';
  dirty = false;
}

// ---------------- 采样归因 ----------------

function addSeconds(key: string, exe: string, sec: number): void {
  const existing = accum.get(key);
  if (existing) {
    existing.seconds += sec;
  } else {
    accum.set(key, { app: key, exe, seconds: sec });
  }
  dirty = true;
}

function handleSample(sample: FgSample): void {
  if (sample.error) return;
  rolloverIfNeeded();

  const now = Date.now();

  // 将"上一采样点 → 现在"的时长归因给上一采样点的前台应用/空闲
  if (lastSampleAt !== null) {
    let deltaMs = now - lastSampleAt;
    if (deltaMs > MAX_ATTRIBUTION_MS) deltaMs = SAMPLE_INTERVAL_SEC * 1000;
    if (deltaMs > 0) {
      if (lastSampleKey) {
        addSeconds(lastSampleKey, lastSampleExe, deltaMs / 1000);
      } else {
        idleSeconds += deltaMs / 1000;
        dirty = true;
      }
    }
  }

  // 定期落盘
  if (dirty && now - lastFlushCheck >= FLUSH_INTERVAL_MS) {
    lastFlushCheck = now;
    flushDailyFile();
  }

  // 重置重启退避（成功收到一条采样说明协议正常）
  restartAttempts = 0;

  // 解析当前采样点状态，供下一区间归因
  currentApp = '';
  lastSampleAt = now;
  lastSampleKey = null;
  lastSampleExe = '';

  // 空闲超过阈值：不计入任何应用（记为 idle），恢复输入后重新采样归因
  if (typeof sample.idle === 'number' && sample.idle >= IDLE_THRESHOLD_SEC) return;
  // 前台是桌面（explorer 桌面态）：忽略
  if (sample.desktop) return;
  // 标题过短：无意义窗口
  if (!sample.title || sample.title.trim().length < MIN_TITLE_LEN) return;
  // 系统进程忽略清单 / 自身
  if (isIgnored(sample)) return;

  const name = friendlyName(sample.exe, sample.proc);
  currentApp = name;
  lastSampleKey = name;
  lastSampleExe = sample.exe || sample.proc || '';
}

function parseLine(line: string): void {
  try {
    const sample = JSON.parse(line) as FgSample;
    if (sample && typeof sample === 'object') handleSample(sample);
  } catch {
    // 忽略非 JSON 行（协议噪声）
  }
}

// ---------------- 常驻子进程管理 ----------------

function buildSampleScript(intervalSec: number): string {
  return `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class FgProbe {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hWnd, System.Text.StringBuilder sb, int maxCount);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern IntPtr GetShellWindow();
  [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO info);
  [DllImport("kernel32.dll")] public static extern uint GetTickCount();
  [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
  public static int IdleSeconds() {
    LASTINPUTINFO lii = new LASTINPUTINFO();
    lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    GetLastInputInfo(ref lii);
    return (int)((GetTickCount() - lii.dwTime) / 1000);
  }
}
'@
while ($true) {
  try {
    $hwnd = [FgProbe]::GetForegroundWindow()
    $sb = New-Object System.Text.StringBuilder 1024
    [void][FgProbe]::GetWindowTextW($hwnd, $sb, 1024)
    $title = $sb.ToString()
    $procId = [uint32]0
    [void][FgProbe]::GetWindowThreadProcessId($hwnd, [ref]$procId)
    $procName = ''
    $exePath = ''
    if ($procId -gt 0) {
      $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
      if ($p) { $procName = [string]$p.ProcessName; $exePath = [string]$p.Path }
    }
    $isDesktop = ($hwnd -eq [FgProbe]::GetShellWindow())
    $idle = [FgProbe]::IdleSeconds()
    $obj = [ordered]@{ title = $title; pid = $procId; proc = $procName; exe = $exePath; desktop = $isDesktop; idle = $idle }
    Write-Output (ConvertTo-Json $obj -Compress)
  } catch {
    Write-Output '{"error":true}'
  }
  Start-Sleep -Seconds ${intervalSec}
}
`.trim();
}

function killChild(): void {
  if (child) {
    try { child.kill(); } catch { /* 已退出 */ }
    child = null;
  }
}

function spawnChild(): void {
  if (!started || stopping || paused || child) return;

  const scriptPath = path.join(usageDir, 'usage-sample.ps1');
  try {
    writeFileSync(scriptPath, buildSampleScript(SAMPLE_INTERVAL_SEC), 'utf8');
  } catch (e) {
    console.warn('[usage-monitor] failed to write sample script:', e);
    scheduleRestart();
    return;
  }

  child = spawn(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    { windowsHide: true }
  );

  let buf = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buf += chunk;
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line) parseLine(line);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (d: string) => {
    console.warn('[usage-monitor] ps stderr:', d.slice(0, 200));
  });
  child.on('exit', () => {
    child = null;
    if (!stopping && !paused) scheduleRestart();
  });
  child.on('error', (e) => {
    console.warn('[usage-monitor] spawn error:', e);
    killChild();
  });
}

/** 子进程异常退出后自动重启（指数退避） */
function scheduleRestart(): void {
  if (!started || stopping || paused || restartTimer) return;
  restartAttempts += 1;
  const delay = Math.min(2000 * Math.pow(2, restartAttempts - 1), MAX_RESTART_DELAY_MS);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    spawnChild();
  }, delay);
}

// ---------------- 对外 API ----------------

/** 启动监测（仅 win32 生效，其他平台优雅跳过） */
export function start(): void {
  if (process.platform !== 'win32' || started) return;
  started = true;
  stopping = false;
  paused = false;

  usageDir = path.join(app.getPath('userData'), 'usage');
  try {
    mkdirSync(usageDir, { recursive: true });
  } catch (e) {
    console.warn('[usage-monitor] mkdir failed:', e);
  }

  currentDate = localDateStr(new Date());
  loadTodayFile();
  lastSampleAt = null;
  lastFlushCheck = Date.now();
  spawnChild();
}

/** 停止监测并显式 kill 常驻子进程（before-quit 调用） */
export function stop(): void {
  if (!started) return;
  stopping = true;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  flushDailyFile();
  killChild();
  started = false;
}

/** 锁屏/休眠：暂停采样（kill 子进程，停止计时） */
export function pause(): void {
  if (!started || paused) return;
  paused = true;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  flushDailyFile();
  killChild();
  lastSampleAt = null;
  lastSampleKey = null;
  currentApp = '';
}

/** 解锁/恢复：重新采样（恢复输入后重新归因） */
export function resume(): void {
  if (!started || !paused || stopping) return;
  paused = false;
  lastSampleAt = null;
  spawnChild();
}

/** 手动清零当日累计（保留 usage:reset-daily 现有行为） */
export function resetDaily(): void {
  accum = new Map();
  idleSeconds = 0;
  currentApp = '';
  lastSampleKey = null;
  lastSampleExe = '';
  dirty = false;
}

/** 当前前台应用显示名（无/空闲/忽略时为 ''） */
export function getCurrentApp(): string {
  return currentApp;
}

/** 当日全量排行（按 seconds 降序），契约：Array<{ app, exe, seconds }> */
export function getRanking(): Array<{ app: string; exe: string; seconds: number }> {
  rolloverIfNeeded();
  return Array.from(accum.values())
    .map(a => ({ app: a.app, exe: a.exe, seconds: Math.round(a.seconds) }))
    .sort((a, b) => b.seconds - a.seconds);
}

/**
 * 兼容旧接口 usage:get-foreground-app 的返回结构：
 * { currentApp, apps: [{ appName, durationMs }] }（durationMs > 1000，降序）
 */
export function getLegacySummary(): { currentApp: string; apps: Array<{ appName: string; durationMs: number }> } {
  rolloverIfNeeded();
  const apps = Array.from(accum.values())
    .map(a => ({ appName: a.app, durationMs: Math.round(a.seconds * 1000) }))
    .filter(a => a.durationMs > 1000)
    .sort((a, b) => b.durationMs - a.durationMs);
  return { currentApp, apps };
}
