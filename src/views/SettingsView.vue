<template>
  <div class="settings">
    <page-header title="Настройки" />

    <div class="body">
      <section class="group" aria-labelledby="set-account">
        <h2 id="set-account" class="group-title">Аккаунт</h2>
        <div class="panel">
          <div v-if="account.isAuthorized" class="row">
            <v-avatar size="44" color="surface-variant">
              <v-img v-if="avatar" :src="avatar" alt="" />
              <v-icon v-else icon="mdi-account" size="24" />
            </v-avatar>
            <div class="row-text">
              <div class="row-title ell">{{ account.profile?.nickname || account.profile?.login || 'Пользователь' }}</div>
              <div v-if="account.profile?.email" class="row-sub ell">{{ account.profile.email }}</div>
            </div>
            <v-btn :loading="loggingOut" variant="tonal" prepend-icon="mdi-logout" @click="logout">Выйти</v-btn>
          </div>
          <div v-else class="row">
            <div class="row-text">
              <div class="row-title">Вы не вошли</div>
              <div class="row-sub">Вход нужен для избранного и синхронизации истории просмотра.</div>
            </div>
            <v-btn color="secondary" :to="{ name: 'login' }">Войти</v-btn>
          </div>
        </div>
      </section>

      <section v-if="isTauri" class="group" aria-labelledby="set-ui">
        <h2 id="set-ui" class="group-title">Интерфейс</h2>
        <div class="panel">
          <div class="row row--wrap">
            <div id="scale-label" class="row-text">
              <div class="row-title">Масштаб</div>
              <div class="row-sub">
                «Авто» увеличивает интерфейс на большом окне.
                Сейчас {{ Math.round(effectiveScale * 100) }}%<template v-if="scaleLimited">: больше не помещается в окно</template>.
              </div>
            </div>
            <div class="segmented" role="group" aria-labelledby="scale-label">
              <button
                v-for="s in scales"
                :key="s.value"
                class="ui-btn seg"
                :class="{ 'seg--on': settings.uiScale === s.value }"
                :aria-pressed="settings.uiScale === s.value"
                @click="settings.uiScale = s.value"
              >
                {{ s.title }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="group" aria-labelledby="set-player">
        <h2 id="set-player" class="group-title">Плеер</h2>
        <div class="panel">
          <div class="row">
            <div id="quality-label" class="row-text">
              <div class="row-title">Качество по умолчанию</div>
              <div class="row-sub">Если у серии его нет, включится лучшее из доступных.</div>
            </div>
            <div class="segmented" role="group" aria-labelledby="quality-label">
              <button
                v-for="q in qualities"
                :key="q.value"
                class="ui-btn seg"
                :class="{ 'seg--on': player.quality === q.value }"
                :aria-pressed="player.quality === q.value"
                @click="player.quality = q.value"
              >
                {{ q.title }}
              </button>
            </div>
          </div>
          <div v-for="item in playerSwitches" :key="item.key" class="row">
            <label :for="`set-${item.key}`" class="row-text">
              <span class="row-title">{{ item.title }}</span>
              <span class="row-sub">{{ item.text }}</span>
            </label>
            <toggle-switch :id="`set-${item.key}`" v-model="settings[item.key]" />
          </div>
        </div>
      </section>

      <section class="group" aria-labelledby="set-notify">
        <h2 id="set-notify" class="group-title">Уведомления</h2>
        <div class="panel">
          <div class="row">
            <label for="set-notifications" class="row-text">
              <span class="row-title">Новые серии из избранного</span>
              <span class="row-sub">Проверка раз в 10 минут; если окно не активно — системное уведомление.</span>
            </label>
            <toggle-switch id="set-notifications" v-model="settings.notifications" />
          </div>
        </div>
      </section>

      <section v-if="updater.supported" class="group" aria-labelledby="set-update">
        <h2 id="set-update" class="group-title">Обновления</h2>
        <div class="panel">
          <div class="row">
            <div class="row-text">
              <div class="row-title">{{ updateTitle }}</div>
              <div class="row-sub">{{ updateText }}</div>
            </div>
            <v-btn
              v-if="updater.status === 'available' || updater.busy"
              color="secondary"
              :loading="updater.status === 'downloading' || updater.status === 'installing'"
              @click="updater.status === 'ready' ? updater.finish() : updater.install()"
            >
              {{ updater.status === 'ready' ? 'Установить' : updater.installError ? 'Повторить' : 'Обновить' }}
            </v-btn>
            <v-btn v-else variant="tonal" :loading="updater.status === 'checking'" @click="updater.checkNow()">
              Проверить
            </v-btn>
          </div>
        </div>
      </section>

      <footer class="about">
        <span class="font-display about-name">Animoon</span>
        <span v-if="version">{{ version }}</span>
        <span>·</span>
        <span>неофициальный клиент AniLiberty (бывш. AniLibria), не связан с командой проекта</span>
        <span>·</span>
        <span>данные и видео — {{ mirrorHost }}</span>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { computed, onMounted, ref } from 'vue'
import { mediaUrl, mirror } from '@/api/http'
import PageHeader from '@/components/ui/PageHeader.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'
import { useAccountStore } from '@/stores/account'
import { type Quality, usePlayerStore } from '@/stores/player'
import { useProgressStore } from '@/stores/progress'
import { effectiveScale } from '@/composables/useUiScale'
import { type UiScale, useSettingsStore } from '@/stores/settings'
import { useUpdaterStore } from '@/stores/updater'
import { isTauri } from '@/utils/window'

const account = useAccountStore()
const player = usePlayerStore()
const progress = useProgressStore()
const { settings } = useSettingsStore()

const scales: { title: string, value: UiScale }[] = [
  { title: 'Авто', value: 'auto' },
  { title: '100%', value: 1 },
  { title: '125%', value: 1.25 },
  { title: '150%', value: 1.5 },
  { title: '175%', value: 1.75 }
]
const scaleLimited = computed(() => settings.uiScale !== 'auto' && effectiveScale.value < settings.uiScale)

const updater = useUpdaterStore()
const updateTitle = computed(() => updater.status === 'available' || updater.busy
  ? `Доступна версия ${updater.version}`
  : `Установлена версия ${version.value || '—'}`)
const updateText = computed(() => {
  if (updater.installError && (updater.status === 'available' || updater.status === 'ready')) {
    return `Не удалось обновиться: ${updater.installError}.`
  }
  switch (updater.status) {
    case 'checking': return 'Проверяем…'
    case 'none': return 'Это последняя версия.'
    case 'available': return 'Скачается и установится, приложение перезапустится.'
    case 'downloading': return 'Скачивается…'
    case 'ready': return 'Скачана. Установится после выхода из плеера или по кнопке.'
    case 'installing': return 'Устанавливается, приложение сейчас перезапустится.'
    case 'error': return `Не удалось проверить: ${updater.checkError}.`
    default: return 'Проверяется само раз в 6 часов.'
  }
})

const qualities: { title: string, value: Quality }[] = [
  { title: '1080p', value: '1080' },
  { title: '720p', value: '720' },
  { title: '480p', value: '480' }
]

const playerSwitches = [
  { key: 'resume', title: 'Продолжать с места остановки', text: 'Серия откроется там, где вы закончили.' },
  { key: 'autoNext', title: 'Следующая серия автоматически', text: 'После конца серии — отсчёт 8 секунд, его можно отменить.' },
  { key: 'autoSkipOpening', title: 'Пропускать опенинг', text: 'Если у серии отмечен опенинг.' }
] as const

const version = ref('')
const loggingOut = ref(false)

const mirrorHost = computed(() => mirror().replace(/^https?:\/\//, ''))

const avatar = computed(() => {
  const image = account.profile?.avatar
  return image ? mediaUrl(image.optimized?.thumbnail ?? image.thumbnail) : ''
})

async function logout (): Promise<void> {
  loggingOut.value = true
  try {
    // сначала тайм-коды из очереди, пока токен ещё действует
    await progress.flush()
    await account.logout()
  } finally {
    loggingOut.value = false
  }
}

onMounted(async () => {
  if (isTauri) version.value = await getVersion()
})
</script>

<style scoped>
.settings {
  padding-bottom: 40px;
}

.body {
  max-width: 760px;
  padding: 0 40px;
}

.group {
  margin-top: 28px;
}

.group-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-3);
}

.panel {
  border-radius: 14px;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--line);
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 12px 20px;
}

.row--wrap {
  flex-wrap: wrap;
}

.row + .row {
  border-top: 1px solid var(--line);
}

.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

label.row-text {
  cursor: pointer;
}

.row-title {
  font-size: 15px;
  font-weight: 500;
}

.row-sub {
  font-size: 13px;
  color: var(--text-3);
}

.segmented {
  flex: none;
  display: flex;
  padding: 2px;
  border-radius: 10px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.seg {
  height: 32px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
}

.seg:hover {
  color: var(--text);
}

.seg--on {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
}

.seg:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.about {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  margin-top: 32px;
  font-size: 13px;
  color: var(--text-3);
}

.about-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
}
</style>
