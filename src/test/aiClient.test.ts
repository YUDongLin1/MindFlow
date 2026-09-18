/**
 * AI Client 测试 — checkProvenance 溯源校验 + generateReview 三模式
 *
 * 覆盖用例：
 * - 测试 1-4: checkProvenance 溯源校验（覆盖、免校验、accuracyFlag 降级）
 * - 测试 5-7: generateReview 回退逻辑（byok/cloud/local）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localforage before importing aiClient
vi.mock('localforage', () => {
  const stores = new Map<string, Record<string, any>>()
  function getStore(name: string) {
    if (!stores.has(name)) stores.set(name, {})
    return stores.get(name)!
  }
  return {
    default: {
      getItem: vi.fn(async (key: string) => {
        return getStore('default')[key] ?? null
      }),
      setItem: vi.fn(async (key: string, value: any) => {
        getStore('default')[key] = value
      }),
      createInstance: vi.fn((config: any) => {
        const storeKey = config?.storeName || config?.name || 'default'
        return {
          getItem: vi.fn(async (key: string) => getStore(storeKey)[key] ?? null),
          setItem: vi.fn(async (key: string, value: any) => { getStore(storeKey)[key] = value }),
        }
      }),
    },
  }
})

import { checkProvenance, generateReview } from '@/services/aiClient'
import type { JournalEntry, AIReviewSegment } from '@/stores/journal'

// ---------------------------------------------------------------------------
// 测试数据工厂
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'test-1',
    date: '2026-01-15',
    module: 'work',
    prompts: [
      { id: 'did', label: '今天做了什么', value: '今天完成了数据结构设计，画了 ER 图' },
      { id: 'stuck', label: '卡在哪里', value: '导出格式还没定' },
      { id: 'next', label: '下一步计划', value: '明天和前端对齐' },
    ],
    tags: [],
    links: [],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-01-15T10:00:00Z',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// checkProvenance 溯源校验
// ---------------------------------------------------------------------------

describe('checkProvenance — 溯源覆盖率校验', () => {
  // 测试 1: AI 输出包含原文片段 → coverage >= 0.35 → passed: true
  it('测试1: AI输出包含原文片段时应通过溯源校验', () => {
    const userText = '今天完成了数据结构设计，画了ER图'
    const segments: AIReviewSegment = {
      achievements: '今天完成了数据结构设计，画了ER图',
      learnings: '（留白也是一种记录，明天再补也不迟。）',
      improvements: '导出格式还没定',
      actions: '明天和前端对齐',
    }

    const result = checkProvenance(userText, segments)

    expect(result.passed).toBe(true)
    expect(result.failedSegments).toHaveLength(0)
    expect(result.coverage).toBeGreaterThanOrEqual(0.35)
  })

  // 测试 2: AI 输出完全无关内容 → coverage < 0.35 → passed: false
  it('测试2: AI输出完全无关内容时应不通过溯源校验', () => {
    const userText = '今天完成了数据结构设计'
    const segments: AIReviewSegment = {
      achievements: '明天去爬山看日出，风景特别美丽',
      learnings: '（留白也是一种记录，明天再补也不迟。）',
      improvements: '（留白也是一种记录，明天再补也不迟。）',
      actions: '（留白也是一种记录，明天再补也不迟。）',
    }

    const result = checkProvenance(userText, segments)

    expect(result.passed).toBe(false)
    expect(result.failedSegments).toContain('achievements')
  })

  // 测试 3: 占位文本免校验 — 不出现在 failedSegments
  it('测试3: 占位文本免校验不出现在failedSegments', () => {
    const userText = '今天完成了数据结构设计'
    const segments: AIReviewSegment = {
      achievements: '今天完成了数据结构设计',
      learnings: '（留白也是一种记录，明天再补也不迟。）',
      improvements: '（留白也是一种记录，明天再补也不迟。）',
      actions: '（留白也是一种记录，明天再补也不迟。）',
    }

    const result = checkProvenance(userText, segments)

    // 占位文本不应出现在 failedSegments
    expect(result.failedSegments).not.toContain('learnings')
    expect(result.failedSegments).not.toContain('improvements')
    expect(result.failedSegments).not.toContain('actions')
  })

  // 测试 4: 模型自报 accuracyFlag=true 但 provenance.passed=false → 最终 accuracyFlag 应为 false
  // 这个逻辑在 generateReview 中实现，这里测试 checkProvenance 的 passed=false 场景
  it('测试4: provenance.passed=false时generateReview应将accuracyFlag降级为false', async () => {
    // 构造一个会触发溯源失败的 BYOK 场景
    // 我们通过 mock fetch 来模拟 AI 返回无关内容
    const fakeEntry = makeEntry()

    // Mock fetch to return AI response with unrelated content
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              achievements: '明天去爬山看日出风景特别美丽壮观',
              learnings: '（留白也是一种记录，明天再补也不迟。）',
              improvements: '（留白也是一种记录，明天再补也不迟。）',
              actions: '（留白也是一种记录，明天再补也不迟。）',
              accuracyFlag: true,
            }),
          },
        }],
      }),
    }) as any

    const result = await generateReview(fakeEntry, {
      mode: 'byok',
      apiKey: 'test-key',
      aiBaseUrl: 'https://api.openai.com/v1',
      aiModel: 'gpt-4o-mini',
    })

    // 模型自报 accuracyFlag=true，但溯源失败 → 最终应为 false
    expect(result.accuracyFlag).toBe(false)
    expect(result.provenance?.passed).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateReview 回退逻辑
// ---------------------------------------------------------------------------

describe('generateReview — 三模式与回退', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // 测试 5: byok 模式无 apiKey → 抛错 → 回退 local-fallback → source='local-fallback'
  it('测试5: byok模式无apiKey时应回退到local-fallback', async () => {
    const entry = makeEntry()
    // Ollama endpoint 不需要 apiKey，所以用非 Ollama 的 baseUrl 来触发 apiKey 检查
    const result = await generateReview(entry, {
      mode: 'byok',
      apiKey: undefined,
      aiBaseUrl: 'https://api.openai.com/v1',
    })

    expect(result.source).toBe('local-fallback')
    expect(result.draft).toBeDefined()
    expect(result.accuracyFlag).toBe(true)
  })

  // 测试 6: cloud 模式 VITE_MINDFLOW_LLM_ENDPOINT 未设置 → 抛 CLOUD_LLM_NOT_CONFIGURED
  it('测试6: cloud模式未配置endpoint时应抛CLOUD_LLM_NOT_CONFIGURED错误', async () => {
    const entry = makeEntry()

    // Ensure VITE_MINDFLOW_LLM_ENDPOINT is not set
    const original = (import.meta as any).env?.VITE_MINDFLOW_LLM_ENDPOINT
    if ((import.meta as any).env) {
      ;(import.meta as any).env.VITE_MINDFLOW_LLM_ENDPOINT = undefined
    }

    // cloud 模式未配置 endpoint → 抛 CLOUD_LLM_NOT_CONFIGURED 错误（配置错误应上抛，不静默回退）
    await expect(generateReview(entry, { mode: 'cloud' })).rejects.toThrow()
    await expect(generateReview(entry, { mode: 'cloud' })).rejects.toMatchObject({
      code: 'CLOUD_LLM_NOT_CONFIGURED',
    })

    // Restore
    if ((import.meta as any).env && original !== undefined) {
      ;(import.meta as any).env.VITE_MINDFLOW_LLM_ENDPOINT = original
    }
  })

  // 测试 7: local 模式 → 直接返回本地镜像 → source='local'
  it('测试7: local模式应直接返回本地镜像', async () => {
    const entry = makeEntry()

    const result = await generateReview(entry, { mode: 'local' })

    expect(result.source).toBe('local')
    expect(result.draft).toBeDefined()
    expect(result.draft.achievements).toBeTruthy()
    expect(result.accuracyFlag).toBe(true)
  })

  // 额外: local 模式生成的草稿应包含用户原文的引述
  it('local模式草稿应包含用户原文引述', async () => {
    const entry = makeEntry({
      prompts: [
        { id: 'did', label: '今天做了什么', value: '完成了API接口开发' },
        { id: 'stuck', label: '卡在哪里', value: '数据库迁移有问题' },
        { id: 'next', label: '下一步计划', value: '修复迁移脚本' },
      ],
    })

    const result = await generateReview(entry, { mode: 'local' })

    expect(result.draft.achievements).toContain('完成了API接口开发')
    expect(result.draft.improvements).toContain('数据库迁移有问题')
    expect(result.draft.actions).toContain('修复迁移脚本')
  })

  // 额外: local 模式空内容应生成占位文本
  it('local模式空prompt应生成占位文本', async () => {
    const entry = makeEntry({
      prompts: [
        { id: 'did', label: '今天做了什么', value: '' },
        { id: 'stuck', label: '卡在哪里', value: '' },
        { id: 'next', label: '下一步计划', value: '' },
      ],
    })

    const result = await generateReview(entry, { mode: 'local' })

    expect(result.draft.achievements).toContain('留白')
  })
})
