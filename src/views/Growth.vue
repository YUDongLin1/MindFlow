<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { FileText, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import WeeklyReportModal from '@/components/WeeklyReportModal.vue'
import { generateWeeklyReport, type WeeklyReportOutput } from '@/services/weeklyReport'
import { track, EVENTS } from '@/services/analytics'
import { type JournalEntry, type ModuleType, useJournalStore, getModuleLabel } from '@/stores/journal'
import { useTodoStore } from '@/stores/todo'
import { formatLocalDate, mondayLocal } from '@/utils/dateUtils'

const journalStore = useJournalStore()
const todoStore = useTodoStore()

const allEntries = computed(() => journalStore.entries as JournalEntry[])
const weekEntries = computed(() => journalStore.entriesThisWeek as JournalEntry[])

const adoptedThisWeek = computed(
  () => weekEntries.value.filter(e => e.review?.status === 'adopted').length
)
const totalEntries = computed(() => allEntries.value.length)

const completion = computed(() => {
  if (weekEntries.value.length === 0) return 0
  return adoptedThisWeek.value / weekEntries.value.length
})

// 本周一至周日的记录分布（SVG 柱状图，无外部依赖）
const weekDays = computed(() => {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  const labels = ['一', '二', '三', '四', '五', '六', '日']
  const arr: { label: string; date: string; count: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const iso = formatLocalDate(d)
    const count = allEntries.value.filter(e => e.date === iso).length
    arr.push({ label: labels[i], date: iso, count })
  }
  return arr
})
const maxCount = computed(() => Math.max(1, ...weekDays.value.map(d => d.count)))

const ringCirc = 2 * Math.PI * 42
const ringOffset = computed(() => ringCirc * (1 - completion.value))

// ---- 工作周报 ----
const weekStart = computed(() => formatLocalDate(mondayLocal()))
const workEntriesThisWeek = computed(() => weekEntries.value.filter(e => e.module === 'work'))
const reportVisible = ref(false)
const reportData = ref<WeeklyReportOutput | null>(null)

function generateReport() {
  reportData.value = generateWeeklyReport({
    entries: workEntriesThisWeek.value,
    weekStart: weekStart.value,
  })
  reportVisible.value = true
  track(EVENTS.WEEKLY_REVIEW_GENERATED, { entries: workEntriesThisWeek.value.length, weekStart: weekStart.value })
}

// ---- 模块分布（内置 + 自定义模块动态合并） ----
const moduleKeys = computed<ModuleType[]>(() => [
  'diary', 'work', 'study',
  ...journalStore.customModules.map(m => m.id),
])

const moduleDist = computed(() => {
  const dist: Record<string, number> = {}
  for (const key of moduleKeys.value) dist[key] = 0
  for (const e of weekEntries.value) {
    dist[e.module] = (dist[e.module] || 0) + 1
  }
  return dist
})

// ---- 待办统计 ----
const weekTodos = computed(() => {
  const monday = mondayLocal()
  return todoStore.todos.filter(t => new Date(t.date) >= monday)
})
const weekTodoCompleted = computed(() => weekTodos.value.filter(t => t.completed).length)
const weekTodoTotal = computed(() => weekTodos.value.length)
const weekTodoRate = computed(() => weekTodoTotal.value === 0 ? 0 : Math.round((weekTodoCompleted.value / weekTodoTotal.value) * 100))

const moduleMaxCount = computed(() => Math.max(1, ...Object.values(moduleDist.value)))

const moduleLabels: Record<ModuleType, string> = {
  diary: '日记', work: '工作', study: '学习',
}
function moduleLabel(key: ModuleType): string {
  return moduleLabels[key] || getModuleLabel(key, journalStore.customModules)
}

// ---- 标签 Top 5 ----
const topTags = computed(() => {
  const tagCounts = new Map<string, number>()
  for (const e of weekEntries.value) {
    for (const t of e.tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
    }
  }
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }))
})

