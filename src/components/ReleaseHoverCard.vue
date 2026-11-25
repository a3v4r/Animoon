<template>
  <!-- Только для мыши: фокус не забирает, клавиатура ходит по карточкам -->
  <v-menu
    :model-value="modelValue"
    :target="target"
    location="center"
    :capture-focus="false"
    :close-on-content-click="false"
    scroll-strategy="close"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="release" class="hover-card" @mouseenter="emit('enter')" @mouseleave="emit('leave')">
      <!-- Ссылка дублирует название, поэтому скрыта от диктора -->
      <router-link class="frame" :to="releaseRoute" tabindex="-1" aria-hidden="true">
        <img :src="poster" alt="">
        <div class="badges">
          <span v-if="isToday" class="badge badge--sm badge--warm">Сегодня</span>
          <span v-if="release.is_ongoing" class="badge badge--sm badge--glass">Онгоинг</span>
        </div>
      </router-link>

      <div class="body">
        <router-link class="title clamp-2" :to="releaseRoute">{{ release.name.main }}</router-link>
        <div v-if="meta" class="meta ell">{{ meta }}</div>
        <div v-if="genres" class="genres ell">{{ genres }}</div>
        <div v-if="released" class="released">
          <span>{{ released.text }}</span>
          <div v-if="released.ratio != null" class="thin-progress bar"><i :style="{ width: `${released.ratio * 100}%` }" /></div>
        </div>

        <div class="actions">
          <router-link class="act act--primary" :to="watchTarget" :title="watchTitle">
            <v-icon icon="mdi-play" size="18" />
            Смотреть
          </router-link>
          <button
            v-if="account.isAuthorized"
            class="ui-btn act act--icon"
            :class="{ 'act--on': isFavorite }"
            :aria-label="isFavorite ? 'Убрать из избранного' : 'В избранное'"
            :aria-pressed="isFavorite"
            :disabled="favoriteLoading"
            :title="isFavorite ? 'Убрать из избранного' : 'В избранное'"
            @click="toggleFavorite"
          >
            <v-icon :icon="isFavorite ? 'mdi-heart' : 'mdi-heart-outline'" size="18" />
          </button>
          <router-link class="act act--icon" :to="releaseRoute" title="Подробнее" aria-label="Подробнее">
            <v-icon icon="mdi-information-outline" size="18" />
          </router-link>
        </div>
      </div>
    </div>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { mediaUrl } from '@/api/http'
import type { Release } from '@/api/types'
import { useAccountStore } from '@/stores/account'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { useProgressStore } from '@/stores/progress'
import { useReleasesStore } from '@/stores/releases'
import { useScheduleStore } from '@/stores/schedule'
import { nextEpisodeToWatch } from '@/utils/episodes'

const props = defineProps<{
  modelValue: boolean
  release: Release | null
  target?: HTMLElement
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  enter: []
  leave: []
}>()

const account = useAccountStore()
const index = useEpisodeIndexStore()
const progress = useProgressStore()
const releases = useReleasesStore()

const favoriteLoading = ref(false)

const releaseRoute = computed<RouteLocationRaw>(() => ({ name: 'release', params: { id: props.release?.id ?? 0 } }))

const poster = computed(() => {
  const image = props.release?.poster
  return image ? mediaUrl(image.optimized?.preview ?? image.preview) : ''
})

const schedule = useScheduleStore()
const isToday = computed(() => !!props.release?.is_ongoing && props.release.publish_day?.value === schedule.today)

const meta = computed(() => {
  const r = props.release
  if (!r) return ''
  return [
    r.type?.description,
    [r.season?.description, r.year].filter(Boolean).join(' '),
    r.average_duration_of_episode ? `${r.average_duration_of_episode} мин` : undefined,
    r.age_rating?.label
  ].filter(Boolean).join(' · ')
})

const genres = computed(() => props.release?.genres?.map(g => g.name).join(' · ') ?? '')

// В ответе каталога нет числа вышедших серий, берём номер последней из справочника
const released = computed(() => {
  const r = props.release
  if (!r) return null
  const count = index.releaseProgress(r).released
  const total = r.episodes_total
  if (count && total) return { text: `Вышло ${Math.min(count, total)} из ${total}`, ratio: Math.min(1, count / total) }
  if (r.latest_episode) return { text: `Вышла серия ${r.latest_episode.ordinal}`, ratio: null }
  return null
})

const nextEpisode = computed(() => {
  const full = props.release ? releases.peek(props.release.id) : null
  return full ? nextEpisodeToWatch(full.episodes, progress.get) : null
})

const watchTarget = computed<RouteLocationRaw>(() => (props.release && nextEpisode.value
  ? { name: 'watch', params: { id: props.release.id, ordinal: nextEpisode.value.ordinal } }
  : releaseRoute.value))

const watchTitle = computed(() => (nextEpisode.value ? `Смотреть серию ${nextEpisode.value.ordinal}` : 'Открыть релиз'))

watch(() => (props.modelValue ? props.release?.id : undefined), id => {
  if (id != null) releases.load(id).catch(() => {})
}, { immediate: true })

const isFavorite = computed(() => (props.release ? account.isFavorite(props.release.id) : false))

async function toggleFavorite (): Promise<void> {
  if (!props.release) return
  favoriteLoading.value = true
  try {
    await account.toggleFavorite(props.release.id)
  } finally {
    favoriteLoading.value = false
  }
}
</script>

<style scoped>
.hover-card {
  width: 264px;
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface-2);
  box-shadow: 0 0 0 1px var(--line-2), 0 24px 48px rgba(0, 0, 0, 0.7);
  color: var(--text);
}

.frame {
  position: relative;
  display: block;
  height: 148px;
}

.frame img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 18%;
}

.frame::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(0deg, var(--surface-2) 0, rgba(30, 33, 41, 0) 55%);
}

.badges {
  position: absolute;
  left: 12px;
  top: 12px;
  z-index: 1;
  display: flex;
  gap: 4px;
}

.body {
  position: relative;
  margin-top: -8px;
  padding: 0 16px 16px;
}

.title {
  font-size: 15px;
  font-weight: 700;
  line-height: 20px;
  color: inherit;
  text-decoration: none;
}

.title:hover {
  color: var(--accent);
}

.title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.meta {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-2);
}

.genres {
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-3);
}

.released {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-2);
  white-space: nowrap;
}

.released .bar {
  flex: 1;
}

.released .bar > i {
  background: var(--text-2);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.act {
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 10px;
  background: rgba(30, 33, 41, 0.72);
  box-shadow: inset 0 0 0 1px var(--glass-line);
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  transition: background-color 0.15s, filter 0.15s;
}

.act:hover {
  background: #2a2e38;
}

.act:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.act:disabled {
  cursor: default;
  opacity: 0.6;
}

.act--primary {
  flex: 1;
  background: var(--accent);
  box-shadow: none;
  color: var(--accent-ink);
}

.act--primary:hover {
  background: var(--accent);
  filter: brightness(1.08);
}

.act--icon {
  flex: none;
  width: 36px;
  padding: 0;
}

.act--on,
.act--on:hover {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(92, 225, 230, 0.45);
  color: var(--accent);
}
</style>
