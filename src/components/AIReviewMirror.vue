<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { PenLine, Check, RotateCcw, X, ShieldCheck } from 'lucide-vue-next'
import { generateReview } from '@/services/aiClient'
import type { AIConfig } from '@/services/aiClient'
import type { JournalEntry, AIReviewSegment, AIMode } from '@/stores/journal'
import { useJournalStore } from '@/stores/journal'
import { track, EVENTS } from '@/services/analytics'
import { getVariant, trackExposure } from '@/services/abTest'

const props = defineProps<{ entry: JournalEntry }>()
const journalStore = useJournalStore()

const draft = ref<AIReviewSegment>({ achievements: '', learnings: '', improvements: '', actions: '' })
const original = ref<AIReviewSegment | null>(null)
const generating = ref(false)
const wireNotice = ref(false)
const error = ref('')
const fallbackNotice = ref(false)
const sourceLabel = ref<string>('')
const hasEdited = ref(false)
const autoInjected = ref(false)

// A/B 实验分桶
const exp1Variant = ref<'control' | 'treatment' | null>(null)
const exp2Variant = ref<'control' | 'treatment' | null>(null)
const exp3Variant = ref<'control' | 'treatment' | null>(null)

const review = computed(() => props.entry.review)
const hasDraft = computed(() => !!review.value && review.value.status !== 'idle')

function syncFromEntry() {
  if (props.entry.review && props.entry.review.draft) {
    draft.value = { ...props.entry.review.draft }
    original.value = { ...props.entry.review.draft }
  }
}
watch(() => props.entry.id, syncFromEntry, { immediate: true })

onMounted(async () => {
  // 初始化实验分桶
  exp1Variant.value = await getVariant('exp1_privacy')
  exp2Variant.value = await getVariant('exp2_quote')
  exp3Variant.value = await getVariant('exp3_default')

  // 曝光埋点
  await trackExposure('exp1_privacy')
  await trackExposure('exp3_default')

  // exp3 treatment: 首次展开自动预填草稿
  if (exp3Variant.value === 'treatment' && !hasDraft.value && !autoInjected.value) {
    autoInjected.value = true
    await runGenerate()
  }
})

async function runGenerate(modeOverride?: AIMode) {
  generating.value = true
  error.value = ''
  wireNotice.value = false
  fallbackNotice.value = false
  hasEdited.value = false

  // 触发埋点
  await track(EVENTS.AI_REVIEW_TRIGGERED, {
    module: props.entry.module,
    mode: modeOverride || journalStore.prefs.aiMode,
  })

  const cfg: AIConfig = {
    mode: (modeOverride || journalStore.prefs.aiMode) as AIMode,
    apiKey: journalStore.prefs.aiKey,
    aiBaseUrl: journalStore.prefs.aiBaseUrl,
    aiModel: journalStore.prefs.aiModel,
  }

  try {
    // exp2_quote treatment → polished 模式
    const opts = { polished: exp2Variant.value === 'treatment' }
    const res = await generateReview(props.entry, cfg, opts)
    draft.value = res.draft
    original.value = res.draft
    sourceLabel.value = res.source
    fallbackNotice.value = res.source === 'local-fallback'

    // 生成完成埋点
    await track(EVENTS.AI_REVIEW_GENERATED, {
      source: res.source,
      accuracyFlag: res.accuracyFlag,
      module: props.entry.module,
    })

    await journalStore.setAIReview({
      entryId: props.entry.id,
      review: {
        status: 'generated',
        draft: res.draft,
        source: res.source,
        note: res.note,
        accuracyFlag: res.accuracyFlag,
        generatedAt: new Date().toISOString(),
      },
    })

    // 渲染完成埋点
    await track(EVENTS.AI_REVIEW_VIEWED, {
      source: res.source,
      module: props.entry.module,
    })
  } catch (e: any) {
    if (e?.code === 'REAL_LLM_NOT_WIRED' || e?.code === 'CLOUD_LLM_NOT_CONFIGURED') {
      wireNotice.value = true
      await track(EVENTS.AI_REVIEW_DISMISSED, {
        reason: e.code,
        module: props.entry.module,
      })
    } else {
      error.value = e?.message || '生成失败'
    }
  } finally {
    generating.value = false
  }
}

async function adopt() {
  // 如果有编辑，先记录 edited 事件
  if (hasEdited.value && original.value) {
    await track(EVENTS.AI_REVIEW_EDITED, {
      module: props.entry.module,
    })
  }

  await journalStore.setAIReview({
    entryId: props.entry.id,
    review: {
      status: 'adopted',
      draft: { ...draft.value },
      source: review.value?.source || 'local',
      note: review.value?.note,
      accuracyFlag: review.value?.accuracyFlag,
      generatedAt: review.value?.generatedAt,
    },
  })

  await track(EVENTS.AI_REVIEW_ADOPTED, {
    module: props.entry.module,
    source: review.value?.source || 'local',
  })
}

