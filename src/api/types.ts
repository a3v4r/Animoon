// Типы ответов AniLibria API v1. Описаны только поля, которые использует приложение;
// полная схема — docs/api-v1.json.

export interface ValueDescription<T = string> {
  value: T
  description: string
}

export interface Image {
  src?: string
  preview: string
  thumbnail: string
  optimized?: { src?: string, preview: string, thumbnail: string }
}

export interface Genre {
  id: number
  name: string
}

export interface TimeRange {
  start: number | null
  stop: number | null
}

export interface Episode {
  id: string
  name: string | null
  ordinal: number
  opening: TimeRange
  ending: TimeRange
  preview: Image | null
  hls_480: string | null
  hls_720: string | null
  hls_1080: string | null
  duration: number | null
  sort_order: number
  release_id: number
  updated_at?: string
}

export interface Member {
  id: string
  role: ValueDescription
  nickname: string
}

export interface Release {
  id: number
  alias: string
  type: ValueDescription | null
  year: number
  name: { main: string, english: string | null, alternative: string | null }
  season: ValueDescription | null
  poster: Image
  fresh_at: string | null
  is_ongoing: boolean
  age_rating: { value: string, label: string } | null
  publish_day: ValueDescription<number> | null
  description: string | null
  episodes_total: number | null
  average_duration_of_episode: number | null
  added_in_users_favorites: number
  is_blocked_by_geo: boolean
  is_blocked_by_copyrights: boolean
  genres?: Genre[]
  latest_episode?: Episode | null
}

export interface ReleaseFull extends Release {
  genres: Genre[]
  members: Member[]
  episodes: Episode[]
}

export interface Paginated<T> {
  data: T[]
  meta: {
    pagination: {
      total: number
      count: number
      per_page: number
      current_page: number
      total_pages: number
    }
  }
}

export interface ScheduleItem {
  release: Release
  full_season_is_released: boolean
  published_release_episode: Episode | null
  next_release_episode_number: number | null
}

export interface Profile {
  id: number
  login: string | null
  nickname: string | null
  email: string | null
  avatar: Image | null
}

/** Тайм-код просмотра: [id серии, секунда, досмотрена]. */
export type Timecode = [string, number, boolean]

export interface AppStatus {
  is_alive: boolean
  available_api_endpoints: string[]
}
