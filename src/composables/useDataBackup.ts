import { ref, nextTick } from 'vue'
import { useStore } from 'vuex'
import { useI18n } from 'vue-i18n'
import { DaySummary } from '@/store/types'
import { useImportConflict, type ImportMode, type ImportConflict, type ImportStats } from './useImportConflict'
import { isDaySummary, isTask, isHabit } from '@/store'

// Current backup version - increment when format changes
const CURRENT_VERSION = '2.0.0'

/**
 * Version history and migration notes:
 *
 * v1.0.0 - Initial backup format
 *   - Basic export/import functionality
 *   - No version field
 *
 * v2.0.0 - Enhanced backup format (Current)
 *   - Added version field
 *   - Added exportDate timestamp
 *   - Added data validation on import
 *   - Added migration support for older formats
 */

interface BackupData {
  version: string
  exportDate: string
  daySummaries: any[]
  tasks: any[]
  habits: any[]
  sparks: any[]
  calendarEntries: any[]
}

/**
 * Migrate backup data from older versions to current format
 */
const migrateBackupData = (data: any): BackupData => {
  // If no version field, treat as v1.0.0
  const version = data.version || '1.0.5'

  console.log(`Migrating backup data from version ${version} to ${CURRENT_VERSION}`)

  let migratedData = { ...data }

  // Migration from v1.0.0 to v2.0.0
  if (version === '1.0.5') {
    console.log('Applying v1.0.0 → v2.0.0 migration...')

    // Add missing fields with defaults
    migratedData = {
      ...data,
      version: '2.0.0',
      exportDate: data.exportDate || new Date().toISOString(),
      daySummaries: data.daySummaries || [],
      tasks: data.tasks || [],
      habits: data.habits || [],
      sparks: data.sparks || [],
      calendarEntries: data.calendarEntries || []
    }

    // Migrate day summaries: ensure sparks field exists
    migratedData.daySummaries = migratedData.daySummaries.map((summary: any) => ({
      ...summary,
      sparks: summary.sparks || []
    }))

    console.log('✅ Migration v1.0.0 → v2.0.0 complete')
  }

  // Future migrations would go here
  // if (version === '2.0.0') {
  //   // Migrate to v3.0.0
  // }

  return migratedData as BackupData
}

