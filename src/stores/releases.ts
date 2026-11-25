import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'
import { getRelease } from '@/api/releases'
import type { ReleaseFull } from '@/api/types'
import { useEpisodeIndexStore } from './episodeIndex'

const MAX_AGE_MS = 10 * 60 * 1000

export const useReleasesStore = defineStore('releases', () => {
  const cache = shallowReactive(new Map<string, ReleaseFull>())
  const loadedAt = new Map<number, number>()

  async function load (id: string | number, force = false): Promise<ReleaseFull> {
    const cached = cache.get(String(id))
    if (cached && !force && Date.now() - (loadedAt.get(cached.id) ?? 0) < MAX_AGE_MS) return cached
    let release: ReleaseFull
    try {
      release = await getRelease(id)
    } catch (error) {
      // Без сети отдаём старую карточку, но не при явном обновлении
      if (cached && !force) return cached
      throw error
    }
    cache.set(String(release.id), release)
    cache.set(release.alias, release)
    loadedAt.set(release.id, Date.now())
    useEpisodeIndexStore().learn(release)
    return release
  }

  function peek (id: string | number): ReleaseFull | null {
    return cache.get(String(id)) ?? null
  }

  return { load, peek }
})
