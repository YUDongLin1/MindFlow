import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'
import { todayLocal } from '@/utils/dateUtils'

export interface TodoItem {
  id: string
  text: string
  completed: boolean
  priority: 'low' | 'normal' | 'high'
  date: string // YYYY-MM-DD
  targetDate?: string // YYYY-MM-DD - for scheduled todos that should appear on this date
  createdAt: string
  completedAt?: string
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function todayISO(): string {
  return todayLocal()
}

const STORAGE_KEY = 'mindflow:todos'

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<TodoItem[]>([])

  // ---- getters ----
  const todayTodos = computed(() => todos.value.filter(t => t.date === todayISO()))
  const todayCompleted = computed(() => todayTodos.value.filter(t => t.completed).length)
  const todayTotal = computed(() => todayTodos.value.length)
  const completionRate = computed(() => todayTotal.value === 0 ? 0 : Math.round((todayCompleted.value / todayTotal.value) * 100))

  const todosByDate = computed(() => (date: string) => todos.value.filter(t => t.date === date))

  // Future scheduled todos (targetDate set and > today)
  const futureTodos = computed(() => {
    const today = todayISO()
    return todos.value.filter(t => t.targetDate && t.targetDate > today && !t.completed)
  })

  // Get future todos for a specific date
  const futureTodosByDate = computed(() => (date: string) =>
    todos.value.filter(t => t.targetDate === date && !t.completed)
  )

  // ---- actions ----
  async function loadTodos() {
    try {
      const raw = await localforage.getItem(STORAGE_KEY)
      if (raw && Array.isArray(raw)) {
        todos.value = raw as TodoItem[]
      }
    } catch (e) {
      console.error('[todo] load failed', e)
      todos.value = []
    }
  }

  async function persist() {
    try {
      // 深度去代理：todos.value 是 Vue reactive Proxy，IndexedDB structured clone
      // 无法克隆 Proxy（DataCloneError），必须先序列化为纯 JSON 快照再写盘。
      // TodoItem 字段均为 string/boolean，JSON 安全。
      await localforage.setItem(STORAGE_KEY, JSON.parse(JSON.stringify(todos.value)))
    } catch (e) {
      console.error('[todo] persist failed', e)
    }
  }

  async function addTodo(text: string, priority: TodoItem['priority'] = 'normal', date?: string, targetDate?: string) {
    const item: TodoItem = {
      id: uid(),
      text: text.trim(),
      completed: false,
      priority,
      date: date || todayISO(),
      targetDate,
      createdAt: new Date().toISOString(),
    }
    todos.value.unshift(item)
    await persist()
    return item
  }

  async function toggleTodo(id: string) {
    const item = todos.value.find(t => t.id === id)
    if (!item) return
    item.completed = !item.completed
    item.completedAt = item.completed ? new Date().toISOString() : undefined
    await persist()
  }

  async function deleteTodo(id: string) {
    todos.value = todos.value.filter(t => t.id !== id)
    await persist()
  }

  async function updateTodo(id: string, updates: Partial<Pick<TodoItem, 'text' | 'priority'>>) {
    const item = todos.value.find(t => t.id === id)
    if (!item) return
    if (updates.text !== undefined) item.text = updates.text
    if (updates.priority !== undefined) item.priority = updates.priority
    await persist()
  }

  // Sync scheduled todos: when today reaches targetDate, move to today's todos
  async function syncScheduledTodos() {
    const today = todayISO()
    let changed = false
    for (const todo of todos.value) {
      if (todo.targetDate && todo.targetDate <= today && !todo.completed) {
        // Move scheduled todo to today
        todo.date = today
        todo.targetDate = undefined
        changed = true
      }
    }
    if (changed) await persist()
  }

  // 清理旧数据：删除 30 天前已完成的待办
  async function cleanupOld() {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const before = todos.value.length
    todos.value = todos.value.filter(t => !t.completed || t.date >= cutoffStr)
    if (todos.value.length !== before) await persist()
  }

  return {
    todos,
    todayTodos, todayCompleted, todayTotal, completionRate,
    todosByDate, futureTodos, futureTodosByDate,
    loadTodos, addTodo, toggleTodo, deleteTodo, updateTodo, cleanupOld, syncScheduledTodos,
  }
})
