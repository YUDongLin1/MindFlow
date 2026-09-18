/**
 * A/B 实验框架测试
 *
 * 覆盖用例：
 * - 测试 12: assignVariant 返回 'control' 或 'treatment'
 * - 测试 13: 粘性：同一 expId 多次 assignVariant 返回相同值
 * - 测试 14: getVariant 在未 assign 前返回 null
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// In-memory storage for localforage mock
const mockStore: Record<string, any> = {}

vi.mock('localforage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => mockStore[key] ?? null),
    setItem: vi.fn(async (key: string, value: any) => { mockStore[key] = value }),
    createInstance: vi.fn(() => ({
      getItem: vi.fn(async (key: string) => mockStore[key] ?? null),
      setItem: vi.fn(async (key: string, value: any) => { mockStore[key] = value }),
    })),
  },
}))

// Mock analytics to avoid localforage conflicts
vi.mock('@/services/analytics', () => ({
  EVENTS: { AI_REVIEW_EXPOSURE: 'ai_review_exposure' },
  track: vi.fn(async () => {}),
}))

import { assignVariant, getVariant, type ExpId } from '@/services/abTest'

describe('A/B 实验框架', () => {
  beforeEach(() => {
    for (const key of Object.keys(mockStore)) delete mockStore[key]
  })

  // 测试 12: assignVariant 返回 'control' 或 'treatment'
  it('测试12: assignVariant应返回control或treatment', async () => {
    // 运行多次以确保结果始终在合法范围内
    for (let i = 0; i < 20; i++) {
      // Clear store each iteration to force new assignment
      for (const key of Object.keys(mockStore)) delete mockStore[key]

      const expId: ExpId = `exp${(i % 3) + 1}_${['privacy', 'quote', 'default'][i % 3]}` as ExpId
      const variant = await assignVariant(expId)
      expect(['control', 'treatment']).toContain(variant)
    }
  })

  // 测试 13: 粘性：同一 expId 多次 assignVariant 返回相同值
  it('测试13: 同一expId多次assignVariant应返回相同值（粘性）', async () => {
    const expId: ExpId = 'exp1_privacy'

    const first = await assignVariant(expId)
    const second = await assignVariant(expId)
    const third = await assignVariant(expId)

    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  // 测试 14: getVariant 在未 assign 前返回 null
  it('测试14: 未assign前getVariant应返回null', async () => {
    const expId: ExpId = 'exp2_quote'
    const variant = await getVariant(expId)
    expect(variant).toBeNull()
  })

  // 额外: assign 后 getVariant 应返回已分配的值
  it('assign后getVariant应返回已分配的值', async () => {
    const expId: ExpId = 'exp3_default'
    const assigned = await assignVariant(expId)
    const retrieved = await getVariant(expId)
    expect(retrieved).toBe(assigned)
  })
})
