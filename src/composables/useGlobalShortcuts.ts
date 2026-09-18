import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

/**
 * 全局导航快捷键：
 * - Ctrl/Cmd + N  → 回到「今日」新建记录
 * - Ctrl/Cmd + F  → 跳转知识库并聚焦搜索框
 * - Ctrl/Cmd + ,  → 打开设置
 * 编辑器相关快捷键（Ctrl+S / Ctrl+E / Ctrl+D / Ctrl+L / Ctrl+Shift+A）由 Homepage 自行处理。
 */
export function useGlobalShortcuts() {
  const router = useRouter()

  function onKeyDown(event: KeyboardEvent) {
    const mod = event.ctrlKey || event.metaKey
    if (!mod || event.altKey) return

    const key = event.key.toLowerCase()

    // Ctrl+Shift+A 留给 Homepage（AI 复盘）
    if (event.shiftKey) return

    if (key === 'n') {
      event.preventDefault()
      router.push('/')
    } else if (key === 'f') {
      event.preventDefault()
      router.push({ path: '/knowledge', query: { focus: 'search' } })
    } else if (key === ',') {
      event.preventDefault()
      router.push('/settings')
    }
  }

  onMounted(() => document.addEventListener('keydown', onKeyDown))
  onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
}
