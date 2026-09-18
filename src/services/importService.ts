/**
 * 无损导入服务
 * 支持源：JSON（MindFlow 备份）、微信小记（TXT）、备忘录（TXT/HTML）、Notion（CSV/MD）
 * 零损失：所有字段映射为 JournalEntry，冲突预检，不丢失原始数据
 */

import type { JournalEntry, ModuleType, JournalPrompt } from '@/stores/journal'
import { todayLocal, formatLocalDate } from '@/utils/dateUtils'

// ------------------------------------------------------------------
// 类型定义
// ------------------------------------------------------------------

export type ImportSource = 'json' | 'wechat_memo' | 'apple_notes' | 'notion_csv' | 'notion_md' | 'auto'

export interface ParsedImportEntry {
  date: string
  module: ModuleType
  mood?: string
  title?: string
  content: string  // 原始内容文本
  tags: string[]
  createdAt?: string
  source: ImportSource
}

export interface ImportConflict {
  incoming: ParsedImportEntry
  existing: JournalEntry
  type: 'date_module_duplicate'
}

export interface ImportPreview {
  entries: ParsedImportEntry[]
  conflicts: ImportConflict[]
  source: ImportSource
  stats: {
    total: number
    new: number
    conflicts: number
    tags: string[]
    dateRange: { start: string; end: string } | null
  }
}

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

// ------------------------------------------------------------------
// 工具函数
// ------------------------------------------------------------------

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'e_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function todayISO(): string {
  return todayLocal()
}

function normalizeDate(raw: string): string {
  if (!raw) return todayISO()
  // 已是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // 中文日期：2025年1月15日
  const cn = raw.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (cn) return `${cn[1]}-${cn[2].padStart(2, '0')}-${cn[3].padStart(2, '0')}`
  // MM/DD/YYYY 或 M/D/YYYY
  const us = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  // 尝试 Date 解析
  try {
    const d = new Date(raw)
    if (!isNaN(d.getTime())) return formatLocalDate(d)
  } catch {}
  return todayISO()
}

function guessModule(content: string, tags: string[]): ModuleType {
  const lower = content.toLowerCase()
  if (tags.some(t => /学习|笔记|study|learn|learn/i.test(t))) return 'study'
  if (tags.some(t => /工作|work|日志|log/i.test(t))) return 'work'
  if (/做了什么|卡在哪里|下一步|工作|会议|项目|deadline|bug|需求/i.test(content)) return 'work'
  if (/学了|学到|知识|笔记|learn|study|concept/i.test(content)) return 'study'
  return 'diary'
}

// ------------------------------------------------------------------
// 解析器：JSON（MindFlow 完整备份 / MindFlow journal 导出）
// ------------------------------------------------------------------

function parseJson(text: string): ParsedImportEntry[] {
  const data = JSON.parse(text)
  const entries: ParsedImportEntry[] = []

  // 格式1：MindFlow journal 格式 { entries: [...] }
  if (data.entries && Array.isArray(data.entries)) {
    for (const e of data.entries) {
      if (!e.date || !e.prompts) continue
      const content = e.prompts.filter((p: any) => p.value).map((p: any) => `${p.label}: ${p.value}`).join('\n')
      entries.push({
        date: e.date,
        module: e.module || guessModule(content, e.tags || []),
        mood: e.mood,
        title: e.title,
        content,
        tags: e.tags || [],
        createdAt: e.createdAt,
        source: 'json',
      })
    }
    return entries
  }

  // 格式2：MindFlow daySummaries 格式 { daySummaries: [...] }
  if (data.daySummaries && Array.isArray(data.daySummaries)) {
    for (const ds of data.daySummaries) {
      if (!ds.date) continue
      const content = ds.summary || ''
      entries.push({
        date: ds.date,
        module: guessModule(content, ds.tags || []),
        mood: ds.mood,
        title: ds.date,
        content: content.replace(/<[^>]*>/g, ''), // strip HTML
        tags: ds.tags || [],
        createdAt: ds.date,
        source: 'json',
      })
    }
    return entries
  }

  // 格式3：数组格式
  if (Array.isArray(data)) {
    for (const item of data) {
      const date = item.date || item.created_at || todayISO()
      const content = item.content || item.summary || item.text || JSON.stringify(item)
      entries.push({
        date: normalizeDate(date),
        module: item.module || guessModule(content, item.tags || []),
        mood: item.mood,
        content: content.replace(/<[^>]*>/g, ''),
        tags: item.tags || [],
        source: 'json',
      })
    }
    return entries
  }

  throw new Error('JSON 格式无法识别：缺少 entries 或 daySummaries 字段')
}

// ------------------------------------------------------------------
// 解析器：微信小记（TXT，每条以日期开头）
// ------------------------------------------------------------------

