import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSchedule } from '@/api/catalog'
import type { ScheduleItem } from '@/api/types'

const MAX_AGE_MS = 10 * 60 * 1000

// В API дни 1-7 с понедельника, в JS 0 - воскресенье
export function weekday (date = new Date()): number {
  return ((date.getDay() + 6) % 7) + 1
}

export const useScheduleStore = defineStore('schedule', () => {
  const items = ref<ScheduleItem[]>([])
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

  function airsToday (releaseId: number): { out: boolean, ordinal: number | null } | null {
    const entry = byRelease(releaseId)
    if (!entry || entry.release.publish_day?.value !== weekday()) return null
    if (entry.published_release_episode) return { out: true, ordinal: entry.published_release_episode.ordinal }
    return { out: false, ordinal: entry.next_release_episode_number }
  }

  return { items, today, load, byRelease, airsToday }
})
