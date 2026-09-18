<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Clock, Monitor } from 'lucide-vue-next'
import { getTodayUsage, formatDuration, type DailyUsageData } from '@/services/usageTracker'

const usage = ref<DailyUsageData>({ date: '', mindflowMs: 0, apps: [] })
let timer: ReturnType<typeof setInterval> | null = null

function refresh() {
  usage.value = getTodayUsage()
}

onMounted(() => {
  refresh()
  timer = setInterval(refresh, 30_000) // 每 30 秒刷新
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="card p-4">
    <div class="flex items-center gap-2 mb-3">
      <Clock :size="16" class="text-accent" />
      <h3 class="text-sm font-semibold text-ink">今日使用时间</h3>
    </div>

    <div class="space-y-2">
      <!-- MindFlow 使用时长 -->
      <div class="flex items-center justify-between p-2.5 rounded-lg bg-surface-2">
        <div class="flex items-center gap-2">
          <Monitor :size="14" class="text-accent" />
          <span class="text-sm text-ink">MindFlow</span>
        </div>
        <span class="text-sm font-medium text-accent">{{ formatDuration(usage.mindflowMs) }}</span>
      </div>

      <!-- 外部软件使用时长（仅 Electron 环境；全量展示，滚动查看） -->
      <div v-if="usage.apps.length > 0" class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
        <div
          v-for="app in usage.apps"
          :key="app.appName"
          class="flex items-center justify-between p-2.5 rounded-lg bg-surface-2"
        >
          <span class="text-sm text-ink truncate max-w-[60%]">{{ app.appName }}</span>
          <span class="text-sm text-ink-2">{{ formatDuration(app.durationMs) }}</span>
        </div>
      </div>

      <div v-if="usage.apps.length === 0" class="text-xs text-ink-2 text-center py-2">
        已记录 MindFlow 活跃时间；桌面端还将同步外部应用使用统计（每 30 秒更新，含周末与节假日）
      </div>
    </div>
  </div>
</template>
