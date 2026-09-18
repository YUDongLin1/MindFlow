import { createStore, StoreOptions } from 'vuex'
import localforage from 'localforage'
import {
  Task,
  Habit,
  DaySummary,
  MediaItem,
  CustomSection,
  DailyCheck,
  MoodType,
  HabitStatus
} from './types'
import { handleStorageError } from '@/utils/storageErrorHandler'
import { countWordsInHtml } from '@/utils/wordCount'
import journalModule from './journal'

localforage.config({
  name: 'MindFlow',
  storeName: 'mindflow_store',
})

// Type guard functions for runtime validation
const isValidMood = (mood: any): mood is MoodType => {
  return typeof mood === 'string' && ['happy', 'neutral', 'sad', 'excited', 'angry'].includes(mood)
}

const isDaySummaryHabit = (obj: any): obj is import('./types').DaySummaryHabit => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.name === 'string' &&
    typeof obj.completed === 'boolean' &&
    (obj.status === 'did' || obj.status === 'partial' || obj.status === 'not' || obj.status === null)
  )
}

const isMediaItem = (obj: any): obj is MediaItem => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.type === 'string' &&
    typeof obj.url === 'string' &&
    (obj.size === undefined || typeof obj.size === 'number') &&
    (obj.checksum === undefined || typeof obj.checksum === 'string') &&
    (obj.createdAt === undefined || typeof obj.createdAt === 'string') &&
    (obj.storageKey === undefined || typeof obj.storageKey === 'string') &&
    (obj.integrity === undefined || (
      typeof obj.integrity === 'object' && obj.integrity !== null &&
      typeof obj.integrity.ok === 'boolean' &&
      (obj.integrity.reason === undefined || typeof obj.integrity.reason === 'string')
    ))
  )
}

const isCustomSection = (obj: any): obj is CustomSection => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.title === 'string' &&
    typeof obj.content === 'string'
  )
}

const isDailyCheck = (obj: any): obj is DailyCheck => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.energyLevel === 'number' &&
    typeof obj.stressLevel === 'number' &&
    typeof obj.productivity === 'number' &&
    obj.energyLevel >= 1 && obj.energyLevel <= 10 &&
    obj.stressLevel >= 1 && obj.stressLevel <= 10 &&
    obj.productivity >= 1 && obj.productivity <= 10
  )
}

const isDaySummary = (obj: any): obj is DaySummary => {
  if (typeof obj !== 'object' || obj === null) return false

  return (
    typeof obj.date === 'string' &&
    typeof obj.summary === 'string' &&
    typeof obj.mood === 'string' &&
    typeof obj.weather === 'string' &&
    Array.isArray(obj.habits) &&
    obj.habits.every(isDaySummaryHabit) &&
    isDailyCheck(obj.dailyCheck) &&
    typeof obj.comfortZoneEntry === 'string' &&
    Array.isArray(obj.customSections) &&
    obj.customSections.every(isCustomSection) &&
    Array.isArray(obj.tags) &&
    obj.tags.every((tag: any) => typeof tag === 'string') &&
    Array.isArray(obj.media) &&
    obj.media.every(isMediaItem) &&
    // sparks is optional for backward compatibility
    (obj.sparks === undefined || (Array.isArray(obj.sparks) && obj.sparks.every((spark: any) => typeof spark === 'string')))
  )
}

const isTask = (obj: any): obj is Task => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'number' &&
    typeof obj.description === 'string' &&
    ['Lowest', 'Low', 'Normal', 'Medium', 'High', 'Highest'].includes(obj.priority) &&
    typeof obj.dueDate === 'string'
  )
}

const isHabit = (obj: any): obj is Habit => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.id === 'number' &&
    typeof obj.name === 'string' &&
    typeof obj.description === 'string' &&
    Array.isArray(obj.statuses) &&
    obj.statuses.every((status: any) =>
      typeof status === 'object' &&
      status !== null &&
      typeof status.date === 'string' &&
      (status.status === 'did' || status.status === 'partial' || status.status === 'not')
    )
  )
}

// Export type guards for use in other modules
export { isDaySummary, isTask, isHabit }

export interface AppSettings {
  autoSaveOnClose: boolean
}

export interface State {
  daySummaries: DaySummary[]
  tasks: Task[]
  habits: Habit[]
  sparks: string[]
  calendarEntries: { date: string; content: string }[]
  settings: AppSettings
}


