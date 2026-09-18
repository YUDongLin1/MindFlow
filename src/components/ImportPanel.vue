<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, FileText, AlertTriangle, CheckCircle, X, Loader2, ChevronDown } from 'lucide-vue-next'
import {
  parseImportFile,
  executeImport,
  SOURCE_LABELS,
  ACCEPTED_EXTENSIONS,
  type ImportPreview,
  type ImportResult,
  type ImportConflict,
} from '@/services/importService'
import { track, EVENTS } from '@/services/analytics'

import { useJournalStore } from '@/stores/journal'

const emit = defineEmits<{ close: [] }>()

const journalStore = useJournalStore()
const { t } = useI18n()

const fileInput = ref<HTMLInputElement | null>(null)
const loading = ref(false)
const error = ref('')
const preview = ref<ImportPreview | null>(null)
const conflictMode = ref<'skip' | 'overwrite' | 'merge'>('skip')
const result = ref<ImportResult | null>(null)
const importing = ref(false)

// 拖拽状态
const isDragging = ref(false)

const existingEntries = computed(() => journalStore.entries || [])

function triggerFileInput() {
  fileInput.value?.click()
}

async function handleFile(file: File) {
  loading.value = true
  error.value = ''
  preview.value = null
  result.value = null

  try {
    preview.value = await parseImportFile(file, existingEntries.value)
  } catch (e: any) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.[0]) handleFile(input.files[0])
}

function onDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) handleFile(file)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function doImport() {
  if (!preview.value) return
  importing.value = true
  try {
    result.value = await executeImport(preview.value, journalStore, conflictMode.value)
    track(EVENTS.IMPORT_COMPLETED, {
      source: preview.value.source,
      imported: result.value.imported,
      skipped: result.value.skipped,
      errors: result.value.errors.length,
      conflictMode: conflictMode.value,
    })
  } catch (e: any) {
    error.value = `导入失败：${e.message}`
  } finally {
    importing.value = false
  }
}

function reset() {
  preview.value = null
  result.value = null
  error.value = ''
  conflictMode.value = 'skip'
}

const hasConflicts = computed(() => preview.value && preview.value.conflicts.length > 0)
</script>

