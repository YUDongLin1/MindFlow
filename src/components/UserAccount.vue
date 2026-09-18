<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { User, LogIn, Cloud, Shield, X } from 'lucide-vue-next'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const { t } = useI18n()

const isLoggedIn = ref(false)
const userName = ref('')
const userEmail = ref('')

function handleLogin() {
  // Reserved: Cloud login/registration flow
  console.log('[account] Login clicked — not yet implemented')
}

function handleLogout() {
  isLoggedIn.value = false
  userName.value = ''
  userEmail.value = ''
}

function close() {
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        @click.self="close"
      >
        <div class="card w-full max-w-sm mx-4 p-6 shadow-2xl">
          <!-- Header -->
          <div class="flex items-center justify-between mb-5">
            <h3 class="text-lg font-semibold text-ink flex items-center gap-2">
              <User :size="20" class="text-accent" />
              {{ t('sidebar.account', '账号') }}
            </h3>
            <button
              class="btn btn-ghost !px-2 !py-2"
              @click="close"
              :aria-label="t('common.close', '关闭')"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Not logged in state -->
          <div v-if="!isLoggedIn" class="text-center py-6">
            <div class="w-16 h-16 rounded-full bg-accent-soft flex items-center justify-center mx-auto mb-4">
              <User :size="28" class="text-accent" />
            </div>
            <p class="text-sm text-ink-2 mb-6">
              {{ t('sidebar.accountHint', '登录后可同步数据到云端，实现多设备同步') }}
            </p>

            <button
              class="btn btn-primary w-full flex items-center justify-center gap-2"
              @click="handleLogin"
            >
              <LogIn :size="16" />
              {{ t('sidebar.login', '登录 / 注册') }}
            </button>

            <div class="flex items-center gap-2 mt-4 text-xs text-ink-2/60 justify-center">
              <Shield :size="12" />
              <span>{{ t('sidebar.privacyNote', '本地数据不会自动上传，需手动开启同步') }}</span>
            </div>
          </div>

          <!-- Logged in state -->
          <div v-else class="py-4">
            <div class="flex items-center gap-3 mb-4">
              <div class="w-12 h-12 rounded-full bg-accent-soft flex items-center justify-center">
                <User :size="22" class="text-accent" />
              </div>
              <div>
                <div class="text-sm font-medium text-ink">{{ userName }}</div>
                <div class="text-xs text-ink-2">{{ userEmail }}</div>
              </div>
            </div>

            <div class="flex items-center gap-2 p-3 rounded-lg bg-surface-2 mb-4">
              <Cloud :size="16" class="text-accent" />
              <span class="text-sm text-ink-2">{{ t('sidebar.cloudSync', '云端同步') }}</span>
              <span class="chip chip-soft ml-auto text-xs">{{ t('sidebar.active', '已开启') }}</span>
            </div>

            <button
              class="btn btn-ghost w-full text-ink-2 hover:text-danger"
              @click="handleLogout"
            >
              {{ t('sidebar.logout', '退出登录') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
