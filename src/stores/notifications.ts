import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { mediaUrl } from '@/api/http'
import { getLatest } from '@/api/releases'
import { readJson, writeJson } from '@/utils/storage'
import { isTauri } from '@/utils/window'
import { useAccountStore } from './account'
import { useSettingsStore } from './settings'

const ITEMS_KEY = 'notifications.items'
const SEEN_KEY = 'notifications.seen'
const MAX_ITEMS = 50

export interface NewEpisodeNotice {
  id: string
  releaseId: number
  title: string
  ordinal: number
  poster: string
  createdAt: number
  read: boolean
}

export const useNotificationsStore = defineStore('notifications', () => {
  const items = ref<NewEpisodeNotice[]>(readJson(ITEMS_KEY, []))
  const seen = readJson<Record<number, number>>(SEEN_KEY, {})
  let timer: number | undefined

  const unread = computed(() => items.value.filter(item => !item.read).length)

  function persist (): void {
    writeJson(ITEMS_KEY, items.value)
    writeJson(SEEN_KEY, seen)
  }

  async function notifySystem (notice: NewEpisodeNotice): Promise<void> {
    if (!isTauri || document.hasFocus()) return
    let granted = await isPermissionGranted()
    if (!granted) granted = (await requestPermission()) === 'granted'
    if (granted) sendNotification({ title: notice.title, body: `Вышла ${notice.ordinal} серия` })
  }

  async function check (): Promise<void> {
    const account = useAccountStore()
    const { settings } = useSettingsStore()
    if (!account.isAuthorized || account.favoriteIds.size === 0) return
    try {
      const { data } = await getLatest(1, 50)
      for (const release of data) {
        const ordinal = release.latest_episode?.ordinal
        if (ordinal == null || !account.favoriteIds.has(release.id)) continue
        const known = seen[release.id]
        seen[release.id] = Math.max(known ?? 0, ordinal)
        // Первую встречу с релизом только запоминаем, иначе после входа посыплются старые серии
        if (known == null || ordinal <= known) continue
        const notice: NewEpisodeNotice = {
          id: `${release.id}-${ordinal}`,
          releaseId: release.id,
          title: release.name.main,
          ordinal,
          poster: mediaUrl(release.poster.optimized?.thumbnail ?? release.poster.thumbnail),
          createdAt: Date.now(),
          read: false
        }
        items.value = [notice, ...items.value.filter(item => item.id !== notice.id)].slice(0, MAX_ITEMS)
        if (settings.notifications) void notifySystem(notice)
      }
      persist()
    } catch {
      // сеть недоступна, проверим в следующий раз
    }
  }

  function start (): void {
    window.clearInterval(timer)
    void check()
    timer = window.setInterval(() => { void check() }, 10 * 60 * 1000)
  }

  function markAllRead (): void {
    items.value = items.value.map(item => ({ ...item, read: true }))
    persist()
  }

  function clear (): void {
    items.value = []
    persist()
  }

  return { items, unread, check, start, markAllRead, clear }
})
