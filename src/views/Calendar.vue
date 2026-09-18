<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronLeft, ChevronRight, Calendar, FileText, Briefcase, GraduationCap, BookOpen, Edit3, Plus, CheckCircle, Circle } from 'lucide-vue-next'
import { type JournalEntry, type ModuleType, useJournalStore, getModuleLabel } from '@/stores/journal'
import { formatLocalDate, todayLocal } from '@/utils/dateUtils'
import EntryEditModal from '@/components/EntryEditModal.vue'
import AddTodoModal from '@/components/AddTodoModal.vue'
import { useTodoStore, type TodoItem } from '@/stores/todo'

const journalStore = useJournalStore()
const todoStore = useTodoStore()
const { t } = useI18n()

// 编辑弹窗
const editingEntry = ref<JournalEntry | null>(null)
const showAddTodoModal = ref(false)
const addTodoDate = ref<string>('')

const now = new Date()
const currentYear = ref(now.getFullYear())
const currentMonth = ref(now.getMonth()) // 0-indexed
const selectedDate = ref<string | null>(null)

const entries = computed<JournalEntry[]>(() => journalStore.entries || [])

// 当月所有天的映射：date -> entries[]
const monthMap = computed(() => {
  const map: Record<string, JournalEntry[]> = {}
  entries.value.forEach(e => {
    // 只显示当月的
    const d = new Date(e.date)
    if (d.getFullYear() === currentYear.value && d.getMonth() === currentMonth.value) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
  })
  return map
})

// 日历网格
const calendarDays = computed(() => {
  const year = currentYear.value
  const month = currentMonth.value
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDayOfWeek = firstDay.getDay() // 0=Sun

  const days: { date: string; day: number; isCurrentMonth: boolean; hasEntries: boolean; entryCount: number }[] = []

  // 上月填充
  const prevMonthLast = new Date(year, month, 0)
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLast.getDate() - i
    const dt = new Date(year, month - 1, d)
    const ds = fmt(dt)
    days.push({ date: ds, day: d, isCurrentMonth: false, hasEntries: !!monthMap.value[ds]?.length, entryCount: monthMap.value[ds]?.length || 0 })
  }

  // 本月
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dt = new Date(year, month, d)
    const ds = fmt(dt)
    days.push({ date: ds, day: d, isCurrentMonth: true, hasEntries: !!monthMap.value[ds]?.length, entryCount: monthMap.value[ds]?.length || 0 })
  }

  // 下月填充
  const remaining = 7 - (days.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d)
      const ds = fmt(dt)
      days.push({ date: ds, day: d, isCurrentMonth: false, hasEntries: !!monthMap.value[ds]?.length, entryCount: monthMap.value[ds]?.length || 0 })
    }
  }

  return days
})

// 选中日期的条目
const selectedEntries = computed(() => {
  if (!selectedDate.value) return []
  return entries.value.filter(e => e.date === selectedDate.value)
})

// 本月统计
const monthStats = computed(() => {
  const monthEntries = entries.value.filter(e => {
    const d = new Date(e.date)
    return d.getFullYear() === currentYear.value && d.getMonth() === currentMonth.value
  })
  return {
    total: monthEntries.length,
    diary: monthEntries.filter(e => e.module === 'diary').length,
    work: monthEntries.filter(e => e.module === 'work').length,
    study: monthEntries.filter(e => e.module === 'study').length,
  }
})

const monthLabel = computed(() => {
  const d = new Date(currentYear.value, currentMonth.value, 1)
  return d.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })
})

function fmt(d: Date): string {
  return formatLocalDate(d)
}

function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value--
  } else {
    currentMonth.value--
  }
  selectedDate.value = null
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value++
  } else {
    currentMonth.value++
  }
  selectedDate.value = null
}

function goToday() {
  const n = new Date()
  currentYear.value = n.getFullYear()
  currentMonth.value = n.getMonth()
  selectedDate.value = fmt(n)
}

function selectDay(date: string) {
  selectedDate.value = selectedDate.value === date ? null : date
}

function showAddTodo(date: string) {
  addTodoDate.value = date
  showAddTodoModal.value = true
}

function isToday(date: string) {
  return date === todayLocal()
}

function moduleIcon(m: ModuleType) {
  if (m === 'diary') return FileText
  if (m === 'work') return Briefcase
  return GraduationCap
}

function moduleColor(m: ModuleType) {
  if (m === 'diary') return 'text-accent'
  if (m === 'work') return 'text-ember'
  return 'bg-accent-soft text-accent'
}

const weekDays = computed(() => [
  t('calendar.weekDays.sun'),
  t('calendar.weekDays.mon'),
  t('calendar.weekDays.tue'),
  t('calendar.weekDays.wed'),
  t('calendar.weekDays.thu'),
  t('calendar.weekDays.fri'),
  t('calendar.weekDays.sat'),
])
</script>

