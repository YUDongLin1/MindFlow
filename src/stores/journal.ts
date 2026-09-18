import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { todayLocal, yesterdayLocal, mondayLocal } from '@/utils/dateUtils'
import { useToast } from '../composables/useToast'

export type BuiltinModuleType = 'diary' | 'work' | 'study'
export type ModuleType = BuiltinModuleType | string // 支持自定义模块 ID
export type AIMode = 'local' | 'byok' | 'cloud'

/** 自定义模块定义 */
export interface CustomModule {
  id: string
  name: string
  icon: string // lucide 图标名
  prompts: { id: string; label: string; placeholder: string }[]
  createdAt: string
}

export interface AIReviewSegment {
  achievements: string
  learnings: string
  improvements: string
  actions: string
}

export interface AIReview {
  status: 'idle' | 'generated' | 'adopted' | 'dismissed'
  draft: AIReviewSegment
  source: AIMode | 'local-fallback'
  generatedAt?: string
  accuracyFlag?: boolean
  note?: string
}

export interface JournalPrompt {
  id: string
  label: string
  value: string
}

export interface EntryMetadata {
  location?: string
  weather?: string
  temperature?: number
  attachments?: EntryAttachment[]
}

export interface EntryAttachment {
  id: string
  name: string
  type: string // MIME type
  size: number
  dataUrl?: string // base64 data URL for preview
  storageKey?: string // Electron media storage key
}

export interface JournalEntry {
  id: string
  date: string // YYYY-MM-DD
  module: ModuleType
  mood?: string
  prompts: JournalPrompt[]
  title?: string
  tags: string[]
  links: string[]
  createdAt: string
  updatedAt: string
  review?: AIReview
  reviewMark?: boolean
  wikiLinks?: string[]
  metadata?: EntryMetadata
}

export interface AuditEntry {
  ts: string
  action: string
  detail?: string
}

export interface JournalPrefs {
  aiMode: AIMode
  aiKey: string
  e2eeEnabled: boolean
  aiBaseUrl?: string
  aiModel?: string
}

export const MODULE_LABELS: Record<ModuleType, string> = {
  diary: '日记',
  work: '工作日志',
  study: '学习笔记',
}

export const MODULE_PROMPTS: Record<ModuleType, { id: string; label: string; placeholder: string }[]> = {
  diary: [
    { id: 'did', label: '今天值得记下的', placeholder: '发生了什么，或哪一步走得踏实' },
    { id: 'keep', label: '想记住的一句话', placeholder: '今天冒出来的念头、金句或感悟' },
  ],
  work: [
    { id: 'did', label: '今天做了什么', placeholder: '完成了哪些事，推进到哪' },
    { id: 'stuck', label: '卡在哪里', placeholder: '受阻的点、待决策的事' },
    { id: 'next', label: '下一步计划', placeholder: '明天最该推进的一件事' },
  ],
  study: [
    { id: 'learned', label: '今天学到什么', placeholder: '一个新概念、一个解法' },
    { id: 'confused', label: '还有哪里没懂', placeholder: '模糊、想不通的地方' },
    { id: 'dig', label: '想深挖的点', placeholder: '想延展阅读或实践的方向' },
  ],
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function todayISO(): string {
  return todayLocal()
}

function extractWikiLinks(prompts: JournalPrompt[]): string[] {
  const regex = /\[\[([^\]]+)\]\]/g
  const links = new Set<string>()
  for (const p of prompts) {
    if (!p.value) continue
    let match: RegExpExecArray | null
    while ((match = regex.exec(p.value)) !== null) {
      links.add(match[1].trim())
    }
  }
  return Array.from(links)
}

/** 获取模块的 prompts（支持自定义模块） */
export function getModulePrompts(moduleId: ModuleType, customModules: CustomModule[]): { id: string; label: string; placeholder: string }[] {
  if (moduleId in MODULE_PROMPTS) {
    return MODULE_PROMPTS[moduleId as BuiltinModuleType]
  }
  const custom = customModules.find(m => m.id === moduleId)
  return custom?.prompts || [{ id: 'content', label: '内容', placeholder: '记录点什么…' }]
}

/** 获取模块标签（支持自定义模块） */
export function getModuleLabel(moduleId: ModuleType, customModules: CustomModule[]): string {
  if (moduleId in MODULE_LABELS) {
    return MODULE_LABELS[moduleId as BuiltinModuleType]
  }
  const custom = customModules.find(m => m.id === moduleId)
  return custom?.name || moduleId
}

