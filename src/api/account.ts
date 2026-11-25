import { api } from './http'
import type { Paginated, Profile, ReleaseFull, Timecode } from './types'

/** Вход по логину (или почте) и паролю. Возвращает токен сессии. */
export async function login (loginOrEmail: string, password: string): Promise<string> {
  const { token } = await api<{ token: string }>('/accounts/users/auth/login', {
    method: 'POST',
    body: { login: loginOrEmail, password }
  })
  return token
}

export function logout (): Promise<void> {
  return api<void>('/accounts/users/auth/logout', { method: 'POST' })
}

export function getProfile (): Promise<Profile> {
  return api<Profile>('/accounts/users/me/profile')
}

/** ID релизов в избранном. */
export function getFavoriteIds (): Promise<number[]> {
  return api<number[]>('/accounts/users/me/favorites/ids')
}

/** Релизы из избранного, постранично (не больше 50 за запрос — ограничение API). */
export function getFavorites (page: number, limit = 50, sorting = 'FRESH_AT_DESC'): Promise<Paginated<ReleaseFull>> {
  return api<Paginated<ReleaseFull>>('/accounts/users/me/favorites/releases', {
    method: 'POST',
    body: { page, limit, f: { sorting } }
  })
}

/** Всё избранное целиком: первая страница, затем остальные параллельно. */
export async function getAllFavorites (): Promise<ReleaseFull[]> {
  const first = await getFavorites(1)
  const pages = first.meta.pagination.total_pages
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getFavorites(i + 2)))
  return [first, ...rest].flatMap(page => page.data)
}

export function addFavorite (releaseId: number): Promise<number[]> {
  return api<number[]>('/accounts/users/me/favorites', { method: 'POST', body: [{ release_id: releaseId }] })
}

export function removeFavorite (releaseId: number): Promise<number[]> {
  return api<number[]>('/accounts/users/me/favorites', { method: 'DELETE', body: [{ release_id: releaseId }] })
}

/** Тайм-коды просмотра; since — только изменённые после этой даты (ISO). */
export function getTimecodes (since?: string): Promise<Timecode[]> {
  return api<Timecode[]>('/accounts/users/me/views/timecodes', { query: { since } })
}

export function saveTimecodes (items: { release_episode_id: string, time: number, is_watched: boolean }[]): Promise<void> {
  return api<void>('/accounts/users/me/views/timecodes', { method: 'POST', body: items })
}
