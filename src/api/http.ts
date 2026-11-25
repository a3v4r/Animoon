// HTTP-клиент AniLibria API v1.
// В приложении запросы идут через tauri-plugin-http (Rust): нет CORS, прокси настраивается в Rust.
// В обычном браузере (pnpm dev без Tauri) используется window.fetch.
// Если зеркало не отвечает или отдаёт 5xx, клиент переключается на следующее.

import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

export const MIRRORS = ['https://anilibria.top', 'https://aniliberty.top', 'https://api.anilibria.app']

const isTauri = '__TAURI_INTERNALS__' in window
const doFetch: typeof fetch = isTauri ? (tauriFetch as typeof fetch) : window.fetch.bind(window)

let current = 0

/** Адрес зеркала, через которое сейчас идут запросы. Нужен и для картинок: API отдаёт пути вида /storage/... */
export function mirror (): string {
  return MIRRORS[current]
}

/** Абсолютный адрес картинки или файла с зеркала. */
export function mediaUrl (path: string | null | undefined): string {
  if (!path) return ''
  if (/^https?:\/\//.test(path)) return path
  return mirror() + path
}

export class ApiError extends Error {
  constructor (readonly status: number, message: string) {
    super(message)
  }
}

type Query = Record<string, string | number | boolean | undefined | null>

function buildUrl (base: string, path: string, query?: Query): string {
  const url = new URL(`/api/v1${path}`, base)
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }
  return url.toString()
}

let authToken: string | null = null

/** Токен сессии пользователя; передаётся в заголовке Authorization во всех запросах. */
export function setAuthToken (token: string | null): void {
  authToken = token
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'DELETE'
  query?: Query
  body?: unknown
  signal?: AbortSignal
}

/** Текст ошибки из ответа API: { message, errors: { поле: [текст] } }. */
async function errorMessage (response: Response): Promise<string> {
  try {
    const data = await response.json() as { message?: string, errors?: Record<string, string[]> }
    const first = data.errors ? Object.values(data.errors).flat()[0] : undefined
    return first ?? data.message ?? `Ошибка API ${response.status}`
  } catch {
    return `Ошибка API ${response.status}`
  }
}

export async function api<T> (path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  let lastError: unknown
  for (let attempt = 0; attempt < MIRRORS.length; attempt++) {
    const index = (current + attempt) % MIRRORS.length
    try {
      const response = await doFetch(buildUrl(MIRRORS[index], path, options.query), {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal ?? AbortSignal.timeout(15000)
      })
      if (response.status >= 500) {
        lastError = new ApiError(response.status, `Зеркало ${MIRRORS[index]} ответило ${response.status}`)
        continue
      }
      current = index
      if (!response.ok) {
        throw new ApiError(response.status, await errorMessage(response))
      }
      const text = await response.text()
      return (text ? JSON.parse(text) : undefined) as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (options.signal?.aborted) throw error
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Все зеркала AniLibria недоступны')
}
