import { ref, computed } from 'vue'
import quotesJson from '@/assets/quotes.json'
import quotesZhJson from '@/assets/quotes-zh.json'
import type { MoodType } from '@/store/types'

export interface DailyQuote {
  text: string
  author: string
}

export type QuoteSource = 'cache' | 'remote' | 'local' | 'fallback' | 'unknown'

export interface UseDailyQuoteOptions {
  /**
   * Optional storage key override. Useful when scoping quotes per profile.
   */
  storageKey?: string
  /**
   * Cache lifetime in milliseconds. Defaults to 24 hours.
   */
  cacheWindowMs?: number
  /**
   * Optional async fetcher for remote quotes. Return null to fall back to the local pool.
   */
  fetcher?: () => Promise<DailyQuote | null>
  /**
   * Optional mood to filter quotes by. If provided, quotes will be selected from the mood-specific pool.
   */
  mood?: MoodType
  /**
   * Language for quotes. Defaults to 'en'.
   */
  language?: 'en' | 'zh'
}

interface StoredQuotePayload {
  quote: DailyQuote
  cachedAt: string
  expiresAt: string
  source?: QuoteSource
  language?: string
}

const DEFAULT_STORAGE_KEY = 'mindflow.dailyQuote'
const DEFAULT_CACHE_WINDOW = 1000 * 60 * 60 * 24 // 24 hours

const moodBasedQuotes = quotesJson as Record<string, DailyQuote[]>
const moodBasedQuotesZh = quotesZhJson as Record<string, DailyQuote[]>

/**
 * Get the appropriate quotes pool based on language
 */
const getQuotesPool = (language: 'en' | 'zh' = 'en'): Record<string, DailyQuote[]> => {
  return language === 'zh' ? moodBasedQuotesZh : moodBasedQuotes
}

/**
 * Pick a quote from the local pool, optionally filtered by mood.
 * If a mood is provided, quotes from that mood category are preferred.
 * Falls back to general quotes if mood-specific quotes aren't available.
 */
const pickLocalQuote = (excludeText?: string, mood?: MoodType, language: 'en' | 'zh' = 'en'): DailyQuote => {
  const quotesPool: DailyQuote[] = []
  const moodQuotes = getQuotesPool(language)

  // Try to get mood-specific quotes first
  if (mood && moodQuotes[mood] && moodQuotes[mood].length > 0) {
    quotesPool.push(...moodQuotes[mood])
  } else if (moodQuotes.general && moodQuotes.general.length > 0) {
    // Fall back to general quotes
    quotesPool.push(...moodQuotes.general)
  } else {
    // Ultimate fallback: combine all available quotes
    quotesPool.push(...Object.values(moodQuotes).flat())
  }

  const fallbackQuote = language === 'zh'
    ? { text: '每天写一点，记录你的故事。', author: 'MindFlow' }
    : { text: 'Keep writing your story one day at a time.', author: 'MindFlow' }

  if (quotesPool.length === 0) {
    return fallbackQuote
  }

  if (quotesPool.length === 1) {
    return quotesPool[0]
  }

  let attempts = 0
  let candidate = quotesPool[Math.floor(Math.random() * quotesPool.length)]

  while (candidate.text === excludeText && attempts < 5) {
    candidate = quotesPool[Math.floor(Math.random() * quotesPool.length)]
    attempts += 1
  }

  return candidate
}

const defaultRemoteFetcher = async (): Promise<DailyQuote | null> => {
  // Placeholder for future external API integration.
  // Return null so the local fallback is used until the API is ready.
  return null
}

const isCacheValid = (payload: StoredQuotePayload, cacheWindow: number) => {
  const expiresAt = new Date(payload.expiresAt).getTime()
  if (Number.isNaN(expiresAt)) return false
  return Date.now() < expiresAt && Date.now() - new Date(payload.cachedAt).getTime() < cacheWindow * 2
}

export function useDailyQuote(options: UseDailyQuoteOptions = {}) {
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
  const cacheWindow = options.cacheWindowMs ?? DEFAULT_CACHE_WINDOW
  const remoteFetcher = options.fetcher ?? defaultRemoteFetcher
  const mood = ref<MoodType | undefined>(options.mood)
  const language = ref<'en' | 'zh'>(options.language ?? 'en')

  const quote = ref<DailyQuote | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const source = ref<QuoteSource>('unknown')
  const lastUpdatedAt = ref<Date | null>(null)

  const hydrateFromStorage = () => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return

      const stored: StoredQuotePayload = JSON.parse(raw)
      if (!isCacheValid(stored, cacheWindow)) {
        window.localStorage.removeItem(storageKey)
        return
      }

      quote.value = stored.quote
      source.value = stored.source ?? 'cache'
      lastUpdatedAt.value = new Date(stored.cachedAt)
    } catch (err) {
      console.warn('[useDailyQuote] Failed to restore cached quote', err)
    }
  }

  const persistQuote = (value: DailyQuote, origin: QuoteSource) => {
    if (typeof window === 'undefined') return

    const cachedAt = new Date()
    const expiresAt = new Date(cachedAt.getTime() + cacheWindow)

    const payload: StoredQuotePayload = {
      quote: value,
      cachedAt: cachedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      source: origin
    }

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload))
    } catch (err) {
      console.warn('[useDailyQuote] Failed to cache quote', err)
    }
  }

  const applyQuote = (value: DailyQuote, origin: QuoteSource) => {
    quote.value = value
    source.value = origin
    lastUpdatedAt.value = new Date()
    persistQuote(value, origin)
  }

  const loadQuote = async (options: { forceRefresh?: boolean; mood?: MoodType } = {}) => {
    // Update mood if provided
    if (options.mood !== undefined) {
      mood.value = options.mood
    }

    if (quote.value && !options.forceRefresh) {
      return
    }

    hydrateFromStorage()
    if (quote.value && !options.forceRefresh) {
      return
    }

    isLoading.value = true
    error.value = null

    try {
      const remoteQuote = await remoteFetcher()
      if (remoteQuote) {
        applyQuote(remoteQuote, 'remote')
        return
      }

      const localQuote = pickLocalQuote(quote.value?.text, mood.value, language.value)
      applyQuote(localQuote, 'local')
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load quote'
      const fallbackQuote = pickLocalQuote(quote.value?.text, mood.value, language.value)
      applyQuote(fallbackQuote, 'fallback')
    } finally {
      isLoading.value = false
    }
  }

  const refreshQuote = async (newMood?: MoodType) => {
    await loadQuote({ forceRefresh: true, mood: newMood })
  }

  const updateMood = (newMood: MoodType) => {
    mood.value = newMood
  }

  const updateLanguage = (newLanguage: 'en' | 'zh') => {
    language.value = newLanguage
  }

  const quoteText = computed(() => quote.value?.text ?? '')
  const quoteAuthor = computed(() => quote.value?.author ?? '')
  const quoteSource = computed(() => source.value)
  const lastUpdated = computed(() => lastUpdatedAt.value)

  return {
    quote,
    quoteText,
    quoteAuthor,
    quoteSource,
    lastUpdated,
    isLoading,
    error,
    mood,
    language,
    initializeQuote: loadQuote,
    refreshQuote,
    updateMood,
    updateLanguage
  }
}
