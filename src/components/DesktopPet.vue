<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { usePetStore, type PetType } from '@/stores/pet'
import { useTodoStore } from '@/stores/todo'
import { useJournalStore } from '@/stores/journal'
import { Cat, Dog, Flower2, Upload, MessageCircle, Loader2 } from 'lucide-vue-next'

const petStore = usePetStore()
const todoStore = useTodoStore()
const journalStore = useJournalStore()

const showBubble = ref(false)
const bubbleText = ref('')
const tailWag = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// 宠物形象映射
const petEmojis: Record<PetType, string> = {
  cat: '🐱',
  dog: '🐶',
  plant: '🌱',
  custom: '✨',
}

const petIcons: Record<PetType, any> = {
  cat: Cat,
  dog: Dog,
  plant: Flower2,
  custom: Upload,
}

onMounted(async () => {
  await petStore.loadConfig()
  await petStore.fetchDailyQuote()
})

// 点击互动
function onPetClick() {
  petStore.interact()
  tailWag.value = true
  setTimeout(() => { tailWag.value = false }, 1500)
}

// 监听互动状态显示气泡
watch(() => petStore.isInteracting, (val) => {
  if (val) {
    bubbleText.value = petStore.encourageText
    showBubble.value = true
    setTimeout(() => { showBubble.value = false }, 3000)
  }
})

// 今日待办提醒
function getReminderText(): string {
  const total = todoStore.todayTotal
  const completed = todoStore.todayCompleted
  if (total === 0) return '今天还没有待办事项哦～'
  if (completed === total) return '太棒了！今天的待办全部完成了！🎉'
  return `今日待办：${completed}/${total} 已完成`
}

// 自定义形象上传
function onCustomImageUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  const reader = new FileReader()
  reader.onload = () => {
    petStore.updateConfig({ customImageUrl: reader.result as string, type: 'custom' })
  }
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="flex flex-col items-center">
    <!-- 气泡 -->
    <transition name="bubble">
      <div
        v-if="showBubble"
        class="mb-2 px-3 py-1.5 bg-surface rounded-xl shadow-lg border border-line/50 text-xs text-ink max-w-[180px] text-center relative"
      >
        {{ bubbleText }}
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border-r border-b border-line/50 rotate-45"></div>
      </div>
    </transition>

    <!-- 宠物主体 -->
    <div
      class="relative cursor-pointer select-none transition-transform"
      :class="{ 'animate-bounce': tailWag }"
      @click="onPetClick"
      :title="'点击互动'"
    >
      <!-- 自定义形象 -->
      <div
        v-if="petStore.config.type === 'custom' && petStore.config.customImageUrl"
        class="w-16 h-16 rounded-full overflow-hidden border-2 border-accent/30 shadow-md"
      >
        <img :src="petStore.config.customImageUrl" alt="pet" class="w-full h-full object-cover" />
      </div>

      <!-- 预设形象 -->
      <div
        v-else
        class="w-16 h-16 rounded-full bg-accent-soft border-2 border-accent/30 shadow-md flex items-center justify-center text-3xl"
        :class="{ 'animate-pulse': petStore.isInteracting }"
      >
        {{ petEmojis[petStore.config.type] }}
      </div>
    </div>

    <!-- 宠物名字 -->
    <div class="text-xs text-ink-2 mt-1 font-medium">{{ petStore.config.name }}</div>

    <!-- 每日语录 -->
    <div
      v-if="petStore.config.dailyQuoteEnabled && petStore.currentQuote"
      class="mt-2 text-[0.65rem] text-ink-2 text-center max-w-[160px] leading-relaxed italic"
    >
      "{{ petStore.currentQuote }}"
    </div>

    <!-- 待办提醒 -->
    <div
      v-if="petStore.config.reminderEnabled"
      class="mt-1 text-[0.6rem] text-accent text-center"
    >
      {{ getReminderText() }}
    </div>
  </div>
</template>

<style scoped>
.bubble-enter-active {
  transition: all 0.3s ease-out;
}
.bubble-leave-active {
  transition: all 0.2s ease-in;
}
.bubble-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.9);
}
.bubble-leave-to {
  opacity: 0;
  transform: translateY(-5px) scale(0.95);
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  25% { transform: translateY(-8px) rotate(-5deg); }
  50% { transform: translateY(0); }
  75% { transform: translateY(-4px) rotate(3deg); }
}
.animate-bounce {
  animation: bounce 0.6s ease-in-out;
}
</style>