// ---- 叙事 ----
const weeklyNarrative = computed(() => {
  const total = weekEntries.value.length
  if (total === 0) return '这周还没有记录。不着急，随时可以开始。'
  const adopted = adoptedThisWeek.value
  const parts: string[] = [`本周记录了 ${total} 条`]
  const modParts: string[] = []
  for (const key of moduleKeys.value) {
    const count = moduleDist.value[key] || 0
    if (count > 0) modParts.push(`${moduleLabel(key)} ${count} 条`)
  }
  if (modParts.length > 0) parts.push(`其中 ${modParts.join('、')}`)
  if (adopted > 0) parts.push(`采纳复盘 ${adopted} 条`)
  return parts.join('，') + '。记录本身就有价值。'
})

// ===================================================================
// 月回顾
// ===================================================================
const viewMode = ref<'week' | 'month'>('week')

// 当前查看的月份（默认本月）
const now = new Date()
const viewYear = ref(now.getFullYear())
const viewMonth = ref(now.getMonth()) // 0-indexed

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
function goThisMonth() {
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
}

const monthLabel = computed(() => {
  return `${viewYear.value} 年 ${viewMonth.value + 1} 月`
})

const monthEntries = computed(() => {
  return allEntries.value.filter(e => {
    const d = new Date(e.date)
    return d.getFullYear() === viewYear.value && d.getMonth() === viewMonth.value
  })
})

// 本月天数
const daysInMonth = computed(() => new Date(viewYear.value, viewMonth.value + 1, 0).getDate())

