<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { BookOpen, Check, RotateCcw, Eye, EyeOff, ChevronRight } from 'lucide-vue-next'
import { type JournalEntry, useJournalStore } from '@/stores/journal'
import {
  loadCards, saveCards, getDueCards, getOrCreateCard, scheduleCard,
  type SRCard
} from '@/services/spacedRepetition'

const journalStore = useJournalStore()

const srCards = ref<SRCard[]>([])
const reviewMode = ref(false)
const currentIndex = ref(0)
const flipped = ref(false)

onMounted(() => {
  srCards.value = loadCards()
})

const allEntries = computed(() => journalStore.entries as JournalEntry[])

const reviewItems = computed(() => {
  return allEntries.value
    .filter(
      (e: JournalEntry) =>
        e.module === 'study' &&
        ((e.reviewMark === true) || (e.wikiLinks && e.wikiLinks.length > 0))
    )
    .sort((a: JournalEntry, b: JournalEntry) => {
      if (a.reviewMark && !b.reviewMark) return -1
      if (!a.reviewMark && b.reviewMark) return 1
      return a.date < b.date ? 1 : -1
    })
})

const dueCards = computed(() => {
  const due = getDueCards(srCards.value)
  // 只显示有对应条目的卡片
  const entryIds = new Set(allEntries.value.map(e => e.id))
  return due.filter(c => entryIds.has(c.entryId))
})

const currentEntry = computed<JournalEntry | null>(() => {
  if (!reviewMode.value) return null
  const items = reviewItems.value
  if (currentIndex.value >= items.length) return null
  return items[currentIndex.value] || null
})

function summary(entry: JournalEntry): string {
  const p = entry.prompts.find(p => p.value && p.value.trim())
  if (!p) return '（无内容）'
  const text = p.value.trim()
  return text.length > 100 ? text.slice(0, 100) + '…' : text
}

function fullContent(entry: JournalEntry): string {
  return entry.prompts
    .filter(p => p.value && p.value.trim())
    .map(p => `${p.label}：${p.value}`)
    .join('\n')
}

function toggleMark(entryId: string) {
  journalStore.toggleReviewMark(entryId)
}

function startReview() {
  reviewMode.value = true
  currentIndex.value = 0
  flipped.value = false
  // 确保当前条目有 SR 卡片
  if (currentEntry.value) {
    getOrCreateCard(srCards.value, currentEntry.value.id)
  }
}

function flipCard() {
  flipped.value = !flipped.value
}

function rateCard(quality: number) {
  if (!currentEntry.value) return
  const card = getOrCreateCard(srCards.value, currentEntry.value.id)
  const updated = scheduleCard(card, quality)
  const idx = srCards.value.findIndex(c => c.entryId === updated.entryId)
  if (idx !== -1) srCards.value[idx] = updated
  else srCards.value.push(updated)
  saveCards(srCards.value)

  // 下一张
  currentIndex.value++
  flipped.value = false
  if (currentIndex.value >= reviewItems.value.length) {
    reviewMode.value = false
  }
}

function exitReview() {
  reviewMode.value = false
}
</script>

