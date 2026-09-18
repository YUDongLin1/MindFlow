import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import store from './store'  // Vuex 兼容层，逐步迁移后移除
import router from './router'
import i18n from './i18n'
import './style.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { DynamicScroller, DynamicScrollerItem } from 'vue-virtual-scroller'
import localforage from 'localforage'
import { initUsageTracker } from './services/usageTracker'

// 统一 localforage 配置（必须在任何 store 使用之前）
localforage.config({
  name: 'MindFlow',
  storeName: 'mindflow_store',
})

// 一次性迁移：旧库 MoodsNote/mood_notes_store → 新库 MindFlow/mindflow_store（合并不覆盖）
// 背景：数据库名从 MoodsNote/mood_notes_store 改为 MindFlow/mindflow_store 时无迁移，
// 导致旧版用户历史数据孤儿化。此处在首次启动时把旧库数据搬入新库。
const MIGRATION_FLAG = 'mindflow:migrated-from-moodsnote'
async function migrateFromMoodsNote(): Promise<void> {
  try {
    const already = await localforage.getItem(MIGRATION_FLAG)
    if (already) return
    const oldDb = localforage.createInstance({ name: 'MoodsNote', storeName: 'mood_notes_store' })
    let count = 0
    await oldDb.iterate(async (value, key) => {
      // 仅当新库中不存在该 key 时才写入（合并而非覆盖）
      const existing = await localforage.getItem(key)
      if (existing === null || existing === undefined) {
        await localforage.setItem(key, value)
        count++
      }
    })
    await localforage.setItem(MIGRATION_FLAG, true)
    console.log(`[migration] MoodsNote → MindFlow 迁移完成，共迁移 ${count} 个 key`)
  } catch (e) {
    // 迁移失败不阻塞启动
    console.error('[migration] 旧库迁移失败（不阻塞启动）:', e)
  }
}

// 请求浏览器/Electron 将存储标记为持久化，避免被自动清理
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {})
}

// Pinia stores
import { useJournalStore } from './stores/journal'
import { useTodoStore } from './stores/todo'
import { useSettingsStore } from './stores/settings'
import { useHabitsStore } from './stores/habits'
import { useSummariesStore } from './stores/summaries'
import { usePetStore } from './stores/pet'

// Global error handlers
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})

console.log('MindFlow 智流日志 starting...')

// 初始化使用时间追踪
initUsageTracker()

const app = createApp(App)
const pinia = createPinia()

app.config.errorHandler = (err, instance, info) => {
  console.error('Vue error:', err, info)
}

app.component('DynamicScroller', DynamicScroller)
app.component('DynamicScrollerItem', DynamicScrollerItem)

// Install plugins: Pinia first, then Vuex 兼容层, router, i18n
app.use(pinia)
app.use(store)  // Vuex 兼容层 — 旧组件仍可 useStore()
app.use(router)
app.use(i18n)

// Load saved language preference
localforage.getItem('settings:language').then((savedLang) => {
  if (savedLang === 'zh' || savedLang === 'en') {
    i18n.global.locale.value = savedLang as 'en' | 'zh'
  }
}).catch(err => {
  console.error('Failed to load language setting:', err)
})

// Load all data from Pinia stores
console.log('Loading initial data...')
const journalStore = useJournalStore()
const todoStore = useTodoStore()
const settingsStore = useSettingsStore()
const habitsStore = useHabitsStore()
const summariesStore = useSummariesStore()
const petStore = usePetStore()

// 先完成旧库迁移，再加载数据，避免迁移与加载竞争
migrateFromMoodsNote().then(() => Promise.all([
  journalStore.loadEntries(),
  todoStore.loadTodos(),
  settingsStore.loadSettings(),
  settingsStore.loadSparks(),
  settingsStore.loadCalendarEntries(),
  habitsStore.loadHabits(),
  summariesStore.loadDaySummaries(),
  petStore.loadConfig(),
  // 已移除：原 6 个 Vuex store.dispatch('loadXxx') 调用（loadDaySummaries/loadSparks/
  // loadCalendarEntries/loadTasks/loadHabits/loadSettings）。它们与 Pinia 侧双加载同一份数据，
  // 且 Vuex load actions 的类型守卫"清洗回写"可能误删数据，现统一由 Pinia 加载。
])).then(() => {
  console.log('Initial data loaded')
  todoStore.cleanupOld()
}).catch(err => {
  console.error('Failed to load initial data:', err)
})

console.log('Mounting app...')
app.mount('#app')
console.log('App mounted successfully')

// Electron packaged-run adjustments
if (typeof window !== 'undefined' && (window as any).api && (window as any).api.receive) {
  try {
    ;(window as any).api.receive('fromMain', (msg: any) => {
      try {
        if (msg && msg.type === 'app:packaged' && msg.isPackaged) {
          if (!localStorage.getItem('theme')) {
            localStorage.setItem('theme', 'light')
          }
        }
      } catch (e) {
        console.warn('Error handling fromMain message', e)
      }
    })
  } catch (e) {
    console.warn('Failed to register fromMain listener', e)
  }
}
