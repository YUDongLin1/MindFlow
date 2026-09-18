<script setup lang="ts">
import { ref, reactive, computed, watch, onActivated, onDeactivated } from 'vue'
import { Plus, Tag, ChevronDown, MessageSquare, PenLine, Edit3, Image, X } from 'lucide-vue-next'
import AIReviewMirror from '@/components/AIReviewMirror.vue'
import DailyTodo from '@/components/DailyTodo.vue'
import DailySummaryCard from '@/components/DailySummaryCard.vue'
import UsageTimeCard from '@/components/UsageTimeCard.vue'
import MetaBar from '@/components/MetaBar.vue'
import RichEditor from '@/components/RichEditor.vue'
import SmartTagSuggest from '@/components/SmartTagSuggest.vue'
import VoiceInput from '@/components/VoiceInput.vue'
import EntryEditModal from '@/components/EntryEditModal.vue'
import DesktopPet from '@/components/DesktopPet.vue'
import { getCurrentMeta, type CurrentMeta } from '@/services/metaService'
import {
  MODULE_PROMPTS,
  MODULE_LABELS,
  type ModuleType,
  type JournalPrompt,
  type JournalEntry,
  type EntryAttachment,
  useJournalStore,
  getModulePrompts,
  getModuleLabel,
} from '@/stores/journal'
import { track, EVENTS } from '@/services/analytics'
import { todayLocal } from '@/utils/dateUtils'

const journalStore = useJournalStore()

const module = ref<ModuleType>('diary')
const form = reactive<Record<string, string>>({})
const mood = ref('')
const tagsInput = ref('')
const savedFlash = ref(false)
const selectedId = ref<string | null>(null)
const richMode = ref(false) // 富文本模式切换
const editingEntry = ref<JournalEntry | null>(null)
const attachments = ref<EntryAttachment[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

// 图片附件处理
function onFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > 5 * 1024 * 1024) continue // 5MB 限制
    const reader = new FileReader()
    reader.onload = () => {
      attachments.value.push({
        id: 'att_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result as string,
      })
    }
    reader.readAsDataURL(file)
  }
  // 清空 input 以便重复选择同一文件
  if (fileInput.value) fileInput.value.value = ''
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter(a => a.id !== id)
}

// 元数据（自动记录时间/地点/天气）
const currentMeta = ref<CurrentMeta>({ time: '', location: null, weather: null })

// 延迟获取元数据；缓存标志避免 keep-alive 重复激活时重复请求
let metaRequested = false
function ensureCurrentMeta() {
  if (metaRequested) return
  metaRequested = true
  setTimeout(() => {
    getCurrentMeta().then(meta => { currentMeta.value = meta }).catch(() => {})
  }, 300)
}

const prompts = computed(() => getModulePrompts(module.value, journalStore.customModules))

// 所有可用模块（内置 + 自定义）
const allModules = computed(() => {
  const builtins = Object.entries(MODULE_LABELS).map(([key, label]) => ({ key: key as ModuleType, label }))
  const customs = journalStore.customModules.map(m => ({ key: m.id as ModuleType, label: m.name }))
  return [...builtins, ...customs]
})

// 语音输入：将转写文字追加到第一个 prompt
function onVoiceTranscript(text: string) {
  const firstPrompt = prompts.value[0]
  if (!firstPrompt) return
  const existing = form[firstPrompt.id] || ''
  form[firstPrompt.id] = existing ? existing + ' ' + text : text
}

watch(module, () => {
  Object.keys(form).forEach(k => delete form[k])
  mood.value = ''
})

const todayISO = todayLocal()
const todayLabel = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
const hour = new Date().getHours()
const greeting = hour < 11 ? '早安' : hour < 14 ? '午安' : hour < 18 ? '下午好' : '晚上好'

const entriesToday = computed<JournalEntry[]>(() =>
  journalStore.entries
    .filter((e: JournalEntry) => e.date === todayISO)
    .slice()
    .sort((a: JournalEntry, b: JournalEntry) => (a.createdAt < b.createdAt ? 1 : -1))
)

const canSave = computed(() => prompts.value.some(p => (form[p.id] || '').trim().length > 0))

// 智能标签：合并所有 prompt 文本作为输入
const combinedText = computed(() =>
  prompts.value.map(p => form[p.id] || '').filter(Boolean).join('\n')
)

function parseTags(): string[] {
  return Array.from(
    new Set(
      tagsInput.value
        .split(/[,，\s]+/)
        .map(t => t.trim())
        .filter(Boolean)
    )
  )
}

