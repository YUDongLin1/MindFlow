<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Sun, Moon, Monitor, Check, Globe, Info, Settings as SettingsIcon, Upload, Download, Database, FolderOpen, RotateCcw } from 'lucide-vue-next'
import { useTheme, type Theme } from '@/composables/useTheme'
import { useJournalStore } from '@/stores/journal'
import { useSettingsStore } from '@/stores/settings'
import { exportJournalJSON, exportJournalCSV, exportJournalMarkdown } from '@/services/dataExport'
import { APP_VERSION, BUILD_DATE } from '@/utils/appMeta'
import localforage from 'localforage'
import ImportPanel from '@/components/ImportPanel.vue'
import CustomModuleManager from '@/components/CustomModuleManager.vue'
import PetSettingsPanel from '@/components/PetSettingsPanel.vue'

const { t, locale } = useI18n()
const journalStore = useJournalStore()
const settingsStore = useSettingsStore()
const { currentTheme, setTheme } = useTheme()

// 语言
const currentLanguage = ref<string>(locale.value as string || 'zh')

async function setLanguage(lang: 'en' | 'zh') {
  currentLanguage.value = lang
  locale.value = lang
  await localforage.setItem('settings:language', lang)
}

// 自动保存
const autoSaveEnabled = computed(() => settingsStore.settings?.autoSaveOnClose ?? true)

async function toggleAutoSave() {
  const newValue = !autoSaveEnabled.value
  try {
    await settingsStore.updateSetting('autoSaveOnClose', newValue)
  } catch (e) {
    console.error('Failed to update auto-save:', e)
  }
}

// 主题卡片
const themeOptions: { key: Theme; icon: any; titleKey: string; subtitleKey: string; descKey: string }[] = [
  { key: 'light', icon: Sun, titleKey: 'settings.themeOptions.light.title', subtitleKey: 'settings.themeOptions.light.subtitle', descKey: 'settings.themeOptions.light.description' },
  { key: 'dark', icon: Moon, titleKey: 'settings.themeOptions.dark.title', subtitleKey: 'settings.themeOptions.dark.subtitle', descKey: 'settings.themeOptions.dark.description' },
  { key: 'auto', icon: Monitor, titleKey: 'settings.themeOptions.auto.title', subtitleKey: 'settings.themeOptions.auto.subtitle', descKey: 'settings.themeOptions.auto.description' },
]

onMounted(async () => {
  loadStoragePath()
  const savedLang = await localforage.getItem('settings:language') as string | null
  if (savedLang === 'zh' || savedLang === 'en') {
    currentLanguage.value = savedLang
    locale.value = savedLang
  }
})

// 导入面板
// 存储路径
const storagePath = ref('')
const defaultStoragePath = ref('')
const storageLoading = ref(false)
const storageMessage = ref('')
const storageMessageType = ref<'success' | 'error'>('success')

async function loadStoragePath() {
  try {
    const api = (window as any).api
    if (!api?.storage) return
    const result = await api.storage.getPath()
    if (result.success) {
      storagePath.value = result.currentPath || ''
      defaultStoragePath.value = result.defaultPath || ''
    }
  } catch (e) {
    console.error('Failed to load storage path:', e)
  }
}

async function pickStorageFolder() {
  try {
    const api = (window as any).api
    if (!api?.storage) return
    const result = await api.storage.pickFolder()
    if (result.success && result.path) {
      storageLoading.value = true
      const setResult = await api.storage.setPath(result.path)
      if (setResult.success) {
        storagePath.value = result.path
        storageMessage.value = '存储路径已更新'
        storageMessageType.value = 'success'
      } else {
        storageMessage.value = setResult.error || '设置失败'
        storageMessageType.value = 'error'
      }
      setTimeout(() => { storageMessage.value = '' }, 3000)
    }
  } catch (e) {
    console.error('Failed to pick folder:', e)
  } finally {
    storageLoading.value = false
  }
}

async function resetStoragePath() {
  try {
    const api = (window as any).api
    if (!api?.storage) return
    storageLoading.value = true
    const result = await api.storage.setPath(defaultStoragePath.value)
    if (result.success) {
      storagePath.value = defaultStoragePath.value
      storageMessage.value = '已恢复默认路径'
      storageMessageType.value = 'success'
    }
    setTimeout(() => { storageMessage.value = '' }, 3000)
  } catch (e) {
    console.error('Failed to reset storage path:', e)
  } finally {
    storageLoading.value = false
  }
}

