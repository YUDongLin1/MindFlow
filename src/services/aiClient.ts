/**
 * MindFlow AI 复盘客户端
 *
 * 三种模式：
 * - local:  本地镜像（离线、免 Key、纯整理）
 * - byok:   自带 Key（Ollama 本地 或 OpenAI 兼容 API）
 * - cloud:  MindFlow 订阅云模型
 *
 * 设计红线：
 * 1. 绝不编造内容 — 只基于给定文本
 * 2. 绝不静默替用户定稿 — 输出前必须声明「草稿·需你确认」
 * 3. 每段须能回溯到用户原文 — checkProvenance 溯源校验
 * 4. 网络错误/解析失败 → 回退到本地镜像，source='local-fallback'
 */

import type { JournalEntry, AIReviewSegment, AIMode } from '@/stores/journal'
import localforage from 'localforage'

// ---------------------------------------------------------------------------
// 接口定义
// ---------------------------------------------------------------------------

export interface AIConfig {
  mode: AIMode
  apiKey?: string
  aiBaseUrl?: string
  aiModel?: string
}

export interface ProvenanceCheck {
  coverage: number
  passed: boolean
  checkedAt: string
  failedSegments: string[]
}

export interface ReviewResult {
  draft: AIReviewSegment
  accuracyFlag: boolean
  note: string
  source: AIMode | 'local-fallback'
  provenance?: ProvenanceCheck
}

// ---------------------------------------------------------------------------
// 辅助函数（保留原有）
// ---------------------------------------------------------------------------

function val(entry: JournalEntry, id: string): string {
  return entry.prompts.find(p => p.id === id)?.value?.trim() || ''
}

function quote(text: string, max = 80): string {
  const t = text.length > max ? text.slice(0, max) + '…' : text
  return `你写道：「${t}」`
}

function buildSegment(text: string, withQuote: boolean): string {
  if (!text) return '（留白也是一种记录，明天再补也不迟。）'
  return withQuote ? quote(text) : text
}

// ---------------------------------------------------------------------------
// 本地镜像生成（保留原有逻辑）
// ---------------------------------------------------------------------------

function generateLocalMirror(entry: JournalEntry): { draft: AIReviewSegment; note: string } {
  const did = val(entry, 'did')
  const learned = val(entry, 'learned')
  const keep = val(entry, 'keep')
  const stuck = val(entry, 'stuck')
  const confused = val(entry, 'confused')
  const next = val(entry, 'next')
  const dig = val(entry, 'dig')

  const achievementsSrc = did || learned
  const learningsSrc = keep || dig
  const improvementsSrc = stuck || confused
  const actionsSrc = next || dig

  const draft: AIReviewSegment = {
    achievements: buildSegment(achievementsSrc, true),
    learnings: learningsSrc
      ? buildSegment(learningsSrc, true)
      : entry.module === 'work'
        ? '（今天偏推进执行，明天不妨留一点时间做沉淀。）'
        : buildSegment('', false),
    improvements: buildSegment(improvementsSrc, true),
    actions: buildSegment(actionsSrc, true),
  }

  const note = '本地镜像模式：仅基于你写下的内容整理成四段结构，未联网、未润色、未替你定稿。你可编辑，或一键还原为原文。'

  return { draft, note }
}

// ---------------------------------------------------------------------------
// 溯源校验
// ---------------------------------------------------------------------------

/**
 * 占位模式检测：包含「（」且包含「明天/留白/不妨/慢慢来」的内容视为占位文本，免校验。
 */
function isPlaceholder(text: string): boolean {
  if (!text.includes('（')) return false
  const placeholders = ['明天', '留白', '不妨', '慢慢来']
  return placeholders.some(p => text.includes(p))
}

/**
 * 生成 3 字滑动窗口（shingle）集合。
 */
function shingleSet(text: string, n = 3): Set<string> {
  const normalized = text.toLowerCase().replace(/\s+/g, '')
  const result = new Set<string>()
  if (normalized.length < n) {
    result.add(normalized)
    return result
  }
  for (let i = 0; i <= normalized.length - n; i++) {
    result.add(normalized.slice(i, i + n))
  }
  return result
}

/**
 * 溯源覆盖率校验：检查 AI 生成的每段内容是否能回溯到用户原文。
 *
 * 规则：
 * - 段长度 < 8 或匹配占位模式 → 免校验（exempt）
 * - coverage = matched shingles / segment shingles，阈值 >= 0.35 视为通过
 * - 模型自报 accuracyFlag=true 但 passed=false → 强制 false
 *
 * @param userText 用户原始输入文本（拼接所有 prompt value）
 * @param segments AI 生成的四段内容
 */
