<template>
  <section class="hero">
    <!-- Кадр серии справа, растворяется к тексту и вниз. -->
    <div class="art">
      <div class="art-fade">
        <transition name="fade">
          <div v-if="frame" :key="frame" class="art-img" :style="{ backgroundImage: `url('${frame}')` }" />
        </transition>
      </div>
    </div>
    <div class="scrim" />

    <div v-if="item" class="body">
      <div class="badges">
        <span v-if="item.mode === 'continue'" class="badge badge--accent">
          <v-icon icon="mdi-play-circle-outline" /> Ваша следующая серия
        </span>
        <span v-else class="badge badge--accent"><v-icon icon="mdi-new-box" /> Новая серия {{ item.release.latest_episode?.ordinal }}</span>
        <span v-if="item.airsToday" class="badge badge--warm"><v-icon icon="mdi-clock-outline" /> {{ item.airsToday }}</span>
      </div>

      <router-link class="title-link" :to="releaseRoute">
        <h1 class="title font-display clamp-2">{{ item.release.name.main }}</h1>
      </router-link>

      <div v-if="episodeLine" class="episode ell">
        <b>Серия {{ episodeLine.ordinal }}</b><template v-if="episodeLine.name"> · {{ episodeLine.name }}</template>
      </div>

      <div v-if="progressInfo" class="progress-row">
        <span>Просмотрено <b>{{ progressInfo.watched }} из {{ progressInfo.released }}</b></span>
        <div class="thin-progress bar"><i :style="{ width: `${progressInfo.ratio * 100}%` }" /></div>
        <span v-if="resume" class="dim">серия {{ episodeLine?.ordinal }}: {{ formatDuration(resume.time) }} из {{ formatDuration(resume.duration) }}</span>
      </div>
      <p v-else-if="item.release.description" class="description clamp-2">{{ item.release.description }}</p>

      <div class="actions">
        <v-btn class="action" color="secondary" height="44" prepend-icon="mdi-play" :loading="waitingFull" :to="watchTarget">
          {{ playLabel }}
        </v-btn>
        <v-btn
          v-if="item.mode === 'continue' && nextEpisode"
          class="action action--glass action--collapsible"
          height="44"
          prepend-icon="mdi-check"
          title="Отметить серию просмотренной"
          variant="flat"
          @click="markWatched"
        >
          Отметить просмотренной
        </v-btn>
        <v-btn v-else class="action action--glass" height="44" variant="flat" :to="releaseRoute">
          О релизе
        </v-btn>
        <v-btn
          v-if="account.isAuthorized"
          :class="['action', 'action--icon', isFavorite ? 'action--on' : 'action--glass']"
          :icon="isFavorite ? 'mdi-heart' : 'mdi-heart-outline'"
          :loading="favoriteLoading"
          :title="isFavorite ? 'Убрать из избранного' : 'В избранное'"
          height="44"
          variant="flat"
          width="44"
          @click="toggleFavorite"
        />
      </div>
    </div>

    <!-- Переключатель подборки: видимая точка маленькая, зона нажатия — вся кнопка. -->
    <div v-if="items.length > 1" class="dots" role="tablist" aria-label="Подборка">
      <button
        v-for="(entry, i) in items"
        :key="entry.release.id"
        class="ui-btn dot"
        :class="{ 'dot--active': i === modelValue }"
        role="tab"
        :aria-selected="i === modelValue"
        :aria-label="entry.release.name.main"
        :title="entry.release.name.main"
        @click="emit('update:modelValue', i)"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { Episode, Release, ReleaseFull } from '@/api/types'
import { episodeFrame, type Frame, posterFrame, useProgressiveFrame } from '@/composables/useProgressiveFrame'
import { useAccountStore } from '@/stores/account'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { useProgressStore } from '@/stores/progress'
import { useReleasesStore } from '@/stores/releases'
import { nextEpisodeToWatch } from '@/utils/episodes'
import { formatDuration } from '@/utils/time'

export interface HeroItem {
  release: Release
  /** continue — пользователь смотрит релиз и есть непросмотренные серии; fresh — просто новая серия. */
  mode: 'continue' | 'fresh'
  /** «Серия 10 выйдет сегодня», если по расписанию сегодня. */
  airsToday: string | null
}

const props = defineProps<{ items: HeroItem[], modelValue: number }>()
const emit = defineEmits<{ 'update:modelValue': [index: number] }>()

