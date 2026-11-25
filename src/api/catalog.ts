import { api } from './http'
import type { Genre, Paginated, Release, ScheduleItem, ValueDescription } from './types'

export interface CatalogFilters {
  genres?: number[]
  types?: string[]
  seasons?: string[]
  years?: { from_year?: number, to_year?: number }
  search?: string
  sorting?: string
  age_ratings?: string[]
  publish_statuses?: string[]
  production_statuses?: string[]
}

export interface SortingOption {
  value: string
  label: string
  description: string
}

export interface CatalogReferences {
  genres: Genre[]
  types: ValueDescription[]
  seasons: ValueDescription[]
  years: number[]
  sorting: SortingOption[]
  ageRatings: { value: string, label: string }[]
  publishStatuses: ValueDescription[]
  productionStatuses: ValueDescription[]
}

/** Каталог с фильтрами, постранично. */
export function getCatalog (page: number, filters: CatalogFilters, limit = 30): Promise<Paginated<Release>> {
  return api<Paginated<Release>>('/anime/catalog/releases', {
    method: 'POST',
    body: { page, limit, f: filters }
  })
}

/** Все справочники для фильтров каталога одним вызовом. */
export async function getCatalogReferences (): Promise<CatalogReferences> {
  const ref = <T>(name: string) => api<T>(`/anime/catalog/references/${name}`)
  const [genres, types, seasons, years, sorting, ageRatings, publishStatuses, productionStatuses] = await Promise.all([
    ref<Genre[]>('genres'),
    ref<ValueDescription[]>('types'),
    ref<ValueDescription[]>('seasons'),
    ref<number[]>('years'),
    ref<SortingOption[]>('sorting'),
    ref<{ value: string, label: string }[]>('age-ratings'),
    ref<ValueDescription[]>('publish-statuses'),
    ref<ValueDescription[]>('production-statuses')
  ])
  return { genres, types, seasons, years, sorting, ageRatings, publishStatuses, productionStatuses }
}

/** Расписание выхода серий на неделю. */
export function getSchedule (): Promise<ScheduleItem[]> {
  return api<ScheduleItem[]>('/anime/schedule/week')
}
