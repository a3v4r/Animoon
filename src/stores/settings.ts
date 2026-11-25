import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { readJson, writeJson } from '@/utils/storage'

const KEY = 'settings'

/** Масштаб интерфейса: «auto» — по размеру окна, иначе множитель (1 = 100%). */
export type UiScale = 'auto' | 1 | 1.25 | 1.5 | 1.75

export interface Settings {
  /** Включать следующую серию, когда закончилась текущая. */
  autoNext: boolean
  /** Пропускать опенинг без нажатия кнопки. */
  autoSkipOpening: boolean
  /** Продолжать серию с места, где остановился. */
  resume: boolean
  /** Системные уведомления о новых сериях релизов из избранного. */
  notifications: boolean
  /** Масштаб интерфейса. */
  uiScale: UiScale
}

const defaults: Settings = {
  autoNext: true,
  autoSkipOpening: false,
  resume: true,
  notifications: true,
  uiScale: 'auto'
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = reactive<Settings>({ ...defaults, ...readJson<Partial<Settings>>(KEY, {}) })
  watch(settings, value => writeJson(KEY, value), { deep: true })
  return { settings }
})
