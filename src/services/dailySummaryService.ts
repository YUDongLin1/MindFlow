/**
 * 每日总结服务
 * 聚合当日所有 JournalEntry，生成结构化总结数据
 */

import type { JournalEntry, ModuleType } from '@/stores/journal'
import { todayLocal, oneYearAgoLocal } from '@/utils/dateUtils'

export interface DailySummaryData {
  date: string
  totalEntries: number
  moduleBreakdown: Record<ModuleType, number>
  totalWords: number
  tags: string[]
  moods: string[]
  keyHighlights: string[]
  entries: JournalEntry[]
}

function todayISO(): string {
  return todayLocal()
}

function countWords(text: string): number {
  if (!text) return 0
  // 中文按字数计，英文按空格分词
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length
  const english = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length
  return chinese + english
}

/**
 * 生成当日总结数据
 */
export function generateDailySummary(entries: JournalEntry[], date?: string): DailySummaryData {
  const targetDate = date || todayISO()
  const todayEntries = entries.filter(e => e.date === targetDate)

  const moduleBreakdown: Record<ModuleType, number> = { diary: 0, work: 0, study: 0 }
  let totalWords = 0
  const allTags = new Set<string>()
  const allMoods = new Set<string>()
  const highlights: string[] = []

  for (const entry of todayEntries) {
    moduleBreakdown[entry.module]++
    for (const p of entry.prompts) {
      totalWords += countWords(p.value)
    }
    entry.tags.forEach(t => allTags.add(t))
    if (entry.mood) allMoods.add(entry.mood)

    // 提取关键内容作为亮点
    const firstContent = entry.prompts.find(p => p.value)?.value
    if (firstContent) {
      highlights.push(firstContent.slice(0, 80) + (firstContent.length > 80 ? '…' : ''))
    }
  }

  return {
    date: targetDate,
    totalEntries: todayEntries.length,
    moduleBreakdown,
    totalWords,
    tags: Array.from(allTags),
    moods: Array.from(allMoods),
    keyHighlights: highlights.slice(0, 5),
    entries: todayEntries,
  }
}

/**
 * 去年今日对比
 */
export function getOneYearAgo(entries: JournalEntry[]): JournalEntry[] {
  const target = oneYearAgoLocal()
  return entries.filter(e => e.date === target)
}
