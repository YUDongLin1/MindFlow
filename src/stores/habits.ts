import { defineStore } from 'pinia'
import { ref } from 'vue'
import localforage from 'localforage'
import type { Habit, HabitStatus } from '@/store/types'
import { handleStorageError } from '@/utils/storageErrorHandler'

export const useHabitsStore = defineStore('habits', () => {
  const habits = ref<Habit[]>([])

  async function loadHabits() {
    try {
      const data = await localforage.getItem('habits')
      if (!data || !Array.isArray(data)) { habits.value = []; return }
      habits.value = data.filter((item: any) =>
        typeof item === 'object' && item !== null &&
        typeof item.id === 'number' && typeof item.name === 'string' &&
        Array.isArray(item.statuses)
      ) as Habit[]
    } catch (e) {
      console.error('[habits] load failed', e)
      habits.value = []
    }
  }

  async function persist() {
    await localforage.setItem('habits', JSON.parse(JSON.stringify(habits.value)))
  }

  async function addHabit(habit: Habit) {
    const original = [...habits.value]
    try {
      habits.value.push(habit)
      await persist()
    } catch (e: any) {
      habits.value = original
      throw handleStorageError(e, 'add habit', 'habits')
    }
  }

  async function updateHabit(habit: Habit) {
    const original = [...habits.value]
    try {
      const idx = habits.value.findIndex(h => h.id === habit.id)
      if (idx !== -1) habits.value[idx] = habit
      await persist()
    } catch (e: any) {
      habits.value = original
      throw handleStorageError(e, 'update habit', 'habits')
    }
  }

  async function updateHabitStatus(payload: { habitId: number; date: string; status: HabitStatus['status'] | null }) {
    const original = [...habits.value]
    try {
      const habit = habits.value.find(h => h.id === payload.habitId)
      if (!habit) return
      const existingIdx = habit.statuses.findIndex(s => s.date === payload.date)
      if (payload.status === null) {
        if (existingIdx !== -1) habit.statuses.splice(existingIdx, 1)
      } else {
        if (existingIdx !== -1) habit.statuses[existingIdx].status = payload.status
        else habit.statuses.push({ date: payload.date, status: payload.status })
      }
      await persist()
    } catch (e: any) {
      habits.value = original
      throw handleStorageError(e, 'update habit status', 'habits')
    }
  }

  return { habits, loadHabits, addHabit, updateHabit, updateHabitStatus }
})
