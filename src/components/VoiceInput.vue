<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Mic, MicOff, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  lang?: string  // 'zh-CN' | 'en-US' 等
}>()

const emit = defineEmits<{
  'transcript': [text: string]
}>()

const isSupported = ref(false)
const isListening = ref(false)
const interimText = ref('')
const error = ref('')

let recognition: any = null

onMounted(() => {
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  if (SpeechRecognition) {
    isSupported.value = true
    recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = props.lang || 'zh-CN'
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          final += transcript
        } else {
          interim += transcript
        }
      }
      interimText.value = interim
      if (final) {
        emit('transcript', final)
        interimText.value = ''
      }
    }

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') return // 忽略无语音
      error.value = event.error === 'not-allowed' ? '请允许麦克风权限' : `语音识别错误: ${event.error}`
      isListening.value = false
    }

    recognition.onend = () => {
      // 如果还在监听状态，自动重启（continuous 模式下可能被浏览器中断）
      if (isListening.value) {
        try { recognition.start() } catch {}
      }
    }
  }
})

onUnmounted(() => {
  if (recognition && isListening.value) {
    recognition.stop()
  }
})

function toggle() {
  if (!recognition) return
  if (isListening.value) {
    recognition.stop()
    isListening.value = false
    interimText.value = ''
  } else {
    error.value = ''
    try {
      recognition.start()
      isListening.value = true
    } catch (e: any) {
      error.value = '无法启动语音识别'
    }
  }
}
</script>

<template>
  <div v-if="isSupported" class="inline-flex items-center gap-1.5">
    <button
      @click="toggle"
      class="relative flex items-center justify-center w-8 h-8 rounded-full transition-all"
      :class="isListening
        ? 'bg-danger text-white animate-pulse'
        : 'bg-surface-2 text-ink-2 hover:bg-accent-soft hover:text-accent'"
      :title="isListening ? '停止语音输入' : '开始语音输入'"
    >
      <Mic v-if="!isListening" :size="16" />
      <MicOff v-else :size="16" />
      <!-- 录音动画圆环 -->
      <span
        v-if="isListening"
        class="absolute inset-0 rounded-full border-2 border-danger animate-ping opacity-30"
      ></span>
    </button>

    <!-- 实时转写文字 -->
    <span v-if="interimText" class="text-xs text-ink-2 italic max-w-[200px] truncate">
      {{ interimText }}
    </span>

    <!-- 错误提示 -->
    <span v-if="error" class="text-xs text-danger">{{ error }}</span>
  </div>
</template>