const account = useAccountStore()
const index = useEpisodeIndexStore()
const progress = useProgressStore()
const releases = useReleasesStore()

const item = computed<HeroItem | undefined>(() => props.items[props.modelValue])
// Полная карточка релиза: нужна, чтобы найти следующую непросмотренную серию и её кадр.
const full = ref<ReleaseFull | null>(null)
const fullFailed = ref(false)
const favoriteLoading = ref(false)

const releaseRoute = computed<RouteLocationRaw>(() => ({ name: 'release', params: { id: item.value?.release.id ?? 0 } }))

// Следим только за релизом и режимом: пересчёт списка (новые объекты HeroItem) не должен
// сбрасывать уже загруженную карточку.
watch(
  () => [item.value?.release.id, item.value?.mode] as const,
  async ([id, mode]) => {
    if (id == null || mode !== 'continue') return
    if (full.value?.id !== id) {
      full.value = releases.peek(id)
      fullFailed.value = false
    }
    if (full.value) return
    try {
      const loaded = await releases.load(id)
      if (item.value?.release.id === id) full.value = loaded
    } catch {
      if (item.value?.release.id === id) fullFailed.value = true
    }
  },
  { immediate: true }
)

const isContinue = computed(() => item.value?.mode === 'continue')
// Карточка ещё грузится — кнопку «Смотреть» показываем с индикатором, а не прячем.
const waitingFull = computed(() => isContinue.value && !full.value && !fullFailed.value)

/** Следующая непросмотренная серия: её и предлагаем, и её кадр показываем (без спойлеров). */
const nextEpisode = computed<Episode | null>(() => {
  if (!isContinue.value || !full.value || full.value.id !== item.value?.release.id) return null
  return nextEpisodeToWatch(full.value.episodes, progress.get)
})

/**
 * Какой кадр нужен. В режиме continue кадр последней серии не показываем никогда (спойлер):
 * только кадр следующей непросмотренной, а пока её не знаем или карточка не загрузилась — постер.
 */
const targetFrame = computed<Frame | null>(() => {
  const current = item.value
  if (!current) return null
  if (current.mode === 'continue') return episodeFrame(nextEpisode.value) ?? posterFrame(current.release)
  return episodeFrame(current.release.latest_episode) ?? posterFrame(current.release)
})

const frame = useProgressiveFrame(targetFrame)

const episodeLine = computed(() => {
  const current = item.value
  if (!current) return null
  const episode = current.mode === 'continue' ? nextEpisode.value : current.release.latest_episode
  return episode ? { ordinal: episode.ordinal, name: episode.name } : null
})

const progressInfo = computed(() => {
  const current = item.value
  if (!current || current.mode !== 'continue') return null
  const p = index.releaseProgress(current.release)
  if (!p.released || p.watched === 0) return null
  return { watched: p.watched, released: p.released, ratio: Math.min(1, p.watched / p.released) }
})

/** Место остановки в следующей серии, если её начали. */
const resume = computed(() => {
  const episode = nextEpisode.value
  if (!episode?.duration) return null
  const saved = progress.get(episode.id)
  return saved && !saved.watched && saved.time > 10 ? { time: saved.time, duration: episode.duration } : null
})

// Куда ведёт «Смотреть»: на серию, а если её не узнать (нет сети) — на страницу релиза.
const watchTarget = computed<RouteLocationRaw>(() => {
  const current = item.value
  if (!current) return releaseRoute.value
  const ordinal = current.mode === 'continue' ? nextEpisode.value?.ordinal : current.release.latest_episode?.ordinal
  return ordinal != null ? { name: 'watch', params: { id: current.release.id, ordinal } } : releaseRoute.value
})

const playLabel = computed(() => {
  if (resume.value) return `Продолжить с ${formatDuration(resume.value.time)}`
  return episodeLine.value ? `Смотреть серию ${episodeLine.value.ordinal}` : 'Смотреть'
})

const isFavorite = computed(() => (item.value ? account.isFavorite(item.value.release.id) : false))

function markWatched (): void {
  if (nextEpisode.value) progress.setWatched(nextEpisode.value.id, true)
}

async function toggleFavorite (): Promise<void> {
  if (!item.value) return
  favoriteLoading.value = true
  try {
    await account.toggleFavorite(item.value.release.id)
  } finally {
    favoriteLoading.value = false
  }
}
</script>

