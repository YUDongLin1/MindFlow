/**
 * MindFlow 埋点服务 — 事件字典 v0.2
 *
 * 所有事件写入 localforage('mindflow:analytics')，环形截断上限 5000 条。
 * sessionId 取自 localStorage('mindflow:session')，缺失则 crypto.randomUUID() 生成。
 *
 * 设计红线：埋点仅用于产品改进，不含用户日志内容。props 只记录结构性元数据。
 */

import localforage from 'localforage'

// ---------------------------------------------------------------------------
// 事件字典 v0.2
// ---------------------------------------------------------------------------

export const EVENTS = {
  SIGNUP: 'signup',
  FIRST_ENTRY_CREATED: 'first_entry_created',
  ENTRY_CREATED: 'entry_created',
  LINK_CREATED: 'link_created',
  HISTORY_REVIEWED: 'history_reviewed',
  SEARCH_QUERY: 'search_query',
  AI_REVIEW_EXPOSURE: 'ai_review_exposure',
  AI_REVIEW_TRIGGERED: 'ai_review_triggered',
  AI_REVIEW_GENERATED: 'ai_review_generated',
  AI_REVIEW_VIEWED: 'ai_review_viewed',
  AI_REVIEW_ADOPTED: 'ai_review_adopted',
  AI_REVIEW_DISMISSED: 'ai_review_dismissed',
  AI_REVIEW_EDITED: 'ai_review_edited',
  AI_REVIEW_RESTORED_ORIGINAL: 'ai_review_restored_original',
  AI_REVIEW_DECLINED_REASON: 'ai_review_declined_reason',
  TRUST_SCORE_SUBMITTED: 'trust_score_submitted',
  WEEKLY_REVIEW_GENERATED: 'weekly_review_generated',
  WEEKLY_REVIEW_VIEWED: 'weekly_review_viewed',
  IMPORT_COMPLETED: 'import_completed',
  EXPORT_TRIGGERED: 'export_triggered',
  APP_CRASH: 'app_crash',
  SYNC_SUCCESS: 'sync_success',
  SYNC_FAIL: 'sync_fail',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface AnalyticsEvent {
  name: string
  props?: Record<string, unknown>
  ts: string
  sessionId: string
}

// ---------------------------------------------------------------------------
// 存储
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'mindflow:analytics'
const SESSION_KEY = 'mindflow:session'
const MAX_EVENTS = 5000

const analyticsStore = localforage.createInstance({
  name: 'MindFlow',
  storeName: 'mindflow_analytics',
})

// ---------------------------------------------------------------------------
// Session ID
// ---------------------------------------------------------------------------

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

// ---------------------------------------------------------------------------
// 核心追踪函数
// ---------------------------------------------------------------------------

/**
 * 记录一个事件到本地存储。
 * @param name  事件名（建议使用 EVENTS 常量）
 * @param props 结构性元数据（不含日志内容）
 */
export async function track(
  name: string,
  props?: Record<string, unknown>
): Promise<void> {
  const event: AnalyticsEvent = {
    name,
    props,
    ts: new Date().toISOString(),
    sessionId: getSessionId(),
  }

  try {
    const existing = (await analyticsStore.getItem<AnalyticsEvent[]>(STORAGE_KEY)) || []
    existing.push(event)
    // 环形截断：保留最后 MAX_EVENTS 条
    if (existing.length > MAX_EVENTS) {
      existing.splice(0, existing.length - MAX_EVENTS)
    }
    await analyticsStore.setItem(STORAGE_KEY, existing)
  } catch (e) {
    console.error('[analytics] track failed', e)
  }
}

/**
 * 同步版本的 track（仅写入队列，不等待）。适用于不想 await 的场景。
 */
export function trackSync(name: string, props?: Record<string, unknown>): void {
  track(name, props).catch(() => {})
}

// ---------------------------------------------------------------------------
// 读取全部事件（调试/导出用）
// ---------------------------------------------------------------------------

export async function getAllEvents(): Promise<AnalyticsEvent[]> {
  try {
    return (await analyticsStore.getItem<AnalyticsEvent[]>(STORAGE_KEY)) || []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// 派生指标函数
// ---------------------------------------------------------------------------

/**
 * 激活率：创建首条记录的用户 / 注册用户。
 * @returns 0-1 之间的比例
 */
export async function activationRate(): Promise<number> {
  const events = await getAllEvents()
  const signups = events.filter(e => e.name === EVENTS.SIGNUP).length
  if (signups === 0) return 0
  const firstEntries = new Set(
    events
      .filter(e => e.name === EVENTS.FIRST_ENTRY_CREATED)
      .map(e => e.sessionId)
  ).size
  return Math.min(firstEntries / signups, 1)
}

/**
 * AI 触发率：触发过 AI 复盘的用户 / 创建过记录的用户。
 * @returns 0-1 之间的比例
 */
export async function aiTriggerRate(): Promise<number> {
  const events = await getAllEvents()
  const entrySessions = new Set(
    events
      .filter(e => e.name === EVENTS.ENTRY_CREATED)
      .map(e => e.sessionId)
  )
  if (entrySessions.size === 0) return 0
  const triggerSessions = new Set(
    events
      .filter(e => e.name === EVENTS.AI_REVIEW_TRIGGERED)
      .map(e => e.sessionId)
  )
  let overlap = 0
  for (const s of triggerSessions) {
    if (entrySessions.has(s)) overlap++
  }
  return overlap / entrySessions.size
}

/**
 * WAR (Weekly Active Rate)：过去 7 天有活跃的用户 / 总注册用户。
 * @returns 0-1 之间的比例
 */
export async function war(): Promise<number> {
  const events = await getAllEvents()
  const signups = events.filter(e => e.name === EVENTS.SIGNUP).length
  if (signups === 0) return 0
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const recentActive = new Set(
    events
      .filter(e => new Date(e.ts).getTime() >= sevenDaysAgo && e.name !== EVENTS.APP_CRASH)
      .map(e => e.sessionId)
  ).size
  return Math.min(recentActive / signups, 1)
}

/**
 * 崩溃率：崩溃事件数 / 总事件数。
 * @returns 0-1 之间的比例
 */
export async function crashRate(): Promise<number> {
  const events = await getAllEvents()
  if (events.length === 0) return 0
  const crashes = events.filter(e => e.name === EVENTS.APP_CRASH).length
  return crashes / events.length
}
