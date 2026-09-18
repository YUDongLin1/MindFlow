import type { Module } from 'vuex'
import type { State } from './index'
import { todayLocal, yesterdayLocal, mondayLocal } from '@/utils/dateUtils'

export type BuiltinModuleType = 'diary' | 'work' | 'study'
export type ModuleType = BuiltinModuleType | string // 支持自定义模块 ID
export type AIMode = 'local' | 'byok' | 'cloud'

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
  reviewMark?: boolean      // 学习笔记复习标记
  wikiLinks?: string[]      // 从学习 prompt 提取的 [[x]]
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

export interface JournalModuleState {
  entries: JournalEntry[]
  prefs: JournalPrefs
  auditLog: AuditEntry[]
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

/**
 * 从 prompt 文本中提取 [[xxx]] 双链，去重返回。
 */
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

const store: Module<JournalModuleState, State> = {
  namespaced: true,
  state: () => ({
    entries: [],
    prefs: { aiMode: 'local', aiKey: '', e2eeEnabled: false },
    auditLog: [],
  }),
  mutations: {
    SET_ENTRIES(state, entries: JournalEntry[]) { state.entries = entries },
    ADD_ENTRY(state, entry: JournalEntry) { state.entries.unshift(entry) },
    UPDATE_ENTRY(state, entry: JournalEntry) {
      const i = state.entries.findIndex(e => e.id === entry.id)
      if (i !== -1) state.entries[i] = entry
      else state.entries.unshift(entry)
    },
    DELETE_ENTRY(state, id: string) { state.entries = state.entries.filter(e => e.id !== id) },
    SET_PREFS(state, prefs: Partial<JournalPrefs>) { state.prefs = { ...state.prefs, ...prefs } },
    SET_AUDIT(state, log: AuditEntry[]) { state.auditLog = log },
    PUSH_AUDIT(state, entry: AuditEntry) { state.auditLog.unshift(entry) },
  },
  actions: {
    async loadEntries({ commit, state }) {
      // Vuex journal 模块不再独立加载数据，由 Pinia store 统一管理
      // 此方法保留为空实现以兼容旧代码中的 dispatch 调用
    },

    async addEntry({ commit, state }, payload: { module: ModuleType; prompts: JournalPrompt[]; mood?: string; tags: string[]; links: string[]; title?: string }) {
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
        // study 模块自动提取 [[xxx]] 双链
        wikiLinks: payload.module === 'study' ? extractWikiLinks(payload.prompts) : undefined,
      }
      commit('ADD_ENTRY', entry)
      await persist(state)
      return entry
    },

    async updateEntry({ commit, state }, entry: JournalEntry) {
      commit('UPDATE_ENTRY', { ...entry, updatedAt: new Date().toISOString() })
      await persist(state)
    },

    async deleteEntry({ commit, state }, id: string) {
      commit('DELETE_ENTRY', id)
      await persist(state)
    },

    async toggleReviewMark({ commit, state }, entryId: string) {
      const entry = state.entries.find(e => e.id === entryId)
      if (!entry) return
      const updated: JournalEntry = {
        ...entry,
        reviewMark: !entry.reviewMark,
        updatedAt: new Date().toISOString(),
      }
      commit('UPDATE_ENTRY', updated)
      await persist(state)
    },

    async setAIReview({ commit, state }, payload: { entryId: string; review: AIReview }) {
      const entry = state.entries.find(e => e.id === payload.entryId)
      if (!entry) return
      const updated: JournalEntry = { ...entry, review: payload.review, updatedAt: new Date().toISOString() }
      commit('UPDATE_ENTRY', updated)
      await persist(state)
      const label = payload.review.status === 'adopted' ? '采纳' : payload.review.status === 'dismissed' ? '丢弃' : '生成'
      commit('PUSH_AUDIT', {
        ts: new Date().toISOString(),
        action: `ai_review_${payload.review.status}`,
        detail: `${MODULE_LABELS[entry.module]} · ${label}（${payload.review.source}）`,
      })
      await persistAudit(state)
    },

    async setAIMode({ commit, state }, mode: AIMode) {
      commit('SET_PREFS', { aiMode: mode })
      await persistPrefs(state)
      commit('PUSH_AUDIT', { ts: new Date().toISOString(), action: 'ai_mode_change', detail: mode })
      await persistAudit(state)
    },
    async setAIKey({ commit, state }, key: string) {
      commit('SET_PREFS', { aiKey: key })
      await persistPrefs(state)
    },
    async setAIPref({ commit, state }, payload: { aiBaseUrl?: string; aiModel?: string }) {
      commit('SET_PREFS', payload)
      await persistPrefs(state)
    },
    async setE2EE({ commit, state }, enabled: boolean) {
      commit('SET_PREFS', { e2eeEnabled: enabled })
      await persistPrefs(state)
      commit('PUSH_AUDIT', { ts: new Date().toISOString(), action: 'e2ee_toggle', detail: enabled ? '开启' : '关闭' })
      await persistAudit(state)
    },
    async logAudit({ commit, state }, entry: AuditEntry) {
      commit('PUSH_AUDIT', entry)
      await persistAudit(state)
    },
  },
  getters: {
    entriesByDate: (state) => (date: string) => state.entries.filter(e => e.date === date),
    entriesThisWeek: (state) => {
      const now = new Date()
      const day = now.getDay() || 7
      const monday = new Date(now)
      monday.setDate(now.getDate() - day + 1)
      monday.setHours(0, 0, 0, 0)
      return state.entries.filter(e => new Date(e.createdAt) >= monday)
    },
    allEntries: (state) => state.entries,
  },
}

// 已禁用：防止恒空的 Vuex state 覆盖 Pinia 持久化的 mindflow:journal
// （原实现不含 customModules，一旦触发即清空全量数据）。数据写入统一由 Pinia store 负责。
async function persist(_state: JournalModuleState) {}
async function persistPrefs(_state: JournalModuleState) {}
async function persistAudit(_state: JournalModuleState) {}

export default store