<style scoped>
/* Афиша растёт под длинное название, текст прижат к низу; сверху место под панель окна. */
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: clamp(360px, 52vh, 600px);
  padding: calc(var(--bar-height) + 24px) 40px 56px;
  isolation: isolate;
}

/* Тёплое свечение зала за кадром. */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background:
    radial-gradient(760px 520px at 78% 8%, rgba(196, 96, 48, 0.26), transparent 70%),
    radial-gradient(560px 420px at 10% 0%, rgba(150, 60, 70, 0.16), transparent 70%);
}

.art {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 72%;
  z-index: -1;
  overflow: hidden;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, rgba(0, 0, 0, 0.4) 24%, #000 52%);
  mask-image: linear-gradient(90deg, transparent 0, rgba(0, 0, 0, 0.4) 24%, #000 52%);
}

.art-fade {
  position: absolute;
  inset: 0;
  -webkit-mask-image: linear-gradient(0deg, transparent 0, rgba(0, 0, 0, 0.5) 18%, #000 46%);
  mask-image: linear-gradient(0deg, transparent 0, rgba(0, 0, 0, 0.5) 18%, #000 46%);
}

.art-img {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transform-origin: 60% 40%;
}

/* Медленный наезд камеры: один проход на кадр (элемент пересоздаётся при смене кадра), потом покой. */
@media (prefers-reduced-motion: no-preference) {
  .art-img {
    animation: ken-burns 24s ease-out 1 forwards;
  }

  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.6s ease;
  }
}

@keyframes ken-burns {
  from { transform: scale(1.02); }
  to { transform: scale(1.09) translate(-1.5%, -1%); }
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Затемнение под текстом слева, чтобы текст читался на светлых кадрах. */
.scrim {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(11, 12, 16, 0.92) 0, rgba(11, 12, 16, 0.7) 38%, rgba(11, 12, 16, 0) 70%);
  -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent);
  mask-image: linear-gradient(180deg, #000 70%, transparent);
}

.body {
  /* На узком окне текст не выходит за затемнение. */
  width: min(560px, 46%);
  min-width: 360px;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.title-link {
  color: inherit;
  text-decoration: none;
}

.title-link:hover .title {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 6px;
}

.title {
  margin: 16px 0 8px;
  font-size: clamp(30px, 3vw, 40px);
  font-weight: 700;
  line-height: 1.22;
  letter-spacing: -0.025em;
}

.episode {
  font-size: 16px;
  line-height: 24px;
  color: var(--text-2);
}

.episode b {
  color: var(--text);
  font-weight: 600;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
}

.progress-row b {
  color: var(--text);
  font-weight: 600;
}

.progress-row .bar {
  width: 160px;
  flex: none;
}

.dim {
  color: var(--text-3);
  overflow: hidden;
  text-overflow: ellipsis;
}

.description {
  margin-top: 12px;
  font-size: 15px;
  line-height: 22px;
  color: var(--text-2);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  text-shadow: none;
}

.action {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  border-radius: 12px !important;
}

.action--glass {
  background: rgba(30, 33, 41, 0.72) !important;
  box-shadow: inset 0 0 0 1px var(--glass-line);
  color: var(--text) !important;
}

.action--on {
  background: var(--accent-soft) !important;
  box-shadow: inset 0 0 0 1px rgba(92, 225, 230, 0.45);
  color: var(--accent) !important;
}

.action--icon {
  min-width: 0 !important;
  padding: 0 !important;
}

/* Узкое окно: у длинной кнопки остаётся только иконка (подпись — во всплывающей подсказке). */
@media (max-width: 1100px) {
  .action--collapsible {
    width: 44px;
    min-width: 0 !important;
    padding: 0 !important;
  }

  .action--collapsible :deep(.v-btn__content) {
    display: none;
  }

  .action--collapsible :deep(.v-btn__prepend) {
    margin: 0;
  }
}

.dots {
  position: absolute;
  right: 34px;
  bottom: 52px;
  display: flex;
}

.dot {
  position: relative;
  width: 20px;
  height: 24px;
  transition: width 0.2s;
}

.dot::before {
  content: '';
  position: absolute;
  left: 6px;
  top: 8px;
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.35);
  transition: width 0.2s, background-color 0.2s;
}

.dot:hover::before {
  background: rgba(255, 255, 255, 0.6);
}

.dot--active {
  width: 36px;
}

.dot--active::before,
.dot--active:hover::before {
  width: 24px;
  background: var(--accent);
}

.dot:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 6px;
}
</style>
