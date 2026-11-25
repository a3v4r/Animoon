import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as accountApi from '@/api/account'
import { ApiError, setAuthToken } from '@/api/http'
import type { Profile } from '@/api/types'
import { readJson, writeJson } from '@/utils/storage'

const TOKEN_KEY = 'account.token'

/** Сессия пользователя, профиль и избранное. */
export const useAccountStore = defineStore('account', () => {
  const token = ref<string | null>(readJson<string | null>(TOKEN_KEY, null))
  const profile = ref<Profile | null>(null)
  const favoriteIds = ref<Set<number>>(new Set())

  const isAuthorized = computed(() => token.value != null)

  setAuthToken(token.value)

  function setToken (value: string | null): void {
    token.value = value
    setAuthToken(value)
    writeJson(TOKEN_KEY, value)
  }

  /** Сессия истекла или токен отозван: забываем его без запроса к API. */
  function dropSession (): void {
    setToken(null)
    profile.value = null
    favoriteIds.value = new Set()
  }

  /** Загрузить профиль и избранное по сохранённому токену. */
  async function init (): Promise<void> {
    if (!token.value) return
    try {
      const [me, ids] = await Promise.all([accountApi.getProfile(), accountApi.getFavoriteIds()])
      profile.value = me
      favoriteIds.value = new Set(ids)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) dropSession()
    }
  }

  async function login (loginOrEmail: string, password: string): Promise<void> {
    setToken(await accountApi.login(loginOrEmail, password))
    await init()
  }

  async function logout (): Promise<void> {
    try {
      await accountApi.logout()
    } finally {
      dropSession()
    }
  }

  function isFavorite (releaseId: number): boolean {
    return favoriteIds.value.has(releaseId)
  }

  async function toggleFavorite (releaseId: number): Promise<void> {
    const ids = isFavorite(releaseId)
      ? await accountApi.removeFavorite(releaseId)
      : await accountApi.addFavorite(releaseId)
    favoriteIds.value = new Set(ids)
  }

  return { token, profile, favoriteIds, isAuthorized, init, login, logout, dropSession, isFavorite, toggleFavorite }
})
