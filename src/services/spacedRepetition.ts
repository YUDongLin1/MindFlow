/**
 * 间隔重复复习服务
 * 基于 SM-2 算法简化版
 *
 * 核心逻辑：
 * - 每张卡片有 easiness(难度系数) / interval(间隔天数) / repetitions(连续正确次数) / dueDate(下次复习日期)
 * - 复习评分 0-5：0=完全忘记, 3=勉强记得, 4=记得但犹豫, 5=完全记得
 * - 评分 ≥3 → interval 递增；评分 <3 → 重置
 */

export interface SRCard {
  entryId: string
  easiness: number    // ≥1.3，默认 2.5
  interval: number    // 天数，默认 0
  repetitions: number // 连续正确次数，默认 0
  dueDate: string     // YYYY-MM-DD
  lastReview?: string // 上次复习日期
}

const STORAGE_KEY = 'mindflow:sr_cards'
const MIN_EASINESS = 1.3

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * SM-2 算法核心：根据评分更新卡片参数
 */
export function scheduleCard(card: SRCard, quality: number): SRCard {
  const q = Math.max(0, Math.min(5, quality))
  const today = todayLocal()

  let { easiness, interval, repetitions } = card

  if (q >= 3) {
    // 记住了
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 3
    } else {
      interval = Math.round(interval * easiness)
    }
    repetitions++
  } else {
    // 忘记了，重置
    repetitions = 0
    interval = 1
  }

  // 更新难度系数
  easiness = easiness + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easiness = Math.max(MIN_EASINESS, easiness)

  return {
    ...card,
    easiness,
    interval,
    repetitions,
    dueDate: addDays(today, interval),
    lastReview: today,
  }
}

/**
 * 创建新卡片
 */
export function createCard(entryId: string): SRCard {
  return {
    entryId,
    easiness: 2.5,
    interval: 0,
    repetitions: 0,
    dueDate: todayLocal(), // 立即可复习
  }
}

/**
 * 从 localStorage 加载所有卡片
 */
export function loadCards(): SRCard[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SRCard[]
  } catch {
    return []
  }
}

/**
 * 保存卡片到 localStorage
 */
export function saveCards(cards: SRCard[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

/**
 * 获取今日待复习卡片
 */
export function getDueCards(cards: SRCard[]): SRCard[] {
  const today = todayLocal()
  return cards.filter(c => c.dueDate <= today).sort((a, b) => a.dueDate < b.dueDate ? -1 : 1)
}

/**
 * 获取或创建卡片（如果没有则创建）
 */
export function getOrCreateCard(cards: SRCard[], entryId: string): SRCard {
  const existing = cards.find(c => c.entryId === entryId)
  if (existing) return existing
  const newCard = createCard(entryId)
  cards.push(newCard)
  saveCards(cards)
  return newCard
}
