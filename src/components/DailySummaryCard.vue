<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { FileText, Briefcase, GraduationCap, BookOpen, Tag, Heart } from 'lucide-vue-next'
import { generateDailySummary, getOneYearAgo, type DailySummaryData } from '@/services/dailySummaryService'
import { useJournalStore, type JournalEntry } from '@/stores/journal'
import MetaBar from './MetaBar.vue'

const props = defineProps<{
  date?: string  // 默认今天
}>()

const { t } = useI18n()
const journalStore = useJournalStore()

const summary = computed<DailySummaryData>(() =>
  generateDailySummary(journalStore.entries, props.date)
)

const lastYearEntries = computed(() => getOneYearAgo(journalStore.entries))

function moduleIcon(m: string) {
  if (m === 'diary') return FileText
  if (m === 'work') return Briefcase
  return GraduationCap
}

function moduleLabel(m: string) {
  if (m === 'diary') return '日记'
  if (m === 'work') return '工作'
  return '学习'
}

function moodEmoji(m: string): string {
  const map: Record<string, string> = {
    happy: '😄', neutral: '😐', sad: '😢', excited: '🎉', angry: '😠',
    '开心': '😄', '平静': '😐', '难过': '😢', '激动': '🎉', '愤怒': '😠',
  }
  return map[m] || '📝'
}
</script>

<template>
  <div class="card p-4 space-y-3">
    <!-- 头部：日期 + 元数据 -->
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-semibold text-ink flex items-center gap-2">
        <BookOpen :size="16" class="text-accent" />
        每日总结
      </h3>
      <MetaBar />
    </div>

    <!-- 无记录状态 -->
    <div v-if="summary.totalEntries === 0" class="text-center py-4">
      <div class="text-sm text-ink-2">今天还没有记录</div>
      <div class="text-xs text-ink-2/60 mt-1">开始记录后自动生成每日总结</div>
    </div>

    <!-- 统计概览 -->
    <div v-else>
      <div class="grid grid-cols-4 gap-2">
        <!-- 总条目 -->
        <div class="card-soft p-2.5 text-center">
          <div class="text-lg font-bold text-accent">{{ summary.totalEntries }}</div>
          <div class="text-[0.65rem] text-ink-2">记录</div>
        </div>
        <!-- 总字数 -->
        <div class="card-soft p-2.5 text-center">
          <div class="text-lg font-bold text-ink">{{ summary.totalWords }}</div>
          <div class="text-[0.65rem] text-ink-2">字数</div>
        </div>
        <!-- 标签数 -->
        <div class="card-soft p-2.5 text-center">
          <div class="text-lg font-bold text-ember">{{ summary.tags.length }}</div>
          <div class="text-[0.65rem] text-ink-2">标签</div>
        </div>
        <!-- 心情 -->
        <div class="card-soft p-2.5 text-center">
          <div class="text-lg">
            {{ summary.moods.length > 0 ? moodEmoji(summary.moods[0]) : '📝' }}
          </div>
          <div class="text-[0.65rem] text-ink-2">{{ summary.moods[0] || '未记录' }}</div>
        </div>
      </div>

      <!-- 模块分布 -->
      <div class="flex gap-2 mt-2">
        <div
          v-for="(count, mod) in summary.moduleBreakdown"
          :key="mod"
          v-show="count > 0"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-2 text-xs"
        >
          <component :is="moduleIcon(mod)" :size="12" class="text-ink-2" />
          <span class="text-ink">{{ moduleLabel(mod) }} {{ count }}</span>
        </div>
      </div>

      <!-- 标签 -->
      <div v-if="summary.tags.length" class="flex flex-wrap gap-1 mt-2">
        <Tag :size="12" class="text-ink-2" />
        <span v-for="tag in summary.tags.slice(0, 8)" :key="tag" class="chip chip-soft !text-[0.6rem] !py-0">{{ tag }}</span>
      </div>

      <!-- 关键内容预览 -->
      <div v-if="summary.keyHighlights.length" class="mt-2 space-y-1.5">
        <div class="text-xs font-medium text-ink-2">今日片段</div>
        <div
          v-for="(hl, i) in summary.keyHighlights.slice(0, 3)"
          :key="i"
          class="text-xs text-ink leading-relaxed pl-3 border-l-2 border-accent/30"
        >
          {{ hl }}
        </div>
      </div>
    </div>

    <!-- 去年今日 -->
    <div v-if="lastYearEntries.length > 0" class="pt-2 border-t border-line/50">
      <div class="text-xs font-medium text-ink-2 flex items-center gap-1 mb-1.5">
        <Heart :size="12" class="text-ember" />
        去年今日
      </div>
      <div
        v-for="entry in lastYearEntries.slice(0, 2)"
        :key="entry.id"
        class="text-xs text-ink leading-relaxed"
      >
        {{ entry.prompts.find(p => p.value)?.value?.slice(0, 60) }}…
      </div>
    </div>
  </div>
</template>
