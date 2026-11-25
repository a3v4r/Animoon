import { ref, type Ref, watch } from 'vue'
import { mediaUrl } from '@/api/http'
import type { Episode, Release } from '@/api/types'

/** Кадр для фона: лёгкий (720×405, приходит быстро) и оригинал (1920×1080, для больших окон). */
export interface Frame {
  low: string
  high: string
}

/** Кадр серии; null, если у серии нет превью. */
export function episodeFrame (episode: Episode | null | undefined): Frame | null {
  const preview = episode?.preview
  const high = mediaUrl(preview?.src ?? preview?.preview)
  const low = mediaUrl(preview?.optimized?.src ?? preview?.optimized?.preview) || high
  return high || low ? { low, high: high || low } : null
}

/** Постер релиза как запасной фон (анонс без серий, серия без кадра). */
export function posterFrame (release: Release): Frame {
  const url = mediaUrl(release.poster.optimized?.src ?? release.poster.src)
  return { low: url, high: url }
}

/** Загрузить картинку заранее; true — загрузилась. */
function preload (url: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = url
  })
}

/**
 * Показываемый кадр меняется, только когда картинка загрузилась (без пустой вспышки):
 * сначала лёгкий кадр, затем оригинал. Следим за адресами, а не за объектом: пересчёт списка
 * с теми же кадрами ничего не перезагружает. Устаревшие загрузки отбрасываются; если картинка
 * не загрузилась, остаётся то, что уже показано.
 */
export function useProgressiveFrame (target: Ref<Frame | null>): Ref<string> {
  const frame = ref('')
  let request = 0
  watch(() => (target.value ? `${target.value.low}\n${target.value.high}` : ''), async () => {
    const next = target.value
    const current = ++request
    if (!next) return
    // Оригинал уже на экране — лёгкий кадр не нужен.
    if (frame.value === next.high) return
    const lowOk = await preload(next.low)
    if (current !== request) return
    if (lowOk) frame.value = next.low
    if (next.high === next.low) {
      if (!lowOk) frame.value = ''
      return
    }
    const highOk = await preload(next.high)
    if (current !== request) return
    if (highOk) frame.value = next.high
    else if (!lowOk) frame.value = ''
  }, { immediate: true })
  return frame
}