export function useDataBackup() {
  const store = useStore()
  const { t } = useI18n()
  const isExporting = ref(false)
  const isImporting = ref(false)
  const backupProgress = ref(0)
  const { analyzeImportData, resolveConflicts, mergeDaySummary } = useImportConflict()

  /**
   * Validate backup data structure
   */
  const validateBackupStructure = (data: any): { valid: boolean; error?: string } => {
    // Check for required top-level fields
    if (!data || typeof data !== 'object') {
      return { valid: false, error: t('backup.error.invalidObject') }
    }

    // daySummaries must be an array
    if (!data.daySummaries || !Array.isArray(data.daySummaries)) {
      return { valid: false, error: t('backup.error.missingSummaries') }
    }

    // Optional fields - should be arrays if present
    const optionalArrayFields = ['tasks', 'habits', 'sparks', 'calendarEntries']
    for (const field of optionalArrayFields) {
      if (data[field] !== undefined && !Array.isArray(data[field])) {
        return { valid: false, error: t('backup.error.invalidField', { field }) }
      }
    }

    return { valid: true }
  }

  /**
   * Parse and analyze import file without importing
   */
  const analyzeImportFile = async (file: File): Promise<{
    data: any
    conflicts: ImportConflict[]
    stats: ImportStats
  }> => {
    const text = await file.text()

    let data: any

    if (file.name.endsWith('.json')) {
      data = JSON.parse(text)
    } else {
      throw new Error(t('backup.error.unsupportedFormat'))
    }

    // Validate backup structure
    const { valid, error } = validateBackupStructure(data)
    if (!valid) {
      throw new Error(error || t('backup.error.invalidStructure'))
    }

    // Migrate data if from older version
    const version = data.version || '1.0.5'
    if (version !== CURRENT_VERSION) {
      console.log(`Detected backup version ${version}, migrating to ${CURRENT_VERSION}...`)
      data = migrateBackupData(data)
    } else {
      console.log(`Backup is already at current version ${CURRENT_VERSION}`)
    }

    // Analyze for conflicts
    const { conflicts, stats } = analyzeImportData(data)

    return { data, conflicts, stats }
  }

  const exportData = async (format: 'json' | 'csv' | 'markdown' = 'json') => {
    isExporting.value = true
    backupProgress.value = 0

    try {
      const data = {
        version: CURRENT_VERSION, // Include version for backward compatibility
        exportDate: new Date().toISOString(),
        daySummaries: store.state.daySummaries,
        tasks: store.state.tasks,
        habits: store.state.habits,
        sparks: store.state.sparks,
        calendarEntries: store.state.calendarEntries
      }

      backupProgress.value = 50

      let content: string
      let filename: string
      let mimeType: string

      switch (format) {
        case 'json':
          content = JSON.stringify(data, null, 2)
          filename = `mindflow-backup-v${CURRENT_VERSION}-${new Date().toISOString().split('T')[0]}.json`
          mimeType = 'application/json'
          break

        case 'csv':
          content = convertToCSV(data.daySummaries)
          filename = `mindflow-backup-${new Date().toISOString().split('T')[0]}.csv`
          mimeType = 'text/csv'
          break

        case 'markdown':
          content = convertToMarkdown(data.daySummaries)
          filename = `mindflow-backup-${new Date().toISOString().split('T')[0]}.md`
          mimeType = 'text/markdown'
          break

        default:
          throw new Error(t('backup.error.unsupportedFormat'))
      }

      backupProgress.value = 90

      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()

      URL.revokeObjectURL(url)
      backupProgress.value = 100

      setTimeout(() => {
        isExporting.value = false
        backupProgress.value = 0
      }, 1000)

    } catch (error) {
      console.error('Export failed:', error)
      isExporting.value = false
      backupProgress.value = 0
      throw error
    }
  }

  const importData = async (
    data: any,
    mode: ImportMode = 'merge',
    conflicts: ImportConflict[] = []
  ): Promise<void> => {
    isImporting.value = true
    backupProgress.value = 0

    // Track validation statistics
    const validationStats = {
      invalidSummaries: 0,
      invalidTasks: 0,
      invalidHabits: 0,
      invalidSparks: 0,
      totalProcessed: 0
    }

    try {
      backupProgress.value = 20

      // Apply resolution based on mode
      const resolvedMode = mode === 'preview' ? 'keepExisting' : mode
      const resolvedConflicts = resolveConflicts(conflicts, resolvedMode as any)

      backupProgress.value = 40

      // Import day summaries with validation
      if (data.daySummaries && Array.isArray(data.daySummaries)) {
        for (const summary of data.daySummaries) {
          validationStats.totalProcessed++

          // Validate summary structure using type guard
          if (!isDaySummary(summary)) {
            console.warn('Invalid day summary found during import, skipping:', summary)
            validationStats.invalidSummaries++
            continue
          }

          const conflict = resolvedConflicts.find(
            c => c.type === 'daySummary' && c.date === summary.date
          )

          if (conflict) {
            // Handle conflict based on resolution
            if (conflict.resolution === 'skip' || conflict.resolution === 'keep') {
              continue // Skip this item
            } else if (conflict.resolution === 'replace' && mode === 'merge') {
              // Merge intelligently
              const merged = mergeDaySummary(conflict.existing, summary)
              // Re-validate merged data
              if (!isDaySummary(merged)) {
                console.warn('Merged summary is invalid, skipping:', merged)
                validationStats.invalidSummaries++
                continue
              }
              await store.dispatch('updateDaySummary', merged)
            } else {
              // Replace
              await store.dispatch('updateDaySummary', summary)
            }
          } else {
            // No conflict, import as new
            await store.dispatch('updateDaySummary', summary)
          }
        }
      }

      backupProgress.value = 60

      // Import tasks with validation
      if (data.tasks && Array.isArray(data.tasks)) {
        for (const task of data.tasks) {
          validationStats.totalProcessed++

          // Validate task structure using type guard
          if (!isTask(task)) {
            console.warn('Invalid task found during import, skipping:', task)
            validationStats.invalidTasks++
            continue
          }

          const conflict = resolvedConflicts.find(
            c => c.type === 'task' && c.id === task.id
          )

          if (!conflict || conflict.resolution === 'replace') {
            await store.dispatch('addTask', task)
          }
        }
      }

      backupProgress.value = 75

      // Import habits with validation
      if (data.habits && Array.isArray(data.habits)) {
        for (const habit of data.habits) {
          validationStats.totalProcessed++

          // Validate habit structure using type guard
          if (!isHabit(habit)) {
            console.warn('Invalid habit found during import, skipping:', habit)
            validationStats.invalidHabits++
            continue
          }

          const conflict = resolvedConflicts.find(
            c => c.type === 'habit' && c.incoming.name === habit.name
          )

          if (!conflict || conflict.resolution === 'replace') {
            await store.dispatch('addHabit', habit)
          }
        }
      }

      backupProgress.value = 90

      // Import sparks with validation (no conflict checking needed)
      if (data.sparks && Array.isArray(data.sparks)) {
        for (const spark of data.sparks) {
          validationStats.totalProcessed++

          // Validate spark is a non-empty string
          if (typeof spark !== 'string' || spark.trim() === '') {
            console.warn('Invalid spark found during import, skipping:', spark)
            validationStats.invalidSparks++
            continue
          }

          await store.dispatch('addSpark', spark)
        }
      }

      backupProgress.value = 100

      // Log validation summary
      const totalInvalid =
        validationStats.invalidSummaries +
        validationStats.invalidTasks +
        validationStats.invalidHabits +
        validationStats.invalidSparks

      if (totalInvalid > 0) {
        console.warn(`Import completed with ${totalInvalid} invalid items skipped:`, validationStats)
      } else {
        console.log('Import completed successfully with all items validated')
      }

      setTimeout(() => {
        isImporting.value = false
        backupProgress.value = 0
      }, 1000)

    } catch (error) {
      console.error('Import failed:', error)
      isImporting.value = false
      backupProgress.value = 0
      throw error
    }
  }

  const convertToCSV = (summaries: DaySummary[]): string => {
    const headers = ['Date', 'Mood', 'Weather', 'Summary', 'Tags', 'Energy Level', 'Stress Level', 'Productivity', 'Comfort Zone Entry']
    const rows = summaries.map(summary => [
      summary.date,
      summary.mood,
      summary.weather,
      `"${summary.summary.replace(/"/g, '""')}"`,
      `"${summary.tags.join(', ')}"`,
      summary.dailyCheck?.energyLevel || '',
      summary.dailyCheck?.stressLevel || '',
      summary.dailyCheck?.productivity || '',
      `"${(summary.comfortZoneEntry || '').replace(/"/g, '""')}"`
    ])

    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }

  const convertToMarkdown = (summaries: DaySummary[]): string => {
    let markdown = '# MindFlow Backup\n\n'
    
    summaries.forEach(summary => {
      markdown += `## ${summary.date}\n\n`
      markdown += `**Mood:** ${summary.mood} | **Weather:** ${summary.weather}\n\n`
      
      if (summary.tags.length > 0) {
        markdown += `**Tags:** ${summary.tags.map(tag => `\`${tag}\``).join(', ')}\n\n`
      }
      
      if (summary.summary) {
        markdown += `### Summary\n${summary.summary}\n\n`
      }
      
      if (summary.dailyCheck) {
        markdown += `### Daily Check\n`
        markdown += `- Energy Level: ${summary.dailyCheck.energyLevel}/10\n`
        markdown += `- Stress Level: ${summary.dailyCheck.stressLevel}/10\n`
        markdown += `- Productivity: ${summary.dailyCheck.productivity}/10\n\n`
      }
      
      if (summary.comfortZoneEntry) {
        markdown += `### Comfort Zone Entry\n${summary.comfortZoneEntry}\n\n`
      }
      
      if (summary.customSections.length > 0) {
        summary.customSections.forEach(section => {
          markdown += `### ${section.title}\n${section.content}\n\n`
        })
      }
      
      markdown += '---\n\n'
    })

    return markdown
  }

  return {
    exportData,
    importData,
    analyzeImportFile,
    isExporting,
    isImporting,
    backupProgress
  }
}