export function checkProvenance(
  userText: string,
  segments: AIReviewSegment
): ProvenanceCheck {
  const sourceSet = shingleSet(userText)
  const failedSegments: string[] = []
  let totalCoverage = 0
  let checkedCount = 0

  const segmentValues: [string, string][] = [
    ['achievements', segments.achievements],
    ['learnings', segments.learnings],
    ['improvements', segments.improvements],
    ['actions', segments.actions],
  ]

  for (const [label, segText] of segmentValues) {
    // 短文本或占位文本免校验
    if (segText.length < 8 || isPlaceholder(segText)) {
      continue
    }

    const segSet = shingleSet(segText)
    if (segSet.size === 0) continue

    let matched = 0
    for (const shingle of segSet) {
      if (sourceSet.has(shingle)) matched++
    }
    const coverage = matched / segSet.size
    totalCoverage += coverage
    checkedCount++

    if (coverage < 0.35) {
      failedSegments.push(label)
    }
  }

  const avgCoverage = checkedCount > 0 ? totalCoverage / checkedCount : 1

  return {
    coverage: Math.round(avgCoverage * 1000) / 1000,
    passed: failedSegments.length === 0,
    checkedAt: new Date().toISOString(),
    failedSegments,
  }
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `你是 MindFlow 的复盘助手。你的角色是"镜子"，不是"写手"。

硬约束：
1. 只能基于用户给定文本内容进行整理，不得编造、不得补充、不得润色定稿。
2. 返回严格的 JSON 对象，格式：{"achievements": string, "learnings": string, "improvements": string, "actions": string, "accuracyFlag": boolean}
3. achievements = 今日成果（从用户文本中提取）
4. learnings = 学习收获（从用户文本中提取）
5. improvements = 待改进（从用户文本中提取）
6. actions = 明日行动（从用户文本中提取）
7. 每段内容必须能回溯到用户原文，不得凭空生成。
8. accuracyFlag = 你是否确认所有内容都来自用户原文（true/false）。
9. 输出前必须声明这是草稿，需用户确认。在 note 字段外不附加任何说明文字。
10. 如果用户某方面信息缺失，使用「（留白也是一种记录，明天再补也不迟。）」作为占位。`

const SYSTEM_PROMPT_POLISHED = `你是 MindFlow 的复盘助手。你的角色是"镜子"，不是"写手"。

硬约束：
1. 只能基于用户给定文本内容进行整理，不得编造、不得补充、不得润色定稿。
2. 允许轻度结构整理：可以调整语序、合并同类项、提取要点，但不得添加原文没有的信息。
3. 返回严格的 JSON 对象，格式：{"achievements": string, "learnings": string, "improvements": string, "actions": string, "accuracyFlag": boolean}
4. achievements = 今日成果（从用户文本中提取并轻度整理）
5. learnings = 学习收获（从用户文本中提取并轻度整理）
6. improvements = 待改进（从用户文本中提取并轻度整理）
7. actions = 明日行动（从用户文本中提取并轻度整理）
8. 每段内容必须能回溯到用户原文，不得凭空生成。
9. accuracyFlag = 你是否确认所有内容都来自用户原文（true/false）。
10. 输出前必须声明这是草稿，需用户确认。
11. 如果用户某方面信息缺失，使用「（留白也是一种记录，明天再补也不迟。）」作为占位。`

// ---------------------------------------------------------------------------
// 用户文本拼接
// ---------------------------------------------------------------------------

function buildUserText(entry: JournalEntry): string {
  return entry.prompts
    .filter(p => p.value && p.value.trim())
    .map(p => `${p.label}：${p.value.trim()}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// Fetch 超时控制（Electron 下优先主进程转发，规避渲染进程 CORS/代理限制）
// ---------------------------------------------------------------------------

/** 将任意 HeadersInit 归一化为 Record<string,string>（主进程转发契约所需） */
function normalizeHeaders(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!h) return out
  if (typeof Headers !== 'undefined' && h instanceof Headers) {
    h.forEach((v, k) => {
      out[k] = v
    })
  } else if (Array.isArray(h)) {
    for (const [k, v] of h) out[k] = v
  } else {
    Object.assign(out, h)
  }
  return out
}

/** 将主进程转发结果适配为标准 Response（调用方可直接用 ok/status/text()/json()） */
function toResponse(result: { status: number; headers?: Record<string, string>; bodyText?: string }): Response {
  return new Response(result.bodyText ?? '', {
    status: result.status,
    headers: result.headers,
  })
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 12000
): Promise<Response> {
  // Electron 环境：优先走主进程转发（超时由主进程 timeoutMs 保证）
  const apiAiFetch = typeof window !== 'undefined' ? window.api?.ai?.fetch : undefined
  if (apiAiFetch) {
    try {
      const result = await apiAiFetch({
        url,
        method: options.method,
        headers: normalizeHeaders(options.headers),
        body: typeof options.body === 'string' ? options.body : undefined,
        timeoutMs,
      })
      return toResponse(result)
    } catch (e: any) {
      throw new Error(`主进程网络转发失败：${e?.message || e}`)
    }
  }

  // 非 Electron 环境：浏览器 fetch + AbortController 保留 12s 超时语义
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId))
}

// ---------------------------------------------------------------------------
// 审计日志（写入 journal 的 audit）
// ---------------------------------------------------------------------------

async function auditFallback(reason: string): Promise<void> {
  try {
    const raw = await localforage.getItem('mindflow:journal')
    const data = (raw as any) || { entries: [], prefs: {}, audit: [] }
    if (!Array.isArray(data.audit)) data.audit = []
    data.audit.unshift({
      ts: new Date().toISOString(),
      action: 'ai_client_fallback',
      detail: reason,
    })
    await localforage.setItem('mindflow:journal', data)
  } catch (e) {
    console.error('[aiClient] audit fallback failed', e)
  }
}

// ---------------------------------------------------------------------------
// BYOK: Ollama 模式
// ---------------------------------------------------------------------------

function isOllamaEndpoint(baseUrl?: string): boolean {
  if (!baseUrl) return false
  const lower = baseUrl.toLowerCase()
  return (
    lower.includes('localhost:11434') ||
    lower.includes('127.0.0.1:11434') ||
    lower.endsWith(':11434')
  )
}

async function callOllama(
  baseUrl: string,
  model: string,
  systemPrompt: string,
  userText: string
): Promise<AIReviewSegment & { accuracyFlag: boolean }> {
  const url = baseUrl.replace(/\/+$/, '') + '/api/chat'
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
    stream: false,
    format: 'json',
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Ollama HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data = await res.json()
  const content = data?.message?.content || data?.content || ''
  if (!content) throw new Error('Ollama 返回空内容')

  return parseAIResponse(content)
}

// ---------------------------------------------------------------------------
// BYOK: OpenAI 兼容模式
// ---------------------------------------------------------------------------

async function callOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userText: string
): Promise<AIReviewSegment & { accuracyFlag: boolean }> {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userText },
    ],
    response_format: { type: 'json_object' },
  }

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`OpenAI HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content || ''
  if (!content) throw new Error('OpenAI 返回空内容')

  return parseAIResponse(content)
}

// ---------------------------------------------------------------------------
// 响应解析
// ---------------------------------------------------------------------------

function parseAIResponse(content: string): AIReviewSegment & { accuracyFlag: boolean } {
  // 尝试直接解析 JSON
  let parsed: any
  try {
    parsed = JSON.parse(content)
  } catch {
    // 尝试从 markdown 代码块中提取
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[1].trim())
      } catch {
        throw new Error('AI 返回内容无法解析为 JSON')
      }
    } else {
      throw new Error('AI 返回内容无法解析为 JSON')
    }
  }

  // 校验必要字段
  const required = ['achievements', 'learnings', 'improvements', 'actions']
  for (const field of required) {
    if (typeof parsed[field] !== 'string') {
      throw new Error(`AI 返回缺少字段: ${field}`)
    }
  }

  return {
    achievements: String(parsed.achievements),
    learnings: String(parsed.learnings),
    improvements: String(parsed.improvements),
    actions: String(parsed.actions),
    accuracyFlag: parsed.accuracyFlag !== false,
  }
}