function parseWechatMemo(text: string): ParsedImportEntry[] {
  const entries: ParsedImportEntry[] = []
  // 微信小记导出格式：每条以日期行开头，后跟内容
  // 支持 "2025-01-15" 或 "2025年1月15日" 或 "1/15/2025"
  const blocks = text.split(/\n(?=\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})/)

  for (const block of blocks) {
    const lines = block.trim()
    if (!lines) continue
    const firstLineMatch = lines.match(/^(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|\d{1,2}\/\d{1,2}\/\d{4})\s*(.*)/s)
    if (!firstLineMatch) continue
    const date = normalizeDate(firstLineMatch[1])
    const content = (firstLineMatch[2] || '').trim()
    if (!content) continue
    entries.push({
      date,
      module: guessModule(content, []),
      content,
      tags: [],
      source: 'wechat_memo',
    })
  }

  // 如果按日期分割失败，尝试按空行分割
  if (entries.length === 0) {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim())
    for (const para of paragraphs) {
      const dateMatch = para.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
      entries.push({
        date: dateMatch ? normalizeDate(dateMatch[1]) : todayISO(),
        module: guessModule(para, []),
        content: para.replace(/^\d{4}[-/]\d{1,2}[-/]\d{1,2}\s*/, '').trim(),
        tags: [],
        source: 'wechat_memo',
      })
    }
  }

  return entries
}

// ------------------------------------------------------------------
// 解析器：Apple Notes / 备忘录（TXT 或 HTML）
// ------------------------------------------------------------------

function parseAppleNotes(text: string): ParsedImportEntry[] {
  const entries: ParsedImportEntry[] = []
  // Apple Notes 导出通常每条以标题（第一行）开头，后跟内容
  const blocks = text.split(/\n{2,}(?=[^\n]+\n[-=]{3,})/)

  for (const block of blocks) {
    const lines = block.trim()
    if (!lines) continue
    // 尝试提取标题行（第一行）
    const titleMatch = lines.match(/^([^\n]+)\n[-=]{3,}\n?([\s\S]*)/)
    const title = titleMatch ? titleMatch[1].trim() : lines.split('\n')[0].trim()
    const content = titleMatch ? titleMatch[2].trim() : lines
    if (!content && !title) continue

    // 尝试从内容中提取日期
    const dateMatch = content.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
    entries.push({
      date: dateMatch ? normalizeDate(dateMatch[1]) : todayISO(),
      module: guessModule(content || title, []),
      title,
      content: content || title,
      tags: [],
      source: 'apple_notes',
    })
  }

  // 简单回退：按空行分割
  if (entries.length === 0) {
    const paras = text.split(/\n\s*\n/).filter(p => p.trim().length > 10)
    for (const para of paras) {
      entries.push({
        date: todayISO(),
        module: guessModule(para, []),
        content: para.trim(),
        tags: [],
        source: 'apple_notes',
      })
    }
  }

  return entries
}

// ------------------------------------------------------------------
// 解析器：Notion CSV
// ------------------------------------------------------------------

function parseNotionCsv(text: string): ParsedImportEntry[] {
  const entries: ParsedImportEntry[] = []
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return entries

  const headers = parseCsvLine(lines[0])
  const dateIdx = headers.findIndex(h => /date|日期|created|时间/i.test(h))
  const contentIdx = headers.findIndex(h => /content|内容|text|正文|page|title|名称/i.test(h))
  const tagsIdx = headers.findIndex(h => /tags|标签|tag/i.test(h))

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i])
    const date = dateIdx >= 0 ? normalizeDate(cols[dateIdx] || '') : todayISO()
    const content = contentIdx >= 0 ? (cols[contentIdx] || '') : cols.join(' ').trim()
    const tagsRaw = tagsIdx >= 0 ? (cols[tagsIdx] || '') : ''
    const tags = tagsRaw.split(/[,;，]/).map(t => t.trim()).filter(Boolean)

    if (!content) continue
    entries.push({
      date,
      module: guessModule(content, tags),
      content: content.replace(/<[^>]*>/g, ''),
      tags,
      source: 'notion_csv',
    })
  }

  return entries
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

// ------------------------------------------------------------------
// 解析器：Notion Markdown
// ------------------------------------------------------------------