<template>
  <div class="card p-6 max-w-2xl mx-auto">
    <!-- 标题栏 -->
    <div class="flex items-center justify-between mb-5">
      <h2 class="flex items-center gap-2">
        <Upload :size="20" class="text-accent" />
        导入数据
      </h2>
      <button class="btn btn-ghost !px-2 !py-1.5" @click="emit('close')">
        <X :size="18" />
      </button>
    </div>

    <!-- 错误提示 -->
    <div v-if="error" class="p-3 rounded-lg bg-danger/10 border border-danger/30 text-sm text-danger mb-4">
      {{ error }}
    </div>

    <!-- 导入结果 -->
    <div v-if="result" class="space-y-4">
      <div class="flex items-center gap-3 p-4 rounded-xl" :class="result.errors.length > 0 ? 'bg-ember/10' : 'bg-accent-soft'">
        <CheckCircle :size="24" :class="result.errors.length > 0 ? 'text-ember' : 'text-accent'" />
        <div>
          <div class="font-semibold">导入完成</div>
          <div class="text-sm text-ink-2">
            成功 {{ result.imported }} 条，跳过 {{ result.skipped }} 条
            <span v-if="result.errors.length">，{{ result.errors.length }} 条失败</span>
          </div>
        </div>
      </div>

      <div v-if="result.errors.length" class="p-3 rounded-lg bg-ember/5 text-sm text-ember max-h-32 overflow-y-auto custom-scrollbar">
        <div v-for="(err, i) in result.errors" :key="i" class="mb-0.5">{{ err }}</div>
      </div>

      <div class="flex gap-2 justify-end">
        <button class="btn btn-ghost" @click="reset">继续导入</button>
        <button class="btn btn-primary" @click="emit('close')">完成</button>
      </div>
    </div>

    <!-- 预览 -->
    <div v-else-if="preview" class="space-y-4">
      <!-- 统计卡片 -->
      <div class="grid grid-cols-4 gap-3">
        <div class="card-soft p-3 text-center">
          <div class="text-xl font-bold text-ink">{{ preview.stats.total }}</div>
          <div class="text-xs text-ink-2">总计</div>
        </div>
        <div class="card-soft p-3 text-center">
          <div class="text-xl font-bold text-accent">{{ preview.stats.new }}</div>
          <div class="text-xs text-ink-2">新增</div>
        </div>
        <div class="card-soft p-3 text-center">
          <div class="text-xl font-bold text-ember">{{ preview.stats.conflicts }}</div>
          <div class="text-xs text-ink-2">冲突</div>
        </div>
        <div class="card-soft p-3 text-center">
          <div class="text-xl font-bold text-ink">{{ preview.stats.tags.length }}</div>
          <div class="text-xs text-ink-2">标签</div>
        </div>
      </div>

      <!-- 来源与时间范围 -->
      <div class="flex items-center gap-3 text-sm text-ink-2">
        <span class="chip">{{ SOURCE_LABELS[preview.source] }}</span>
        <span v-if="preview.stats.dateRange">
          {{ preview.stats.dateRange.start }} ~ {{ preview.stats.dateRange.end }}
        </span>
      </div>

      <!-- 冲突处理 -->
      <div v-if="hasConflicts" class="p-4 rounded-xl bg-ember/5 border border-ember/20">
        <div class="flex items-center gap-2 mb-3">
          <AlertTriangle :size="16" class="text-ember" />
          <span class="text-sm font-semibold text-ember">
            发现 {{ preview.conflicts.length }} 条冲突（同日期+同模块已存在记录）
          </span>
        </div>
        <div class="flex gap-2">
          <button
            v-for="mode in [
              { value: 'skip' as const, label: '跳过冲突', desc: '保留已有记录' },
              { value: 'overwrite' as const, label: '覆盖', desc: '用导入数据替换' },
              { value: 'merge' as const, label: '追加', desc: '同时保留两条' },
            ]"
            :key="mode.value"
            @click="conflictMode = mode.value"
            class="flex-1 p-2.5 rounded-lg border-2 transition-all cursor-pointer text-left"
            :class="conflictMode === mode.value
              ? 'border-accent bg-accent-soft'
              : 'border-line/50 hover:border-line'"
          >
            <div class="text-xs font-medium" :class="conflictMode === mode.value ? 'text-accent' : 'text-ink'">{{ mode.label }}</div>
            <div class="text-[0.65rem] text-ink-2">{{ mode.desc }}</div>
          </button>
        </div>
      </div>

      <!-- 导入条目预览（最多显示 10 条） -->
      <div>
        <h3 class="text-sm font-semibold text-ink-2 mb-2">预览（前 10 条）</h3>
        <div class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          <div
            v-for="(entry, i) in preview.entries.slice(0, 10)"
            :key="i"
            class="p-3 rounded-lg bg-surface-2 border border-line/50 text-sm"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-ink-2">{{ entry.date }}</span>
              <span class="chip chip-soft !text-[0.6rem] !py-0">
                {{ entry.module === 'diary' ? '日记' : entry.module === 'work' ? '工作' : '学习' }}
              </span>
              <span v-for="tag in entry.tags.slice(0, 3)" :key="tag" class="chip chip-soft !text-[0.55rem] !py-0">{{ tag }}</span>
            </div>
            <div class="text-ink line-clamp-2">{{ entry.content.slice(0, 150) }}{{ entry.content.length > 150 ? '…' : '' }}</div>
          </div>
        </div>
        <div v-if="preview.entries.length > 10" class="text-xs text-ink-2 mt-1 text-center">
          还有 {{ preview.entries.length - 10 }} 条…
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-2 justify-end pt-2">
        <button class="btn btn-ghost" @click="reset">重新选择</button>
        <button class="btn btn-primary" @click="doImport" :disabled="importing">
          <Loader2 v-if="importing" :size="16" class="animate-spin" />
          <CheckCircle v-else :size="16" />
          {{ importing ? '导入中…' : `确认导入 ${preview.stats.new} 条` }}
        </button>
      </div>
    </div>

    <!-- 文件选择区域 -->
    <div v-else>
      <div
        @drop.prevent="onDrop"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @click="triggerFileInput"
        class="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all"
        :class="isDragging
          ? 'border-accent bg-accent-soft'
          : 'border-line hover:border-accent/50'"
      >
        <Upload :size="36" :class="isDragging ? 'text-accent' : 'text-ink-2'" class="mx-auto mb-3" />
        <div class="text-sm font-medium text-ink mb-1">
          {{ loading ? '解析中…' : '拖拽文件到此处，或点击选择' }}
        </div>
        <div class="text-xs text-ink-2">
          支持格式：JSON（MindFlow/MindFlow 备份）、TXT（微信小记/备忘录）、CSV/Markdown（Notion 导出）
        </div>
        <div class="text-xs text-ink-2/70 mt-2">
          文件扩展名：{{ ACCEPTED_EXTENSIONS }}
        </div>
      </div>

      <input
        ref="fileInput"
        type="file"
        :accept="ACCEPTED_EXTENSIONS"
        @change="onFileChange"
        class="hidden"
      />
    </div>
  </div>
</template>