// 导入面板
const showImport = ref(false)

// 数据导出
const exporting = ref('')
const entriesCount = computed(() => journalStore.entries.length)

async function handleExport(format: 'json' | 'csv' | 'markdown') {
  if (exporting.value) return
  exporting.value = format
  try {
    const entries = journalStore.entries
    if (format === 'json') {
      exportJournalJSON(entries, journalStore.prefs, journalStore.auditLog)
    } else if (format === 'csv') {
      exportJournalCSV(entries)
    } else {
      exportJournalMarkdown(entries, journalStore.customModules)
    }
  } catch (e) {
    console.error('Export failed:', e)
  } finally {
    setTimeout(() => (exporting.value = ''), 600)
  }
}
</script>

<template>
  <div class="p-6 max-w-3xl mx-auto">
    <!-- 标题 -->
    <div class="mb-8">
      <h1 class="flex items-center gap-2">
        <SettingsIcon :size="24" class="text-accent" />
        {{ t('settings.title') }}
      </h1>
      <p class="text-ink-2 text-sm mt-1">{{ t('settings.subtitle') }}</p>
    </div>

    <div class="space-y-6">
      <!-- 主题设置 -->
      <section class="card p-5">
        <h2 class="flex items-center gap-2 mb-4">
          <Sun :size="18" class="text-ember" />
          {{ t('settings.theme') }}
        </h2>
        <p class="text-sm text-ink-2 mb-4">{{ t('settings.themeDesc') }}</p>
        <div class="grid grid-cols-3 gap-3">
          <button
            v-for="opt in themeOptions"
            :key="opt.key"
            @click="setTheme(opt.key)"
            class="relative flex flex-col items-center p-4 rounded-xl border-2 transition-all cursor-pointer"
            :class="currentTheme === opt.key
              ? 'border-accent bg-accent-soft'
              : 'border-line/50 hover:border-line bg-surface-2'"
          >
            <component :is="opt.icon" :size="22" :class="currentTheme === opt.key ? 'text-accent' : 'text-ink-2'" />
            <span class="text-sm font-medium mt-2" :class="currentTheme === opt.key ? 'text-accent' : 'text-ink'">
              {{ t(opt.titleKey) }}
            </span>
            <span class="text-[0.7rem] text-ink-2 mt-0.5">{{ t(opt.subtitleKey) }}</span>
            <div v-if="currentTheme === opt.key"
              class="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
              <Check :size="12" />
            </div>
          </button>
        </div>
      </section>

      <!-- 语言设置 -->
      <section class="card p-5">
        <h2 class="flex items-center gap-2 mb-4">
          <Globe :size="18" class="text-accent" />
          {{ t('settings.language') }}
        </h2>
        <p class="text-sm text-ink-2 mb-4">{{ t('settings.languageDesc') }}</p>
        <div class="grid grid-cols-2 gap-3">
          <button
            @click="setLanguage('zh')"
            class="flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer"
            :class="currentLanguage === 'zh'
              ? 'border-accent bg-accent-soft'
              : 'border-line/50 hover:border-line bg-surface-2'"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">????</span>
              <div class="text-left">
                <div class="font-medium text-sm">{{ t('settings.chinese') }}</div>
                <div class="text-[0.7rem] text-ink-2">{{ t('settings.simplifiedChinese') }}</div>
              </div>
            </div>
            <div v-if="currentLanguage === 'zh'"
              class="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
              <Check :size="12" />
            </div>
          </button>
          <button
            @click="setLanguage('en')"
            class="flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer"
            :class="currentLanguage === 'en'
              ? 'border-accent bg-accent-soft'
              : 'border-line/50 hover:border-line bg-surface-2'"
          >
            <div class="flex items-center gap-3">
              <span class="text-xl">????</span>
              <div class="text-left">
                <div class="font-medium text-sm">{{ t('settings.english') }}</div>
                <div class="text-[0.7rem] text-ink-2">{{ t('settings.defaultLanguage') }}</div>
              </div>
            </div>
            <div v-if="currentLanguage === 'en'"
              class="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center">
              <Check :size="12" />
            </div>
          </button>
        </div>
      </section>

      <!-- 自动保存 -->
      <section class="card p-5">
        <h2 class="flex items-center gap-2 mb-4">
          <Info :size="18" class="text-ember" />
          {{ t('settings.autoSave') }}
        </h2>
        <p class="text-sm text-ink-2 mb-4">{{ t('settings.autoSaveDesc') }}</p>
        <div class="flex items-center justify-between p-3 bg-surface-2 rounded-xl">
          <div>
            <div class="text-sm font-medium">{{ t('settings.autoSaveOnClose') }}</div>
            <div class="text-[0.75rem] text-ink-2">{{ t('settings.autoSaveOnCloseDesc') }}</div>
          </div>
          <button
            @click="toggleAutoSave"
            :class="autoSaveEnabled ? 'bg-accent' : 'bg-line'"
            class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            role="switch"
            :aria-checked="autoSaveEnabled"
          >
            <span
              :class="autoSaveEnabled ? 'translate-x-5' : 'translate-x-0'"
              class="pointer-events-none inline-block h-[1.3rem] w-[1.3rem] transform rounded-full bg-white shadow-lg transition duration-200"
            />
          </button>
        </div>
      </section>

      <!-- 自定义记录模块 -->
      <section class="card p-5">
        <CustomModuleManager />
      </section>

      <!-- 数据管理 -->
      <section class="card p-5">
        <h2 class="flex items-center gap-2 mb-4">
          <Database :size="18" class="text-accent" />
          {{ t('settings.dataManager') }}
        </h2>
        <p class="text-sm text-ink-2 mb-4">
          {{ t('settings.dataManagerDesc') }} · {{ t('settings.entriesCount', { count: entriesCount }) }}
        </p>

        <!-- 导出 -->
        <div class="mb-5">
          <div class="text-sm font-medium mb-2.5">{{ t('settings.exportData') }}</div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              class="flex flex-col items-start p-3.5 rounded-xl border-2 border-line/50 bg-surface-2 hover:border-line transition-all cursor-pointer text-left disabled:opacity-50"
              :disabled="!!exporting"
              @click="handleExport('json')"
            >
              <Download :size="16" class="text-accent mb-1.5" />
              <span class="text-sm font-medium">{{ t('settings.exportJson') }}</span>
              <span class="text-[0.7rem] text-ink-2 mt-0.5">{{ t('settings.exportJsonDesc') }}</span>
            </button>
            <button
              class="flex flex-col items-start p-3.5 rounded-xl border-2 border-line/50 bg-surface-2 hover:border-line transition-all cursor-pointer text-left disabled:opacity-50"
              :disabled="!!exporting"
              @click="handleExport('csv')"
            >
              <Download :size="16" class="text-accent mb-1.5" />
              <span class="text-sm font-medium">{{ t('settings.exportCsv') }}</span>
              <span class="text-[0.7rem] text-ink-2 mt-0.5">{{ t('settings.exportCsvDesc') }}</span>
            </button>
            <button
              class="flex flex-col items-start p-3.5 rounded-xl border-2 border-line/50 bg-surface-2 hover:border-line transition-all cursor-pointer text-left disabled:opacity-50"
              :disabled="!!exporting"
              @click="handleExport('markdown')"
            >
              <Download :size="16" class="text-accent mb-1.5" />
              <span class="text-sm font-medium">{{ t('settings.exportMarkdownAll') }}</span>
              <span class="text-[0.7rem] text-ink-2 mt-0.5">{{ t('settings.exportMarkdownAllDesc') }}</span>
            </button>
          </div>
        </div>

        <!-- 导入 -->
        <div class="flex items-center justify-between p-3 bg-surface-2 rounded-xl">
          <div>
            <div class="text-sm font-medium">{{ t('settings.importData') }}</div>
            <div class="text-[0.75rem] text-ink-2">{{ t('settings.importDataDesc') }}</div>
          </div>
          <button class="btn btn-primary" @click="showImport = true">
            <Upload :size="16" /> {{ t('settings.startImport') }}
          </button>
        </div>
      </section>

      <!-- 导入面板（模态） -->
      <div v-if="showImport" class="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 backdrop-blur-sm">
        <ImportPanel @close="showImport = false" />
      </div>

      <!-- 关于 -->
      <section class="card p-5">
        <h2 class="flex items-center gap-2 mb-4">
          <Info :size="18" class="text-ink-2" />
          {{ t('settings.about') }}
        </h2>
        <div class="space-y-1.5 text-sm text-ink-2">
          <p><strong>{{ t('settings.version') }}:</strong> {{ APP_VERSION }}</p>
          <p><strong>{{ t('settings.build') }}:</strong> {{ BUILD_DATE }}</p>
          <p class="pt-2 text-xs leading-relaxed">
            {{ t('settings.aboutDesc') }}
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