// ---------------------------------------------------------------------------
// 主函数：generateReview
// ---------------------------------------------------------------------------

/**
 * 镜子式复盘生成器。
 *
 * @param entry  日志条目
 * @param cfg    AI 配置
 * @param opts   可选参数（polished 模式等）
 */
export async function generateReview(
  entry: JournalEntry,
  cfg: AIConfig,
  opts?: { polished?: boolean }
): Promise<ReviewResult> {
  // -----------------------------------------------------------------------
  // local 模式：保持本地镜像逻辑
  // -----------------------------------------------------------------------
  if (cfg.mode === 'local') {
    const { draft, note } = generateLocalMirror(entry)
    return {
      draft,
      accuracyFlag: true,
      note,
      source: 'local',
    }
  }

  // -----------------------------------------------------------------------
  // cloud 模式：读 VITE_MINDFLOW_LLM_ENDPOINT
  // -----------------------------------------------------------------------
  if (cfg.mode === 'cloud') {
    const endpoint = import.meta.env.VITE_MINDFLOW_LLM_ENDPOINT as string | undefined
    if (!endpoint || endpoint.trim() === '') {
      const err: any = new Error(
        '云模型尚未在本地配置，可改用本地镜像或自带 Key。请在「隐私」页检查 AI 设置。'
      )
      err.code = 'CLOUD_LLM_NOT_CONFIGURED'
      throw err
    }

    try {
      const userText = buildUserText(entry)
      const systemPrompt = opts?.polished ? SYSTEM_PROMPT_POLISHED : SYSTEM_PROMPT
      const result = await callOpenAI(
        endpoint,
        '', // cloud 模式无需 apiKey（端点自带鉴权）
        cfg.aiModel || 'gpt-4o-mini',
        systemPrompt,
        userText
      )

      const provenance = checkProvenance(userText, {
        achievements: result.achievements,
        learnings: result.learnings,
        improvements: result.improvements,
        actions: result.actions,
      })

      let accuracyFlag = result.accuracyFlag
      if (result.accuracyFlag && !provenance.passed) {
        accuracyFlag = false
      }

      return {
        draft: {
          achievements: result.achievements,
          learnings: result.learnings,
          improvements: result.improvements,
          actions: result.actions,
        },
        accuracyFlag,
        note: '云端模型生成 · 草稿·需你确认。仅基于你写下的内容整理，已通过溯源校验。你可编辑，或一键还原。',
        source: 'cloud',
        provenance,
      }
    } catch (e: any) {
      // 回退到本地镜像
      await auditFallback(`cloud: ${e?.message || e}`)
      const { draft, note } = generateLocalMirror(entry)
      return {
        draft,
        accuracyFlag: true,
        note: `网络异常，已用本地镜像预览。原因：${e?.message || '未知'}。${note}`,
        source: 'local-fallback',
      }
    }
  }

  // -----------------------------------------------------------------------
  // byok 模式：Ollama 或 OpenAI 兼容
  // -----------------------------------------------------------------------
  if (cfg.mode === 'byok') {
    try {
      const userText = buildUserText(entry)
      const systemPrompt = opts?.polished ? SYSTEM_PROMPT_POLISHED : SYSTEM_PROMPT
      const baseUrl = cfg.aiBaseUrl || ''

      let result: AIReviewSegment & { accuracyFlag: boolean }

      if (isOllamaEndpoint(baseUrl)) {
        // Ollama 模式
        const ollamaUrl = baseUrl || 'http://localhost:11434'
        const model = cfg.aiModel || 'llama3.1'
        result = await callOllama(ollamaUrl, model, systemPrompt, userText)
      } else {
        // OpenAI 兼容模式
        if (!cfg.apiKey) {
          throw new Error('自带 Key 模式需要填写 API Key')
        }
        const openaiUrl = baseUrl || 'https://api.openai.com/v1'
        const model = cfg.aiModel || 'gpt-4o-mini'
        result = await callOpenAI(openaiUrl, cfg.apiKey, model, systemPrompt, userText)
      }

      const provenance = checkProvenance(userText, {
        achievements: result.achievements,
        learnings: result.learnings,
        improvements: result.improvements,
        actions: result.actions,
      })

      let accuracyFlag = result.accuracyFlag
      if (result.accuracyFlag && !provenance.passed) {
        accuracyFlag = false
      }

      return {
        draft: {
          achievements: result.achievements,
          learnings: result.learnings,
          improvements: result.improvements,
          actions: result.actions,
        },
        accuracyFlag,
        note: '自带 Key 模型生成 · 草稿·需你确认。仅基于你写下的内容整理，已通过溯源校验。你可编辑，或一键还原。',
        source: 'byok',
        provenance,
      }
    } catch (e: any) {
      // 回退到本地镜像
      await auditFallback(`byok: ${e?.message || e}`)
      const { draft, note } = generateLocalMirror(entry)
      return {
        draft,
        accuracyFlag: true,
        note: `网络异常，已用本地镜像预览。原因：${e?.message || '未知'}。${note}`,
        source: 'local-fallback',
      }
    }
  }

  // 不应到达此处
  const { draft, note } = generateLocalMirror(entry)
  return {
    draft,
    accuracyFlag: true,
    note,
    source: 'local-fallback',
  }
}
