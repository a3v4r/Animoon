import type { Episode } from '@/api/types'
import type { EpisodeProgress } from '@/stores/progress'

type ProgressOf = (episodeId: string) => EpisodeProgress | undefined

export function sortEpisodes (episodes: readonly Episode[]): Episode[] {
  return [...episodes].sort((a, b) => a.sort_order - b.sort_order)
}

// не по времени изменений: пересмотр старой серии не должен сбивать «Продолжить»
export function nextEpisodeToWatch (episodes: readonly Episode[], progressOf: ProgressOf): Episode | null {
  return sortEpisodes(episodes).find(e => !progressOf(e.id)?.watched) ?? null
}

export function hasMeaningfulProgress (entry: EpisodeProgress | undefined): boolean {
  return !!entry && (entry.watched || entry.time > 10)
}
