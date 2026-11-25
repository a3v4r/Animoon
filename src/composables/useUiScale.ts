// Масштаб интерфейса. Вёрстка рассчитана на окно ~1280–1800 px; на большом мониторе при масштабе Windows 100%
// (например, 2560×1440) всё выглядит мелко. Увеличиваем весь WebView встроенным зумом — вёрстка при этом
// просто видит окно «уже» и раскладывается как на привычной ширине.

import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { isTauri } from '@/utils/window'

/** Ширина и высота, на которых автомасштаб начинает расти (100% до них). */
const BASE_WIDTH = 1760
const BASE_HEIGHT = 990
/** Меньше этого окно после масштаба не становится: вёрстка рассчитана на минимум 960×560. */
const MIN_WIDTH = 960
const MIN_HEIGHT = 560
const MAX_SCALE = 2

/** Масштаб, который сейчас действует (для подписи в настройках). */
export const effectiveScale = ref(1)

/** Масштаб «Авто» для окна такого размера (логические пиксели). */
export function autoScale (width: number, height: number): number {
  const raw = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT)
  // До ~110% не трогаем: на обычном Full HD интерфейс остаётся как есть.
  if (raw < 1.1) return 1
  return Math.min(MAX_SCALE, Math.floor(raw * 20) / 20)
}

/** Не даём масштабу сделать окно «меньше» минимума вёрстки. */
function fit (scale: number, width: number, height: number): number {
  const limit = Math.min(width / MIN_WIDTH, height / MIN_HEIGHT)
  return Math.max(1, Math.min(scale, Math.floor(limit * 20) / 20))
}

let started = false
const cleanup: Array<() => void> = []

/**
 * Запускается один раз из main.ts до монтирования: сразу ставит масштаб,
 * потом следит за размером окна, сменой монитора и настройкой.
 */
export async function startUiScale (): Promise<void> {
  if (!isTauri || started) return
  started = true
  const { settings } = useSettingsStore()
  const win = getCurrentWindow()
  const webview = getCurrentWebview()

  let width = 0
  let height = 0
  // Реальный зум неизвестен: после перезагрузки страницы WebView сохраняет прежний, поэтому первый раз ставим всегда.
  let applied = Number.NaN

  async function measure (): Promise<boolean> {
    const [factor, size, fullscreen, minimized] = await Promise.all([
      win.scaleFactor(), win.innerSize(), win.isFullscreen(), win.isMinimized()
    ])
    // Свёрнутое окно в Windows сообщает размер вроде 144×19 — по нему масштаб не считаем.
    if (minimized) return false
    // В полноэкранном плеере масштаб не пересчитываем: иначе при входе и выходе всё перестраивается (140% ↔ 145%).
    if (fullscreen && !Number.isNaN(applied)) return false
    const logical = size.toLogical(factor)
    if (!logical.width || !logical.height) return false
    width = logical.width
    height = logical.height
    return true
  }

  async function apply (): Promise<void> {
    if (!width || !height) return
    const wanted = settings.uiScale === 'auto' ? autoScale(width, height) : settings.uiScale
    const next = fit(wanted, width, height)
    if (next === applied) return
    applied = next
    try {
      await webview.setZoom(next)
      effectiveScale.value = next
    } catch (e) {
      applied = Number.NaN
      throw e
    }
  }

  async function update (): Promise<void> {
    try {
      if (await measure()) await apply()
    } catch {
      // Без зума интерфейс просто остаётся 100%.
    }
  }

  // Сначала масштаб, потом подписки — первый кадр уже в нужном размере.
  await update()

  // Изменения размера приходят пачкой при перетаскивании края — пересчитываем не чаще кадра.
  let frame = 0
  const schedule = (): void => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => { void update() })
  }

  cleanup.push(await win.onResized(schedule))
  cleanup.push(await win.onScaleChanged(schedule))
  cleanup.push(watch(() => settings.uiScale, schedule))
  cleanup.push(() => cancelAnimationFrame(frame))
}

// При горячей замене модуля в разработке — снять старые подписки, иначе два экземпляра спорят за зум.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const stop of cleanup.splice(0)) stop()
  })
}
