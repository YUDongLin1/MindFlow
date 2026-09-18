<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Home, TrendingUp, BookOpen, Shield, Calendar, Sun, Moon, User, Settings2 } from 'lucide-vue-next'
import MindFlowMark from './MindFlowMark.vue'
import { useTheme } from '@/composables/useTheme'
import { type AIMode, useJournalStore } from '@/stores/journal'
import { APP_VERSION } from '@/utils/appMeta'

const route = useRoute()
const router = useRouter()
const journalStore = useJournalStore()
const { t } = useI18n()
const { effectiveTheme, toggleTheme } = useTheme()

const nav = [
  { path: '/', labelKey: 'nav.today', icon: Home },
  { path: '/growth', labelKey: 'nav.growth', icon: TrendingUp },
  { path: '/knowledge', labelKey: 'nav.knowledge', icon: BookOpen },
  { path: '/calendar', labelKey: 'nav.calendar', icon: Calendar },
  { path: '/privacy', labelKey: 'nav.privacy', icon: Shield },
]

const isActive = (path: string) => (path === '/' ? route.path === '/' : route.path.startsWith(path))

const aiModeLabel = computed(() => {
  const m = journalStore.prefs.aiMode as AIMode
  return m === 'local' ? t('privacy.localMirror') : m === 'byok' ? t('privacy.bringKey') : t('privacy.cloud')
})

function navigateToSettings() {
  router.push('/settings')
}

function openAccount() {
  // Reserved for cloud login/registration
  console.log('[account] Account clicked — cloud login/registration not yet implemented')
}
</script>

<template>
  <div class="app-bg h-screen flex flex-col text-ink overflow-hidden">
    <div class="flex flex-1 min-h-0">
      <!-- sidebar -->
      <aside class="w-60 shrink-0 flex flex-col border-r border-line/60 bg-surface">
        <div class="px-5 py-6">
          <MindFlowMark />
        </div>

        <nav class="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="nav">
          <router-link
            v-for="item in nav"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[0.95rem] font-medium transition-colors"
            :class="isActive(item.path)
              ? 'bg-accent-soft text-accent'
              : 'text-ink-2 hover:bg-surface-2 hover:text-ink'"
          >
            <component :is="item.icon" :size="19" aria-hidden="true" />
            <span>{{ t(item.labelKey) }}</span>
          </router-link>
        </nav>

        <!-- Bottom section: Account + Settings -->
        <div class="px-4 py-3 border-t border-line/60">
          <div class="flex items-center justify-between">
            <!-- Account info -->
            <button
              class="flex items-center gap-2 text-[0.8rem] text-ink-2 hover:text-ink transition-colors cursor-pointer"
              @click="openAccount"
              :aria-label="t('sidebar.account', '账号')"
            >
              <div class="w-7 h-7 rounded-full bg-accent-soft flex items-center justify-center">
                <User :size="14" class="text-accent" />
              </div>
              <span class="truncate max-w-[80px]">{{ t('sidebar.account', '账号') }}</span>
            </button>

            <!-- Settings icon -->
            <button
              class="btn btn-ghost !px-2 !py-2 rounded-lg"
              @click="navigateToSettings"
              :aria-label="t('nav.settings', '设置')"
              :class="route.path === '/settings' ? 'text-accent bg-accent-soft' : 'text-ink-2 hover:text-ink'"
            >
              <Settings2 :size="18" />
            </button>
          </div>

          <div class="flex items-center gap-2 text-[0.72rem] text-ink-2 mt-2">
            <span class="w-2 h-2 rounded-full bg-accent animate-breathe" aria-hidden="true"></span>
            {{ t('sidebar.dataLocal') }}
          </div>
          <div class="text-[0.66rem] text-ink-2/70 mt-1">MindFlow v{{ APP_VERSION }} · {{ t('sidebar.localFirst') }}</div>
        </div>
      </aside>

      <!-- main -->
      <div class="flex-1 flex flex-col min-w-0 min-h-0">
        <header class="h-14 shrink-0 px-6 flex items-center justify-between border-b border-line/50 bg-paper/40">
          <div class="text-sm text-ink-2">{{ t('sidebar.subtitle') }}</div>
          <div class="flex items-center gap-2">
            <span class="chip">
              <span class="w-1.5 h-1.5 rounded-full bg-accent" aria-hidden="true"></span>
              AI · {{ aiModeLabel }}
            </span>
            <button
              class="btn btn-ghost !px-2.5 !py-2"
              @click="toggleTheme"
              :aria-label="effectiveTheme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')"
            >
              <component :is="effectiveTheme === 'dark' ? Sun : Moon" :size="18" />
            </button>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto custom-scrollbar">
          <router-view v-slot="{ Component }">
            <transition name="fade">
              <keep-alive>
                <component :is="Component" />
              </keep-alive>
            </transition>
          </router-view>
        </main>
      </div>
    </div>
  </div>
</template>
