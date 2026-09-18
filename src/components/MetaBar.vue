<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { MapPin, Cloud, Clock, Loader2 } from 'lucide-vue-next'
import { getCurrentMeta, type CurrentMeta } from '@/services/metaService'

const meta = ref<CurrentMeta>({ time: '', location: null, weather: null })
const loading = ref(true)

onMounted(async () => {
  try {
    meta.value = await getCurrentMeta()
  } catch {
    // 静默降级
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="flex items-center gap-3 text-xs text-ink-2 flex-wrap">
    <!-- 时间 -->
    <span class="flex items-center gap-1">
      <Clock :size="12" />
      <span v-if="loading">获取中…</span>
      <span v-else>{{ meta.time || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</span>
    </span>

    <!-- 地点 -->
    <span v-if="meta.location" class="flex items-center gap-1">
      <MapPin :size="12" />
      <span>{{ meta.location.city }}</span>
    </span>

    <!-- 天气 -->
    <span v-if="meta.weather" class="flex items-center gap-1">
      <span>{{ meta.weather.icon }}</span>
      <span>{{ meta.weather.description }} {{ meta.weather.temperature }}°C</span>
    </span>

    <!-- 加载中 -->
    <span v-if="loading" class="flex items-center gap-1">
      <Loader2 :size="12" class="animate-spin" />
    </span>
  </div>
</template>
