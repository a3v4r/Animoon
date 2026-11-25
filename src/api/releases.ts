import { api } from './http'
import type { Paginated, Release, ReleaseFull } from './types'

/** Последние обновлённые релизы, постранично. С параметром page API отдаёт { data, meta }. */
export function getLatest (page: number, limit = 30): Promise<Paginated<Release>> {
  return api<Paginated<Release>>('/anime/releases/latest', { query: { page, limit } })
}

/** Релиз целиком: описание, жанры, команда, серии. */
export function getRelease (idOrAlias: number | string): Promise<ReleaseFull> {
  return api<ReleaseFull>(`/anime/releases/${idOrAlias}`)
}

/** К какому релизу относится серия (тайм-коды аккаунта приходят только с id серии). */
export async function getEpisodeReleaseId (episodeId: string): Promise<number> {
  const { release_id: releaseId } = await api<{ release_id: number }>(`/anime/releases/episodes/${episodeId}`, {
    query: { include: 'release_id' }
  })
  return releaseId
}

/** Поиск по названию. */
export function searchReleases (query: string): Promise<Release[]> {
  return api<Release[]>('/app/search/releases', { query: { query } })
}
