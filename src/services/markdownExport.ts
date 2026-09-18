import type { JournalEntry, AIReview, CustomModule } from '@/stores/journal'
import { getModuleLabel } from '@/stores/journal'

export interface TreeNode {
  year: string
  months: {
    month: string
    files: {
      name: string
      displayPath: string
      fileName: string
      entry: JournalEntry
    }[]
  }[]
}

export function entryToMarkdown(entry: JournalEntry, customModules: CustomModule[] = []): string {
  const title = entry.title || `${entry.date} · ${getModuleLabel(entry.module, customModules)}`
  const front = [
    '---',
    `title: "${title.replace(/"/g, "'")}"`,
    `date: ${entry.date}`,
    `module: ${entry.module}`,
    `mood: ${entry.mood || ''}`,
    `tags: [${entry.tags.join(', ')}]`,
    '---',
    '',
  ].join('\n')

  const header = `# ${title}\n`

  const prompts = entry.prompts
    .filter(p => p.value && p.value.trim())
    .map(p => `- **${p.label}**：${p.value.trim()}`)
    .join('\n')

  const tagLines = entry.tags.length
    ? entry.tags.map(t => `[[${t}]]`).join('  ')
    : '（无）'

  let body = ''
  body += '## 今日三问\n'
  body += prompts || '（无内容）'
  body += '\n\n'
  body += '## 关联\n'
  body += tagLines + '\n'

  if (entry.review && entry.review.status === 'adopted') {
    body += '\n## AI 复盘（已采纳 · 草稿需你确认）\n'
    body += `> ${entry.review.note || ''}\n\n`
    body += `### 今日成果\n${entry.review.draft.achievements}\n\n`
    body += `### 学习收获\n${entry.review.draft.learnings}\n\n`
    body += `### 待改进\n${entry.review.draft.improvements}\n\n`
    body += `### 明日行动\n${entry.review.draft.actions}\n`
  }

  return front + header + body
}

export function buildKnowledgeTree(entries: JournalEntry[], customModules: CustomModule[] = []): TreeNode[] {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1))
  const map = new Map<string, Map<string, JournalEntry[]>>()
  for (const e of sorted) {
    const [y, m] = e.date.split('-')
    if (!map.has(y)) map.set(y, new Map())
    const months = map.get(y)!
    if (!months.has(m)) months.set(m, [])
    months.get(m)!.push(e)
  }
  const nodes: TreeNode[] = []
  for (const [year, months] of map) {
    const monthNodes = []
    for (const [month, list] of months) {
      const files = list.map(e => {
        const label = getModuleLabel(e.module, customModules)
        const name = `${label}-${e.date}.md`
        return {
          name,
          displayPath: `知识库 / ${year} / ${month} / ${name}`,
          fileName: `${year}-${month}-${e.id.slice(0, 4)}-${label}.md`,
          entry: e,
        }
      })
      monthNodes.push({ month, files })
    }
    nodes.push({ year, months: monthNodes })
  }
  return nodes
}

export function downloadMarkdown(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function copyMarkdown(content: string): Promise<void> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(content)
  }
  return new Promise((resolve) => {
    const ta = document.createElement('textarea')
    ta.value = content
    document.body.appendChild(ta)
    ta.select()
    try { document.execCommand('copy') } catch (e) { /* noop */ }
    document.body.removeChild(ta)
    resolve()
  })
}