<template>
  <div class="card p-5">
    <!-- 标题栏 -->
    <div class="flex items-center gap-2 mb-4">
      <BookOpen :size="18" class="text-accent" />
      <h3 class="text-ink">复习队列</h3>
      <span v-if="dueCards.length > 0" class="chip !text-[0.65rem] ml-1">
        {{ dueCards.length }} 待复习
      </span>
      <div class="ml-auto flex gap-2">
        <button
          v-if="dueCards.length > 0 && !reviewMode"
          @click="startReview"
          class="btn btn-primary !text-xs !px-3 !py-1.5"
        >
          <RotateCcw :size="13" /> 开始复习
        </button>
        <span v-else class="chip-soft text-[0.72rem] px-2 py-0.5 rounded-full">
          {{ reviewItems.length }} 条
        </span>
      </div>
    </div>

    <!-- 复习模式 -->
    <div v-if="reviewMode && currentEntry" class="space-y-4">
      <!-- 进度 -->
      <div class="flex items-center gap-2 text-xs text-ink-2">
        <span>{{ currentIndex + 1 }} / {{ reviewItems.length }}</span>
        <div class="flex-1 h-1 bg-surface-2 rounded-full overflow-hidden">
          <div class="h-full bg-accent rounded-full transition-all" :style="{ width: ((currentIndex + 1) / reviewItems.length * 100) + '%' }"></div>
        </div>
        <button @click="exitReview" class="text-ink-2 hover:text-ink">退出</button>
      </div>

      <!-- 卡片正面（摘要） -->
      <div class="p-4 rounded-xl bg-surface-2 border border-line/50">
        <div class="text-xs text-ink-2 mb-2">{{ currentEntry.date }} · 学习笔记</div>
        <p class="text-sm text-ink leading-relaxed">{{ summary(currentEntry) }}</p>

        <div v-if="currentEntry.wikiLinks?.length" class="flex flex-wrap gap-1 mt-2">
          <span v-for="link in currentEntry.wikiLinks" :key="link" class="chip chip-soft !text-[0.6rem]">
            [[{{ link }}]]
          </span>
        </div>
      </div>

      <!-- 翻转按钮 -->
      <button
        @click="flipCard"
        class="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-surface-2 hover:bg-accent-soft text-sm text-ink-2 hover:text-accent transition-colors"
      >
        <component :is="flipped ? EyeOff : Eye" :size="16" />
        {{ flipped ? '隐藏详情' : '查看完整内容' }}
      </button>

      <!-- 卡片背面（完整内容） -->
      <div v-if="flipped" class="p-4 rounded-xl bg-accent-soft/30 border border-accent/20">
        <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap">{{ fullContent(currentEntry) }}</pre>
      </div>

      <!-- 评分按钮 -->
      <div v-if="flipped" class="space-y-2">
        <div class="text-xs text-ink-2 text-center">你记得怎么样？</div>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="q in [
              { val: 1, label: '忘了', color: 'bg-danger/10 text-danger hover:bg-danger/20' },
              { val: 3, label: '模糊', color: 'bg-ember/10 text-ember hover:bg-ember/20' },
              { val: 4, label: '记得', color: 'bg-accent/10 text-accent hover:bg-accent/20' },
              { val: 5, label: '熟练', color: 'bg-accent-soft text-accent hover:bg-accent' },
            ]"
            :key="q.val"
            @click="rateCard(q.val)"
            class="py-2 rounded-lg text-xs font-medium transition-colors"
            :class="q.color"
          >
            {{ q.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- 复习完成 -->
    <div v-else-if="reviewMode" class="text-center py-6">
      <div class="text-lg text-accent mb-2">🎉 今日复习完成！</div>
      <p class="text-sm text-ink-2">所有待复习卡片都已复习过。</p>
      <button @click="exitReview" class="btn btn-ghost mt-3 !text-xs">返回</button>
    </div>

    <!-- 列表模式 -->
    <div v-else>
      <div v-if="reviewItems.length === 0" class="text-sm text-ink-2 text-center py-6">
        还没有需要复习的学习笔记。
        <br />在学习笔记中用 <code class="text-accent">[[双链]]</code> 标记关键词，或点击标记按钮，即可加入复习队列。
      </div>

      <div v-else class="space-y-2.5 max-h-64 overflow-y-auto custom-scrollbar">
        <div
          v-for="entry in reviewItems.slice(0, 10)"
          :key="entry.id"
          class="card-soft p-3"
          :class="entry.reviewMark ? 'border-l-4' : ''"
          :style="entry.reviewMark ? 'border-left-color: rgb(var(--accent))' : ''"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="text-[0.7rem] text-ink-2">{{ entry.date }}</span>
            <button
              class="text-[0.7rem] font-medium transition-colors"
              :class="entry.reviewMark ? 'text-accent' : 'text-ink-2 hover:text-accent'"
              @click="toggleMark(entry.id)"
            >
              <span class="inline-flex items-center gap-1">
                <Check :size="12" />
                {{ entry.reviewMark ? '已标记' : '标记复习' }}
              </span>
            </button>
          </div>
          <p class="text-xs text-ink leading-relaxed">{{ summary(entry) }}</p>
          <div v-if="entry.wikiLinks?.length" class="flex flex-wrap gap-1 mt-1.5">
            <span v-for="link in entry.wikiLinks" :key="link" class="chip chip-soft !text-[0.55rem] !py-0">
              [[{{ link }}]]
            </span>
          </div>
        </div>
        <div v-if="reviewItems.length > 10" class="text-xs text-ink-2 text-center">
          还有 {{ reviewItems.length - 10 }} 条…
        </div>
      </div>
    </div>
  </div>
</template>
