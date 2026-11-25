import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getTimecodes, saveTimecodes } from '@/api/account'
import { readJson, writeJson } from '@/utils/storage'
import { useAccountStore } from './account'

const KEY = 'progress.episodes'
const SYNC_KEY = 'progress.syncedAt'
const OWNER_KEY = 'progress.owner'
// Сервер молча отбрасывает запись по серии, если предыдущая пришла недавно
const SEND_INTERVAL = 15000

interface TimecodeUpdate {
  release_episode_id: string
  time: number
  is_watched: boolean
}

export interface EpisodeProgress {
  time: number
  watched: boolean
  updatedAt: number
}

export function isWatched (time: number, duration: number | null | undefined): boolean {
  if (!duration) return false
  return duration - time < 120 || time / duration > 0.9
}

export const useProgressStore = defineStore('progress', () => {
  const episodes = ref<Record<string, EpisodeProgress>>(readJson(KEY, {}))
  const pending = new Map<string, TimecodeUpdate>()
  let flushTimer: number | undefined

  function persist (): void {
    writeJson(KEY, episodes.value)
  }

  function get (episodeId: string): EpisodeProgress | undefined {
    return episodes.value[episodeId]
  }

  const lastSent = new Map<string, number>()

  function scheduleFlush (delay: number): void {
    if (flushTimer === undefined) {
      flushTimer = window.setTimeout(() => { void flush() }, delay)
    }
  }

  // force: всё сразу перед закрытием, пусть сервер что-то и отбросит
  async function flush (force = false): Promise<void> {
    window.clearTimeout(flushTimer)
    flushTimer = undefined
    const account = useAccountStore()
    if (!account.isAuthorized || pending.size === 0) return

    const now = Date.now()
    const ready: TimecodeUpdate[] = []
    let wait = Infinity
    for (const item of pending.values()) {
      const left = (lastSent.get(item.release_episode_id) ?? 0) + SEND_INTERVAL - now
      if (force || left <= 0) ready.push(item)
      else wait = Math.min(wait, left)
    }
    if (wait !== Infinity) scheduleFlush(wait)
    if (ready.length === 0) return

    for (const item of ready) {
      pending.delete(item.release_episode_id)
      lastSent.set(item.release_episode_id, now)
    }
    try {
      await saveTimecodes(ready)
    } catch {
      for (const item of ready) if (!pending.has(item.release_episode_id)) pending.set(item.release_episode_id, item)
      scheduleFlush(SEND_INTERVAL)
    }
  }

  function save (episodeId: string, time: number, duration: number | null | undefined): void {
    const watched = isWatched(time, duration) || (get(episodeId)?.watched ?? false)
    // Меняем на месте, чтобы сохранение позиции не пересчитывало отметки на всех карточках
    const entry = episodes.value[episodeId]
    if (entry) {
      entry.time = Math.floor(time)
      entry.watched = watched
      entry.updatedAt = Date.now()
    } else {
      episodes.value[episodeId] = { time: Math.floor(time), watched, updatedAt: Date.now() }
    }
    persist()
    pending.set(episodeId, { release_episode_id: episodeId, time: Math.floor(time), is_watched: watched })
    // Таймер не переставляем: плеер сохраняет каждые 10 с, и отправка не случилась бы никогда
    scheduleFlush(SEND_INTERVAL)
  }

  function setWatched (episodeId: string, watched: boolean): void {
    const current = get(episodeId)
    episodes.value[episodeId] = { time: watched ? (current?.time ?? 0) : 0, watched, updatedAt: Date.now() }
    persist()
    pending.set(episodeId, { release_episode_id: episodeId, time: episodes.value[episodeId].time, is_watched: watched })
    void flush()
  }

  let lastSyncAt = 0

  function attach (userId: number): void {
    const owner = readJson<number | null>(OWNER_KEY, null)
    if (owner === userId) return
    if (owner != null) {
      episodes.value = {}
      pending.clear()
      persist()
    }
    writeJson(SYNC_KEY, null)
    writeJson(OWNER_KEY, userId)
  }

  async function sync (force = true): Promise<void> {
    const account = useAccountStore()
    if (!account.isAuthorized || !account.profile) return
    if (!force && Date.now() - lastSyncAt < 60000) return
    lastSyncAt = Date.now()
    attach(account.profile.id)
    const since = readJson<string | null>(SYNC_KEY, null)
    const lastSync = since ? Date.parse(since) : 0
    const startedAt = Date.now()
    // Снимок до запроса: локальные правки с прошлой синхронизации ответ сервера не перетирает
    const dirty = new Set(Object.entries(episodes.value)
      .filter(([, local]) => local.updatedAt >= lastSync)
      .map(([id]) => id))
    try {
      const remote = await getTimecodes(since ?? undefined)
      for (const [id, time, watched] of remote) {
        if (dirty.has(id)) continue
        const local = episodes.value[id]
        if (local && local.updatedAt >= startedAt) continue
        // Сервер не отдаёт время изменения, ставим раньше startedAt, чтобы не считать это локальной правкой
        episodes.value[id] = { time, watched, updatedAt: startedAt - 1 }
      }
      for (const id of dirty) {
        const local = episodes.value[id]
        if (local && !pending.has(id)) {
          pending.set(id, { release_episode_id: id, time: local.time, is_watched: local.watched })
        }
      }
      persist()
      writeJson(SYNC_KEY, new Date(startedAt).toISOString())
      await flush()
    } catch {
      // сеть или сессия, повторим в следующий раз
    }
  }

  return { episodes, get, save, setWatched, sync, flush }
})
