/**
 * MindFlow journal 数据导出服务
 * 导出格式与 importService 的 JSON 解析器（格式1: { entries: [...] }）兼容，可无损往返。
 */
import type { JournalEntry, JournalPrefs, AuditEntry, CustomModule } from '@/stores/journal'
import { entryToMarkdown } from '@/services/markdownExport'
import { todayLocal } from '@/utils/dateUtils'

const BACKUP_VERSION = '1.0.0'

function triggerDownload(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** 导出完整 JSON 备份（含条目 / AI 偏好 / 审计日志），可通过「设置 → 导入」恢复 */
export function exportJournalJSON(
  entries: JournalEntry[],
  prefs: JournalPrefs,
  auditLog: AuditEntry[],
): void {
  const data = {
    app: 'mindflow',
    version: BACKUP_VERSION,
    exportDate: new Date().toISOString(),
    entries,
    prefs: { ...prefs, aiKey: prefs.aiKey ? '***' : '' }, // 密钥不导出明文
    auditLog,
  }
  triggerDownload(
    `mindflow-backup-${todayLocal()}.json`,
    JSON.stringify(data, null, 2),
    'application/json',
  )
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

/** 导出 CSV（UTF-8 BOM，Excel 直接打开不乱码） */
export function exportJournalCSV(entries: JournalEntry[]): void {
  const headers = ['日期', '模块', '心情', '标签', '内容', '地点', '天气', '创建时间']
  const moduleLabel: Record<string, string> = { diary: '日记', work: '工作日志', study: '学习笔记' }
  const rows = entries.map(e => [
    e.date,
    moduleLabel[e.module] || e.module,
    csvEscape(e.mood || ''),
    csvEscape(e.tags.join(', ')),
    csvEscape(e.prompts.filter(p => p.value).map(p => `${p.label}：${p.value}`).join(' | ')),
    csvEscape(e.metadata?.location || ''),
    csvEscape(e.metadata?.weather || ''),
    e.createdAt,
  ])
  const csv = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  triggerDownload(`mindflow-entries-${todayLocal()}.csv`, csv, 'text/csv;charset=utf-8')
}

/** 导出全量 Markdown 知识库（单文件，带 frontmatter + 双链，Obsidian 可直接打开） */
export function exportJournalMarkdown(entries: JournalEntry[], customModules: CustomModule[] = []): void {
  const sorted = entries.slice().sort((a, b) => (a.date < b.date ? -1 : 1))
  const body = sorted.map(e => entryToMarkdown(e, customModules)).join('\n\n---\n\n')
  const content = `# MindFlow 知识库导出\n\n> 导出时间：${new Date().toLocaleString('zh-CN')} · 共 ${sorted.length} 条\n\n---\n\n${body}\n`
  triggerDownload(`mindflow-knowledge-${todayLocal()}.md`, content, 'text/markdown;charset=utf-8')
}
