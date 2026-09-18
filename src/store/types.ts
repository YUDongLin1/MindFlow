export interface Task {
  id: number
  description: string
  priority: 'Lowest' | 'Low' | 'Normal' | 'Medium' | 'High' | 'Highest'
  dueDate: string
}

export type MoodType = 'happy' | 'neutral' | 'sad' | 'excited' | 'angry'

export interface HabitStatus {
  date: string // ISO date string
  status: 'did' | 'partial' | 'not'
}

export interface Habit {
  id: number
  name: string
  description: string
  statuses: HabitStatus[] // Track status per date
}

// Simplified habit interface for day summaries
export interface DaySummaryHabit {
  id?: number // Optional ID to link back to the Habit in store
  name: string
  completed: boolean
  status: 'did' | 'partial' | 'not' | null
}

export interface DailyCheck {
  energyLevel: number // 1 to 10
  stressLevel: number // 1 to 10
  productivity: number // 1 to 10
}

export interface CustomSection {
  title: string
  content: string
}

export interface MediaItem {
  type: string // Full MIME type like 'image/jpeg', 'video/mp4', etc.
  url: string
  filename?: string // Optional filename for new media system
  id?: string // Optional ID for new media system
  size?: number
  checksum?: string
  createdAt?: string
  storageKey?: string
  integrity?: {
    ok: boolean
    reason?: string
  }
}

export interface DaySummary {
  date: string
  summary: string
  mood: string
  weather: string
  habits: DaySummaryHabit[]
  dailyCheck: {
    energyLevel: number
    stressLevel: number
    productivity: number
  }
  comfortZoneEntry: string
  customSections: CustomSection[]
  tags: string[]
  media: MediaItem[]
  sparks: string[] // Daily inspiration/highlights
  goalReflections?: Record<number, string> // Reflections on goals due today or tomorrow
}

export interface MoodDetails {
  emoji: string
  color: string
}

export interface EntryMetadata {
  location?: string
  weather?: string
  temperature?: number
}
