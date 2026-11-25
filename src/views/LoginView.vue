<template>
  <div class="login-page">
    <div class="login">
      <img class="mark" :src="markUrl" alt="" draggable="false">
      <h1 class="title font-display">Вход в AniLiberty</h1>
      <p class="lead">Избранное и история просмотра синхронизируются с аккаунтом на сайте.</p>

      <v-form class="form" @submit.prevent="submit">
        <v-text-field
          v-model="login"
          autocomplete="username"
          autofocus
          label="Логин или почта"
          variant="outlined"
          rounded="lg"
          color="secondary"
          hide-details="auto"
        />
        <v-text-field
          v-model="password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          label="Пароль"
          variant="outlined"
          rounded="lg"
          color="secondary"
          hide-details="auto"
        >
          <!-- своя кнопка: у append-иконки Vuetify кривая подпись и нет aria-pressed -->
          <template #append-inner>
            <button
              type="button"
              class="ui-btn pw-toggle"
              aria-label="Показать пароль"
              :aria-pressed="showPassword"
              @mousedown.prevent
              @click="showPassword = !showPassword"
            >
              <v-icon :icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'" size="20" />
            </button>
          </template>
        </v-text-field>
        <div v-if="error" class="error allow-select" role="alert">
          <v-icon icon="mdi-alert-circle-outline" size="18" />
          {{ error }}
        </div>
        <v-btn :disabled="!login.trim() || !password" :loading="loading" block color="secondary" size="large" type="submit">
          Войти
        </v-btn>
      </v-form>

      <div class="foot">
        Нет аккаунта?
        <button class="ui-btn link" type="button" @click="openExternal(`${mirror()}/auth/registration`)">
          Зарегистрироваться на сайте
          <v-icon icon="mdi-open-in-new" size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { mirror } from '@/api/http'
// ?no-inline: иначе Vite встроит SVG как data:, а CSP img-src его не пустит
import markUrl from '@/assets/brand/mark.svg?no-inline'
import { useAccountStore } from '@/stores/account'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { useProgressStore } from '@/stores/progress'
import { openExternal } from '@/utils/window'

const router = useRouter()
const account = useAccountStore()
const progress = useProgressStore()
const episodeIndex = useEpisodeIndexStore()

const login = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function submit (): Promise<void> {
  // :loading не блокирует отправку по Enter
  if (loading.value || !login.value.trim() || !password.value) return
  loading.value = true
  error.value = ''
  try {
    await account.login(login.value.trim(), password.value)
    password.value = ''
    void progress.sync().then(() => episodeIndex.resolveUnknown())
    void router.replace({ name: 'favorites' })
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: calc(100vh - var(--bar-height));
  display: grid;
  place-items: center;
  padding: 32px 16px;
  background: radial-gradient(800px 400px at 50% 0%, rgba(92, 225, 230, 0.08), transparent 70%);
}

.login {
  width: 100%;
  max-width: 400px;
  padding: 32px;
  border-radius: 20px;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--line), 0 24px 60px rgba(0, 0, 0, 0.45);
}

.mark {
  width: 64px;
  height: 64px;
}

.title {
  margin: 20px 0 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 30px;
}

.lead {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--text-3);
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.error {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 82, 82, 0.1);
  color: #ff8a80;
  font-size: 14px;
}

.foot {
  margin-top: 20px;
  font-size: 14px;
  color: var(--text-3);
}

.pw-toggle {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-right: -4px;
  border-radius: 8px;
  color: var(--text-2);
}

.pw-toggle:hover {
  color: var(--text);
}

.pw-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  font-weight: 500;
}

.link:hover {
  text-decoration: underline;
}

.link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
