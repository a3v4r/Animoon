import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getEpisodeReleaseId } from '@/api/releases'
import type { Release, ReleaseFull } from '@/api/types'
import { readJson, writeJson } from '@/utils/storage'
import { useProgressStore } from './progress'

const EPISODES_KEY = 'index.episodeRelease'
const RELEASED_KEY = 'index.releasedCount'
const LAST_KEY = 'index.lastOrdinal'

// -1: серии нет в API (релиз удалён), чтобы не спрашивать снова
const UNKNOWN = -1

export interface ReleaseProgress {
  watched: number
  released: number | null
  total: number | null
}

export const useEpisodeIndexStore = defineStore('episodeIndex', () => {
  const episodeRelease = ref<Record<string, number>>(readJson(EPISODES_KEY, {}))
  const releasedCount = ref<Record<number, number>>(readJson(RELEASED_KEY, {}))
  const lastOrdinal = ref<Record<number, number>>(readJson(LAST_KEY, {}))
  let resolving = false

  function persist (): void {
    writeJson(EPISODES_KEY, episodeRelease.value)
    writeJson(RELEASED_KEY, releasedCount.value)
    writeJson(LAST_KEY, lastOrdinal.value)
  }

  function learn (release: Pick<ReleaseFull, 'id' | 'episodes'>): void {
    for (const episode of release.episodes) episodeRelease.value[episode.id] = release.id
    releasedCount.value[release.id] = release.episodes.length
    lastOrdinal.value[release.id] = release.episodes.reduce((max, e) => Math.max(max, e.ordinal), 0)
    persist()
  }

  // Запомненное число могло устареть: прибавляем разницу номеров, не меньше одной
  function releasedWithoutEpisodes (release: Release): number | null {
    const known = releasedCount.value[release.id]
    const latest = release.latest_episode
    if (known != null) {
      const knownLast = lastOrdinal.value[release.id]
      if (latest && knownLast != null && latest.ordinal > knownLast) {
        return known + Math.max(1, Math.floor(latest.ordinal) - Math.floor(knownLast))
      }
      return known
    }
    if (latest) return Math.floor(latest.ordinal)
    if (!release.is_ongoing && release.episodes_total) return release.episodes_total
    return null
  }

  function isStale (release: Release): boolean {
    const knownLast = lastOrdinal.value[release.id]
    return knownLast != null && release.latest_episode != null && release.latest_episode.ordinal > knownLast
  }

  const watchedByRelease = computed(() => {
    const progress = useProgressStore()
    const counts = new Map<number, number>()
    for (const [episodeId, entry] of Object.entries(progress.episodes)) {
      const releaseId = episodeRelease.value[episodeId]
      if (entry.watched && releaseId != null && releaseId !== UNKNOWN) {
        counts.set(releaseId, (counts.get(releaseId) ?? 0) + 1)
      }
    }
    return counts
  })

  function releaseProgress (release: Release & { episodes?: unknown[] }): ReleaseProgress {
    const total = release.episodes_total ?? null
    const released = Array.isArray(release.episodes) ? release.episodes.length : releasedWithoutEpisodes(release)
    return { watched: watchedByRelease.value.get(release.id) ?? 0, released, total }
  }

  async function resolveUnknown (): Promise<void> {
    if (resolving) return
    resolving = true
    try {
      const progress = useProgressStore()
      const queue = Object.keys(progress.episodes).filter(id => episodeRelease.value[id] == null)
      let changed = 0
      const worker = async (): Promise<void> => {
        for (let id = queue.shift(); id; id = queue.shift()) {
          try {
            episodeRelease.value[id] = await getEpisodeReleaseId(id)
          } catch (error) {
            // 404: серии больше нет, на сетевой ошибке повторим в следующий раз
            if ((error as { status?: number }).status === 404) episodeRelease.value[id] = UNKNOWN
          }
          if (++changed % 20 === 0) persist()
        }
      }
      await Promise.all([worker(), worker(), worker(), worker()])
      persist()
    } finally {
      resolving = false
    }
  }

  return { learn, releaseProgress, isStale, resolveUnknown }
})