function onSmartTagSelect(tag: string) {
  const existing = parseTags()
  if (!existing.some(t => t.toLowerCase() === tag.toLowerCase())) {
    tagsInput.value = tagsInput.value ? tagsInput.value + ', ' + tag : tag
  }
}

async function save() {
  if (!canSave.value) return
  const ps: JournalPrompt[] = prompts.value.map(p => ({
    id: p.id,
    label: p.label,
    value: (form[p.id] || '').trim(),
  }))
  const tags = parseTags()
  const totalLen = ps.reduce((sum, p) => sum + p.value.length, 0)

  const wasEmpty = journalStore.entries.length === 0

  // 自动附加元数据
  const metadata = {
    location: currentMeta.value.location?.city,
    weather: currentMeta.value.weather ? `${currentMeta.value.weather.description} ${currentMeta.value.weather.temperature}°C` : undefined,
    temperature: currentMeta.value.weather?.temperature,
    attachments: attachments.value.length > 0 ? [...attachments.value] : undefined,
  }

  await journalStore.addEntry({
    module: module.value,
    prompts: ps,
    mood: module.value === 'diary' ? mood.value.trim() || undefined : undefined,
    tags,
    links: tags,
    metadata,
  })

  await track(EVENTS.ENTRY_CREATED, {
    module: module.value,
    len: totalLen,
    source: 'homepage',
  })

  if (wasEmpty) {
    await track(EVENTS.FIRST_ENTRY_CREATED, { module: module.value })
  }

  if (tags.length > 0) {
    await track(EVENTS.LINK_CREATED, { count: tags.length, tags, module: module.value })
  }

  prompts.value.forEach(p => (form[p.id] = ''))
  tagsInput.value = ''
  mood.value = ''
  attachments.value = []
  savedFlash.value = true
  setTimeout(() => (savedFlash.value = false), 2000)
}

function toggleReview(id: string) {
  selectedId.value = selectedId.value === id ? null : id
}

// 新建自定义板块
const showNewModule = ref(false)
const newModuleName = ref('')

function openNewModule() {
  showNewModule.value = true
  newModuleName.value = ''
}

function cancelNewModule() {
  showNewModule.value = false
  newModuleName.value = ''
}

async function confirmNewModule() {
  const name = newModuleName.value.trim()
  if (!name) return
  const newMod = await journalStore.addCustomModule({
    name,
    icon: 'FileText',
    prompts: [{ id: 'content', label: '内容', placeholder: '记录点什么…' }],
  })
  module.value = newMod.id
  cancelNewModule()
}

// ------------------------------------------------------------------
// 编辑器快捷键（本页内生效）：
// Ctrl+S 保存 · Ctrl+E 切换富/纯文本 · Ctrl+Shift+A 复盘最新一条
// Ctrl+D 插入日期 · Ctrl+L 插入双链（后两者限纯文本模式的 textarea）
// ------------------------------------------------------------------
function insertAtCursor(text: string) {
  const el = document.activeElement as HTMLTextAreaElement | null
  if (!el || el.tagName !== 'TEXTAREA' || !el.dataset.prompt) return
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  el.setRangeText(text, start, end, 'end')
  form[el.dataset.prompt] = el.value
}

function onEditorKeydown(event: KeyboardEvent) {
  const mod = event.ctrlKey || event.metaKey
  if (!mod || event.altKey) return
  const key = event.key.toLowerCase()

  if (event.shiftKey && key === 'a') {
    event.preventDefault()
    const latest = entriesToday.value[0]
    if (latest) selectedId.value = latest.id
    return
  }
  if (event.shiftKey) return

  if (key === 's') {
    event.preventDefault()
    save()
  } else if (key === 'e') {
    event.preventDefault()
    richMode.value = !richMode.value
  } else if (key === 'd') {
    if (richMode.value) return
    event.preventDefault()
    insertAtCursor(todayLocal())
  } else if (key === 'l') {
    if (richMode.value) return
    event.preventDefault()
    insertAtCursor('[[]]')
    const el = document.activeElement as HTMLTextAreaElement | null
    if (el && el.tagName === 'TEXTAREA') {
      const pos = el.selectionStart - 2 // 光标移入 [[|]] 中间
      el.setSelectionRange(pos, pos)
    }
  }
}

// keep-alive 下：全局监听器在激活时注册、失活时移除，避免跨页残留
onActivated(() => {
  document.addEventListener('keydown', onEditorKeydown)
  ensureCurrentMeta()
})
onDeactivated(() => document.removeEventListener('keydown', onEditorKeydown))
</script>

