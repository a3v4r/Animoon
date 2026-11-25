import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { readJson, writeJson } from '@/utils/storage'

const KEY = 'settings'

export type UiScale = 'auto' | 1 | 1.25 | 1.5 | 1.75

export interface Settings {
  autoNext: boolean
  autoSkipOpening: boolean
  resume: boolean
  notifications: boolean
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
