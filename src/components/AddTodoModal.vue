<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, Plus, Calendar } from 'lucide-vue-next'
import { useTodoStore, type TodoItem } from '@/stores/todo'
import { track, EVENTS } from '@/services/analytics'

const props = defineProps<{
  visible: boolean
  /** If set, the todo will be scheduled for this date */
  scheduledDate?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'added'): void
}>()

const { t } = useI18n()
const todoStore = useTodoStore()

const newTodoText = ref('')
const newTodoPriority = ref<TodoItem['priority']>('normal')
const targetDate = ref(props.scheduledDate || '')

async function addTodo() {
  const text = newTodoText.value.trim()
  if (!text) return

  const todayStr = new Date().toISOString().slice(0, 10)
  const isScheduled = targetDate.value && targetDate.value !== todayStr
  await todoStore.addTodo(
    text,
    newTodoPriority.value,
    isScheduled ? todayStr : undefined,
    isScheduled ? targetDate.value : undefined
  )

  track(EVENTS.ENTRY_CREATED, { module: 'todo', len: text.length, source: 'add_todo_modal' })
  newTodoText.value = ''
  newTodoPriority.value = 'normal'
  targetDate.value = ''
  emit('added')
  emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    addTodo()
  }
}

function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="close"
      >
        <div class="card w-full max-w-md mx-4 p-6 shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-ink flex items-center gap-2">
              <Plus :size="20" class="text-accent" />
              {{ scheduledDate ? t('calendarView.addScheduledTodo', '添加计划待办') : t('common.add', '添加') + ' ' + t('common.todo', '待办') }}
            </h3>
            <button
              class="btn btn-ghost !px-2 !py-2"
              @click="close"
              :aria-label="t('common.close', '关闭')"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Todo text input -->
          <div class="mb-4">
            <input
              v-model="newTodoText"
              class="input w-full"
              :placeholder="t('daySummary.editorPlaceholder', '输入待办内容…')"
              @keydown="onKeydown"
              autofocus
            />
          </div>

          <!-- Priority selection -->
          <div class="flex items-center gap-3 mb-4">
            <span class="text-sm text-ink-2">{{ t('home.priority', '优先级') }}:</span>
            <div class="flex gap-2">
              <button
                v-for="p in (['low', 'normal', 'high'] as const)"
                :key="p"
                class="chip cursor-pointer transition-all"
                :class="{
                  'chip-soft': newTodoPriority !== p,
                  'bg-accent text-white': newTodoPriority === p,
                  'bg-danger/10 text-danger': p === 'high' && newTodoPriority === p,
                  'bg-ink-2/10 text-ink-2': p === 'low' && newTodoPriority === p,
                }"
                @click="newTodoPriority = p"
              >
                {{ p === 'low' ? t('priority.low', '低') : p === 'high' ? t('priority.high', '高') : t('priority.normal', '中') }}
              </button>
            </div>
          </div>

          <!-- Target date (for scheduling) -->
          <div class="mb-5">
            <div class="flex items-center gap-2 mb-2">
              <Calendar :size="16" class="text-ink-2" />
              <span class="text-sm text-ink-2">{{ t('calendarView.targetDate', '计划日期') }}:</span>
            </div>
            <input
              v-model="targetDate"
              type="date"
              class="input w-full"
              :min="new Date().toISOString().slice(0, 10)"
            />
            <p class="text-xs text-ink-2/60 mt-1">
              {{ t('calendarView.targetDateHint', '选择日期后，待办将在该日自动出现在今日待办中') }}
            </p>
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-3">
            <button class="btn btn-ghost" @click="close">
              {{ t('common.cancel', '取消') }}
            </button>
            <button
              class="btn btn-primary"
              @click="addTodo"
              :disabled="!newTodoText.trim()"
            >
              <Plus :size="16" />
              {{ t('common.add', '添加') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
