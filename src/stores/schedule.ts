import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSchedule } from '@/api/catalog'
import type { ScheduleItem } from '@/api/types'

const MAX_AGE_MS = 10 * 60 * 1000

/** День недели как в API: 1–7 с понедельника (в JS 0 — воскресенье). */
export function weekday (date = new Date()): number {
  return ((date.getDay() + 6) % 7) + 1
}

/**
 * Расписание на неделю, общее для главной, расписания и страницы релиза:
 * один источник для «вышла / выйдет сегодня» и один запрос на всех.
 */
export const useScheduleStore = defineStore('schedule', () => {
  const items = ref<ScheduleItem[]>([])
  // Текущий день недели для плашек «Сегодня»; сверяется раз в минуту, чтобы пережить полночь.
  const today = ref(weekday())
  window.setInterval(() => {
    const now = weekday()
    if (now !== today.value) today.value = now
  }, 60_000)
  let loadedAt = 0
  let pending: Promise<ScheduleItem[]> | null = null

  async function load (force = false): Promise<ScheduleItem[]> {
    if (!force && loadedAt && Date.now() - loadedAt < MAX_AGE_MS) return items.value
    pending ??= getSchedule()
      .then(list => {
        items.value = list
        loadedAt = Date.now()
        return list
      })
      .finally(() => { pending = null })
    return pending
  }

  function byRelease (releaseId: number): ScheduleItem | undefined {
    return items.value.find(entry => entry.release.id === releaseId)
  }

  /** «Серия 9 вышла сегодня» / «Серия 10 — сегодня» по расписанию; null, если сегодня не выходит. */
  function airsToday (releaseId: number): { out: boolean, ordinal: number | null } | null {
    const entry = byRelease(releaseId)
    if (!entry || entry.release.publish_day?.value !== weekday()) return null
    if (entry.published_release_episode) return { out: true, ordinal: entry.published_release_episode.ordinal }
    return { out: false, ordinal: entry.next_release_episode_number }
  }

  return { items, today, load, byRelease, airsToday }
})
