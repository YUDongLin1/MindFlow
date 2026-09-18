<script setup lang="ts">
import { Download, Copy, X } from 'lucide-vue-next'
import { downloadMarkdown, copyMarkdown } from '@/services/markdownExport'
import type { WeeklyReportOutput } from '@/services/weeklyReport'
import { track, EVENTS } from '@/services/analytics'

const props = defineProps<{
  report: WeeklyReportOutput | null
  visible: boolean
}>()

const emit = defineEmits<{ close: [] }>()

async function copy() {
  if (!props.report) return
  await copyMarkdown(props.report.markdown)
  track(EVENTS.EXPORT_TRIGGERED, { format: 'markdown', action: 'copy', source: 'weekly_report' })
}

function download() {
  if (!props.report) return
  const fileName = `工作周报-${props.report.range.start}~${props.report.range.end}.md`
  downloadMarkdown(fileName, props.report.markdown)
  track(EVENTS.EXPORT_TRIGGERED, { format: 'markdown', action: 'download', source: 'weekly_report' })
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible && report"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: rgb(35 43 38 / 0.4); backdrop-filter: blur(2px);"
      @click.self="emit('close')"
    >
      <div class="card w-full max-w-2xl max-h-[85vh] flex flex-col">
        <!-- 头部 -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-line/60">
          <div class="flex items-center gap-2">
            <h3 class="text-ink font-semibold">工作周报</h3>
            <span class="chip">{{ report.range.start }} ~ {{ report.range.end }}</span>
          </div>
          <button class="btn btn-ghost !p-2" @click="emit('close')">
            <X :size="18" />
          </button>
        </div>

        <!-- 统计摘要 -->
        <div class="px-5 py-3 flex gap-4 text-sm border-b border-line/40">
          <span class="text-ink-2">覆盖 <span class="text-ink font-semibold">{{ report.daysCovered }}</span> 天</span>
          <span class="text-ink-2">做了 <span class="text-ink font-semibold">{{ report.counts.did }}</span> 条</span>
          <span class="text-ink-2">卡点 <span class="text-ink font-semibold">{{ report.counts.stuck }}</span> 条</span>
          <span class="text-ink-2">下一步 <span class="text-ink font-semibold">{{ report.counts.next }}</span> 条</span>
        </div>

        <!-- Markdown 预览 -->
        <div class="flex-1 overflow-auto custom-scrollbar px-5 py-4">
          <pre class="text-[0.82rem] leading-relaxed text-ink whitespace-pre-wrap">{{ report.markdown }}</pre>
        </div>

        <!-- 底部操作 -->
        <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-line/60">
          <button class="btn btn-ghost" @click="copy">
            <Copy :size="16" /> 复制
          </button>
          <button class="btn btn-primary" @click="download">
            <Download :size="16" /> 下载 .md
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
