<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { useGlobalShortcuts } from '@/composables/useGlobalShortcuts'
import ErrorBoundary from './components/ErrorBoundary.vue'
import AppShell from './components/AppShell.vue'
import { track, EVENTS } from '@/services/analytics'
import { assignVariant } from '@/services/abTest'

const { initTheme } = useTheme()
useGlobalShortcuts()

// 全局错误捕获
function onWindowError(event: ErrorEvent) {
  track(EVENTS.APP_CRASH, {
    type: 'error',
    message: event.error?.message || event.message || 'Unknown error',
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
  })
}

function onUnhandledRejection(event: PromiseRejectionEvent) {
  track(EVENTS.APP_CRASH, {
    type: 'unhandledrejection',
    message: event.reason?.message || String(event.reason) || 'Unknown rejection',
  })
}

onMounted(() => {
  initTheme()

  // 首次启动埋点 + 实验分配
  const signupKey = 'mindflow:signup'
  if (!localStorage.getItem(signupKey)) {
    localStorage.setItem(signupKey, new Date().toISOString())
    track(EVENTS.SIGNUP, { ts: new Date().toISOString() })
  }

  // 分配实验分桶
  assignVariant('exp1_privacy').catch(() => {})
  assignVariant('exp3_default').catch(() => {})

  // 全局错误监听
  window.addEventListener('error', onWindowError)
  window.addEventListener('unhandledrejection', onUnhandledRejection)
})

onUnmounted(() => {
  window.removeEventListener('error', onWindowError)
  window.removeEventListener('unhandledrejection', onUnhandledRejection)
})
</script>

<template>
  <ErrorBoundary>
    <AppShell />
  </ErrorBoundary>
</template>

<style scoped>
/* Global styles if any */
</style>
