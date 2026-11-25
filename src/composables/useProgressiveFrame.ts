import { ref, type Ref, watch } from 'vue'
import { mediaUrl } from '@/api/http'
import type { Episode, Release } from '@/api/types'

export interface Frame {
  low: string
  high: string
}

export function episodeFrame (episode: Episode | null | undefined): Frame | null {
  const preview = episode?.preview
  const high = mediaUrl(preview?.src ?? preview?.preview)
  const low = mediaUrl(preview?.optimized?.src ?? preview?.optimized?.preview) || high
  return high || low ? { low, high: high || low } : null
}

export function posterFrame (release: Release): Frame {
  const url = mediaUrl(release.poster.optimized?.src ?? release.poster.src)
  return { low: url, high: url }
}

function preload (url: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(true)
    image.onerror = () => resolve(false)
    image.src = url
  })
}

export function useProgressiveFrame (target: Ref<Frame | null>): Ref<string> {
  const frame = ref('')
  let request = 0
  // следим за адресами, а не за объектом: пересчёт списка с теми же кадрами не перезагружает
  watch(() => (target.value ? `${target.value.low}\n${target.value.high}` : ''), async () => {
    const next = target.value
    const current = ++request
    if (!next) return
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