const store: StoreOptions<State> = {
  state: {
    daySummaries: [],
    tasks: [],
    habits: [],
    sparks: [],
    calendarEntries: [],
    settings: {
      autoSaveOnClose: true, // Default to enabled
    },
  },
  mutations: {
    // Day Summaries
    SET_DAY_SUMMARIES(state, daySummaries: DaySummary[]) {
      state.daySummaries = daySummaries
    },
    ADD_DAY_SUMMARY(state, daySummary: DaySummary) {
      state.daySummaries.push(daySummary)
    },
    UPDATE_DAY_SUMMARY(state, updatedSummary: DaySummary) {
      const index = state.daySummaries.findIndex(s => s.date === updatedSummary.date)
      if (index !== -1) {
        state.daySummaries[index] = updatedSummary
      } else {
        state.daySummaries.push(updatedSummary)
      }
    },
    DELETE_DAY_SUMMARY(state, date: string) {
      state.daySummaries = state.daySummaries.filter(s => s.date !== date)
    },
    // Tasks
    SET_TASKS(state, tasks: Task[]) {
      state.tasks = tasks
    },
    ADD_TASK(state, task: Task) {
      state.tasks.push(task)
    },
    UPDATE_TASK(state, updatedTask: Task & { id: number }) {
      const index = state.tasks.findIndex(t => t.id === updatedTask.id)
      if (index !== -1) {
        state.tasks[index] = updatedTask
      }
    },
    DELETE_TASK(state, index: number) {
      state.tasks.splice(index, 1)
    },
    // Habits
    SET_HABITS(state, habits: Habit[]) {
      state.habits = habits
    },
    ADD_HABIT(state, habit: Habit) {
      state.habits.push(habit)
    },
    UPDATE_HABIT(state, updatedHabit: Habit) {
      const index = state.habits.findIndex(h => h.id === updatedHabit.id)
      if (index !== -1) {
        state.habits[index] = updatedHabit
      }
    },
    UPDATE_HABIT_STATUS(state, payload: { habitId: number; date: string; status: 'did' | 'partial' | 'not' | null }) {
      const habit = state.habits.find(h => h.id === payload.habitId)
      if (habit) {
        const existingStatusIndex = habit.statuses.findIndex(s => s.date === payload.date)

        if (payload.status === null) {
          // Remove status if null
          if (existingStatusIndex !== -1) {
            habit.statuses.splice(existingStatusIndex, 1)
          }
        } else {
          // Update or add status
          if (existingStatusIndex !== -1) {
            habit.statuses[existingStatusIndex].status = payload.status
          } else {
            habit.statuses.push({ date: payload.date, status: payload.status })
          }
        }
      }
    },
    // Sparks
    SET_SPARKS(state, sparks: string[]) {
      state.sparks = sparks
    },
    ADD_SPARK(state, spark: string) {
      state.sparks.push(spark)
    },
    // Calendar Entries
    SET_CALENDAR_ENTRIES(state, entries: { date: string; content: string }[]) {
      state.calendarEntries = entries
    },
    ADD_CALENDAR_ENTRY(state, entry: { date: string; content: string }) {
      state.calendarEntries.push(entry)
    },
    // Settings
    SET_SETTINGS(state, settings: AppSettings) {
      state.settings = settings
    },
    UPDATE_SETTING(state, { key, value }: { key: keyof AppSettings; value: any }) {
      if (!state.settings) {
        state.settings = { autoSaveOnClose: true }
      }
      state.settings[key] = value
    },
  },
  actions: {
    // Loaders
    async loadDaySummaries({ commit }) {
      try {
        const data = await localforage.getItem('daySummaries')

        // Validate data type
        if (!data) {
          commit('SET_DAY_SUMMARIES', [])
          return
        }

        if (!Array.isArray(data)) {
          console.error('Invalid daySummaries format in storage - expected array')
          commit('SET_DAY_SUMMARIES', [])
          return
        }

        // Filter and validate each day summary using type guards
        const validSummaries = data.filter((item: any) => {
          const isValid = isDaySummary(item)
          if (!isValid) {
            console.warn('Invalid day summary found and skipped:', item)
          }
          return isValid
        })

        // Clean up any invalid data in valid summaries
        const cleanedSummaries = validSummaries.map(summary => {
          const cleaned: any = { ...summary }

          // Ensure sparks field exists (for backward compatibility)
          if (!cleaned.sparks) {
            cleaned.sparks = []
          }

          // Normalize dailyCheck values
          if (cleaned.dailyCheck) {
            cleaned.dailyCheck = {
              energyLevel: Math.min(Math.max(Number(cleaned.dailyCheck.energyLevel) || 5, 1), 10),
              stressLevel: Math.min(Math.max(Number(cleaned.dailyCheck.stressLevel) || 5, 1), 10),
              productivity: Math.min(Math.max(Number(cleaned.dailyCheck.productivity) || 5, 1), 10)
            }
          }

          return cleaned
        })

        commit('SET_DAY_SUMMARIES', cleanedSummaries)

        // Save cleaned data back if anything changed
        if (validSummaries.length !== data.length || JSON.stringify(cleanedSummaries) !== JSON.stringify(data)) {
          await localforage.setItem('daySummaries', cleanedSummaries)
          console.log('✨ Cleaned invalid data in existing summaries')
        }
      } catch (error) {
        console.error('Failed to load day summaries:', error)
        // Return empty array on error to prevent app crash
        commit('SET_DAY_SUMMARIES', [])
      }
    },
    async addDaySummary({ commit, state }, daySummary: DaySummary) {
      try {
        commit('ADD_DAY_SUMMARY', daySummary)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.daySummaries)

        // Check data size before saving (10MB limit)
        const size = new Blob([serialized]).size
        const MAX_STORAGE_SIZE = 10 * 1024 * 1024 // 10MB
        if (size > MAX_STORAGE_SIZE) {
          // Rollback the mutation
          commit('DELETE_DAY_SUMMARY', daySummary.date)
          throw new Error(`Storage limit exceeded (${(size / 1024 / 1024).toFixed(2)}MB / ${MAX_STORAGE_SIZE / 1024 / 1024}MB). Please export and clean old entries.`)
        }

        const cleanedSummaries = JSON.parse(serialized)
        await localforage.setItem('daySummaries', cleanedSummaries)
      } catch (error: any) {
        console.error('Failed to add day summary:', error)

        // Rollback the mutation on error
        commit('DELETE_DAY_SUMMARY', daySummary.date)

        if (error.name === 'QuotaExceededError') {
          throw new Error('Storage quota exceeded. Please export and clean old data to free up space.')
        } else if (!navigator.onLine) {
          throw new Error('You appear to be offline. Changes will be saved when you reconnect.')
        } else if (error.message?.includes('Storage limit exceeded')) {
          throw error // Re-throw our custom storage limit error
        } else {
          throw new Error(`Failed to save: ${error.message}. Please try again or contact support if this persists.`)
        }
      }
    },
    async updateDaySummary({ commit, state }, daySummary: DaySummary) {
      // Store the original summary for rollback
      const originalSummaries = [...state.daySummaries]

      try {
        commit('UPDATE_DAY_SUMMARY', daySummary)

        // Use JSON serialization to create a deep clone and remove any non-serializable properties
        // This ensures the data is completely clean for IndexedDB
        const serialized = JSON.stringify(state.daySummaries)

        // Check data size before saving (10MB limit)
        const size = new Blob([serialized]).size
        const MAX_STORAGE_SIZE = 10 * 1024 * 1024 // 10MB
        if (size > MAX_STORAGE_SIZE) {
          // Rollback the mutation
          commit('SET_DAY_SUMMARIES', originalSummaries)
          throw new Error(`Storage limit exceeded (${(size / 1024 / 1024).toFixed(2)}MB / ${MAX_STORAGE_SIZE / 1024 / 1024}MB). Please export and clean old entries.`)
        }

        const cleanedSummaries = JSON.parse(serialized)

        await localforage.setItem('daySummaries', cleanedSummaries)
      } catch (error: any) {
        console.error('Failed to update day summary:', error)
        console.error('Error stack:', error)

        // Rollback the mutation on error
        commit('SET_DAY_SUMMARIES', originalSummaries)

        if (error.name === 'QuotaExceededError') {
          throw new Error('Storage quota exceeded. Please export and clean old data to free up space.')
        } else if (!navigator.onLine) {
          throw new Error('You appear to be offline. Changes will be saved when you reconnect.')
        } else if (error.message?.includes('Storage limit exceeded')) {
          throw error // Re-throw our custom storage limit error
        } else {
          throw new Error(`Failed to save: ${error.message}. Please try again or contact support if this persists.`)
        }
      }
    },
    async deleteDaySummary({ commit, state }, date: string) {
      try {
        commit('DELETE_DAY_SUMMARY', date)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.daySummaries)
        const cleanedSummaries = JSON.parse(serialized)
        await localforage.setItem('daySummaries', cleanedSummaries)
      } catch (error) {
        console.error('Failed to delete day summary:', error)
        throw new Error('Failed to delete day summary. Please try again.')
      }
    },
    // Tasks
    async loadTasks({ commit }) {
      try {
        const data = await localforage.getItem('tasks')

        if (!data) {
          commit('SET_TASKS', [])
          return
        }

        if (!Array.isArray(data)) {
          console.error('Invalid tasks format in storage - expected array')
          commit('SET_TASKS', [])
          return
        }

        // Filter and validate each task using type guards
        const validTasks = data.filter((item: any) => {
          const isValid = isTask(item)
          if (!isValid) {
            console.warn('Invalid task found and skipped:', item)
          }
          return isValid
        })

        commit('SET_TASKS', validTasks)

        // Save cleaned data back if anything was filtered
        if (validTasks.length !== data.length) {
          await localforage.setItem('tasks', validTasks)
          console.log('✨ Cleaned invalid tasks')
        }
      } catch (error) {
        console.error('Failed to load tasks:', error)
        commit('SET_TASKS', [])
      }
    },
    async addTask({ commit, state }, task: Task) {
      // Store original state for rollback
      const originalTasks = [...state.tasks]

      try {
        commit('ADD_TASK', task)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.tasks)
        const cleanedTasks = JSON.parse(serialized)
        await localforage.setItem('tasks', cleanedTasks)
      } catch (error: any) {
        console.error('Failed to add task:', error)

        // Rollback state mutation
        commit('SET_TASKS', originalTasks)

        // Throw user-friendly error
        throw handleStorageError(error, 'add task', 'tasks')
      }
    },
    async updateTask({ commit, state }, task: Task & { id: number }) {
      // Store original state for rollback
      const originalTasks = [...state.tasks]

      try {
        commit('UPDATE_TASK', task)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.tasks)
        const cleanedTasks = JSON.parse(serialized)
        await localforage.setItem('tasks', cleanedTasks)
      } catch (error: any) {
        console.error('Failed to update task:', error)

        // Rollback state mutation
        commit('SET_TASKS', originalTasks)

        // Throw user-friendly error
        throw handleStorageError(error, 'update task', 'tasks')
      }
    },
    // Habits
    async loadHabits({ commit }) {
      try {
        const data = await localforage.getItem('habits')

        if (!data) {
          commit('SET_HABITS', [])
          return
        }

        if (!Array.isArray(data)) {
          console.error('Invalid habits format in storage - expected array')
          commit('SET_HABITS', [])
          return
        }

        // Filter and validate each habit using type guards
        const validHabits = data.filter((item: any) => {
          const isValid = isHabit(item)
          if (!isValid) {
            console.warn('Invalid habit found and skipped:', item)
          }
          return isValid
        })

        commit('SET_HABITS', validHabits)

        // Save cleaned data back if anything was filtered
        if (validHabits.length !== data.length) {
          await localforage.setItem('habits', validHabits)
          console.log('✨ Cleaned invalid habits')
        }
      } catch (error) {
        console.error('Failed to load habits:', error)
        commit('SET_HABITS', [])
      }
    },
    async addHabit({ commit, state }, habit: Habit) {
      // Store original state for rollback
      const originalHabits = [...state.habits]

      try {
        commit('ADD_HABIT', habit)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.habits)
        const cleanedHabits = JSON.parse(serialized)
        await localforage.setItem('habits', cleanedHabits)
      } catch (error: any) {
        console.error('Failed to add habit:', error)

        // Rollback state mutation
        commit('SET_HABITS', originalHabits)

        // Throw user-friendly error
        throw handleStorageError(error, 'add habit', 'habits')
      }
    },
    async updateHabit({ commit, state }, habit: Habit) {
      // Store original state for rollback
      const originalHabits = [...state.habits]

      try {
        commit('UPDATE_HABIT', habit)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.habits)
        const cleanedHabits = JSON.parse(serialized)
        await localforage.setItem('habits', cleanedHabits)
      } catch (error: any) {
        console.error('Failed to update habit:', error)

        // Rollback state mutation
        commit('SET_HABITS', originalHabits)

        // Throw user-friendly error
        throw handleStorageError(error, 'update habit', 'habits')
      }
    },
    async updateHabitStatus({ commit, state }, payload: { habitId: number; date: string; status: 'did' | 'partial' | 'not' | null }) {
      // Store original state for rollback
      const originalHabits = [...state.habits]

      try {
        commit('UPDATE_HABIT_STATUS', payload)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.habits)
        const cleanedHabits = JSON.parse(serialized)
        await localforage.setItem('habits', cleanedHabits)
      } catch (error: any) {
        console.error('Failed to update habit status:', error)

        // Rollback state mutation
        commit('SET_HABITS', originalHabits)

        // Throw user-friendly error
        throw handleStorageError(error, 'update habit status', 'habits')
      }
    },
    // Sparks
    async loadSparks({ commit }) {
      try {
        const sparks = (await localforage.getItem('sparks')) as string[] | null
        if (sparks) {
          commit('SET_SPARKS', sparks)
        }
      } catch (error) {
        console.error('Failed to load sparks:', error)
        commit('SET_SPARKS', [])
      }
    },
    async addSpark({ commit, state }, spark: string) {
      // Store original state for rollback
      const originalSparks = [...state.sparks]

      try {
        commit('ADD_SPARK', spark)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.sparks)
        const cleanedSparks = JSON.parse(serialized)
        await localforage.setItem('sparks', cleanedSparks)
      } catch (error: any) {
        console.error('Failed to add spark:', error)

        // Rollback state mutation
        commit('SET_SPARKS', originalSparks)

        // Throw user-friendly error
        throw handleStorageError(error, 'add spark', 'sparks')
      }
    },
    // Calendar Entries
    async loadCalendarEntries({ commit }) {
      try {
        const entries = (await localforage.getItem('calendarEntries')) as { date: string; content: string }[] | null
        if (entries) {
          commit('SET_CALENDAR_ENTRIES', entries)
        }
      } catch (error) {
        console.error('Failed to load calendar entries:', error)
        commit('SET_CALENDAR_ENTRIES', [])
      }
    },
    async addCalendarEntry({ commit, state }, entry: { date: string; content: string }) {
      // Store original state for rollback
      const originalEntries = [...state.calendarEntries]

      try {
        commit('ADD_CALENDAR_ENTRY', entry)
        // Serialize to ensure IndexedDB compatibility
        const serialized = JSON.stringify(state.calendarEntries)
        const cleanedEntries = JSON.parse(serialized)
        await localforage.setItem('calendarEntries', cleanedEntries)
      } catch (error: any) {
        console.error('Failed to add calendar entry:', error)

        // Rollback state mutation
        commit('SET_CALENDAR_ENTRIES', originalEntries)

        // Throw user-friendly error
        throw handleStorageError(error, 'add calendar entry', 'calendarEntries')
      }
    },
    // Settings
    async loadSettings({ commit }) {
      console.log('📥 Loading settings from storage...')
      try {
        const settings = (await localforage.getItem('settings')) as AppSettings | null
        console.log('📦 Raw settings from storage:', settings)
        
        if (settings) {
          // Merge with defaults to ensure all keys exist
          const defaultSettings: AppSettings = {
            autoSaveOnClose: true,
          }
          const mergedSettings: AppSettings = {
            ...defaultSettings,
            ...settings,
          }
          console.log('✅ Merged settings:', mergedSettings)
          commit('SET_SETTINGS', mergedSettings)
        } else {
          // Initialize with defaults if no settings exist
          const defaultSettings: AppSettings = {
            autoSaveOnClose: true,
          }
          console.log('🆕 Initializing with default settings:', defaultSettings)
          commit('SET_SETTINGS', defaultSettings)
          await localforage.setItem('settings', defaultSettings)
        }
        console.log('✅ Settings loaded successfully')
      } catch (error) {
        console.error('❌ Failed to load settings:', error)
        // Use defaults on error
        const fallbackSettings = { autoSaveOnClose: true }
        console.log('🔄 Using fallback settings:', fallbackSettings)
        commit('SET_SETTINGS', fallbackSettings)
      }
    },
    async updateSetting({ commit, state }, { key, value }: { key: keyof AppSettings; value: any }) {
      console.log('🔧 Updating setting:', { key, value, currentSettings: state.settings })
      
      // Store original state for rollback
      const originalSettings = { ...state.settings }

      try {
        commit('UPDATE_SETTING', { key, value })
        console.log('✅ Mutation completed, new settings:', state.settings)
        
        // Serialize and parse to ensure clean, cloneable object
        const cleanSettings = JSON.parse(JSON.stringify(state.settings))
        
        // Save to storage
        await localforage.setItem('settings', cleanSettings)
        console.log('✅ Settings saved to storage')
      } catch (error: any) {
        console.error('❌ Failed to update setting:', error)
        console.error('Error details:', {
          message: error.message,
          stack: error.stack,
          key,
          value
        })

        // Rollback state mutation
        commit('SET_SETTINGS', originalSettings)

        // Throw user-friendly error
        throw handleStorageError(error, 'update setting', 'settings')
      }
    },
  },
  getters: {
    // Day Summaries with O(1) indexed lookup
    getDaySummary: (state) => (date: string): DaySummary | undefined => {
      // Create an indexed Map for O(1) lookups
      const summaryMap = new Map(
        state.daySummaries.map(s => [s.date, s])
      )
      return summaryMap.get(date)
    },

    // Alternative: Get day summaries as a Map for multiple lookups
    getDaySummariesMap: (state) => {
      return new Map(
        state.daySummaries.map(s => [s.date, s])
      )
    },

    // Tasks
    getTasks: (state) => state.tasks,
    // Habits
    getHabits: (state) => state.habits,
    // Sparks
    getSparks: (state) => state.sparks,
    // Calendar Entries
    getCalendarEntries: (state) => state.calendarEntries,
    // Settings
    getSettings: (state) => state.settings || { autoSaveOnClose: true },
    // Getter to calculate total words this month
    totalWordsThisMonth: (state) => (year: number, month: number): number => {
      return state.daySummaries
        .filter(summary => {
          const date = new Date(summary.date)
          return date.getFullYear() === year && date.getMonth() === month
        })
        .reduce((total, summary) => {
          const wordCount = summary.summary ? countWordsInHtml(summary.summary) : 0
          return total + wordCount
        }, 0)
    },

    // Getter to calculate number of tags this year
    numberOfTagsThisYear: (state) => (year: number): number => {
      const tagsSet = new Set<string>()
      state.daySummaries.forEach(summary => {
        const date = new Date(summary.date)
        if (date.getFullYear() === year && summary.tags) {
          summary.tags.forEach(tag => tagsSet.add(tag))
        }
      })
      return tagsSet.size
    },

    // Getter to find the most used tag
    mostUsedTag: (state) => (year: number): string | null => {
      const tagCount: { [key: string]: number } = {}
      state.daySummaries.forEach(summary => {
        const date = new Date(summary.date)
        if (date.getFullYear() === year && summary.tags) {
          summary.tags.forEach(tag => {
            tagCount[tag] = (tagCount[tag] || 0) + 1
          })
        }
      })
      let maxCount = 0
      let mostUsed: string | null = null
      for (const tag in tagCount) {
        if (tagCount[tag] > maxCount) {
          maxCount = tagCount[tag]
          mostUsed = tag
        }
      }
      return mostUsed
    },

    // Getter to calculate average energy level
    averageEnergyLevel: (state) => (year: number, month: number): number => {
      const relevantSummaries = state.daySummaries.filter(summary => {
        const date = new Date(summary.date)
        return date.getFullYear() === year && date.getMonth() === month && summary.dailyCheck
      })
      if (relevantSummaries.length === 0) return 0
      
      const totalEnergy = relevantSummaries.reduce((total, summary) => {
        // Ensure energyLevel is a valid number between 0-10
        const energyLevel = summary.dailyCheck?.energyLevel || 0
        const validEnergy = Math.min(Math.max(Number(energyLevel) || 0, 0), 10)
        return total + validEnergy
      }, 0)
      
      const average = totalEnergy / relevantSummaries.length
      return parseFloat(average.toFixed(2))
    },
  },
  modules: {
    journal: journalModule,
  },
}

export default createStore(store)
