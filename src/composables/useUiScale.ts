import { getCurrentWebview } from '@tauri-apps/api/webview'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { ref, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { isTauri } from '@/utils/window'

const BASE_WIDTH = 1760
const BASE_HEIGHT = 990
const MIN_WIDTH = 960
const MIN_HEIGHT = 560
const MAX_SCALE = 2

export const effectiveScale = ref(1)

export function autoScale (width: number, height: number): number {
  const raw = Math.min(width / BASE_WIDTH, height / BASE_HEIGHT)
  if (raw < 1.1) return 1
  return Math.min(MAX_SCALE, Math.floor(raw * 20) / 20)
}

function fit (scale: number, width: number, height: number): number {
  const limit = Math.min(width / MIN_WIDTH, height / MIN_HEIGHT)
  return Math.max(1, Math.min(scale, Math.floor(limit * 20) / 20))
}

let started = false
const cleanup: Array<() => void> = []

export async function startUiScale (): Promise<void> {
  if (!isTauri || started) return
  started = true
  const { settings } = useSettingsStore()
  const win = getCurrentWindow()
  const webview = getCurrentWebview()

  let width = 0
  let height = 0
  // после перезагрузки WebView помнит прежний зум, поэтому первый раз ставим всегда
  let applied = Number.NaN

  async function measure (): Promise<boolean> {
    const [factor, size, fullscreen, minimized] = await Promise.all([
      win.scaleFactor(), win.innerSize(), win.isFullscreen(), win.isMinimized()
    ])
    // свёрнутое окно в Windows сообщает размер вроде 144x19
    if (minimized) return false
    // в полноэкранном не пересчитываем, иначе на входе и выходе всё прыгает (140% и 145%)
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
    }
  }

  await update()

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

// при HMR снимаем старые подписки, иначе два экземпляра спорят за зум
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const stop of cleanup.splice(0)) stop()
  })
}
