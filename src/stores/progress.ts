import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getTimecodes, saveTimecodes } from '@/api/account'
import { readJson, writeJson } from '@/utils/storage'
import { useAccountStore } from './account'

const KEY = 'progress.episodes'
const SYNC_KEY = 'progress.syncedAt'
// ID аккаунта, чьи тайм-коды лежат в локальном прогрессе.
const OWNER_KEY = 'progress.owner'
// Не чаще раза в столько мс по одной серии: более частые записи сервер отбрасывает.
const SEND_INTERVAL = 15000

interface TimecodeUpdate {
  release_episode_id: string
  time: number
  is_watched: boolean
}

export interface EpisodeProgress {
  time: number
  watched: boolean
  /** Когда запись изменилась, мс. */
  updatedAt: number
}

/** Серия считается досмотренной, если осталось меньше 2 минут или 90%. */
export function isWatched (time: number, duration: number | null | undefined): boolean {
  if (!duration) return false
  return duration - time < 120 || time / duration > 0.9
}

/**
 * Прогресс просмотра серий. Хранится локально и, если пользователь вошёл,
 * синхронизируется с тайм-кодами аккаунта AniLibria.
 */
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

  // Когда тайм-код серии последний раз ушёл на сервер.
  const lastSent = new Map<string, number>()

  function scheduleFlush (delay: number): void {
    if (flushTimer === undefined) {
      flushTimer = window.setTimeout(() => { void flush() }, delay)
    }
  }

  /**
   * Отправить накопленные тайм-коды на сервер.
   * Сервер AniLibria молча отбрасывает запись по серии, если предыдущая пришла несколько секунд назад,
   * поэтому одна и та же серия уходит не чаще раза в SEND_INTERVAL, остальное досылается позже.
   */
  /**
   * Отправить очередь. force — всё сразу, без паузы между записями одной серии
   * (перед закрытием приложения: сервер может отбросить слишком частую запись, но это лучше, чем ничего).
   */
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
      // Не получилось — вернуть в очередь, если за это время не появилось значение новее.
      for (const item of ready) if (!pending.has(item.release_episode_id)) pending.set(item.release_episode_id, item)
      scheduleFlush(SEND_INTERVAL)
    }
  }

  function save (episodeId: string, time: number, duration: number | null | undefined): void {
    const watched = isWatched(time, duration) || (get(episodeId)?.watched ?? false)
    // Существующую запись меняем на месте: тогда сохранение позиции не пересчитывает отметки
    // на всех карточках (они зависят только от watched, а он обычно не меняется).
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
    // Таймер не переставляется: плеер сохраняет каждые 10 секунд,
    // и с перестановкой отправка во время просмотра не случалась бы никогда.
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

  /**
   * Вошёл другой аккаунт: прогресс прошлого аккаунта убрать, а тайм-коды нового загрузить целиком.
   * Прогресс, накопленный без входа (владельца нет), остаётся и уйдёт в аккаунт.
   */
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

  /**
   * Синхронизировать с тайм-кодами аккаунта: подтянуть просмотры с сайта и других приложений
   * и отправить локальные, которые изменились после прошлой синхронизации (в том числе без входа).
   * Серверная запись побеждает, если локальная не менялась после прошлой синхронизации.
   * force = false — не чаще раза в минуту: вызывается при каждом возврате фокуса в окно.
   */
  async function sync (force = true): Promise<void> {
    const account = useAccountStore()
    if (!account.isAuthorized || !account.profile) return
    if (!force && Date.now() - lastSyncAt < 60000) return
    lastSyncAt = Date.now()
    attach(account.profile.id)
    const since = readJson<string | null>(SYNC_KEY, null)
    const lastSync = since ? Date.parse(since) : 0
    const startedAt = Date.now()
    // Что изменилось локально с прошлой синхронизации (смотрели без входа, закрыли окно до отправки).
    // Снимок до запроса: ответ сервера ниже эти записи не перезаписывает.
    const dirty = new Set(Object.entries(episodes.value)
      .filter(([, local]) => local.updatedAt >= lastSync)
      .map(([id]) => id))
    try {
      const remote = await getTimecodes(since ?? undefined)
      for (const [id, time, watched] of remote) {
        if (dirty.has(id)) continue
        const local = episodes.value[id]
        // Правка во время запроса новее ответа сервера.
        if (local && local.updatedAt >= startedAt) continue
        // Время изменения сервер не отдаёт; ставим чуть раньше отметки синхронизации,
        // чтобы в следующий раз запись не считалась локальной правкой.
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
      // Сеть или сессия: попробуем в следующий раз.
    }
  }

  return { episodes, get, save, setWatched, sync, flush }
})
