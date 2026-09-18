/**
 * 双向链接服务
 * 从所有条目中构建反向链接索引和知识图谱数据
 */

import type { JournalEntry } from '@/stores/journal'

export interface BackLink {
  /** 被引用的标签/双链名称 */
  target: string
  /** 引用它的条目 */
  sourceEntry: JournalEntry
  /** 匹配到的 prompt 片段 */
  snippet: string
}

export interface GraphNode {
  id: string
  label: string
  type: 'entry' | 'tag'
  count: number  // 引用/被引用次数
  date?: string
  module?: string
}

export interface GraphEdge {
  source: string
  target: string
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/**
 * 构建反向链接索引：给定一个标签名，返回所有引用它的条目
 */
export function findBackLinks(targetTag: string, entries: JournalEntry[]): BackLink[] {
  const results: BackLink[] = []
  const lower = targetTag.toLowerCase()

  for (const entry of entries) {
    // 检查 wikiLinks
    if (entry.wikiLinks?.some(l => l.toLowerCase() === lower)) {
      const snippet = entry.prompts.find(p => p.value)?.value?.slice(0, 80) || ''
      results.push({ target: targetTag, sourceEntry: entry, snippet })
      continue
    }
    // 检查 tags
    if (entry.tags.some(t => t.toLowerCase() === lower)) {
      const snippet = entry.prompts.find(p => p.value)?.value?.slice(0, 80) || ''
      results.push({ target: targetTag, sourceEntry: entry, snippet })
    }
  }

  return results.sort((a, b) => a.sourceEntry.date < b.sourceEntry.date ? 1 : -1)
}

/**
 * 构建知识图谱数据（节点 + 边）
 */
export function buildGraph(entries: JournalEntry[]): GraphData {
  const nodeMap = new Map<string, GraphNode>()
  const edgeSet = new Set<string>()
  const edges: GraphEdge[] = []

  // 统计所有标签
  const tagCount = new Map<string, number>()
  for (const entry of entries) {
    for (const tag of entry.tags) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
    }
    if (entry.wikiLinks) {
      for (const link of entry.wikiLinks) {
        tagCount.set(link, (tagCount.get(link) || 0) + 1)
      }
    }
  }

  // 创建标签节点
  for (const [tag, count] of tagCount) {
    const id = `tag:${tag}`
    nodeMap.set(id, { id, label: tag, type: 'tag', count })
  }

  // 创建条目节点和边
  for (const entry of entries) {
    const entryId = `entry:${entry.id}`
    nodeMap.set(entryId, {
      id: entryId,
      label: entry.date + (entry.module === 'diary' ? ' 日记' : entry.module === 'work' ? ' 工作' : ' 学习'),
      type: 'entry',
      count: 1,
      date: entry.date,
      module: entry.module,
    })

    // 条目 → 标签 的边
    for (const tag of entry.tags) {
      const tagId = `tag:${tag}`
      const edgeKey = `${entryId}->${tagId}`
      if (!edgeSet.has(edgeKey)) {
        edgeSet.add(edgeKey)
        edges.push({ source: entryId, target: tagId })
      }
    }
    // 条目 → wikiLink 的边
    if (entry.wikiLinks) {
      for (const link of entry.wikiLinks) {
        const linkId = `tag:${link}`
        const edgeKey = `${entryId}->${linkId}`
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey)
          edges.push({ source: entryId, target: linkId })
        }
      }
    }
  }

  // 过滤：只保留引用 ≥2 次的节点，避免图太稀疏
  const significantNodes = Array.from(nodeMap.values()).filter(n =>
    n.type === 'tag' ? n.count >= 2 : true
  )
  const significantIds = new Set(significantNodes.map(n => n.id))
  const significantEdges = edges.filter(e => significantIds.has(e.source) && significantIds.has(e.target))

  // 限制节点数量避免渲染卡顿
  const maxNodes = 60
  const sortedNodes = significantNodes.sort((a, b) => b.count - a.count).slice(0, maxNodes)
  const finalIds = new Set(sortedNodes.map(n => n.id))
  const finalEdges = significantEdges.filter(e => finalIds.has(e.source) && finalIds.has(e.target))

  return { nodes: sortedNodes, edges: finalEdges }
}
