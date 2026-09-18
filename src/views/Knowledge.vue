<script setup lang="ts">
import { ref, computed, nextTick, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { Search, Download, Copy, FileText, MessageSquare, Send, Loader2, BookOpen } from 'lucide-vue-next'
import {
  buildKnowledgeTree,
  entryToMarkdown,
  downloadMarkdown,
  copyMarkdown,
} from '@/services/markdownExport'
import { getModuleLabel, type JournalEntry, type AIMode, useJournalStore } from '@/stores/journal'
import { useTodoStore } from '@/stores/todo'
import ReviewQueue from '@/components/ReviewQueue.vue'
import LinkGraph from '@/components/LinkGraph.vue'

// 轻量 AI 问答：直接调用 fetch，不复用 generateReview（签名不同）
async function askAI(question: string, context: string, cfg: { mode: AIMode; apiKey?: string; aiBaseUrl?: string; aiModel?: string }): Promise<string> {
  const systemPrompt = `你是一个知识库助手。请根据用户提供的记录回答问题。只基于给定记录回答，如果记录中没有相关信息就说不确定。回答简洁有帮助，用中文。`
  const userContent = `用户的问题：${question}\n\n相关记录：\n${context}`

  // local 模式：本地摘要（不调 AI）
  if (cfg.mode === 'local') {
    return generateLocalAnswer(question, context)
  }

  const baseUrl = cfg.aiBaseUrl || 'https://api.openai.com/v1'
  const isOllama = baseUrl.includes('localhost:11434') || baseUrl.includes('127.0.0.1:11434')
  const model = cfg.aiModel || (isOllama ? 'llama3.1' : 'gpt-4o-mini')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)

  try {
    let url: string
    let body: any
    let headers: Record<string, string> = { 'Content-Type': 'application/json' }

    if (isOllama) {
      url = 'http://localhost:11434/api/chat'
      body = { model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], stream: false }
    } else {
      url = `${baseUrl}/chat/completions`
      if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`
      body = { model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], temperature: 0.7 }
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
    if (!res.ok) throw new Error(`AI API ${res.status}`)

    const data = await res.json()
    if (isOllama) return data.message?.content || ''
    return data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timer)
  }
}

/** 本地模式：基于检索结果生成摘要回答（不依赖 AI） */
function generateLocalAnswer(question: string, context: string): string {
  const lines = context.split('\n').filter(l => l.trim())
  const entries: { date: string; module: string; content: string }[] = []
  let current: { date: string; module: string; content: string } | null = null

  for (const line of lines) {
    const headerMatch = line.match(/^\[(.+?)\s*·\s*(.+?)\]$/)
    if (headerMatch) {
      if (current) entries.push(current)
      current = { date: headerMatch[1], module: headerMatch[2], content: '' }
    } else if (line !== '---' && current) {
      current.content += line + '\n'
    }
  }
  if (current) entries.push(current)

  if (entries.length === 0) {
    return '未找到与问题相关的记录。请尝试换个关键词或日期搜索。'
  }

  // 组织回答
  const parts = entries.map(e => {
    const contentLines = e.content.trim().split('\n').filter(Boolean)
    const summary = contentLines.map(l => {
      const colonIdx = l.indexOf('：')
      return colonIdx > 0 ? l.slice(colonIdx + 1).trim() : l.trim()
    }).filter(Boolean).join('；')
    return `📅 ${e.date}（${e.module}）：${summary}`
  })

  return `找到 ${entries.length} 条相关记录：\n\n${parts.join('\n\n')}`
}

const journalStore = useJournalStore()
const todoStore = useTodoStore()
const { t } = useI18n()
const route = useRoute()
const query = ref('')
const searchInput = ref<HTMLInputElement | null>(null)

// Ctrl+F 跳转过来时（?focus=search）自动聚焦搜索框
async function focusSearchIfRequested() {
  if (route.query.focus !== 'search') return
  await nextTick()
  searchInput.value?.focus()
  searchInput.value?.select()
}
onMounted(focusSearchIfRequested)
watch(() => route.query.focus, focusSearchIfRequested)
const selectedId = ref<string | null>(null)
const copied = ref(false)
const exporting = ref(false)

// 知识库问答
const qaQuery = ref('')
const qaLoading = ref(false)
const qaAnswer = ref('')
const qaRelatedEntries = ref<JournalEntry[]>([])
const qaError = ref('')
const showQA = ref(false)

const allEntries = computed(() => journalStore.entries as JournalEntry[])

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allEntries.value
  return allEntries.value.filter(e => {
    const hay = [
      e.date,
      e.title || '',
      e.mood || '',
      ...e.tags,
      ...e.prompts.map(p => p.value),
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
})

const tree = computed(() => buildKnowledgeTree(filtered.value, journalStore.customModules))

const firstId = computed(() => (filtered.value.length ? filtered.value[0].id : null))
const activeId = computed(() => selectedId.value || firstId.value)
const selectedEntry = computed(() => allEntries.value.find(e => e.id === activeId.value) || null)
const previewMd = computed(() => (selectedEntry.value ? entryToMarkdown(selectedEntry.value, journalStore.customModules) : ''))

function fileNameFor(e: JournalEntry): string {
  return `${e.date}-${e.id.slice(0, 4)}-${getModuleLabel(e.module, journalStore.customModules)}.md`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string)
  )
}
function highlight(text: string, q: string): string {
  const esc = escapeHtml(text)
  if (!q.trim()) return esc
  const qe = escapeHtml(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return esc.replace(new RegExp(qe, 'gi'), m => `<mark>${m}</mark>`)
}
const previewHtml = computed(() => highlight(previewMd.value, query.value))

async function copy() {
  if (!previewMd.value) return
  await copyMarkdown(previewMd.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1800)
}
function downloadCurrent() {
  if (!selectedEntry.value) return
  downloadMarkdown(fileNameFor(selectedEntry.value), previewMd.value)
}
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))
async function exportAll() {
  exporting.value = true
  const list = filtered.value.slice().sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const e of list) {
    downloadMarkdown(fileNameFor(e), entryToMarkdown(e, journalStore.customModules))
    await delay(180)
  }
  exporting.value = false
}

// 知识库问答：基于关键词检索 + AI 生成回答
async function askKnowledgeBase() {
  const q = qaQuery.value.trim()
  if (!q) return
  qaLoading.value = true
  qaError.value = ''
  qaAnswer.value = ''
  qaRelatedEntries.value = []

  try {
    // 1. 智能关键词提取：支持中文、日期、英文
    const keywords = extractKeywords(q)

    // 2. 多维度检索匹配
    const scored = allEntries.value.map(entry => {
      const contentText = entry.prompts.map(p => p.value).join(' ').toLowerCase()
      const tagText = entry.tags.join(' ').toLowerCase()
      const dateText = entry.date // YYYY-MM-DD
      const moduleText = getModuleLabel(entry.module, journalStore.customModules).toLowerCase()
      let score = 0

      for (const kw of keywords) {
        const kwLower = kw.toLowerCase()
        // 内容匹配（权重最高）
        const contentMatches = (contentText.match(new RegExp(escapeRegex(kwLower), 'g')) || []).length
        score += contentMatches * 3
        // 标签匹配
        const tagMatches = (tagText.match(new RegExp(escapeRegex(kwLower), 'g')) || []).length
        score += tagMatches * 5
        // 模块名匹配
        if (moduleText.includes(kwLower)) score += 2
        // 日期匹配（支持 "8月3日"、"8-3"、"2026-08-03" 等格式）
        if (dateText.includes(kw) || normalizeDate(kw) === dateText) score += 10
        // 日期部分匹配（如 "8月" 匹配 "2026-08"）
        const datePart = extractDatePart(kw)
        if (datePart && dateText.includes(datePart)) score += 6
      }

      return { entry, score }
    }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)

    qaRelatedEntries.value = scored.map(s => s.entry)

    if (scored.length === 0) {
      // 退化：尝试模糊匹配
      const fuzzyResults = allEntries.value.filter(entry => {
        const text = entry.prompts.map(p => p.value).join(' ') + entry.tags.join(' ') + entry.date
        return keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()))
      }).slice(0, 3)

      if (fuzzyResults.length > 0) {
        qaRelatedEntries.value = fuzzyResults
        const context = buildContext(fuzzyResults)
        const aiConfig = getAIConfig()
        try {
          qaAnswer.value = await askAI(q, context, aiConfig)
        } catch {
          qaAnswer.value = generateLocalAnswer(q, context)
        }
      } else {
        qaError.value = '未找到相关记录。请尝试换个关键词或日期搜索。'
      }
      qaLoading.value = false
      return
    }

    // 3. 拼接上下文，调 AI 生成回答
    const context = buildContext(scored.map(s => s.entry))
    const aiConfig = getAIConfig()

    try {
      qaAnswer.value = await askAI(q, context, aiConfig)
    } catch (aiErr: any) {
      console.warn('[knowledge QA] AI unavailable:', aiErr)
      qaAnswer.value = generateLocalAnswer(q, context)
    }
  } catch (e: any) {
    qaError.value = e.message || '未知错误'
  } finally {
    qaLoading.value = false
  }
}

/** 提取搜索关键词：支持中文字符、英文单词、日期格式 */
function extractKeywords(query: string): string[] {
  const keywords: string[] = []
  // 提取日期格式（8月3日、8-3、2026-08-03 等）
  const datePatterns = query.match(/\d{4}[-年.]\d{1,2}[-月.]\d{1,2}[日]?|\d{1,2}月\d{1,2}[日号]?/g)
  if (datePatterns) keywords.push(...datePatterns)
  // 提取英文单词
  const englishWords = query.replace(/[\u4e00-\u9fff]/g, ' ').split(/\s+/).filter(w => w.length > 1)
  keywords.push(...englishWords)
  // 提取中文词组（2-6字滑动窗口）
  const chineseOnly = query.replace(/[^\u4e00-\u9fff]/g, '')
  if (chineseOnly.length >= 2) {
    for (let len = Math.min(6, chineseOnly.length); len >= 2; len--) {
      for (let i = 0; i <= chineseOnly.length - len; i++) {
        keywords.push(chineseOnly.slice(i, i + len))
      }
    }
  }
  return [...new Set(keywords)].filter(k => k.length >= 2)
}

/** 转义正则特殊字符 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 尝试将中文日期转为 YYYY-MM-DD */
function normalizeDate(kw: string): string {
  const m = kw.match(/(\d{1,2})月(\d{1,2})[日号]?/)
  if (m) {
    const year = new Date().getFullYear()
    const month = m[1].padStart(2, '0')
    const day = m[2].padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const m2 = kw.match(/(\d{4})[-年.](\d{1,2})[-月.](\d{1,2})[日]?/)
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`
  }
  return ''
}

