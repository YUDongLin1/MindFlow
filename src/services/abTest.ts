/**
 * MindFlow A/B 实验服务
 *
 * 三个实验（按设计文档 §3.3）：
 * - exp1_privacy: 隐私徽标 — treatment 展示「本地·不训练·可关」徽标
 * - exp2_quote:   复盘语气 — treatment 允许轻度结构整理（仍须过溯源校验）
 * - exp3_default: 默认展开 — treatment 首次展开自动预填草稿
 *
 * 分配策略：50/50 随机，粘性写入 localforage('mindflow:ab')。
 */

import localforage from 'localforage'
import { track, EVENTS } from './analytics'

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export type ExpId = 'exp1_privacy' | 'exp2_quote' | 'exp3_default'
export type Variant = 'control' | 'treatment'

export interface ABExperiment {
  id: ExpId
  name: string
  description: string
  variants: Record<Variant, string>
}

// ---------------------------------------------------------------------------
// 实验定义
// ---------------------------------------------------------------------------

export const EXPERIMENTS: Record<ExpId, ABExperiment> = {
  exp1_privacy: {
    id: 'exp1_privacy',
    name: '隐私徽标',
    description: '在 AI 复盘区展示「本地·不训练·可关」隐私徽标，增强用户信任感。',
    variants: {
      control: '不展示隐私徽标',
      treatment: '展示隐私徽标',
    },
  },
  exp2_quote: {
    id: 'exp2_quote',
    name: '复盘语气',
    description: 'AI 复盘草稿的语气与结构整理程度。',
    variants: {
      control: '纯镜像直引原文',
      treatment: '允许轻度结构整理',
    },
  },
  exp3_default: {
    id: 'exp3_default',
    name: '默认展开',
    description: '首次展开 AI 复盘时是否自动预填草稿。',
    variants: {
      control: '需手动点击生成',
      treatment: '首次展开自动预填草稿',
    },
  },
}

// ---------------------------------------------------------------------------
// 存储
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'mindflow:ab'

const abStore = localforage.createInstance({
  name: 'MindFlow',
  storeName: 'mindflow_ab',
})

type ABAssignments = Partial<Record<ExpId, Variant>>

// ---------------------------------------------------------------------------
// 核心函数
// ---------------------------------------------------------------------------

async function readAssignments(): Promise<ABAssignments> {
  try {
    return (await abStore.getItem<ABAssignments>(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

async function writeAssignments(data: ABAssignments): Promise<void> {
  try {
    await abStore.setItem(STORAGE_KEY, data)
  } catch (e) {
    console.error('[abTest] write failed', e)
  }
}

/**
 * 获取用户在指定实验中的分桶。
 * @param expId 实验 ID
 * @returns 分桶结果，若未分配则返回 null
 */
export async function getVariant(expId: ExpId): Promise<Variant | null> {
  const assignments = await readAssignments()
  return assignments[expId] || null
}

/**
 * 为用户分配实验分桶（50/50 随机）。
 * 如果已有粘性分桶则直接返回，不重新分配。
 * @param expId 实验 ID
 * @returns 分配后的分桶
 */
export async function assignVariant(expId: ExpId): Promise<Variant> {
  // 先检查是否已有分桶
  const existing = await getVariant(expId)
  if (existing) return existing

  // 50/50 随机分配
  const variant: Variant = Math.random() < 0.5 ? 'control' : 'treatment'
  const assignments = await readAssignments()
  assignments[expId] = variant
  await writeAssignments(assignments)
  return variant
}

/**
 * 记录实验曝光事件。
 * @param expId 实验 ID
 */
export async function trackExposure(expId: ExpId): Promise<void> {
  const variant = await getVariant(expId)
  if (!variant) return
  await track(EVENTS.AI_REVIEW_EXPOSURE, {
    experiment: expId,
    variant,
  })
}