// 本月每日记录分布
const monthDayDistribution = computed(() => {
  const days: { day: number; count: number }[] = []
  for (let d = 1; d <= daysInMonth.value; d++) {
    const iso = `${viewYear.value}-${String(viewMonth.value + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const count = allEntries.value.filter(e => e.date === iso).length
    days.push({ day: d, count })
  }
  return days
})
const monthMaxDayCount = computed(() => Math.max(1, ...monthDayDistribution.value.map(d => d.count)))

// 本月模块分布
const monthModuleDist = computed(() => {
  const dist: Record<string, number> = {}
  for (const key of moduleKeys.value) dist[key] = 0
  for (const e of monthEntries.value) {
    dist[e.module] = (dist[e.module] || 0) + 1
  }
  return dist
})
const monthModuleMaxCount = computed(() => Math.max(1, ...Object.values(monthModuleDist.value)))

// 本月统计
const monthTotalWords = computed(() => {
  let total = 0
  for (const e of monthEntries.value) {
    for (const p of e.prompts) {
      if (p.value) {
        const chinese = (p.value.match(/[\u4e00-\u9fff]/g) || []).length
        const english = p.value.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(w => w.length > 0).length
        total += chinese + english
      }
    }
  }
  return total
})

const monthAdopted = computed(() => monthEntries.value.filter(e => e.review?.status === 'adopted').length)

const monthActiveDays = computed(() => {
  const days = new Set(monthEntries.value.map(e => e.date))
  return days.size
})

const monthTopTags = computed(() => {
  const tagCounts = new Map<string, number>()
  for (const e of monthEntries.value) {
    for (const t of e.tags) {
      tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
    }
  }
  return Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }))
})

// 本月待办统计
const monthTodos = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  return todoStore.todos.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === y && d.getMonth() === m
  })
})
const monthTodoCompleted = computed(() => monthTodos.value.filter(t => t.completed).length)
const monthTodoTotal = computed(() => monthTodos.value.length)
const monthTodoRate = computed(() => monthTodoTotal.value === 0 ? 0 : Math.round((monthTodoCompleted.value / monthTodoTotal.value) * 100))

// 本月叙事
const monthNarrative = computed(() => {
  const total = monthEntries.value.length
  if (total === 0) return '本月还没有记录。不着急，随时可以开始。'
  const parts: string[] = [`本月共记录 ${total} 条，活跃 ${monthActiveDays.value} 天`]
  const modParts: string[] = []
  for (const key of moduleKeys.value) {
    const count = monthModuleDist.value[key] || 0
    if (count > 0) modParts.push(`${moduleLabel(key)} ${count} 条`)
  }
  if (modParts.length > 0) parts.push(`其中 ${modParts.join('、')}`)
  parts.push(`共 ${monthTotalWords.value} 字`)
  if (monthAdopted.value > 0) parts.push(`采纳复盘 ${monthAdopted.value} 条`)
  if (monthTopTags.value.length > 0) parts.push(`高频标签：${monthTopTags.value.slice(0, 3).map(t => '#' + t.tag).join('、')}`)
  return parts.join('，') + '。'
})

// ---- 埋点 ----
onMounted(() => {
  track(EVENTS.WEEKLY_REVIEW_VIEWED, {})
})
</script>

<template>
  <section class="max-w-4xl mx-auto px-6 py-8 animate-fade-up">
    <header class="mb-6">
      <div class="flex items-center gap-2 mb-2">
        <p class="text-ink-2 text-sm">成长回顾</p>
        <!-- 周/月切换 -->
        <div class="ml-auto flex items-center gap-1 bg-surface-2 rounded-xl p-1">
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :class="viewMode === 'week' ? 'bg-accent text-white shadow-sm' : 'text-ink-2 hover:text-ink'"
            @click="viewMode = 'week'"
          >周回顾</button>
          <button
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            :class="viewMode === 'month' ? 'bg-accent text-white shadow-sm' : 'text-ink-2 hover:text-ink'"
            @click="viewMode = 'month'"
          >月回顾</button>
        </div>
      </div>
      <h1 class="text-ink">{{ viewMode === 'week' ? '这周的你' : '这个月的你' }}</h1>
      <p class="text-ink-2 text-sm mt-1">不比连续打卡，只看你留下了什么。</p>
    </header>

    <!-- ==================== 周回顾 ==================== -->
    <template v-if="viewMode === 'week'">
      <!-- 周回顾卡 -->
      <div class="card p-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
        <div class="relative w-[120px] h-[120px] mx-auto">
          <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--line))" stroke-width="9" />
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgb(var(--accent))" stroke-width="9" stroke-linecap="round" :stroke-dasharray="ringCirc" :stroke-dashoffset="ringOffset" />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-2xl font-bold text-ink">{{ Math.round(completion * 100) }}%</span>
            <span class="text-[0.66rem] text-ink-2">复盘完成度</span>
          </div>
        </div>
        <div>
          <p class="text-ink text-lg font-medium">本周你留下了 <span class="text-accent font-bold">{{ weekEntries.length }}</span> 条记录。</p>
          <p class="text-ink-2 text-sm mt-1">其中 {{ adoptedThisWeek }} 条完成了 AI 复盘采纳。慢慢来，记录本身就有价值。</p>
          <div class="grid grid-cols-3 gap-3 mt-4">
            <div class="card-soft p-3 text-center">
              <div class="text-xl font-bold text-ink">{{ weekEntries.length }}</div>
              <div class="text-[0.7rem] text-ink-2">本周记录</div>
            </div>
            <div class="card-soft p-3 text-center">
              <div class="text-xl font-bold text-ink">{{ adoptedThisWeek }}</div>
              <div class="text-[0.7rem] text-ink-2">复盘采纳</div>
            </div>
            <div class="card-soft p-3 text-center">
              <div class="text-xl font-bold text-ink">{{ totalEntries }}</div>
              <div class="text-[0.7rem] text-ink-2">累计卡片</div>
            </div>
          </div>
        </div>
      </div>

      <!-- 本周叙事 -->
      <div class="card p-5 mt-5">
        <h3 class="text-ink mb-2">本周叙事</h3>
        <p class="text-sm text-ink-2 leading-relaxed">{{ weeklyNarrative }}</p>
      </div>

      <!-- 分布图 -->
      <div class="card p-6 mt-5">
        <h3 class="text-ink mb-4">本周记录分布</h3>
        <div class="flex items-end justify-between gap-2 h-44 px-1">
          <div v-for="d in weekDays" :key="d.label" class="flex-1 flex flex-col items-center justify-end h-full group">
            <span class="text-[0.7rem] text-ink-2 mb-1">{{ d.count || '' }}</span>
            <div class="w-full rounded-t-lg transition-all" :class="d.count ? 'bg-accent' : 'bg-line/60'" :style="{ height: (d.count / maxCount * 100) + '%', minHeight: d.count ? '6px' : '3px' }"></div>
            <span class="text-[0.72rem] text-ink-2 mt-2">周{{ d.label }}</span>
          </div>
        </div>
      </div>

      <!-- 模块分布 + 标签 Top -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <div class="card p-5">
          <h3 class="text-ink mb-4">模块分布</h3>
          <div class="space-y-3">
            <div v-for="key in moduleKeys" :key="key" class="flex items-center gap-3">
              <span class="text-sm text-ink-2 w-10 shrink-0 truncate" :title="moduleLabel(key)">{{ moduleLabel(key) }}</span>
              <div class="flex-1 h-7 rounded-lg bg-surface-2 overflow-hidden">
                <div class="h-full rounded-lg transition-all flex items-center justify-end pr-2" :class="moduleDist[key] > 0 ? 'bg-accent-soft' : ''" :style="{ width: (moduleDist[key] / moduleMaxCount * 100) + '%' }">
                  <span v-if="moduleDist[key] > 0" class="text-[0.72rem] font-semibold text-accent">{{ moduleDist[key] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="card p-5">
          <h3 class="text-ink mb-4">本周标签 Top 5</h3>
          <div v-if="topTags.length === 0" class="text-sm text-ink-2">本周还没有标签。</div>
          <div v-else class="flex flex-wrap gap-2">
            <div v-for="item in topTags" :key="item.tag" class="chip">#{{ item.tag }} <span class="text-[0.65rem] opacity-70 ml-1">{{ item.count }}</span></div>
          </div>
        </div>
      </div>

      <!-- 工作周报 CTA -->
      <div class="card p-5 mt-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 class="text-ink mb-1">工作周报</h3>
          <p class="text-sm text-ink-2">将本周工作日志自动整理为 Markdown 周报，可复制或下载带走。</p>
        </div>
        <button class="btn btn-primary" @click="generateReport">
          <FileText :size="16" /> 生成本周工作周报
        </button>
      </div>
    </template>

    <!-- ==================== 月回顾 ==================== -->
    <template v-if="viewMode === 'month'">
      <!-- 月份导航 -->
      <div class="flex items-center justify-between mb-4">
        <button class="btn btn-ghost !px-2 !py-1.5" @click="prevMonth">
          <ChevronLeft :size="20" />
        </button>
        <div class="flex items-center gap-3">
          <h2 class="text-lg font-semibold">{{ monthLabel }}</h2>
          <button class="chip cursor-pointer hover:opacity-80" @click="goThisMonth">本月</button>
        </div>
        <button class="btn btn-ghost !px-2 !py-1.5" @click="nextMonth">
          <ChevronRight :size="20" />
        </button>
      </div>

      <!-- 月统计卡片 -->
      <div class="card p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-3xl font-bold text-accent">{{ monthEntries.length }}</div>
          <div class="text-xs text-ink-2 mt-1">本月记录</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-ink">{{ monthActiveDays }}</div>
          <div class="text-xs text-ink-2 mt-1">活跃天数</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-ember">{{ monthTotalWords }}</div>
          <div class="text-xs text-ink-2 mt-1">总字数</div>
        </div>
        <div class="text-center">
          <div class="text-3xl font-bold text-accent">{{ monthAdopted }}</div>
          <div class="text-xs text-ink-2 mt-1">复盘采纳</div>
        </div>
      </div>

      <!-- 月叙事 -->
      <div class="card p-5 mt-5">
        <h3 class="text-ink mb-2">本月叙事</h3>
        <p class="text-sm text-ink-2 leading-relaxed">{{ monthNarrative }}</p>
      </div>

      <!-- 每日记录分布（热力条） -->
      <div class="card p-5 mt-5">
        <h3 class="text-ink mb-4">每日记录分布</h3>
        <div class="flex flex-wrap gap-1">
          <div
            v-for="d in monthDayDistribution"
            :key="d.day"
            class="w-8 h-8 rounded-md flex items-center justify-center text-[0.6rem] font-medium transition-colors"
            :class="d.count > 0 ? 'bg-accent text-white' : 'bg-surface-2 text-ink-2/40'"
            :style="d.count > 0 ? { opacity: 0.3 + (d.count / monthMaxDayCount) * 0.7 } : {}"
            :title="`${d.day}日：${d.count} 条`"
          >
            {{ d.day }}
          </div>
        </div>
        <div class="flex items-center gap-2 mt-3 text-xs text-ink-2">
          <span>少</span>
          <div class="flex gap-0.5">
            <div class="w-4 h-4 rounded-sm bg-accent" style="opacity: 0.3"></div>
            <div class="w-4 h-4 rounded-sm bg-accent" style="opacity: 0.6"></div>
            <div class="w-4 h-4 rounded-sm bg-accent" style="opacity: 1"></div>
          </div>
          <span>多</span>
        </div>
      </div>

      <!-- 模块分布 + 标签 Top + 待办 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <!-- 模块分布 -->
        <div class="card p-5">
          <h3 class="text-ink mb-4">模块分布</h3>
          <div class="space-y-3">
            <div v-for="key in moduleKeys" :key="key" class="flex items-center gap-3">
              <span class="text-sm text-ink-2 w-10 shrink-0 truncate" :title="moduleLabel(key)">{{ moduleLabel(key) }}</span>
              <div class="flex-1 h-7 rounded-lg bg-surface-2 overflow-hidden">
                <div class="h-full rounded-lg transition-all flex items-center justify-end pr-2" :class="monthModuleDist[key] > 0 ? 'bg-accent-soft' : ''" :style="{ width: (monthModuleDist[key] / monthModuleMaxCount * 100) + '%' }">
                  <span v-if="monthModuleDist[key] > 0" class="text-[0.72rem] font-semibold text-accent">{{ monthModuleDist[key] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 标签 Top 10 -->
        <div class="card p-5">
          <h3 class="text-ink mb-4">本月标签 Top 10</h3>
          <div v-if="monthTopTags.length === 0" class="text-sm text-ink-2">本月还没有标签。</div>
          <div v-else class="flex flex-wrap gap-2">
            <div v-for="item in monthTopTags" :key="item.tag" class="chip">#{{ item.tag }} <span class="text-[0.65rem] opacity-70 ml-1">{{ item.count }}</span></div>
          </div>
        </div>
      </div>

      <!-- 月待办统计 -->
      <div class="card p-5 mt-5">
        <h3 class="text-ink mb-4">本月待办完成情况</h3>
        <div class="grid grid-cols-3 gap-4">
          <div class="text-center">
            <div class="text-2xl font-bold text-ink">{{ monthTodoTotal }}</div>
            <div class="text-xs text-ink-2 mt-1">总待办</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-accent">{{ monthTodoCompleted }}</div>
            <div class="text-xs text-ink-2 mt-1">已完成</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-bold text-ember">{{ monthTodoRate }}%</div>
            <div class="text-xs text-ink-2 mt-1">完成率</div>
          </div>
        </div>
        <!-- 进度条 -->
        <div v-if="monthTodoTotal > 0" class="mt-4 h-3 bg-surface-2 rounded-full overflow-hidden">
          <div class="h-full bg-accent rounded-full transition-all duration-500" :style="{ width: monthTodoRate + '%' }"></div>
        </div>
      </div>
    </template>

    <p class="text-center text-ink-2 text-sm mt-6">
      想看更久的趋势？知识库里每一条都带着日期，随时可回溯。
    </p>

    <!-- 周报弹窗 -->
    <WeeklyReportModal :report="reportData" :visible="reportVisible" @close="reportVisible = false" />
  </section>
</template>
