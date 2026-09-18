/**
 * 工作周报生成器测试
 *
 * 覆盖用例：
 * - 测试 15: 空条目列表 → markdown 包含 "本周还没有工作记录"
 * - 测试 16: 有 WORK 条目 → markdown 包含 did/stuck/next 内容
 * - 测试 17: daysCovered 等于不同日期数
 * - 测试 18: counts.did 等于有 did 值的条目数
 */
import { describe, it, expect } from 'vitest'
import { generateWeeklyReport } from '@/services/weeklyReport'
import type { JournalEntry } from '@/stores/journal'

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-' + Math.random().toString(36).slice(2, 8),
    date: '2026-01-13',
    module: 'work',
    prompts: [],
    tags: [],
    links: [],
    createdAt: '2026-01-13T10:00:00Z',
    updatedAt: '2026-01-13T10:00:00Z',
    ...overrides,
  }
}

describe('WeeklyReport 周报生成', () => {
  const weekStart = '2026-01-13' // 周一

  // 测试 15: 空条目列表 → markdown 包含 "本周还没有工作记录"
  it('测试15: 空条目列表应包含本周还没有工作记录', () => {
    const result = generateWeeklyReport({ entries: [], weekStart })

    expect(result.markdown).toContain('本周还没有工作记录')
    expect(result.daysCovered).toBe(0)
    expect(result.counts.did).toBe(0)
  })

  // 测试 16: 有 WORK 条目 → markdown 包含 did/stuck/next 内容
  it('测试16: 有WORK条目时markdown应包含did/stuck/next内容', () => {
    const entries: JournalEntry[] = [
      makeEntry({
        date: '2026-01-13',
        prompts: [
          { id: 'did', label: '今天做了什么', value: '完成了 API 接口开发' },
          { id: 'stuck', label: '卡在哪里', value: '数据库迁移报错' },
          { id: 'next', label: '下一步计划', value: '修复迁移脚本' },
        ],
      }),
    ]

    const result = generateWeeklyReport({ entries, weekStart })

    expect(result.markdown).toContain('完成了 API 接口开发')
    expect(result.markdown).toContain('数据库迁移报错')
    expect(result.markdown).toContain('修复迁移脚本')
    expect(result.markdown).toContain('做了什么')
    expect(result.markdown).toContain('卡在哪里')
    expect(result.markdown).toContain('下一步')
  })

  // 测试 17: daysCovered 等于不同日期数
  it('测试17: daysCovered应等于不同日期数', () => {
    const entries: JournalEntry[] = [
      makeEntry({ date: '2026-01-13', prompts: [{ id: 'did', label: '', value: '任务A' }] }),
      makeEntry({ date: '2026-01-14', prompts: [{ id: 'did', label: '', value: '任务B' }] }),
      makeEntry({ date: '2026-01-15', prompts: [{ id: 'did', label: '', value: '任务C' }] }),
      makeEntry({ date: '2026-01-13', prompts: [{ id: 'did', label: '', value: '任务D' }] }), // 同日
    ]

    const result = generateWeeklyReport({ entries, weekStart })

    expect(result.daysCovered).toBe(3) // 13, 14, 15
  })

  // 测试 18: counts.did 等于有 did 值的条目数
  it('测试18: counts.did应等于有did值的条目数', () => {
    const entries: JournalEntry[] = [
      makeEntry({ date: '2026-01-13', prompts: [{ id: 'did', label: '', value: '任务A' }] }),
      makeEntry({ date: '2026-01-14', prompts: [{ id: 'did', label: '', value: '任务B' }] }),
      makeEntry({ date: '2026-01-15', prompts: [{ id: 'did', label: '', value: '' }] }), // did 为空
      makeEntry({ date: '2026-01-16', prompts: [{ id: 'stuck', label: '', value: '卡住了' }] }), // 无 did
    ]

    const result = generateWeeklyReport({ entries, weekStart })

    expect(result.counts.did).toBe(2) // 只有 2 条有 did 值
  })

  // 额外: 周末日期计算正确
  it('周末日期应为weekStart加6天', () => {
    const result = generateWeeklyReport({ entries: [], weekStart: '2026-01-13' })
    expect(result.range.start).toBe('2026-01-13')
    expect(result.range.end).toBe('2026-01-19')
  })

  // 额外: stuck 和 next 计数正确
  it('counts.stuck和counts.next应正确统计', () => {
    const entries: JournalEntry[] = [
      makeEntry({
        date: '2026-01-13',
        prompts: [
          { id: 'did', label: '', value: '任务A' },
          { id: 'stuck', label: '', value: '卡住A' },
          { id: 'next', label: '', value: '下一步A' },
        ],
      }),
      makeEntry({
        date: '2026-01-14',
        prompts: [
          { id: 'did', label: '', value: '任务B' },
          { id: 'stuck', label: '', value: '' },
          { id: 'next', label: '', value: '下一步B' },
        ],
      }),
    ]

    const result = generateWeeklyReport({ entries, weekStart })
    expect(result.counts.stuck).toBe(1)
    expect(result.counts.next).toBe(2)
  })
})
