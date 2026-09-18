import { defineStore } from 'pinia'
import { ref } from 'vue'
import localforage from 'localforage'
import type { DaySummary } from '@/store/types'

function isDaySummary(obj: any): obj is DaySummary {
  if (typeof obj !== 'object' || obj === null) return false
  return (
    typeof obj.date === 'string' &&
    typeof obj.summary === 'string' &&
    typeof obj.mood === 'string' &&
    typeof obj.weather === 'string' &&
    Array.isArray(obj.habits) &&
    typeof obj.dailyCheck === 'object' && obj.dailyCheck !== null &&
    typeof obj.dailyCheck.energyLevel === 'number' &&
    Array.isArray(obj.customSections) &&
    Array.isArray(obj.tags) &&
    Array.isArray(obj.media) &&
    (obj.sparks === undefined || Array.isArray(obj.sparks))
  )
}

export const useSummariesStore = defineStore('summaries', () => {
  const daySummaries = ref<DaySummary[]>([])

  async function loadDaySummaries() {
    try {
      const data = await localforage.getItem('daySummaries')
      if (!data || !Array.isArray(data)) { daySummaries.value = []; return }
      daySummaries.value = data.filter(isDaySummary).map((s: any) => ({
        ...s,
        sparks: s.sparks || [],
        dailyCheck: {
          energyLevel: Math.min(Math.max(Number(s.dailyCheck?.energyLevel) || 5, 1), 10),
          stressLevel: Math.min(Math.max(Number(s.dailyCheck?.stressLevel) || 5, 1), 10),
          productivity: Math.min(Math.max(Number(s.dailyCheck?.productivity) || 5, 1), 10),
        },
      }))
    } catch (e) {
      console.error('[summaries] load failed', e)
      daySummaries.value = []
    }
  }

  async function persist() {
    await localforage.setItem('daySummaries', JSON.parse(JSON.stringify(daySummaries.value)))
  }

  async function addDaySummary(summary: DaySummary) {
    const serialized = JSON.stringify(daySummaries.value)
    const size = new Blob([serialized]).size
    if (size > 10 * 1024 * 1024) throw new Error('存储限制超出，请导出并清理旧条目')
    daySummaries.value.push(summary)
    try { await persist() } catch (e) {
      daySummaries.value = daySummaries.value.filter(s => s.date !== summary.date)
      throw e
    }
  }

  async function updateDaySummary(summary: DaySummary) {
    const original = [...daySummaries.value]
    const idx = daySummaries.value.findIndex(s => s.date === summary.date)
    if (idx !== -1) daySummaries.value[idx] = summary
    else daySummaries.value.push(summary)
    try { await persist() } catch (e) {
      daySummaries.value = original
      throw e
    }
  }

  async function deleteDaySummary(date: string) {
    daySummaries.value = daySummaries.value.filter(s => s.date !== date)
    await persist()
  }

  const getDaySummary = (date: string) => daySummaries.value.find(s => s.date === date)

  return { daySummaries, loadDaySummaries, addDaySummary, updateDaySummary, deleteDaySummary, getDaySummary }
})