/** 提取日期中的年月部分 */
function extractDatePart(kw: string): string {
  const m = kw.match(/(\d{1,2})月/)
  if (m) {
    const year = new Date().getFullYear()
    return `${year}-${m[1].padStart(2, '0')}`
  }
  const m2 = kw.match(/(\d{4})[-年.](\d{1,2})/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}`
  return ''
}

/** 构建检索上下文 */
function buildContext(entries: JournalEntry[]): string {
  return entries.map(entry => {
    const content = entry.prompts.filter(p => p.value).map(p => `${p.label}: ${p.value}`).join('\n')
    const tags = entry.tags.length > 0 ? `\n标签: ${entry.tags.join(', ')}` : ''
    const mood = entry.mood ? `\n心情: ${entry.mood}` : ''
    return `[${entry.date} · ${getModuleLabel(entry.module, journalStore.customModules)}]${mood}${tags}\n${content}`
  }).join('\n---\n')
}

/** 获取当前 AI 配置 */
function getAIConfig() {
  return {
    mode: journalStore.prefs.aiMode as AIMode,
    apiKey: journalStore.prefs.aiKey,
    aiBaseUrl: journalStore.prefs.aiBaseUrl,
    aiModel: journalStore.prefs.aiModel,
  }
}
</script>

<template>
  <section class="max-w-5xl mx-auto px-6 py-8 animate-fade-up">
    <header class="flex items-end justify-between mb-6 gap-4 flex-wrap">
      <div>
        <p class="text-ink-2 text-sm">自动沉淀</p>
        <h1 class="text-ink">知识库</h1>
        <p class="text-ink-2 text-sm mt-1">每条记录自动生成带 frontmatter 与双链的 Markdown，可带走、可复用。</p>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-ghost" @click="showQA = !showQA">
          <MessageSquare :size="16" /> {{ t('knowledgeQA.title') }}
        </button>
        <button class="btn btn-primary" @click="exportAll" :disabled="exporting || !filtered.length">
          <Download :size="16" /> {{ exporting ? '导出中…' : '导出全部' }}
        </button>
      </div>
    </header>

    <!-- 知识库问答区域 -->
    <div v-if="showQA" class="card p-5 mb-5">
      <div class="flex items-center gap-2 mb-3">
        <MessageSquare :size="18" class="text-accent" />
        <h2 class="text-lg">{{ t('knowledgeQA.title') }}</h2>
      </div>
      <p class="text-sm text-ink-2 mb-3">{{ t('knowledgeQA.askHint') }}</p>

      <!-- 输入框 -->
      <div class="flex gap-2 mb-4">
        <input
          v-model="qaQuery"
          class="input flex-1"
          :placeholder="t('knowledgeQA.placeholder')"
          @keyup.enter="askKnowledgeBase"
          :disabled="qaLoading"
        />
        <button
          class="btn btn-primary"
          @click="askKnowledgeBase"
          :disabled="qaLoading || !qaQuery.trim()"
        >
          <Loader2 v-if="qaLoading" :size="16" class="animate-spin" />
          <Send v-else :size="16" />
          {{ t('knowledgeQA.askBtn') }}
        </button>
      </div>

      <!-- 加载状态 -->
      <div v-if="qaLoading" class="flex items-center gap-2 text-sm text-ink-2 py-3">
        <Loader2 :size="16" class="animate-spin text-accent" />
        {{ t('knowledgeQA.searching') }}
      </div>

      <!-- 错误 -->
      <div v-if="qaError" class="text-sm text-ember py-2">
        {{ qaError }}
      </div>

      <!-- AI 回答 -->
      <div v-if="qaAnswer" class="mb-4">
        <div class="flex items-center gap-2 mb-2">
          <BookOpen :size="16" class="text-accent" />
          <h3 class="text-sm font-semibold text-accent">{{ t('knowledgeQA.aiAnswer') }}</h3>
        </div>
        <div class="bg-surface-2 rounded-xl p-4 text-sm leading-relaxed text-ink whitespace-pre-wrap">{{ qaAnswer }}</div>
      </div>

      <!-- 相关记录 -->
      <div v-if="qaRelatedEntries.length > 0">
        <h3 class="text-sm font-semibold text-ink-2 mb-2">{{ t('knowledgeQA.relatedEntries') }}</h3>
        <div class="space-y-2">
          <div
            v-for="entry in qaRelatedEntries"
            :key="entry.id"
            class="p-3 bg-surface-2 rounded-lg border border-line/50 cursor-pointer hover:border-accent/30 transition-colors"
            @click="selectedId = entry.id; showQA = false"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-[0.7rem] text-ink-2">{{ entry.date }}</span>
              <span class="chip chip-soft !text-[0.6rem] !py-0">{{ getModuleLabel(entry.module, journalStore.customModules) }}</span>
            </div>
            <div class="text-sm text-ink line-clamp-2">
              {{ entry.prompts.filter(p => p.value).map(p => p.value).join(' ').slice(0, 120) }}…
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
      <!-- 文件树 -->
      <div class="card p-4 h-[70vh] overflow-y-auto custom-scrollbar">
        <div class="relative mb-3">
          <Search :size="15" class="absolute left-3 top-1/2 -translate-y-1/2 text-ink-2" />
          <input ref="searchInput" class="input !pl-9 !py-2 text-sm" placeholder="搜索内容或标签" v-model="query" />
        </div>

        <div v-if="tree.length === 0" class="text-sm text-ink-2 text-center py-8">
          没有匹配的记录。
        </div>

        <div v-for="yr in tree" :key="yr.year" class="mb-3">
          <div class="text-xs font-semibold text-ink-2 tracking-wide px-1">{{ yr.year }} 年</div>
          <div v-for="mo in yr.months" :key="mo.month" class="mt-1">
            <div class="text-[0.7rem] text-ink-2/70 px-1">{{ mo.month }} 月</div>
            <button
              v-for="f in mo.files"
              :key="f.name"
              class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-sm transition-colors"
              :class="activeId === f.entry.id ? 'bg-accent-soft text-accent' : 'text-ink hover:bg-surface-2'"
              @click="selectedId = f.entry.id"
            >
              <FileText :size="14" class="shrink-0" />
              <span class="truncate">{{ f.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 预览 -->
      <div class="card p-5 h-[70vh] flex flex-col">
        <div class="flex items-center justify-between mb-3">
          <div class="text-sm text-ink-2" v-if="selectedEntry">
            {{ selectedEntry.date }} · {{ getModuleLabel(selectedEntry.module, journalStore.customModules) }}
            <span v-if="selectedEntry.review?.status === 'adopted'" class="chip ml-2">含复盘</span>
          </div>
          <div class="flex gap-2" v-if="selectedEntry">
            <button class="btn btn-ghost !py-1.5 !px-3 text-sm" @click="copy">
              <Copy :size="14" /> {{ copied ? '已复制' : '复制' }}
            </button>
            <button class="btn btn-ghost !py-1.5 !px-3 text-sm" @click="downloadCurrent">
              <Download :size="14" /> 下载
            </button>
          </div>
        </div>
        <pre
          class="flex-1 overflow-auto custom-scrollbar text-[0.82rem] leading-relaxed text-ink bg-surface-2 rounded-xl p-4 whitespace-pre-wrap"
          v-html="previewHtml"
        ></pre>
      </div>
    </div>

    <!-- 知识图谱 + 复习队列 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
      <LinkGraph />
      <ReviewQueue />
    </div>
  </section>
</template>
