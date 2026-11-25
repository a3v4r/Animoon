import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { saveWindowState } from '@tauri-apps/plugin-window-state'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import router from '@/router'
import { useProgressStore } from '@/stores/progress'
import { isTauri } from '@/utils/window'

/** Первая проверка — через 10 с после запуска, дальше раз в 6 часов; после ошибки — через 30 минут. */
const FIRST_CHECK_MS = 10_000
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000
const RETRY_MS = 30 * 60 * 1000

/**
 * - available — найдено обновление; downloading — скачивается;
 * - ready — скачано, ждёт установки (в плеере установка откладывается до выхода из него);
 * - installing — запущена установка, приложение сейчас закроется.
 */
export type UpdaterStatus =
  'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'installing' | 'error' | 'unsupported'

/** Понятный текст вместо сырой ошибки плагина (он отдаёт только английскую строку). */
function describe (e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  console.warn('[updater]', raw)
  const text = raw.toLowerCase()
  if (text.includes('valid release json')) return 'сервер обновлений не ответил'
  if (/error sending request|dns|timed out|timeout|connect|network/.test(text)) return 'нет соединения с GitHub'
  if (text.includes('signature')) return 'подпись обновления не прошла проверку'
  return 'ошибка обновления'
}

/**
 * Автообновление через GitHub Releases (latest.json, подпись ключом Tauri).
 * В режиме разработки не проверяем: версия там та же, а сборки dev не обновляются.
 */
export const useUpdaterStore = defineStore('updater', () => {
  const supported = isTauri && import.meta.env.PROD
  const progressStore = useProgressStore()

  const status = ref<UpdaterStatus>(supported ? 'idle' : 'unsupported')
  const update = shallowRef<Update | null>(null)
  /** Ошибка последней проверки (для настроек). */
  const checkError = ref('')
  /** Ошибка скачивания или установки — баннер остаётся с кнопкой «Повторить». */
  const installError = ref('')
  const received = ref(0)
  const total = ref<number | null>(null)
  // «Позже» действует до перезапуска приложения.
  const dismissed = ref('')
  let timer: number | undefined

  const version = computed(() => update.value?.version ?? '')
  /** Доля скачанного 0–1, если сервер сообщил размер. */
  const progress = computed(() => (total.value ? Math.min(1, received.value / total.value) : null))
  const busy = computed(() => ['downloading', 'ready', 'installing'].includes(status.value))
  /** Баннер: найдено и не отложено, либо уже идёт обновление, которое начал пользователь. */
  const showBanner = computed(() => busy.value || (status.value === 'available' && version.value !== dismissed.value))
  /** В плеере ставить нельзя: позиция серии сохраняется только при выходе из него. */
  const inPlayer = computed(() => router.currentRoute.value.meta.fullscreenLayout === true)

  async function checkNow (manual = true): Promise<void> {
    if (!supported || status.value === 'checking' || busy.value) return
    const previous = status.value
    // Если обновление уже найдено, баннер не прячем на время проверки.
    if (previous !== 'available') status.value = 'checking'
    checkError.value = ''
    try {
      const found = await check()
      // Пока шла проверка, пользователь мог начать установку — тогда новый результат не нужен.
      if (busy.value) {
        if (found && found !== update.value) void found.close().catch(() => {})
        return
      }
      if (update.value && update.value !== found) void update.value.close().catch(() => {})
      update.value = found
      status.value = found ? 'available' : 'none'
    } catch (e) {
      checkError.value = describe(e)
      // Пока шла проверка, началась установка — её статус не трогаем.
      if (busy.value) return
      // Найденное раньше обновление не теряем; неудачная фоновая проверка не висит в настройках ошибкой.
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

  /** Установка скачанного: на Windows установщик закрывает приложение сам, на Linux и macOS — перезапуск. */
  async function finish (): Promise<void> {
    const found = update.value
    if (!found || status.value !== 'ready' || inPlayer.value) return
    status.value = 'installing'
    try {
      // Процесс завершится без обычного выхода — сохранить заранее то, что сохраняется при закрытии.
      await Promise.allSettled([progressStore.flush(true), saveWindowState()])
      // Отправка могла занять до 15 с — если за это время открыли серию, ждём выхода из плеера.
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

  // Скачалось, пока смотрели серию, — ставим после выхода из плеера. flush: 'post' — после того, как плеер
  // размонтировался и сохранил последнюю позицию (onBeforeUnmount), иначе она не попадёт в отправку.
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
