/**
 * 日期工具函数
 * 关键：所有日期比较/存储使用本地时间（非 UTC），避免 UTC+8 时区偏移问题。
 * toISOString() 返回 UTC 时间，在中国时区 16:00 后会变成次日。
 */

/**
 * 获取本地今日日期 YYYY-MM-DD
 */
export function todayLocal(): string {
  return formatLocalDate(new Date())
}

/**
 * 格式化为本地 YYYY-MM-DD
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 获取昨天日期（本地时间）
 */
export function yesterdayLocal(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatLocalDate(d)
}

/**
 * 获取本周一日期（本地时间）
 */
export function mondayLocal(): Date {
  const now = new Date()
  const day = now.getDay() || 7 // 周日=7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * 解析日期字符串为本地 Date（避免 UTC 偏移）
 * 支持 YYYY-MM-DD 格式
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 一年前的今天（本地时间）
 */
export function oneYearAgoLocal(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return formatLocalDate(d)
}
