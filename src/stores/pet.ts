import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import localforage from 'localforage'

export type PetType = 'cat' | 'dog' | 'plant' | 'custom'

export interface PetConfig {
  type: PetType
  name: string
  customImageUrl?: string // 自定义形象
  dailyQuoteEnabled: boolean // 每日语录
  reminderEnabled: boolean // 提醒事项
  interactionEnabled: boolean // 互动功能
}

const DEFAULT_CONFIG: PetConfig = {
  type: 'cat',
  name: '小墨',
  dailyQuoteEnabled: true,
  reminderEnabled: true,
  interactionEnabled: true,
}

const STORAGE_KEY = 'mindflow:pet'

export const usePetStore = defineStore('pet', () => {
  const config = ref<PetConfig>({ ...DEFAULT_CONFIG })
  const currentQuote = ref('')
  const quoteLoading = ref(false)
  const isInteracting = ref(false)
  const encourageText = ref('')

  // 鼓励语库
  const encourageTexts = [
    '今天也要加油哦！✨',
    '你已经很棒了！💪',
    '每一步都算数！🌟',
    '记录本身就是力量！📝',
    '慢慢来，比较快～🐢',
    '你比想象中更强大！🔥',
    '坚持就是胜利！🏆',
    '今天的你，值得被记住！❤️',
    '不完美也没关系～🌈',
    '继续前行，我在陪你！🐱',
  ]

  async function loadConfig() {
    try {
      const raw = await localforage.getItem(STORAGE_KEY)
      if (raw && typeof raw === 'object') {
        config.value = { ...DEFAULT_CONFIG, ...(raw as Partial<PetConfig>) }
      }
    } catch (e) {
      console.error('[pet] load failed', e)
    }
  }

  async function saveConfig() {
    try {
      await localforage.setItem(STORAGE_KEY, { ...config.value })
    } catch (e) {
      console.error('[pet] save failed', e)
    }
  }

  async function updateConfig(updates: Partial<PetConfig>) {
    config.value = { ...config.value, ...updates }
    await saveConfig()
  }

  // 获取每日语录
  async function fetchDailyQuote() {
    if (!config.value.dailyQuoteEnabled) {
      currentQuote.value = ''
      return
    }
    quoteLoading.value = true
    try {
      // 先尝试从缓存读取
      const cacheKey = `mindflow:pet:quote:${new Date().toISOString().slice(0, 10)}`
      const cached = await localforage.getItem(cacheKey) as string | null
      if (cached) {
        currentQuote.value = cached
        quoteLoading.value = false
        return
      }

      // 使用本地语录库
      const quotes = [
        '生活不是等待暴风雨过去，而是学会在雨中翩翩起舞。',
        '每一个优秀的人，都有一段沉默的时光。',
        '你今天的努力，是幸运的伏笔。',
        '把每一天当作最后一天来过，有一天你会发现你是对的。',
        '不积跬步，无以至千里。',
        '星光不负赶路人，时光不负有心人。',
        '世界上唯一不变的，就是变化本身。',
        '做自己生命的主角，而非别人生命的看客。',
        '所有的努力都不会白费，你付出多少时间和精力，都是在对未来的积累。',
        '当你觉得晚了的时候，恰恰是最早的时候。',
        '保持热爱，奔赴山海。',
        '日拱一卒，功不唐捐。',
        '知足且上进，温柔而坚定。',
        '愿你所有的努力都不被辜负。',
        '今天的你，是昨天的你决定的。',
      ]
      const quote = quotes[Math.floor(Math.random() * quotes.length)]
      currentQuote.value = quote
      await localforage.setItem(cacheKey, quote)
    } catch (e) {
      currentQuote.value = '每一天都值得被记录。'
    } finally {
      quoteLoading.value = false
    }
  }

  // 互动：显示鼓励语
  function interact() {
    if (!config.value.interactionEnabled) return
    isInteracting.value = true
    encourageText.value = encourageTexts[Math.floor(Math.random() * encourageTexts.length)]
    setTimeout(() => {
      isInteracting.value = false
    }, 3000)
  }

  return {
    config, currentQuote, quoteLoading, isInteracting, encourageText,
    loadConfig, saveConfig, updateConfig, fetchDailyQuote, interact,
  }
})
