<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { X, Save, Plus, Tag } from 'lucide-vue-next'
import RichEditor from './RichEditor.vue'
import SmartTagSuggest from './SmartTagSuggest.vue'
import { type JournalEntry, type JournalPrompt, MODULE_LABELS, MODULE_PROMPTS, useJournalStore } from '@/stores/journal'

const props = defineProps<{
  entry: JournalEntry
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const journalStore = useJournalStore()

// 编辑状态
const editPrompts = ref<{ id: string; label: string; value: string }[]>([])
const editMood = ref('')
const editTags = ref('')
const saving = ref(false)
const savedFlash = ref(false)

// 初始化编辑数据
watch(() => props.visible, (val) => {
  if (val) {
    editPrompts.value = props.entry.prompts.map(p => ({ ...p }))
    editMood.value = props.entry.mood || ''
    editTags.value = props.entry.tags.join(', ')
    savedFlash.value = false
  }
})

// 合并文本用于智能标签
const combinedText = computed(() =>
  editPrompts.value.map(p => p.value).filter(Boolean).join('\n')
)

function parseTags(): string[] {
  return Array.from(
    new Set(
      editTags.value
        .split(/[,，\s]+/)
        .map(t => t.trim())
        .filter(Boolean)
    )
  )
}

function onSmartTagSelect(tag: string) {
  const existing = parseTags()
  if (!existing.some(t => t.toLowerCase() === tag.toLowerCase())) {
    editTags.value = editTags.value ? editTags.value + ', ' + tag : tag
  }
}

// 添加自定义 prompt 行
function addPrompt() {
  const id = 'custom_' + Date.now().toString(36)
  editPrompts.value.push({ id, label: '自定义', value: '' })
}

// 删除 prompt 行
function removePrompt(index: number) {
  editPrompts.value.splice(index, 1)
}

// 保存编辑
async function saveEdit() {
  saving.value = true
  try {
    const tags = parseTags()
    const updated: JournalEntry = {
      ...props.entry,
      prompts: editPrompts.value.map(p => ({ id: p.id, label: p.label, value: p.value.trim() })),
      mood: props.entry.module === 'diary' ? editMood.value.trim() || undefined : props.entry.mood,
      tags,
      links: tags,
    }
    await journalStore.updateEntry(updated)
    savedFlash.value = true
    setTimeout(() => {
      savedFlash.value = false
      emit('saved')
      emit('close')
    }, 800)
  } catch (e) {
    console.error('Failed to save entry:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal">
      <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('close')">
        <!-- 遮罩 -->
        <div class="absolute inset-0 bg-ink/30 backdrop-blur-sm" @click="emit('close')"></div>

        <!-- 弹窗 -->
        <div class="relative w-full max-w-2xl max-h-[85vh] bg-surface rounded-2xl shadow-2xl border border-line/50 flex flex-col animate-fade-up">
          <!-- 头部 -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-line/50 shrink-0">
            <div>
              <h2 class="text-lg font-semibold text-ink">编辑记录</h2>
              <p class="text-xs text-ink-2 mt-0.5">
                {{ entry.date }} · {{ MODULE_LABELS[entry.module] }}
              </p>
            </div>
            <button
              class="btn btn-ghost !p-2"
              @click="emit('close')"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- 内容区 -->
          <div class="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
            <!-- Prompts -->
            <div v-for="(p, idx) in editPrompts" :key="p.id" class="relative">
              <div class="flex items-center gap-2 mb-1">
                <label class="field-label flex-1">
                  <input
                    v-model="p.label"
                    class="bg-transparent border-none outline-none text-sm font-medium text-ink-2 w-full"
                    placeholder="字段名称"
                  />
                </label>
                <button
                  v-if="editPrompts.length > 1"
                  class="text-ink-2/40 hover:text-danger transition-colors"
                  @click="removePrompt(idx)"
                  title="删除此字段"
                >
                  <X :size="14" />
                </button>
              </div>
              <RichEditor
                :model-value="p.value"
                @update:model-value="p.value = $event"
                :placeholder="'编辑内容…'"
                :minimal="true"
              />
            </div>

            <!-- 添加字段按钮 -->
            <button
              class="flex items-center gap-1.5 text-sm text-ink-2 hover:text-accent transition-colors"
              @click="addPrompt"
            >
              <Plus :size="14" />
              添加自定义字段
            </button>

            <!-- 心情（仅日记） -->
            <div v-if="entry.module === 'diary'">
              <label class="field-label">此刻的心情</label>
              <input class="input" placeholder="例如：平静 / 有点累 / 雀跃" v-model="editMood" />
            </div>

            <!-- 标签 -->
            <div>
              <label class="field-label">
                <span class="inline-flex items-center gap-1"><Tag :size="13" /> 标签（逗号分隔）</span>
              </label>
              <input class="input" placeholder="复盘, 阅读" v-model="editTags" />
              <SmartTagSuggest :text="combinedText" :manual-tags="parseTags()" @select-tag="onSmartTagSelect" />
            </div>
          </div>

          <!-- 底部 -->
          <div class="flex items-center justify-between px-6 py-4 border-t border-line/50 shrink-0">
            <transition name="fade">
              <span v-if="savedFlash" class="text-sm text-accent font-medium">已保存 ✓</span>
            </transition>
            <div class="flex gap-2 ml-auto">
              <button class="btn btn-ghost" @click="emit('close')">取消</button>
              <button class="btn btn-primary" @click="saveEdit" :disabled="saving">
                <Save :size="16" />
                {{ saving ? '保存中…' : '保存修改' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </transition>
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
