/**
 * MindFlow 工作周报生成器
 *
 * 聚合本周 WORK 模块条目，生成结构化 Markdown 周报。
 * 保持温和基调：不羞辱、不打卡、只总结。
 */

import type { JournalEntry } from '@/stores/journal'
import { parseLocalDate, formatLocalDate } from '@/utils/dateUtils'

export interface WeeklyReportInput {
  entries: JournalEntry[]
  weekStart: string // YYYY-MM-DD（周一）
}

export interface WeeklyReportOutput {
  markdown: string
  daysCovered: number
  counts: { did: number; stuck: number; next: number }
  range: { start: string; end: string }
}

/**
 * 计算周末日期（weekStart + 6 天）。
 */
function weekEndDate(weekStart: string): string {
  const d = parseLocalDate(weekStart)
  d.setDate(d.getDate() + 6)
  return formatLocalDate(d)
}

/**
 * 从条目中提取指定 prompt 的值。
 */
function promptValue(entry: JournalEntry, id: string): string {
  return entry.prompts.find(p => p.id === id)?.value?.trim() || ''
}

/**
 * 生成工作周报 Markdown。
 *
 * 格式：
 * - 标题：# 工作周报 · {weekStart} ~ {weekEnd}
 * - 按日期分组，每天列出 did/stuck/next
 * - 底部统计：覆盖天数、各字段条数
 */
export function generateWeeklyReport(input: WeeklyReportInput): WeeklyReportOutput {
  const { entries, weekStart } = input
  const weekEnd = weekEndDate(weekStart)

  // 按日期分组
  const byDate = new Map<string, JournalEntry[]>()
  for (const e of entries) {
    if (!byDate.has(e.date)) byDate.set(e.date, [])
    byDate.get(e.date)!.push(e)
  }

  const sortedDates = Array.from(byDate.keys()).sort()

  // 统计
  let didCount = 0
  let stuckCount = 0
  let nextCount = 0
  for (const e of entries) {
    if (promptValue(e, 'did')) didCount++
    if (promptValue(e, 'stuck')) stuckCount++
    if (promptValue(e, 'next')) nextCount++
  }

  // 构建 Markdown
  let md = `# 工作周报 · ${weekStart} ~ ${weekEnd}\n\n`

  if (sortedDates.length === 0) {
    md += '本周还没有工作记录。不着急，随时可以开始。\n'
  } else {
    for (const date of sortedDates) {
      const dayEntries = byDate.get(date)!
      md += `## ${date}\n\n`
      for (const e of dayEntries) {
        const did = promptValue(e, 'did')
        const stuck = promptValue(e, 'stuck')
        const next = promptValue(e, 'next')
        if (did) md += `- **做了什么**：${did}\n`
        if (stuck) md += `- **卡在哪里**：${stuck}\n`
        if (next) md += `- **下一步**：${next}\n`
      }
      md += '\n'
    }
  }

  md += `---\n\n`
  md += `**统计**\n`
  md += `- 覆盖天数：${sortedDates.length}\n`
  md += `- 做了什么：${didCount} 条\n`
  md += `- 卡在哪里：${stuckCount} 条\n`
  md += `- 下一步：${nextCount} 条\n`

  return {
    markdown: md,
    daysCovered: sortedDates.length,
    counts: { did: didCount, stuck: stuckCount, next: nextCount },
    range: { start: weekStart, end: weekEnd },
  }
}