<template>
  <div>
    <div class="p-6 max-w-5xl mx-auto">
    <!-- 标题 -->
    <div class="mb-6">
      <h1 class="flex items-center gap-2">
        <Calendar :size="24" class="text-accent" />
        {{ t('calendarView.title') }}
      </h1>
      <p class="text-ink-2 text-sm mt-1">{{ t('calendarView.subtitle') }}</p>
    </div>

    <div class="flex gap-6 flex-col lg:flex-row">
      <!-- 日历主体 -->
      <div class="flex-1">
        <!-- 月份导航 -->
        <div class="flex items-center justify-between mb-4">
          <button class="btn btn-ghost !px-2 !py-1.5" @click="prevMonth" :aria-label="t('calendarView.prevMonth')">
            <ChevronLeft :size="20" />
          </button>
          <div class="flex items-center gap-3">
            <h2 class="text-lg font-semibold">{{ monthLabel }}</h2>
            <button class="chip cursor-pointer hover:opacity-80" @click="goToday">{{ t('calendarView.today') }}</button>
          </div>
          <button class="btn btn-ghost !px-2 !py-1.5" @click="nextMonth" :aria-label="t('calendarView.nextMonth')">
            <ChevronRight :size="20" />
          </button>
        </div>

        <!-- 星期表头 -->
        <div class="grid grid-cols-7 gap-1 mb-2">
          <div v-for="wd in weekDays" :key="wd"
            class="text-center text-[0.75rem] font-medium text-ink-2 py-1">
            {{ wd }}
          </div>
        </div>

        <!-- 日期网格 -->
        <div class="grid grid-cols-7 gap-1">
          <button
            v-for="day in calendarDays"
            :key="day.date"
            @click="selectDay(day.date)"
            class="relative flex flex-col items-center justify-center h-16 rounded-xl transition-all cursor-pointer border border-transparent"
            :class="{
              'text-ink': day.isCurrentMonth,
              'text-ink-2/40': !day.isCurrentMonth,
              'bg-accent-soft border-accent/30': selectedDate === day.date,
              'hover:bg-surface-2': selectedDate !== day.date,
              'ring-2 ring-accent/20': isToday(day.date),
            }"
          >
            <span class="text-sm font-medium" :class="{ 'text-accent font-bold': isToday(day.date) }">{{ day.day }}</span>
            <!-- 记录指示点 -->
            <div v-if="day.hasEntries" class="flex gap-0.5 mt-0.5">
              <span
                v-for="i in Math.min(day.entryCount, 3)"
                :key="i"
                class="w-1.5 h-1.5 rounded-full"
                :class="i === 1 ? 'bg-accent' : i === 2 ? 'bg-ember' : 'bg-ink-2/40'"
              ></span>
              <span v-if="day.entryCount > 3" class="text-[0.55rem] text-ink-2 ml-0.5">+</span>
            </div>
          </button>
        </div>
      </div>

      <!-- 侧栏：选中日详情 + 月统计 -->
      <div class="w-full lg:w-72 shrink-0 space-y-4">
        <!-- 月统计 -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold mb-3 text-ink-2">{{ t('calendarView.monthStats') }}</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="text-center">
              <div class="text-2xl font-bold text-accent">{{ monthStats.total }}</div>
              <div class="text-xs text-ink-2">{{ t('calendarView.totalEntries') }}</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-ink">{{ monthStats.diary }}</div>
              <div class="text-xs text-ink-2">{{ t('calendarView.diaryCount') }}</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-ember">{{ monthStats.work }}</div>
              <div class="text-xs text-ink-2">{{ t('calendarView.workCount') }}</div>
            </div>
            <div class="text-center">
              <div class="text-2xl font-bold text-accent">{{ monthStats.study }}</div>
              <div class="text-xs text-ink-2">{{ t('calendarView.studyCount') }}</div>
            </div>
          </div>
        </div>

        <!-- 选中日条目 -->
        <div class="card p-4">
          <h3 class="text-sm font-semibold mb-3">
            {{ selectedDate || t('calendarView.title') }}
          </h3>

          <div v-if="!selectedDate" class="text-sm text-ink-2 text-center py-6">
            ← {{ t('calendarView.noRecords') }}
          </div>

          <div v-else-if="selectedEntries.length === 0" class="text-sm text-ink-2 text-center py-6">
            {{ t('calendarView.noRecords') }}
          </div>

          <div v-else class="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            <div
              v-for="entry in selectedEntries"
              :key="entry.id"
              class="p-3 rounded-lg bg-surface-2 border border-line/50"
            >
              <div class="flex items-center gap-2 mb-1.5">
                <component :is="moduleIcon(entry.module)" :size="14" :class="moduleColor(entry.module)" />
                <span class="text-xs font-medium text-ink-2">
                  {{ entry.module === 'diary' ? t('calendarView.diary') : entry.module === 'work' ? t('calendarView.work') : entry.module === 'study' ? t('calendarView.study') : getModuleLabel(entry.module, journalStore.customModules) }}
                </span>
                <span v-if="entry.mood" class="chip chip-soft !text-[0.65rem] !py-0.5">{{ entry.mood }}</span>
              </div>
              <!-- 显示 prompts -->
              <div v-for="p in entry.prompts.filter(p => p.value)" :key="p.id" class="mb-1.5">
                <div class="text-[0.7rem] text-ink-2 font-medium mb-0.5">{{ p.label }}</div>
                <div class="text-sm text-ink leading-relaxed">{{ p.value.slice(0, 150) }}{{ p.value.length > 150 ? '…' : '' }}</div>
              </div>
              <!-- 标签 -->
              <div v-if="entry.tags.length" class="flex flex-wrap gap-1 mt-2">
                <span v-for="tag in entry.tags" :key="tag" class="chip chip-soft !text-[0.6rem] !py-0">{{ tag }}</span>
              </div>
              <!-- AI 复盘标识 + 编辑按钮 -->
              <div class="flex items-center justify-between mt-2">
                <div v-if="entry.review?.status === 'adopted'" class="flex items-center gap-1 text-[0.65rem] text-accent">
                  <BookOpen :size="12" />
                  {{ t('calendarView.aiReview') }}
                </div>
                <div v-else></div>
                <button
                  class="flex items-center gap-1 text-[0.65rem] text-ink-2 hover:text-accent transition-colors"
                  @click="editingEntry = entry"
                >
                  <Edit3 :size="12" />
                  编辑
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 选中日待办 -->
        <div v-if="selectedDate" class="card p-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-ink-2">{{ t('common.todo', '待办') }}</h3>
            <button
              class="btn btn-ghost !px-2 !py-1 !text-xs"
              @click="showAddTodo(selectedDate!)"
              :aria-label="t('common.add', '添加') + ' ' + t('common.todo', '待办')"
            >
              <Plus :size="14" />
            </button>
          </div>

          <!-- Today's active todos -->
          <div v-if="isToday(selectedDate) && todoStore.todayTodos.length > 0" class="mb-3">
            <div class="text-xs text-accent font-medium mb-2">{{ t('common.today', '今日') }} {{ t('common.todo', '待办') }}</div>
            <div class="space-y-1.5">
              <div
                v-for="todo in todoStore.todayTodos"
                :key="todo.id"
                class="flex items-center gap-2 text-sm"
              >
                <button
                  @click="todoStore.toggleTodo(todo.id)"
                  class="shrink-0 transition-colors"
                  :class="todo.completed ? 'text-accent' : 'text-ink-2/40 hover:text-accent'"
                >
                  <component :is="todo.completed ? CheckCircle : Circle" :size="16" />
                </button>
                <span
                  class="flex-1 truncate"
                  :class="todo.completed ? 'line-through text-ink-2/50' : 'text-ink'"
                >{{ todo.text }}</span>
              </div>
            </div>
          </div>

          <!-- Scheduled todos for future dates -->
          <div v-if="!isToday(selectedDate) && todoStore.futureTodosByDate(selectedDate).length > 0" class="mb-3">
            <div class="text-xs text-ember font-medium mb-2">{{ t('calendarView.scheduledTodos', '计划待办') }}</div>
            <div class="space-y-1.5">
              <div
                v-for="todo in todoStore.futureTodosByDate(selectedDate)"
                :key="todo.id"
                class="flex items-center gap-2 text-sm"
              >
                <Calendar :size="14" class="text-ember shrink-0" />
                <span class="flex-1 truncate text-ink">{{ todo.text }}</span>
                <span class="chip chip-soft !text-[0.55rem] !py-0">{{ todo.priority }}</span>
              </div>
            </div>
          </div>

          <!-- Regular todos for this date -->
          <div v-if="todoStore.todosByDate(selectedDate).length === 0 && todoStore.futureTodosByDate(selectedDate).length === 0" class="text-sm text-ink-2 text-center py-4">
            {{ t('calendarView.noTodos', '暂无待办事项') }}
          </div>
          <div v-else-if="!isToday(selectedDate)" class="space-y-1.5">
            <div
              v-for="todo in todoStore.todosByDate(selectedDate)"
              :key="todo.id"
              class="flex items-center gap-2 text-sm"
            >
              <button
                @click="todoStore.toggleTodo(todo.id)"
                class="shrink-0 transition-colors"
                :class="todo.completed ? 'text-accent' : 'text-ink-2/40 hover:text-accent'"
              >
                <component :is="todo.completed ? CheckCircle : Circle" :size="16" />
              </button>
              <span
                class="flex-1 truncate"
                :class="todo.completed ? 'line-through text-ink-2/50' : 'text-ink'"
              >{{ todo.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>

    <!-- 编辑弹窗 -->
    <EntryEditModal
      v-if="editingEntry"
      :entry="editingEntry"
      :visible="!!editingEntry"
      @close="editingEntry = null"
      @saved="editingEntry = null"
    />

    <!-- 添加待办弹窗 -->
    <AddTodoModal
      :visible="showAddTodoModal"
      :scheduledDate="addTodoDate"
      @close="showAddTodoModal = false"
      @added="showAddTodoModal = false"
    />
  </div>
</template>
