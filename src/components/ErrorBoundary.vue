<template>
  <div>
    <slot v-if="!hasError"></slot>
    <div v-else class="error-boundary">
      <div class="error-boundary-card">
        <h2>应用遇到了问题</h2>
        <p class="text-sm text-ink-2 mt-2">请刷新页面重试。如果问题持续，请检查数据是否已保存。</p>
        <pre class="error-detail">{{ error }}</pre>
        <button class="btn btn-primary mt-3" @click="reload">刷新页面</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue'
import { track, EVENTS } from '@/services/analytics'

const hasError = ref(false)
const error = ref('')

onErrorCaptured((err) => {
  hasError.value = true
  error.value = err.message || 'Unknown error'
  console.error('[ErrorBoundary]', err)

  // 崩溃埋点
  track(EVENTS.APP_CRASH, {
    type: 'vue_error_captured',
    message: err.message || 'Unknown error',
    stack: err.stack,
  })

  return false // 阻止进一步传播
})

function reload() {
  window.location.reload()
}
</script>

<style scoped>
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}
.error-boundary-card {
  max-width: 480px;
  padding: 2rem;
  background: rgb(var(--surface));
  border: 1px solid rgb(var(--line));
  border-radius: 1.25rem;
  box-shadow: 0 8px 24px rgb(35 43 38 / 0.06);
}
.error-boundary-card h2 {
  color: rgb(var(--danger));
}
.error-detail {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgb(var(--surface-2));
  border: 1px solid rgb(var(--line) / 0.6);
  border-radius: 0.5rem;
  font-size: 0.8rem;
  color: rgb(var(--ink-2));
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}
</style>