function parseNotionMd(text: string): ParsedImportEntry[] {
  const entries: ParsedImportEntry[] = []
  // Notion 导出的 MD 通常每个文件 = 一条记录，按 # 标题分割
  const blocks = text.split(/\n(?=# )/)

  for (const block of blocks) {
    const lines = block.trim()
    if (!lines) continue
    const titleMatch = lines.match(/^#\s+(.+)/)
    const title = titleMatch ? titleMatch[1].trim() : ''
    const content = lines.replace(/^#\s+.+\n?/, '').trim()
    if (!content && !title) continue

    // 尝试提取 frontmatter 日期
    const fmDate = content.match(/date:\s*(\d{4}-\d{2}-\d{2})/)
    const contentDate = content.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/)
    const tagsMatch = content.match(/tags?:\s*\[?([^\]\n]+)/i)
    const tags = tagsMatch ? tagsMatch[1].split(/[,;，]/).map(t => t.trim()).filter(Boolean) : []

    entries.push({
      date: fmDate ? fmDate[1] : contentDate ? normalizeDate(contentDate[1]) : todayISO(),
      module: guessModule(content || title, tags),
      title,
      content: content.replace(/^---[\s\S]*?---\n?/, '').trim(), // strip frontmatter
      tags,
      source: 'notion_md',
    })
  }

  return entries
}

// ------------------------------------------------------------------
// 格式自动检测
// ------------------------------------------------------------------

function detectSource(text: string, fileName: string): ImportSource {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'json') return 'json'
  if (ext === 'csv') return 'notion_csv'
  if (ext === 'md' || ext === 'markdown') return 'notion_md'
  if (ext === 'html' || ext === 'htm') return 'apple_notes'

  // 内容嗅探
  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (/^#\s+/m.test(trimmed)) return 'notion_md'
  // 微信小记特征：日期行 + 内容
  if (/^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/m.test(trimmed)) return 'wechat_memo'

  return 'apple_notes'
}

// ------------------------------------------------------------------
// 核心 API
// ------------------------------------------------------------------

/**
 * 解析导入文件，返回预览结果
 */
export async function parseImportFile(
  file: File,
  existingEntries: JournalEntry[],
  sourceHint?: ImportSource
): Promise<ImportPreview> {
  const text = await file.text()
  const source = sourceHint || detectSource(text, file.name)

  let entries: ParsedImportEntry[]
  try {
    switch (source) {
      case 'json': entries = parseJson(text); break
      case 'wechat_memo': entries = parseWechatMemo(text); break
      case 'apple_notes': entries = parseAppleNotes(text); break
      case 'notion_csv': entries = parseNotionCsv(text); break
      case 'notion_md': entries = parseNotionMd(text); break
      default: entries = parseJson(text)
    }
  } catch (e: any) {
    throw new Error(`解析失败（${source}）：${e.message}`)
  }

  // 冲突预检：同日期+同模块 = 冲突
  const conflicts: ImportConflict[] = []
  const existingSet = new Set(existingEntries.map(e => `${e.date}|${e.module}`))

  for (const entry of entries) {
    const key = `${entry.date}|${entry.module}`
    if (existingSet.has(key)) {
      const existing = existingEntries.find(e => e.date === entry.date && e.module === entry.module)
      if (existing) {
        conflicts.push({ incoming: entry, existing, type: 'date_module_duplicate' })
      }
    }
  }

  // 统计
  const allTags = new Set<string>()
  entries.forEach(e => e.tags.forEach(t => allTags.add(t)))
  const dates = entries.map(e => e.date).sort()

  return {
    entries,
    conflicts,
    source,
    stats: {
      total: entries.length,
      new: entries.length - conflicts.length,
      conflicts: conflicts.length,
      tags: Array.from(allTags),
      dateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
    },
  }
}

/**
 * 执行导入：将解析结果写入 journal store
 * conflictMode: 'skip' 跳过冲突 | 'overwrite' 覆盖 | 'merge' 追加
 */
export async function executeImport(
  preview: ImportPreview,
  journalStore: any,  // useJournalStore() instance
  conflictMode: 'skip' | 'overwrite' | 'merge' = 'skip'
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  const conflictKeys = new Set(preview.conflicts.map(c => `${c.incoming.date}|${c.incoming.module}`))

  for (const entry of preview.entries) {
    try {
      const key = `${entry.date}|${entry.module}`
      const isConflict = conflictKeys.has(key)

      if (isConflict && conflictMode === 'skip') {
        result.skipped++
        continue
      }

      if (isConflict && conflictMode === 'overwrite') {
        const existing = preview.conflicts.find(c => `${c.incoming.date}|${c.incoming.module}` === key)?.existing
        if (existing) {
          await journalStore.deleteEntry(existing.id)
        }
      }

      const prompts: JournalPrompt[] = [
        { id: 'content', label: '内容', value: entry.content },
      ]
      if (entry.title) {
        prompts.unshift({ id: 'title', label: '标题', value: entry.title })
      }

      await journalStore.addEntry({
        module: entry.module,
        prompts,
        mood: entry.mood,
        tags: entry.tags,
        links: [],
        title: entry.title,
      })

      result.imported++
    } catch (e: any) {
      result.errors.push(`[${entry.date}] ${e.message}`)
    }
  }

  return result
}

/**
 * 源名称映射（用于 UI 显示）
 */
export const SOURCE_LABELS: Record<ImportSource, string> = {
  json: 'JSON 备份',
  wechat_memo: '微信小记',
  apple_notes: '备忘录',
  notion_csv: 'Notion (CSV)',
  notion_md: 'Notion (Markdown)',
  auto: '自动识别',
}

/**
 * 支持的文件扩展名
 */
export const ACCEPTED_EXTENSIONS = '.json,.csv,.md,.markdown,.txt,.html,.htm'
