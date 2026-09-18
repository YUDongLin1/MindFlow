/**
 * Analytics 埋点服务测试
 *
 * 覆盖用例：
 * - 测试 8: track() 写入事件后 getAllEvents() 能读到
 * - 测试 9: 写入超过 5000 条后，最旧的被截断（length <= 5000）
 * - 测试 10: activationRate() = firstEntrySessions / signups
 * - 测试 11: crashRate() = crashes / totalEvents
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

// Mock localStorage for session ID
const localStorageMock: Record<string, string> = {}
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { localStorageMock[key] = value }),
    removeItem: vi.fn((key: string) => { delete localStorageMock[key] }),
  },
  writable: true,
})

import { track, getAllEvents, activationRate, crashRate, EVENTS } from '@/services/analytics'

describe('Analytics 埋点服务', () => {
  beforeEach(() => {
    // Clear in-memory store
    for (const key of Object.keys(mockStore)) delete mockStore[key]
    for (const key of Object.keys(localStorageMock)) delete localStorageMock[key]
  })

  // 测试 8: track() 写入事件后 getAllEvents() 能读到
  it('测试8: track写入事件后getAllEvents能读到', async () => {
    await track(EVENTS.ENTRY_CREATED, { module: 'work' })

    const events = await getAllEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe(EVENTS.ENTRY_CREATED)
    expect(events[0].props).toEqual({ module: 'work' })
    expect(events[0].ts).toBeTruthy()
    expect(events[0].sessionId).toBeTruthy()
  })

  // 测试 9: 写入超过 5000 条后，最旧的被截断（length <= 5000）
  it('测试9: 超过5000条事件后应环形截断', async () => {
    // 写入 5005 条事件
    for (let i = 0; i < 5005; i++) {
      await track('test_event', { index: i })
    }

    const events = await getAllEvents()
    expect(events.length).toBeLessThanOrEqual(5000)
    // 最旧的 5 条应被截断
    expect(events.length).toBe(5000)
    // 保留的是最后 5000 条（index 5 ~ 5004）
    expect(events[0].props).toEqual({ index: 5 })
    expect(events[events.length - 1].props).toEqual({ index: 5004 })
  })

  // 测试 10: activationRate() = firstEntrySessions / signups
  it('测试10: activationRate应为firstEntrySessions除以signups', async () => {
    // 2 个 signup 事件（同一 session 算一次注册）
    await track(EVENTS.SIGNUP, {})
    await track(EVENTS.SIGNUP, {})

    // 1 个 first_entry_created（不同 session）
    // 由于 session 是基于 localStorage 的，我们需要模拟不同 session
    // 先清空 session 让其重新生成
    delete localStorageMock['mindflow:session']
    await track(EVENTS.FIRST_ENTRY_CREATED, {})

    const rate = await activationRate()
    // 1 个有首条记录的 session / 2 个 signup = 0.5
    // 注意：signup 事件的 session 也是第一个 session
    // 所以第一个 session 同时有 signup 和 first_entry_created
    // 实际：firstEntrySessions = Set(sessionIds of FIRST_ENTRY_CREATED).size = 1
    //       signups = count of SIGNUP events = 2
    // activationRate = 1/2 = 0.5
    expect(rate).toBe(0.5)
  })

  // 测试 11: crashRate() = crashes / totalEvents
  it('测试11: crashRate应为crashes除以totalEvents', async () => {
    await track(EVENTS.ENTRY_CREATED, {})
    await track(EVENTS.AI_REVIEW_TRIGGERED, {})
    await track(EVENTS.APP_CRASH, { error: 'test' })
    await track(EVENTS.APP_CRASH, { error: 'test2' })

    const rate = await crashRate()
    // 2 crashes / 4 total events = 0.5
    expect(rate).toBe(0.5)
  })

  // 额外: 无事件时 crashRate 应为 0
  it('无事件时crashRate应为0', async () => {
    const rate = await crashRate()
    expect(rate).toBe(0)
  })

  // 额外: 无 signup 时 activationRate 应为 0
  it('无signup时activationRate应为0', async () => {
    const rate = await activationRate()
    expect(rate).toBe(0)
  })
})