<template>
  <div>
    <section class="max-w-3xl mx-auto px-6 py-8 animate-fade-up">
    <!-- 问候 + 元数据 + 宠物 -->
    <div class="mb-6 flex items-start justify-between gap-4">
      <div>
        <p class="text-ink-2 text-sm">{{ todayLabel }}</p>
        <h1 class="text-ink">{{ greeting }}，今天过得怎么样？</h1>
        <div class="flex items-center mt-2">
          <p class="text-ink-2 text-sm">从三句话开始，不空白、不费力。</p>
          <MetaBar class="ml-4" />
        </div>
      </div>
      <!-- 桌面宠物 -->
      <div class="shrink-0">
        <DesktopPet />
      </div>
    </div>

    <!-- 上半区：待办 + 每日总结 + 使用时间 -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <DailyTodo />
      <DailySummaryCard />
      <UsageTimeCard />
    </div>

    <!-- 模块切换 -->
    <div class="flex gap-2 mb-4 flex-wrap">
      <button
        v-for="m in allModules"
        :key="m.key"
        class="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        :class="module === m.key
          ? 'bg-accent text-white shadow-accent-glow'
          : 'bg-surface text-ink-2 border border-line/70 hover:bg-surface-2'"
        @click="module = m.key"
      >
        {{ m.label }}
      </button>

      <!-- 新建自定义板块 -->
      <button
        v-if="!showNewModule"
        class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors border border-dashed border-line/70 text-ink-2 hover:border-accent hover:text-accent"
        title="新建自定义板块"
        @click="openNewModule"
      >
        <Plus :size="15" />
      </button>
      <div v-else class="inline-flex items-center gap-1.5">
        <input
          v-model="newModuleName"
          class="input !py-1.5 !text-sm w-36"
          placeholder="板块名称"
          @keyup.enter="confirmNewModule"
          @keyup.esc="cancelNewModule"
        />
        <button
          class="btn btn-primary !px-2.5 !py-1.5 !text-xs"
          :disabled="!newModuleName.trim()"
          @click="confirmNewModule"
        >确定</button>
        <button class="btn btn-ghost !px-2.5 !py-1.5 !text-xs" @click="cancelNewModule">取消</button>
      </div>
    </div>

    <!-- 捕获卡片 -->
    <div class="card p-5">
      <!-- 元信息条 -->
      <div class="flex items-center justify-between mb-3 pb-3 border-b border-line/50">
        <div class="flex items-center gap-2 text-xs text-ink-2">
          <span v-if="currentMeta.location">📍 {{ currentMeta.location.city }}</span>
          <span v-if="currentMeta.weather">{{ currentMeta.weather.icon }} {{ currentMeta.weather.description }} {{ currentMeta.weather.temperature }}°C</span>
        </div>
        <button
          @click="richMode = !richMode"
          class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors"
          :class="richMode ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-surface-2'"
          :title="richMode ? '切换到纯文本' : '切换到富文本'"
        >
          <PenLine :size="12" />
          {{ richMode ? '富文本' : '纯文本' }}
        </button>
      </div>

      <div v-for="p in prompts" :key="p.id" class="mb-4 last:mb-0">
        <label class="field-label">{{ p.label }}</label>
        <!-- 富文本模式 -->
        <RichEditor
          v-if="richMode"
          :model-value="form[p.id] || ''"
          @update:model-value="form[p.id] = $event"
          :placeholder="p.placeholder"
          :minimal="true"
        />
        <!-- 纯文本模式 -->
        <textarea
          v-else
          class="input"
          :placeholder="p.placeholder"
          :data-prompt="p.id"
          rows="2"
          v-model="form[p.id]"
        ></textarea>
      </div>

      <div v-if="module === 'diary'" class="mb-4">
        <label class="field-label">此刻的心情</label>
        <input class="input" placeholder="例如：平静 / 有点累 / 雀跃" v-model="mood" />
      </div>

      <div class="mb-4">
        <label class="field-label">
          <span class="inline-flex items-center gap-1"><Tag :size="13" /> 标签（逗号分隔，将自动成为知识库双链）</span>
        </label>
        <input class="input" placeholder="复盘, 阅读" v-model="tagsInput" />
        <SmartTagSuggest :text="combinedText" :manual-tags="parseTags()" @select-tag="onSmartTagSelect" />
      </div>

      <!-- 图片附件 -->
      <div class="mb-5">
        <label class="field-label">
          <span class="inline-flex items-center gap-1"><Image :size="13" /> 附件图片</span>
        </label>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="att in attachments"
            :key="att.id"
            class="relative w-20 h-20 rounded-lg overflow-hidden border border-line/50 group"
          >
            <img :src="att.dataUrl" :alt="att.name" class="w-full h-full object-cover" />
            <button
              class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-ink/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              @click="removeAttachment(att.id)"
            >
              <X :size="12" />
            </button>
          </div>
          <button
            class="w-20 h-20 rounded-lg border-2 border-dashed border-line/50 flex flex-col items-center justify-center text-ink-2 hover:border-accent hover:text-accent transition-colors"
            @click="fileInput?.click()"
          >
            <Plus :size="16" />
            <span class="text-[0.6rem] mt-0.5">添加</span>
          </button>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="onFileSelect"
        />
      </div>

      <div class="flex items-center gap-3">
        <button class="btn btn-primary" @click="save" :disabled="!canSave">
          <Plus :size="16" /> 保存这条记录
        </button>
        <VoiceInput @transcript="onVoiceTranscript" />
        <transition name="fade">
          <span v-if="savedFlash" class="text-sm text-accent font-medium">已保存 ✓</span>
        </transition>
      </div>
    </div>

    <!-- 今日记录 -->
    <div class="mt-8">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-ink">今日记录</h3>
        <span class="text-sm text-ink-2">{{ entriesToday.length }} 条</span>
      </div>

      <div v-if="entriesToday.length === 0" class="card-soft p-8 text-center text-ink-2">
        还没有今天的记录。上面写三句话，它就出现了。
      </div>

      <div v-else class="space-y-3">
        <div v-for="entry in entriesToday" :key="entry.id" class="card p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="chip">{{ getModuleLabel(entry.module, journalStore.customModules) }}</span>
              <span v-if="entry.mood" class="text-sm text-ink-2">{{ entry.mood }}</span>
              <span
                v-if="entry.review?.status === 'adopted'"
                class="text-[0.7rem] px-2 py-0.5 rounded-full bg-accent-soft text-accent"
                >复盘已采纳</span
              >
            </div>
            <div class="flex items-center gap-2 text-xs text-ink-2">
              <span v-if="entry.metadata?.location" class="flex items-center gap-0.5">📍 {{ entry.metadata.location }}</span>
              <span v-if="entry.metadata?.weather">{{ entry.metadata.weather }}</span>
              <span>{{ new Date(entry.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
            </div>
          </div>

          <ul class="space-y-1 text-sm text-ink">
            <li v-for="p in entry.prompts.filter(p => p.value)" :key="p.id">
              <span class="text-ink-2">{{ p.label }}：</span>{{ p.value }}
            </li>
          </ul>

          <div v-if="entry.tags.length" class="flex flex-wrap gap-1.5 mt-2">
            <span v-for="t in entry.tags" :key="t" class="chip-soft text-[0.72rem]">#{{ t }}</span>
          </div>

          <!-- 附件缩略图 -->
          <div v-if="entry.metadata?.attachments?.length" class="flex gap-1.5 mt-2">
            <img
              v-for="att in entry.metadata.attachments.slice(0, 4)"
              :key="att.id"
              :src="att.dataUrl"
              :alt="att.name"
              class="w-12 h-12 rounded-lg object-cover border border-line/50"
            />
            <span v-if="entry.metadata.attachments.length > 4" class="w-12 h-12 rounded-lg bg-surface-2 flex items-center justify-center text-xs text-ink-2">
              +{{ entry.metadata.attachments.length - 4 }}
            </span>
          </div>

          <div class="flex items-center gap-3 mt-3">
            <button
              class="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
              @click="toggleReview(entry.id)"
            >
              <MessageSquare :size="15" />
              {{ selectedId === entry.id ? '收起复盘' : 'AI 复盘' }}
              <ChevronDown :size="14" v-if="selectedId !== entry.id" />
            </button>
            <button
              class="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-accent transition-colors"
              @click="editingEntry = entry"
            >
              <Edit3 :size="14" />
              编辑
            </button>
          </div>

          <AIReviewMirror v-if="selectedId === entry.id" :entry="entry" />
        </div>
      </div>
    </div>
    </section>

    <!-- 编辑弹窗 -->
    <EntryEditModal
      v-if="editingEntry"
      :entry="editingEntry"
      :visible="!!editingEntry"
      @close="editingEntry = null"
      @saved="editingEntry = null"
    />
  </div>
</template>
