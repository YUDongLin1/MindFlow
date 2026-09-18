import { createRouter, createWebHistory, createWebHashHistory, RouteRecordRaw } from 'vue-router'

// 懒加载路由组件
const Homepage = () => import('../views/Homepage.vue')
const Growth = () => import('../views/Growth.vue')
const Knowledge = () => import('../views/Knowledge.vue')
const Privacy = () => import('../views/Privacy.vue')
const Calendar = () => import('../views/Calendar.vue')
const Settings = () => import('../views/Settings.vue')

const routes: Array<RouteRecordRaw> = [
  { path: '/', name: 'Home', component: Homepage },
  { path: '/growth', name: 'Growth', component: Growth },
  { path: '/knowledge', name: 'Knowledge', component: Knowledge },
  { path: '/calendar', name: 'Calendar', component: Calendar },
  { path: '/privacy', name: 'Privacy', component: Privacy },
  { path: '/settings', name: 'Settings', component: Settings },
]

// Electron 生产环境用 hash 路由（file:// 协议），Web 用 history
const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:'
const router = createRouter({
  history: isFileProtocol ? createWebHashHistory() : createWebHistory(),
  routes,
})

// ---------------------------------------------------------------------------
// 动态 import 容错：应用更新后旧 chunk 失效 / 网络抖动导致懒加载失败时，
// 一次性 reload 重试；若重试后仍失败则提示并回退首页，避免无限刷新循环。
// ---------------------------------------------------------------------------
const CHUNK_RELOAD_FLAG = 'mindflow:chunk-reload-retry'

function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  )
}

router.onError((err, to) => {
  if (!isChunkLoadError(err)) return
  try {
    const retried = sessionStorage.getItem(CHUNK_RELOAD_FLAG) === '1'
    if (!retried) {
      sessionStorage.setItem(CHUNK_RELOAD_FLAG, '1')
      window.location.reload()
      return
    }
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG)
    console.error('[router] 页面模块加载失败，已回退首页：', err)
    window.alert('页面资源加载失败（可能是应用刚更新），已为你返回首页。若反复出现请重启应用。')
    router.replace(to?.fullPath === '/' ? '/' : '/')
  } catch (e) {
    console.error('[router] chunk 错误处理失败：', e)
  }
})

// 导航成功后清除重试标记，保证下一轮失败仍可享受一次性 reload 重试
router.afterEach(() => {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_FLAG)
  } catch {
    // ignore
  }
})

export default router
