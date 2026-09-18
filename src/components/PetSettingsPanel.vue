<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { usePetStore, type PetType } from '@/stores/pet'
import { Cat, Dog, Flower2, Upload, Settings, ToggleLeft, ToggleRight } from 'lucide-vue-next'

const petStore = usePetStore()
const fileInput = ref<HTMLInputElement | null>(null)

const petOptions: { type: PetType; label: string; emoji: string }[] = [
  { type: 'cat', label: '小猫咪', emoji: '🐱' },
  { type: 'dog', label: '小狗狗', emoji: '🐶' },
  { type: 'plant', label: '小植物', emoji: '🌱' },
  { type: 'custom', label: '自定义', emoji: '✨' },
]

onMounted(async () => {
  await petStore.loadConfig()
})

function selectPetType(type: PetType) {
  petStore.updateConfig({ type })
}

function onNameChange(e: Event) {
  petStore.updateConfig({ name: (e.target as HTMLInputElement).value || '小墨' })
}

function toggleDailyQuote() {
  petStore.updateConfig({ dailyQuoteEnabled: !petStore.config.dailyQuoteEnabled })
}

function toggleReminder() {
  petStore.updateConfig({ reminderEnabled: !petStore.config.reminderEnabled })
}

function toggleInteraction() {
  petStore.updateConfig({ interactionEnabled: !petStore.config.interactionEnabled })
}

function onCustomUpload(e: Event) {
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
  <div class="card p-4">
    <div class="flex items-center gap-2 mb-3">
      <Settings :size="16" class="text-accent" />
      <h3 class="text-sm font-semibold text-ink">宠物设置</h3>
    </div>

    <!-- 宠物名称 -->
    <div class="mb-3">
      <label class="text-xs text-ink-2 mb-1 block">宠物名字</label>
      <input
        class="input !py-1.5 text-sm"
        :value="petStore.config.name"
        @input="onNameChange"
        placeholder="给宠物起个名字"
      />
    </div>

    <!-- 宠物形象选择 -->
    <div class="mb-3">
      <label class="text-xs text-ink-2 mb-1.5 block">选择形象</label>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="opt in petOptions"
          :key="opt.type"
          class="flex flex-col items-center p-2 rounded-xl border-2 transition-all cursor-pointer"
          :class="petStore.config.type === opt.type
            ? 'border-accent bg-accent-soft'
            : 'border-line/50 hover:border-line bg-surface-2'"
          @click="selectPetType(opt.type)"
        >
          <span class="text-xl">{{ opt.emoji }}</span>
          <span class="text-[0.6rem] mt-0.5" :class="petStore.config.type === opt.type ? 'text-accent' : 'text-ink-2'">
            {{ opt.label }}
          </span>
        </button>
      </div>
    </div>

    <!-- 自定义形象上传 -->
    <div v-if="petStore.config.type === 'custom'" class="mb-3">
      <label class="text-xs text-ink-2 mb-1 block">上传自定义形象</label>
      <div class="flex items-center gap-2">
        <button
          class="btn btn-ghost !text-xs !py-1.5"
          @click="fileInput?.click()"
        >
          <Upload :size="12" /> 选择图片
        </button>
        <span v-if="petStore.config.customImageUrl" class="text-xs text-accent">已上传</span>
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onCustomUpload"
      />
    </div>

    <!-- 功能开关 -->
    <div class="space-y-2">
      <div class="flex items-center justify-between p-2 rounded-lg bg-surface-2">
        <span class="text-xs text-ink">每日语录</span>
        <button
          class="transition-colors"
          :class="petStore.config.dailyQuoteEnabled ? 'text-accent' : 'text-ink-2/40'"
          @click="toggleDailyQuote"
        >
          <component :is="petStore.config.dailyQuoteEnabled ? ToggleRight : ToggleLeft" :size="22" />
        </button>
      </div>
      <div class="flex items-center justify-between p-2 rounded-lg bg-surface-2">
        <span class="text-xs text-ink">待办提醒</span>
        <button
          class="transition-colors"
          :class="petStore.config.reminderEnabled ? 'text-accent' : 'text-ink-2/40'"
          @click="toggleReminder"
        >
          <component :is="petStore.config.reminderEnabled ? ToggleRight : ToggleLeft" :size="22" />
        </button>
      </div>
      <div class="flex items-center justify-between p-2 rounded-lg bg-surface-2">
        <span class="text-xs text-ink">互动功能</span>
        <button
          class="transition-colors"
          :class="petStore.config.interactionEnabled ? 'text-accent' : 'text-ink-2/40'"
          @click="toggleInteraction"
        >
          <component :is="petStore.config.interactionEnabled ? ToggleRight : ToggleLeft" :size="22" />
        </button>
      </div>
    </div>
  </div>
</template>