export const useJournalStore = defineStore('journal', () => {
  // ---- state ----
  const entries = ref<JournalEntry[]>([])
  const prefs = ref<JournalPrefs>({ aiMode: 'local', aiKey: '', e2eeEnabled: false })
  const auditLog = ref<AuditEntry[]>([])
  const customModules = ref<CustomModule[]>([])

  // ---- getters ----
  const entriesByDate = computed(() => (date: string) => entries.value.filter(e => e.date === date))
  const entriesThisWeek = computed(() => {
    const monday = mondayLocal()
    return entries.value.filter(e => new Date(e.createdAt) >= monday)
  })
  const allEntries = computed(() => entries.value)
  const todayEntries = computed(() => entries.value.filter(e => e.date === todayISO()))

  // ---- persist helpers ----
  async function persist(): Promise<boolean> {
    try {
      // 深度去代理：entries/prefs/auditLog/customModules 是 Vue reactive Proxy，
      // IndexedDB structured clone 无法克隆 Proxy（DataCloneError），
      // 必须先序列化为纯 JSON 快照再写盘。
      // 数据字段均为 string/number/boolean/纯对象（时间戳为 ISO 字符串，无 Date 对象），JSON 安全；
      // undefined 字段会被 JSON 序列化丢弃，与既有读取逻辑（字段存在性判断）语义一致。
      const snapshot = JSON.parse(JSON.stringify({
        entries: entries.value,
        prefs: prefs.value,
        audit: auditLog.value,
        customModules: customModules.value,
      }))
      await localforage.setItem('mindflow:journal', snapshot)
      return true
    } catch (e) {
      console.error('[journal] persist failed', e)
      // 用户可见提示：useToast 为模块级实现（直接 render 到 document.body），可在非组件上下文使用
      try {
        useToast().error('保存失败，数据可能未保存')
      } catch {
        window.dispatchEvent(new CustomEvent('mindflow:persist-error'))
      }
      return false
    }
  }

  // ---- actions ----
  async function loadEntries() {
    try {
      const raw = await localforage.getItem('mindflow:journal')
      if (raw && typeof raw === 'object') {
        const data = raw as { entries?: JournalEntry[]; prefs?: JournalPrefs; audit?: AuditEntry[]; customModules?: CustomModule[] }
        if (Array.isArray(data.entries)) {
          entries.value = data.entries
        }
        if (data.prefs) prefs.value = { ...prefs.value, ...data.prefs }
        if (data.audit) auditLog.value = data.audit
        if (Array.isArray(data.customModules)) customModules.value = data.customModules
      }
      // 首次加载不写入种子数据，保持空白
    } catch (e) {
      console.error('[journal] load failed', e)
      // 加载失败时不清空内存数据，保留可能的已有数据
    }
  }

  async function addEntry(payload: {
    module: ModuleType
    prompts: JournalPrompt[]
    mood?: string
    tags: string[]
    links: string[]
    title?: string
    metadata?: EntryMetadata
  }) {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: uid(),
      date: todayISO(),
      module: payload.module,
      mood: payload.mood,
      prompts: payload.prompts,
      title: payload.title,
      tags: payload.tags,
      links: payload.links,
      createdAt: now,
      updatedAt: now,
      wikiLinks: payload.module === 'study' ? extractWikiLinks(payload.prompts) : undefined,
      metadata: payload.metadata,
    }
    entries.value.unshift(entry)
    await persist()
    return entry
  }

  async function updateEntry(entry: JournalEntry) {
    const idx = entries.value.findIndex(e => e.id === entry.id)
    const updated = { ...entry, updatedAt: new Date().toISOString() }
    if (idx !== -1) entries.value[idx] = updated
    else entries.value.unshift(updated)
    await persist()
  }

  async function deleteEntry(id: string) {
    entries.value = entries.value.filter(e => e.id !== id)
    await persist()
  }

  async function toggleReviewMark(entryId: string) {
    const entry = entries.value.find(e => e.id === entryId)
    if (!entry) return
    entry.reviewMark = !entry.reviewMark
    entry.updatedAt = new Date().toISOString()
    await persist()
  }

  async function setAIReview(payload: { entryId: string; review: AIReview }) {
    const entry = entries.value.find(e => e.id === payload.entryId)
    if (!entry) return
    entry.review = payload.review
    entry.updatedAt = new Date().toISOString()
    await persist()
    const label = payload.review.status === 'adopted' ? '采纳' : payload.review.status === 'dismissed' ? '丢弃' : '生成'
    auditLog.value.unshift({
      ts: new Date().toISOString(),
      action: `ai_review_${payload.review.status}`,
      detail: `${MODULE_LABELS[entry.module]} · ${label}（${payload.review.source}）`,
    })
    await persist()
  }

  async function setAIMode(mode: AIMode) {
    prefs.value.aiMode = mode
    await persist()
    auditLog.value.unshift({ ts: new Date().toISOString(), action: 'ai_mode_change', detail: mode })
    await persist()
  }

  async function setAIKey(key: string) {
    prefs.value.aiKey = key
    await persist()
  }

  async function setAIPref(payload: { aiBaseUrl?: string; aiModel?: string }) {
    if (payload.aiBaseUrl !== undefined) prefs.value.aiBaseUrl = payload.aiBaseUrl
    if (payload.aiModel !== undefined) prefs.value.aiModel = payload.aiModel
    await persist()
  }

  async function setE2EE(enabled: boolean) {
    prefs.value.e2eeEnabled = enabled
    await persist()
    auditLog.value.unshift({ ts: new Date().toISOString(), action: 'e2ee_toggle', detail: enabled ? '开启' : '关闭' })
    await persist()
  }

  async function logAudit(entry: AuditEntry) {
    auditLog.value.unshift(entry)
    await persist()
  }

  // ---- 自定义模块管理 ----
  async function addCustomModule(mod: Omit<CustomModule, 'id' | 'createdAt'>) {
    const newMod: CustomModule = {
      ...mod,
      id: 'custom_' + uid(),
      createdAt: new Date().toISOString(),
    }
    customModules.value.push(newMod)
    await persist()
    return newMod
  }

  async function updateCustomModule(id: string, updates: Partial<Omit<CustomModule, 'id' | 'createdAt'>>) {
    const idx = customModules.value.findIndex(m => m.id === id)
    if (idx === -1) return
    customModules.value[idx] = { ...customModules.value[idx], ...updates }
    await persist()
  }

  async function deleteCustomModule(id: string) {
    customModules.value = customModules.value.filter(m => m.id !== id)
    await persist()
  }

  return {
    // state
    entries, prefs, auditLog, customModules,
    // getters
    entriesByDate, entriesThisWeek, allEntries, todayEntries,
    // actions
    loadEntries, addEntry, updateEntry, deleteEntry,
    toggleReviewMark, setAIReview, setAIMode, setAIKey, setAIPref, setE2EE, logAudit,
    addCustomModule, updateCustomModule, deleteCustomModule,
  }
})
