<script setup lang="ts">
import { ref, watch } from 'vue'
import { Tag, BookOpen, X } from 'lucide-vue-next'
import { extractTagsFromText } from '@/services/smartTag'
import { useJournalStore } from '@/stores/journal'

const props = defineProps<{
  /** 当前输入的文本内容 */
  text: string
  /** 用户已手动输入的标签 */
  manualTags: string[]
}>()

const emit = defineEmits<{
  'select-tag': [tag: string]
}>()

const journalStore = useJournalStore()
const suggestions = ref<string[]>([])
const dismissed = ref<Set<string>>(new Set())

function updateSuggestions() {
  if (!props.text || props.text.trim().length < 15) {
    suggestions.value = []
    return
  }

  const allExisting = journalStore.entries.flatMap(e => e.tags)
  const unique = [...new Set(allExisting)]
  const extracted = extractTagsFromText(props.text, unique)

  // 过滤掉已手动输入的标签和已关闭的建议
  const manualLower = new Set(props.manualTags.map(t => t.toLowerCase()))
  suggestions.value = extracted.filter(s =>
    !manualLower.has(s.toLowerCase()) && !dismissed.value.has(s.toLowerCase())
  )
}

function accept(tag: string) {
  emit('select-tag', tag)
  suggestions.value = suggestions.value.filter(s => s.toLowerCase() !== tag.toLowerCase())
}

function dismiss(tag: string) {
  dismissed.value.add(tag.toLowerCase())
  suggestions.value = suggestions.value.filter(s => s.toLowerCase() !== tag.toLowerCase())
}

watch(() => props.text, updateSuggestions, { flush: 'post' })
watch(() => props.manualTags.length, updateSuggestions)
</script>

<template>
  <div v-if="suggestions.length > 0" class="flex flex-wrap items-center gap-1.5 mt-1.5">
    <BookOpen :size="12" class="text-accent shrink-0" />
    <span class="text-[0.65rem] text-ink-2 shrink-0">智能推荐：</span>
    <button
      v-for="tag in suggestions.slice(0, 5)"
      :key="tag"
      @click="accept(tag)"
      class="chip chip-soft !text-[0.65rem] !py-0.5 cursor-pointer hover:border-accent/50 transition-colors group"
      :title="`点击添加标签「${tag}」`"
    >
      {{ tag }}
      <X :size="10" class="opacity-0 group-hover:opacity-60 ml-0.5" @click.stop="dismiss(tag)" />
    </button>
  </div>
</template>