async function dismiss() {
  await journalStore.setAIReview({
    entryId: props.entry.id,
    review: {
      status: 'dismissed',
      draft: { ...draft.value },
      source: review.value?.source || 'local',
      note: review.value?.note,
      accuracyFlag: review.value?.accuracyFlag,
      generatedAt: review.value?.generatedAt,
    },
  })

  await track(EVENTS.AI_REVIEW_DISMISSED, {
    module: props.entry.module,
    source: review.value?.source || 'local',
  })
}

function restore() {
  if (original.value) {
    draft.value = { ...original.value }
    hasEdited.value = false
    // 还原事件埋点
    track(EVENTS.AI_REVIEW_RESTORED_ORIGINAL, {
      module: props.entry.module,
    })
  }
}

function onEdit() {
  hasEdited.value = true
}

const segments: { key: keyof AIReviewSegment; label: string }[] = [
  { key: 'achievements', label: '今日成果' },
  { key: 'learnings', label: '学习收获' },
  { key: 'improvements', label: '待改进' },
  { key: 'actions', label: '明日行动' },
]
</script>

<template>
  <div class="card p-5 mt-3">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2">
        <ShieldCheck :size="18" class="text-accent" />
        <h4 class="text-ink font-semibold">镜子式复盘</h4>
        <span class="chip">草稿 · 需你确认</span>
        <!-- exp1 隐私徽标 -->
        <span v-if="exp1Variant === 'treatment'" class="chip-soft text-[0.7rem] px-2 py-0.5 rounded-full">
          本地 · 不训练 · 可关
        </span>
      </div>
      <span v-if="review?.accuracyFlag" class="text-[0.72rem] text-ink-2 flex items-center gap-1">
        <ShieldCheck :size="13" /> 可溯源 · 未润色
      </span>
    </div>

    <p class="text-[0.8rem] text-ink-2 mb-4 leading-relaxed">
      AI 是镜子，不是写手。下面只映照你写下的内容，不会替你定稿。你可以编辑，或一键还原。
    </p>

    <!-- 回退提示 -->
    <div v-if="fallbackNotice" class="card-soft p-3 mb-3 border-l-4" style="border-left-color: rgb(var(--ember));">
      <p class="text-[0.82rem] text-ember">
        网络异常，已用本地镜像预览。你可以检查 AI 设置后重试，或直接使用本地镜像结果。
      </p>
    </div>

    <!-- 未生成 -->
    <div v-if="!hasDraft" class="flex flex-col items-start gap-3">
      <button class="btn btn-primary" @click="runGenerate()" :disabled="generating">
        <PenLine :size="16" /> {{ generating ? '生成中…' : '生成复盘' }}
      </button>

      <div v-if="wireNotice" class="w-full card-soft p-4">
        <p class="text-[0.85rem] text-ink-2 mb-2">
          当前选择的 AI 模式（{{ journalStore.prefs.aiMode }}）需要接入真实模型与 API Key，尚未配置。
        </p>
        <button class="btn btn-ghost" @click="runGenerate('local')">
          <PenLine :size="16" /> 用「本地镜像」预览
        </button>
      </div>
      <p v-if="error" class="text-[0.82rem] text-danger">{{ error }}</p>
    </div>

    <!-- 已生成 / 已采纳 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 原始记录 -->
      <div class="card-soft p-4">
        <div class="text-[0.72rem] font-semibold text-ink-2 mb-2 tracking-wide">原始记录</div>
        <ul class="space-y-2 text-[0.85rem] text-ink">
          <li v-for="p in entry.prompts.filter(p => p.value)" :key="p.id">
            <span class="text-ink-2">{{ p.label }}：</span>{{ p.value }}
          </li>
        </ul>
      </div>

      <!-- AI 映照（可编辑） -->
      <div class="space-y-3">
        <div v-for="s in segments" :key="s.key">
          <label class="field-label">{{ s.label }}</label>
          <textarea
            class="input"
            rows="2"
            v-model="draft[s.key]"
            @input="onEdit"
          ></textarea>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button class="btn btn-primary" @click="adopt">
            <Check :size="16" /> 采纳
          </button>
          <button class="btn btn-ghost" @click="restore">
            <RotateCcw :size="16" /> 还原
          </button>
          <button class="btn btn-ghost" @click="dismiss">
            <X :size="16" /> 丢弃
          </button>
          <span
            class="text-[0.72rem] px-2 py-1 rounded-full"
            :class="review?.status === 'adopted' ? 'bg-accent-soft text-accent' : 'chip-soft'"
          >
            {{ review?.status === 'adopted' ? '已采纳' : review?.status === 'dismissed' ? '已丢弃' : '待确认' }}
          </span>
        </div>
        <p v-if="review?.note" class="text-[0.72rem] text-ink-2 leading-relaxed">{{ review.note }}</p>
      </div>
    </div>
  </div>
</template>
