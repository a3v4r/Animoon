import { defineStore } from 'pinia'
import { shallowReactive } from 'vue'
import { getRelease } from '@/api/releases'
import type { ReleaseFull } from '@/api/types'
import { useEpisodeIndexStore } from './episodeIndex'

// Карточка старше этого перечитывается при следующем обращении: у онгоингов выходят серии.
const MAX_AGE_MS = 10 * 60 * 1000

/** Кэш загруженных релизов: страница релиза и плеер не запрашивают одно и то же дважды. */
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
      // Нет сети — лучше показать прежнюю карточку, чем ошибку (кроме явного обновления).
      if (cached && !force) return cached
      throw error
    }
    cache.set(String(release.id), release)
    cache.set(release.alias, release)
    loadedAt.set(release.id, Date.now())
    useEpisodeIndexStore().learn(release)
    return release
  }

  /** Релиз из кэша без запроса: чтобы при повторном показе не было промежуточного пустого состояния. */
  function peek (id: string | number): ReleaseFull | null {
    return cache.get(String(id)) ?? null
  }

  return { load, peek }
})
