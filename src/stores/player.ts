import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export type Quality = '480' | '720' | '1080'

const QUALITY_KEY = 'player.quality'
const VOLUME_KEY = 'player.volume'
const MUTED_KEY = 'player.muted'

function readQuality (): Quality {
  const saved = localStorage.getItem(QUALITY_KEY)
  return saved === '480' || saved === '720' || saved === '1080' ? saved : '1080'
}

function readVolume (): number {
  const saved = Number(localStorage.getItem(VOLUME_KEY))
  return Number.isFinite(saved) && saved > 0 && saved <= 1 ? saved : 1
}

/**
 * Настройки плеера, которые переживают перезапуск и смену серии, и полноэкранный режим.
 * volume — последняя ненулевая громкость (к ней возвращается «Включить звук»).
 */
export const usePlayerStore = defineStore('player', () => {
  const quality = ref<Quality>(readQuality())
  const volume = ref(readVolume())
  const muted = ref(localStorage.getItem(MUTED_KEY) === '1')
  const fullscreen = ref(false)

  watch(quality, value => localStorage.setItem(QUALITY_KEY, value))
  watch(volume, value => localStorage.setItem(VOLUME_KEY, String(value)))
  watch(muted, value => localStorage.setItem(MUTED_KEY, value ? '1' : '0'))

  return { quality, volume, muted, fullscreen }
})
