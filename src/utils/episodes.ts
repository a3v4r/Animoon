import type { Episode } from '@/api/types'
import type { EpisodeProgress } from '@/stores/progress'

type ProgressOf = (episodeId: string) => EpisodeProgress | undefined

/** Серии релиза по порядку показа. */
export function sortEpisodes (episodes: readonly Episode[]): Episode[] {
  return [...episodes].sort((a, b) => a.sort_order - b.sort_order)
}

/**
 * Какую серию смотреть дальше: первую непросмотренную по порядку (с места остановки, если начата).
 * Одно правило для главной и страницы релиза; от времени изменений не зависит, поэтому пересмотр
 * старой серии или случайная отметка дальней не уводят «Продолжить» в сторону. null — всё просмотрено.
 */
export function nextEpisodeToWatch (episodes: readonly Episode[], progressOf: ProgressOf): Episode | null {
  return sortEpisodes(episodes).find(e => !progressOf(e.id)?.watched) ?? null
}

/** Запись прогресса со смыслом: серия просмотрена или начата дальше первых секунд. */
export function hasMeaningfulProgress (entry: EpisodeProgress | undefined): boolean {
  return !!entry && (entry.watched || entry.time > 10)
}
