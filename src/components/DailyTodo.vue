<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Check, X, Circle, CheckCircle, AlertCircle, Calendar } from 'lucide-vue-next'
import { useTodoStore, type TodoItem } from '@/stores/todo'
import { track, EVENTS } from '@/services/analytics'

const { t } = useI18n()
const todoStore = useTodoStore()

const newTodoText = ref('')
const newTodoPriority = ref<TodoItem['priority']>('normal')
const showAdd = ref(false)

// Sync scheduled todos on mount
onMounted(async () => {
  await todoStore.loadTodos()
  await todoStore.syncScheduledTodos()
})

function priorityColor(p: TodoItem['priority']) {
  if (p === 'high') return 'text-danger'
  if (p === 'low') return 'text-ink-2/60'
  return 'text-ink-2'
}

function priorityIcon(p: TodoItem['priority']) {
  if (p === 'high') return AlertCircle
  if (p === 'low') return Circle
  return Circle
}

async function addTodo() {
  const text = newTodoText.value.trim()
  if (!text) return
  await todoStore.addTodo(text, newTodoPriority.value)
  track(EVENTS.ENTRY_CREATED, { module: 'todo', len: text.length, source: 'todo_input' })
  newTodoText.value = ''
  newTodoPriority.value = 'normal'
  showAdd.value = false
}

async function toggleTodo(id: string) {
  await todoStore.toggleTodo(id)
}

async function removeTodo(id: string) {
  await todoStore.deleteTodo(id)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    addTodo()
  }
}
</script>

<template>
  <div class="card p-4">
    <!-- 标题行 -->
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <Check :size="16" class="text-accent" />
        <h3 class="text-sm font-semibold text-ink">今日待办</h3>
        <span v-if="todoStore.todayTotal > 0" class="chip !text-[0.6rem] !py-0">
          {{ todoStore.todayCompleted }}/{{ todoStore.todayTotal }}
        </span>
      </div>
      <button
        class="btn btn-ghost !px-2 !py-1 !text-xs"
        @click="showAdd = !showAdd"
      >
        <Plus :size="14" />
      </button>
    </div>

    <!-- 进度条 -->
    <div v-if="todoStore.todayTotal > 0" class="h-1.5 bg-surface-2 rounded-full mb-3 overflow-hidden">
      <div
        class="h-full bg-accent rounded-full transition-all duration-500"
        :style="{ width: todoStore.completionRate + '%' }"
      ></div>
    </div>

    <!-- 添加输入 -->
    <div v-if="showAdd" class="flex gap-2 mb-3">
      <input
        v-model="newTodoText"
        class="input flex-1 !py-1.5 text-sm"
        placeholder="添加待办事项…"
        @keydown="onKeydown"
        autofocus
      />
      <select v-model="newTodoPriority" class="input !w-auto !py-1.5 text-sm">
        <option value="low">低</option>
        <option value="normal">中</option>
        <option value="high">高</option>
      </select>
      <button class="btn btn-primary !px-3 !py-1.5" @click="addTodo" :disabled="!newTodoText.trim()">
        <Plus :size="14" />
      </button>
    </div>

    <!-- 待办列表 -->
    <div v-if="todoStore.todayTodos.length === 0 && !showAdd" class="text-center py-4">
      <div class="text-sm text-ink-2">暂无待办事项</div>
      <div class="text-xs text-ink-2/60 mt-1">点击 + 添加</div>
    </div>

    <div class="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
      <div
        v-for="todo in todoStore.todayTodos"
        :key="todo.id"
        class="flex items-center gap-2 p-2 rounded-lg transition-colors group"
        :class="todo.completed ? 'bg-surface-2/50' : 'hover:bg-surface-2'"
      >
        <!-- 勾选 -->
        <button
          @click="toggleTodo(todo.id)"
          class="shrink-0 transition-colors"
          :class="todo.completed ? 'text-accent' : 'text-ink-2/40 hover:text-accent'"
        >
          <component :is="todo.completed ? CheckCircle : Circle" :size="18" />
        </button>

        <!-- 文字 -->
        <span
          class="flex-1 text-sm truncate transition-colors"
          :class="[
            todo.completed ? 'line-through text-ink-2/50' : 'text-ink',
            priorityColor(todo.priority)
          ]"
        >
          {{ todo.text }}
        </span>

        <!-- 优先级指示 -->
        <span
          v-if="todo.priority === 'high' && !todo.completed"
          class="w-1.5 h-1.5 rounded-full bg-danger shrink-0"
        ></span>

        <!-- 删除 -->
        <button
          @click="removeTodo(todo.id)"
          class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-ink-2/40 hover:text-danger"
        >
          <X :size="14" />
        </button>
      </div>
    </div>

    <!-- Future scheduled todos -->
    <div v-if="todoStore.futureTodos.length > 0" class="mt-3 pt-3 border-t border-line/50">
      <div class="flex items-center gap-1.5 mb-2">
        <Calendar :size="14" class="text-ink-2" />
        <span class="text-xs font-medium text-ink-2">{{ t('calendarView.scheduledTodos', '计划待办') }}</span>
      </div>
      <div class="space-y-1">
        <div
          v-for="todo in todoStore.futureTodos.slice(0, 3)"
          :key="todo.id"
          class="flex items-center gap-2 text-xs text-ink-2"
        >
          <Calendar :size="12" class="text-ink-2/60" />
          <span class="flex-1 truncate">{{ todo.text }}</span>
          <span class="chip chip-soft !text-[0.5rem] !py-0">{{ todo.targetDate }}</span>
        </div>
        <div v-if="todoStore.futureTodos.length > 3" class="text-xs text-ink-2/60 text-center">
          +{{ todoStore.futureTodos.length - 3 }} {{ t('common.more', '更多') }}
        </div>
      </div>
    </div>
  </div>
</template>
