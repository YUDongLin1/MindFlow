import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { handleStorageError } from '@/utils/storageErrorHandler'

export interface AppSettings {
  autoSaveOnClose: boolean
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ autoSaveOnClose: true })
  const sparks = ref<string[]>([])
  const calendarEntries = ref<{ date: string; content: string }[]>([])

  // ---- actions ----
  async function loadSettings() {
    try {
      const saved = await localforage.getItem('settings') as AppSettings | null
      if (saved) {
        settings.value = { ...settings.value, ...saved }
      } else {
        // 深度去代理：settings.value 是 Vue reactive Proxy，IndexedDB structured clone
        // 无法克隆 Proxy（DataCloneError），必须先序列化为纯 JSON 快照再写盘。
        await localforage.setItem('settings', JSON.parse(JSON.stringify(settings.value)))
      }
    } catch (e) {
      console.error('[settings] load failed', e)
    }
  }

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const original = { ...settings.value }
    try {
      settings.value[key] = value
      await localforage.setItem('settings', JSON.parse(JSON.stringify(settings.value)))
    } catch (e: any) {
      settings.value = original
      throw handleStorageError(e, 'update setting', 'settings')
    }
  }

  async function loadSparks() {
    try {
      const saved = await localforage.getItem('sparks') as string[] | null
      if (saved) sparks.value = saved
    } catch (e) {
      console.error('[sparks] load failed', e)
    }
  }

  async function addSpark(spark: string) {
    const original = [...sparks.value]
    try {
      sparks.value.push(spark)
      // 深度去代理：sparks.value 是 reactive Proxy，写盘前序列化为纯 JSON 快照
      await localforage.setItem('sparks', JSON.parse(JSON.stringify(sparks.value)))
    } catch (e) {
      sparks.value = original
      throw handleStorageError(e, 'add spark', 'sparks')
    }
  }

  async function loadCalendarEntries() {
    try {
      const saved = await localforage.getItem('calendarEntries') as { date: string; content: string }[] | null
      if (saved) calendarEntries.value = saved
    } catch (e) {
      console.error('[calendar] load failed', e)
    }
  }

  async function addCalendarEntry(entry: { date: string; content: string }) {
    const original = [...calendarEntries.value]
    try {
      calendarEntries.value.push(entry)
      // 深度去代理：calendarEntries.value 是 reactive Proxy，写盘前序列化为纯 JSON 快照
      await localforage.setItem('calendarEntries', JSON.parse(JSON.stringify(calendarEntries.value)))
    } catch (e) {
      calendarEntries.value = original
      throw handleStorageError(e, 'add calendar entry', 'calendarEntries')
    }
  }

  return {
    settings, sparks, calendarEntries,
    loadSettings, updateSetting,
    loadSparks, addSpark,
    loadCalendarEntries, addCalendarEntry,
  }
})
