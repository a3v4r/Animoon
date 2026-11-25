import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { saveWindowState } from '@tauri-apps/plugin-window-state'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import router from '@/router'
import { useProgressStore } from '@/stores/progress'
import { isTauri } from '@/utils/window'

const FIRST_CHECK_MS = 10_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const RETRY_MS = 30 * 60 * 1000

export type UpdaterStatus =
  'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'installing' | 'error' | 'unsupported'

function describe (e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  console.warn('[updater]', raw)
  const text = raw.toLowerCase()
  if (text.includes('valid release json')) return 'сервер обновлений не ответил'
  if (/error sending request|dns|timed out|timeout|connect|network/.test(text)) return 'нет соединения с GitHub'
  if (text.includes('signature')) return 'подпись обновления не прошла проверку'
  return 'ошибка обновления'
}

export const useUpdaterStore = defineStore('updater', () => {
  const supported = isTauri && import.meta.env.PROD
  const progressStore = useProgressStore()

  const status = ref<UpdaterStatus>(supported ? 'idle' : 'unsupported')
  const update = shallowRef<Update | null>(null)
  const checkError = ref('')
  const installError = ref('')
  const received = ref(0)
  const total = ref<number | null>(null)
  const dismissed = ref('')
  let timer: number | undefined

  const version = computed(() => update.value?.version ?? '')
  const progress = computed(() => (total.value ? Math.min(1, received.value / total.value) : null))
  const busy = computed(() => ['downloading', 'ready', 'installing'].includes(status.value))
  const showBanner = computed(() => busy.value || (status.value === 'available' && version.value !== dismissed.value))
  // В плеере не ставим: позиция серии сохраняется только при выходе из него
  const inPlayer = computed(() => router.currentRoute.value.meta.fullscreenLayout === true)

  async function checkNow (manual = true): Promise<void> {
    if (!supported || status.value === 'checking' || busy.value) return
    const previous = status.value
    if (previous !== 'available') status.value = 'checking'
    checkError.value = ''
    try {
      const found = await check()
      // Пока шла проверка, могли начать установку: новый результат не нужен
      if (busy.value) {
        if (found && found !== update.value) void found.close().catch(() => {})
        return
      }
      if (update.value && update.value !== found) void update.value.close().catch(() => {})
      update.value = found
      status.value = found ? 'available' : 'none'
    } catch (e) {
      checkError.value = describe(e)
      if (busy.value) return
      if (update.value) status.value = 'available'
      else status.value = manual ? 'error' : previous
    }
  }

  async function install (): Promise<void> {
    const found = update.value
    if (!found || status.value !== 'available') return
    status.value = 'downloading'
    received.value = 0
    total.value = null
    installError.value = ''
    try {
      await found.download(event => {
        if (event.event === 'Started') total.value = event.data.contentLength ?? null
        else if (event.event === 'Progress') received.value += event.data.chunkLength
      })
      status.value = 'ready'
      if (!inPlayer.value) await finish()
    } catch (e) {
      installError.value = describe(e)
      status.value = 'available'
    }
  }

  async function finish (): Promise<void> {
    const found = update.value
    if (!found || status.value !== 'ready' || inPlayer.value) return
    status.value = 'installing'
    try {
      // Процесс завершится без обычного выхода, поэтому сохраняем всё заранее
      await Promise.allSettled([progressStore.flush(true), saveWindowState()])
      // Отправка могла занять до 15 с, за это время могли открыть серию
      if (inPlayer.value) {
        status.value = 'ready'
        return
      }
      await found.install()
      await relaunch()
    } catch (e) {
      installError.value = describe(e)
      status.value = 'ready'
    }
  }

  // flush 'post': плеер уже размонтирован и сохранил последнюю позицию
  watch(inPlayer, value => {
    if (!value && status.value === 'ready') void finish()
  }, { flush: 'post' })

  function dismiss (): void {
    dismissed.value = version.value
  }

  function start (): void {
    if (!supported || timer !== undefined) return
    timer = window.setTimeout(async function tick () {
      await checkNow(false)
      timer = window.setTimeout(tick, checkError.value ? RETRY_MS : CHECK_EVERY_MS)
    }, FIRST_CHECK_MS)
  }

  return {
    supported, status, version, checkError, installError, progress, busy, showBanner, inPlayer,
    checkNow, install, finish, dismiss, start
  }
})
