/**
 * 软件使用时间追踪服务
 *
 * 在 Electron 环境下：
 *   - 通过 IPC 获取前台窗口信息（Win32 API）
 *   - 记录各软件使用时长
 *
 * 在 Web 环境下：
 *   - 仅追踪 MindFlow 自身的活跃时间（focus/blur）
 */

import localforage from 'localforage'
import { todayLocal } from '@/utils/dateUtils'

export interface AppUsageEntry {
  appName: string
  durationMs: number
  lastActive: string // ISO timestamp
}

export interface DailyUsageData {
  date: string
  mindflowMs: number
  apps: AppUsageEntry[]
}

const STORAGE_KEY = 'mindflow:usage'
const SAVE_INTERVAL = 60_000 // 每分钟保存一次
const EXTERNAL_POLL_INTERVAL = 30_000 // 每 30 秒拉取一次外部应用使用时长

// 内存中的今日数据
let todayData: DailyUsageData = {
  date: todayLocal(),
  mindflowMs: 0,
  apps: [],
}

let isActive = true
let lastFocusTime = Date.now()
let saveTimer: ReturnType<typeof setInterval> | null = null
let externalPollTimer: ReturnType<typeof setInterval> | null = null

/** 初始化追踪器 */
export function initUsageTracker(): void {
  loadTodayData()
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
  saveTimer = setInterval(saveData, SAVE_INTERVAL)
  window.addEventListener('beforeunload', saveData)
  // 外部应用时长：立即拉一次，之后每 30 秒同步（非 Electron 环境内部安全跳过）
  void updateExternalAppUsage()
  externalPollTimer = setInterval(() => void updateExternalAppUsage(), EXTERNAL_POLL_INTERVAL)
}

/** 销毁追踪器 */
export function destroyUsageTracker(): void {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('focus', onFocus)
  window.removeEventListener('blur', onBlur)
  if (saveTimer) clearInterval(saveTimer)
  if (externalPollTimer) clearInterval(externalPollTimer)
  externalPollTimer = null
  window.removeEventListener('beforeunload', saveData)
  saveData()
}

function onVisibilityChange() {
  if (document.hidden) {
    onBlur()
  } else {
    onFocus()
  }
}

function onFocus() {
  if (!isActive) {
    isActive = true
    lastFocusTime = Date.now()
  }
}

function onBlur() {
  if (isActive) {
    const elapsed = Date.now() - lastFocusTime
    todayData.mindflowMs += elapsed
    isActive = false
    saveData()
  }
}

/** 加载今日数据 */
async function loadTodayData() {
  const today = todayLocal()
  try {
    const raw = await localforage.getItem(STORAGE_KEY)
    if (raw && typeof raw === 'object') {
      const data = raw as DailyUsageData
      if (data.date === today) {
        todayData = data
      } else {
        todayData = { date: today, mindflowMs: 0, apps: [] }
      }
    }
  } catch (e) {
    console.error('[usage] load failed', e)
  }
  lastFocusTime = Date.now()
}

/** 保存数据 */
async function saveData() {
  if (isActive) {
    const elapsed = Date.now() - lastFocusTime
    todayData.mindflowMs += elapsed
    lastFocusTime = Date.now()
  }
  try {
    await localforage.setItem(STORAGE_KEY, { ...todayData })
  } catch (e) {
    console.error('[usage] save failed', e)
  }
}

/** 获取今日使用数据 */
export function getTodayUsage(): DailyUsageData {
  let currentMs = todayData.mindflowMs
  if (isActive) {
    currentMs += Date.now() - lastFocusTime
  }
  return {
    ...todayData,
    mindflowMs: currentMs,
  }
}

/** 获取格式化的使用时长 */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return '不到 1 分钟'
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  if (remainMinutes === 0) return `${hours} 小时`
  return `${hours} 小时 ${remainMinutes} 分钟`
}

/**
 * 更新外部软件使用数据（仅 Electron 环境可用）
 *
 * 通过 `window.api.usage.getApps()`（IPC: usage:get-apps）从主进程获取
 * `Array<{ app, exe, seconds }>`（按 seconds 降序，主进程按自然日累计，
 * 覆盖周末与节假日，渲染层无需做日期过滤）。
 */
export async function updateExternalAppUsage(): Promise<void> {
  if (typeof window === 'undefined' || !window.api?.usage) return

  try {
    const apps = await window.api.usage.getApps()
    if (!Array.isArray(apps)) return
    const now = new Date().toISOString()
    for (const extApp of apps) {
      const name = extApp?.app || extApp?.exe
      if (!name || name === 'MindFlow') continue // MindFlow 自身时长单独统计，避免重复
      const durationMs = Math.max(0, Math.round((extApp.seconds || 0) * 1000))
      const existing = todayData.apps.find(a => a.appName === name)
      if (existing) {
        existing.durationMs = durationMs
        existing.lastActive = now
      } else {
        todayData.apps.push({ appName: name, durationMs, lastActive: now })
      }
    }
    todayData.apps.sort((a, b) => b.durationMs - a.durationMs)
  } catch (e) {
    // Silent fail - non-Electron environment or IPC unavailable
  }
}
