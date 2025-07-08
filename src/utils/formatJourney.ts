import type { HistoryEntry } from '../types/game'

/**
 * Formats the full parenting journey into a readable plain-text block that can
 * be copied to clipboard or shared.
 *
 * @param history        All history entries for ages 0-18 (sorted not required)
 * @param endingSummary  The ending summary markdown (may contain markup)
 * @param t              i18n translate function
 */
export function formatJourneyText (
  history: HistoryEntry[],
  endingSummary: string,
  t: (key: string, options?: any) => string,
  options?: {
    playerDescription?: string
    childDescription?: string
    childName?: string
  }
): string {
  // Ensure chronological order
  const ordered = [...history].sort((a, b) => a.age - b.age)

  const lines: string[] = []

  // Title
  lines.push(t('messages.journeyComplete'))
  if (options?.childName) {
    lines.push(t('messages.childGrownUp', { childName: options.childName }))
  }
  lines.push('')

  // Initial setup section
  if (options?.playerDescription || options?.childDescription) {
    lines.push(t('messages.myBackground'))
    if (options.playerDescription) lines.push(options.playerDescription)
    if (options.childDescription) lines.push(options.childDescription)
    lines.push('')
  }

  const historyByAge = new Map<number, HistoryEntry>()
  ordered.forEach(e => historyByAge.set(e.age, e))

  // Include all ages 1-18
  for (let age = 1; age <= 18; age++) {
    const entry = historyByAge.get(age)
    lines.push(`${t('ui.currentAge')}: ${age}`)
    if (entry) {
      lines.push(`${t('ui.question')}: ${entry.question}`)
      lines.push(`${t('actions.selectedThisOption') || t('actions.selectOption')}: ${entry.choice}`)
      lines.push(`${t('ui.result')}: ${entry.outcome}`)
    } else {
      lines.push(t('messages.noRecordForYear', { age }))
    }
    lines.push('')
  }

  // Ending summary
  if (endingSummary) {
    lines.push(t('messages.endingComplete'))
    lines.push('')
    // Remove story style comments and basic markdown syntax for readability
    const cleaned = endingSummary
      .replace(/<!--\s*story_style:\s*[^>]*?-->/gi, '') // Remove story style comments
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Clean up extra newlines
      .replace(/[#*_>`~-]/g, '') // Remove basic markdown
    lines.push(cleaned.trim())
    lines.push('')
  }

  // Promotional tagline
  lines.push(t('messages.sharePromotionText'))

  return lines.join('\n')
} 