<template>
  <div class="release-page">
    <div v-if="loading && !release" class="state">
      <v-progress-circular indeterminate size="40" />
    </div>

    <div v-else-if="error && !release" class="state">
      <v-alert type="error" variant="tonal" max-width="520">
        {{ error }}
        <template #append>
          <v-btn variant="text" @click="load">Повторить</v-btn>
        </template>
      </v-alert>
    </div>

    <template v-else-if="release">
      <!-- Шапка: кадр следующей к просмотру серии, слева описание, справа факты. -->
      <section class="hero">
        <div class="art">
          <div class="art-fade">
            <transition name="fade">
              <div v-if="frame" :key="frame" class="art-img" :style="{ backgroundImage: `url('${frame}')` }" />
            </transition>
          </div>
        </div>
        <div class="scrim" />

        <div class="body">
          <div class="eyebrow">
            <template v-for="(part, i) in eyebrow" :key="part">
              <i v-if="i > 0" class="dot" />{{ part }}
            </template>
          </div>

          <!-- Название не обрезается: длинные набираются мельче. -->
          <h1 class="title font-display allow-select" :class="{ 'title--long': release.name.main.length > 50 }">
            {{ release.name.main }}
          </h1>

          <div class="badges">
            <span class="badge badge--glass">{{ release.is_ongoing ? 'Онгоинг' : 'Завершён' }}</span>
            <span v-if="airs" class="badge" :class="airs.out ? 'badge--accent' : 'badge--warm'">
              <v-icon :icon="airs.out ? 'mdi-new-box' : 'mdi-clock-outline'" /> {{ airs.text }}
            </span>
          </div>

          <div v-if="release.genres.length" class="chips">
            <span v-for="genre in release.genres" :key="genre.id" class="chip">{{ genre.name }}</span>
          </div>

          <p
            v-if="release.description"
            ref="descriptionEl"
            class="description allow-select"
            :class="{ 'clamp-3': !descriptionOpen }"
          >
            {{ release.description }}
          </p>
          <button
            v-if="release.description && (descriptionOpen || descriptionOverflows)"
            class="ui-btn more-text"
            :aria-expanded="descriptionOpen"
            @click="descriptionOpen = !descriptionOpen"
          >
            {{ descriptionOpen ? 'Свернуть' : 'Читать полностью' }}
          </button>

          <div v-if="progressInfo" class="progress-row">
            <span>Просмотрено <b>{{ progressInfo.watched }} из {{ progressInfo.released }}</b></span>
            <div class="thin-progress bar"><i :style="{ width: `${progressInfo.ratio * 100}%` }" /></div>
            <span v-if="nextLine" class="dim">{{ nextLine }}</span>
          </div>

          <div class="actions">
            <v-btn
              v-if="playEpisode"
              class="action"
              color="secondary"
              height="44"
              :prepend-icon="allWatched ? 'mdi-replay' : 'mdi-play'"
              :to="{ name: 'watch', params: { id: release.id, ordinal: playEpisode.ordinal } }"
            >
              {{ playLabel }}
            </v-btn>
            <v-btn
              v-if="account.isAuthorized"
              :class="['action', isFavorite ? 'action--on' : 'action--glass']"
              :loading="favoriteLoading"
              :prepend-icon="isFavorite ? 'mdi-heart' : 'mdi-heart-outline'"
              height="44"
              variant="flat"
              @click="toggleFavorite"
            >
              {{ isFavorite ? 'В избранном' : 'В избранное' }}
            </v-btn>
          </div>

          <v-alert
            v-if="release.is_blocked_by_copyrights || release.is_blocked_by_geo"
            class="mt-4"
            density="compact"
            type="warning"
            variant="tonal"
          >
            Релиз заблокирован {{ release.is_blocked_by_copyrights ? 'правообладателем' : 'в вашем регионе' }}.
          </v-alert>
        </div>

        <dl v-if="facts.length" class="facts">
          <div v-for="fact in facts" :key="fact.label" class="fact">
            <dt>{{ fact.label }}</dt>
            <dd class="allow-select">{{ fact.value }}</dd>
          </div>
        </dl>
      </section>

      <!-- Серии. -->
      <section class="episodes">
        <header class="episodes-head">
          <h2 class="font-display">Серии</h2>
          <span class="sub">{{ episodesCount }}</span>
          <span class="spacer" />
          <label v-if="watchedCount > 0" class="switch">
            <input v-model="prefs.hideWatched" type="checkbox">
            <span class="track" />
            Скрыть просмотренные
          </label>
          <button class="ui-btn tool" :title="prefs.order === 'asc' ? 'Сначала первые' : 'Сначала новые'" @click="toggleOrder">
            <v-icon :icon="prefs.order === 'asc' ? 'mdi-sort-numeric-ascending' : 'mdi-sort-numeric-descending'" size="18" />
            {{ prefs.order === 'asc' ? 'По порядку' : 'Сначала новые' }}
          </button>
          <div class="segmented" role="group" aria-label="Вид списка серий">
            <button
              class="ui-btn seg"
              :class="{ 'seg--on': prefs.view === 'grid' }"
              :aria-pressed="prefs.view === 'grid'"
              aria-label="Кадры"
              title="Кадры"
              @click="prefs.view = 'grid'"
            >
              <v-icon icon="mdi-view-grid-outline" size="18" />
            </button>
            <button
              class="ui-btn seg"
              :class="{ 'seg--on': prefs.view === 'list' }"
              :aria-pressed="prefs.view === 'list'"
              aria-label="Список"
              title="Список"
              @click="prefs.view = 'list'"
            >
              <v-icon icon="mdi-view-list-outline" size="18" />
            </button>
          </div>
        </header>

        <div v-if="episodes.length === 0" class="empty">Серий пока нет.</div>
        <div v-else-if="visibleEpisodes.length === 0" class="empty">
          Все серии просмотрены.
          <button class="ui-btn more-text" @click="prefs.hideWatched = false">Показать все</button>
        </div>

        <div v-else-if="prefs.view === 'grid'" class="grid">
          <episode-card
            v-for="episode in visibleEpisodes"
            :key="episode.id"
            :episode="episode"
            :progress="progress.get(episode.id)"
            :state="states.get(episode.id) ?? 'other'"
            @toggle-watched="toggleWatched(episode)"
          />
        </div>

        <div v-else class="list">
          <!-- Строка: ссылка на серию и рядом, а не внутри неё, кнопка отметки. -->
          <div
            v-for="episode in visibleEpisodes"
            :key="episode.id"
            class="row"
            :class="{ 'row--seen': states.get(episode.id) === 'seen', 'row--current': states.get(episode.id) === 'current' }"
          >
            <router-link class="row-link" :to="{ name: 'watch', params: { id: release.id, ordinal: episode.ordinal } }">
              <v-icon class="row-icon" :icon="rowIcon(episode)" size="22" />
              <span class="row-number">Серия {{ episode.ordinal }}</span>
              <span v-if="states.get(episode.id) !== 'other'" class="d-sr-only">
                , {{ states.get(episode.id) === 'seen' ? 'просмотрена' : 'следующая' }}
              </span>
              <span class="row-name ell">{{ episode.name || '—' }}</span>
              <span class="row-time">{{ rowTime(episode) }}</span>
            </router-link>
            <button
              class="ui-btn row-toggle"
              :class="{ 'row-toggle--on': states.get(episode.id) === 'seen' }"
              :aria-label="`Серия ${episode.ordinal} просмотрена`"
              :aria-pressed="states.get(episode.id) === 'seen'"
              :title="states.get(episode.id) === 'seen' ? 'Снять отметку «просмотрено»' : 'Отметить просмотренной'"
              @click="toggleWatched(episode)"
            >
              <v-icon :icon="states.get(episode.id) === 'seen' ? 'mdi-check-circle' : 'mdi-check-circle-outline'" size="18" />
            </button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Episode, ReleaseFull } from '@/api/types'
import EpisodeCard from '@/components/release/EpisodeCard.vue'
import { episodeFrame, posterFrame, useProgressiveFrame } from '@/composables/useProgressiveFrame'
import { useAccountStore } from '@/stores/account'
import { useProgressStore } from '@/stores/progress'
import { useReleasesStore } from '@/stores/releases'
import { useScheduleStore } from '@/stores/schedule'
import { hasMeaningfulProgress, nextEpisodeToWatch, sortEpisodes } from '@/utils/episodes'
import { pluralize } from '@/utils/plural'
import { readJson, writeJson } from '@/utils/storage'
import { formatDuration } from '@/utils/time'

const props = defineProps<{ id: string }>()

const PREFS_KEY = 'release.episodesView'

const releases = useReleasesStore()
const account = useAccountStore()
const progress = useProgressStore()
const schedule = useScheduleStore()

const release = ref<ReleaseFull | null>(releases.peek(props.id))
const loading = ref(false)
const error = ref('')
const favoriteLoading = ref(false)
const descriptionOpen = ref(false)

// Вид списка серий запоминается для всех релизов.
const prefs = reactive({
  hideWatched: false,
  order: 'asc' as 'asc' | 'desc',
  view: 'grid' as 'grid' | 'list',
  ...readJson<Partial<{ hideWatched: boolean, order: 'asc' | 'desc', view: 'grid' | 'list' }>>(PREFS_KEY, {})
})
watch(prefs, value => writeJson(PREFS_KEY, value), { deep: true })

const episodes = computed(() => sortEpisodes(release.value?.episodes ?? []))
const watchedCount = computed(() => episodes.value.filter(e => progress.get(e.id)?.watched).length)
const allWatched = computed(() => episodes.value.length > 0 && watchedCount.value >= episodes.value.length)
const isFavorite = computed(() => release.value != null && account.isFavorite(release.value.id))

/** Серия, которую смотреть дальше: первая непросмотренная по порядку (то же правило, что на главной). */
const continueEpisode = computed(() => nextEpisodeToWatch(episodes.value, progress.get))

/** Релиз начат: есть просмотренная или начатая серия (снятая отметка или открытая на секунду не в счёт). */
const started = computed(() => episodes.value.some(e => hasMeaningfulProgress(progress.get(e.id))))

/** Что включает главная кнопка: следующую серию, а если всё просмотрено — первую (пересмотреть). */
const playEpisode = computed<Episode | null>(() => (allWatched.value ? episodes.value[0] ?? null : continueEpisode.value))

/** Позиция, с которой продолжить серию. */
const resume = computed(() => {
  const episode = continueEpisode.value
  const saved = episode ? progress.get(episode.id) : undefined
  return saved && !saved.watched && saved.time > 10 ? saved.time : null
})

const playLabel = computed(() => {
  const episode = playEpisode.value
  if (!episode) return 'Смотреть'
  if (allWatched.value) return 'Пересмотреть'
  if (resume.value) return `Продолжить · Серия ${episode.ordinal}`
  if (!started.value) return episodes.value.length === 1 ? 'Смотреть' : `Смотреть с ${episode.ordinal} серии`
  return `Смотреть · Серия ${episode.ordinal}`
})

const nextLine = computed(() => {
  const episode = continueEpisode.value
  if (!episode) return ''
  return resume.value ? `дальше серия ${episode.ordinal} с ${formatDuration(resume.value)}` : `дальше серия ${episode.ordinal}`
})

const progressInfo = computed(() => {
  const released = episodes.value.length
  if (!started.value || released === 0) return null
  return { watched: watchedCount.value, released, ratio: Math.min(1, watchedCount.value / released) }
})

/** Состояние каждой серии одним проходом (а не вызовом функции на каждую привязку в шаблоне). */
const states = computed(() => {
  const map = new Map<string, 'seen' | 'current' | 'other'>()
  const currentId = started.value ? continueEpisode.value?.id : undefined
  for (const e of episodes.value) {
    map.set(e.id, progress.get(e.id)?.watched ? 'seen' : e.id === currentId ? 'current' : 'other')
  }
  return map
})

// Фон — кадр серии, которую смотреть дальше (без спойлеров): если всё просмотрено — первой;
// у анонса без серий — постер.
const frame = useProgressiveFrame(computed(() => {
  if (!release.value) return null
  return episodeFrame(continueEpisode.value ?? episodes.value[0]) ?? posterFrame(release.value)
}))

const eyebrow = computed(() => {
  const r = release.value
  if (!r) return []
  return [
    r.type?.description,
    [r.season?.description, r.year].filter(Boolean).join(' '),
    r.age_rating?.label,
    r.average_duration_of_episode ? `серия ≈ ${r.average_duration_of_episode} мин` : undefined
  ].filter((part): part is string => Boolean(part))
})

// «Серия 9 вышла сегодня» / «Серия 10 — сегодня» — по расписанию, как на главной.
// Если расписание не загрузилось, плашки нет: лучше промолчать, чем гадать.
const airs = computed(() => {
  const r = release.value
  if (!r) return null
  const today = schedule.airsToday(r.id)
  if (!today) return null
  if (today.out) return { out: true, text: today.ordinal != null ? `Серия ${today.ordinal} вышла сегодня` : 'Серия вышла сегодня' }
  return { out: false, text: today.ordinal != null ? `Серия ${today.ordinal} — сегодня` : 'Новая серия сегодня' }
})

const numberFormat = new Intl.NumberFormat('ru-RU')

const facts = computed(() => {
  const r = release.value
  if (!r) return []
  const voices = r.members.filter(m => m.role.value === 'voicing').map(m => m.nickname)
  const list = [
    { label: 'Озвучка', value: voices.join(', ') },
    { label: 'Выход', value: r.is_ongoing && r.publish_day ? `каждый ${r.publish_day.description.toLowerCase()}` : undefined },
    { label: 'Оригинал', value: r.name.english ?? undefined },
    {
      label: 'В избранном',
      value: r.added_in_users_favorites
        ? `у ${numberFormat.format(r.added_in_users_favorites)} ${pluralize(r.added_in_users_favorites, ['зрителя', 'зрителей', 'зрителей'])}`
        : undefined
    }
  ]
  return list.filter((f): f is { label: string, value: string } => Boolean(f.value))
})

const episodesCount = computed(() => {
  const r = release.value
  if (!r) return ''
  return r.episodes_total ? `${episodes.value.length} из ${r.episodes_total}` : `${episodes.value.length}`
})

// Отмеченные при включённом «Скрыть просмотренные» не исчезают из-под курсора,
// пока фильтр не переключат заново.
const keptVisible = reactive(new Set<string>())
watch(() => prefs.hideWatched, () => keptVisible.clear())

const visibleEpisodes = computed(() => {
  const list = prefs.hideWatched
    ? episodes.value.filter(e => !progress.get(e.id)?.watched || keptVisible.has(e.id))
    : episodes.value
  return prefs.order === 'asc' ? list : [...list].reverse()
})

// «Читать полностью» — только если описание действительно обрезано.
const descriptionEl = ref<HTMLElement | null>(null)
const descriptionOverflows = ref(false)
function measureDescription (): void {
  const el = descriptionEl.value
  if (el && !descriptionOpen.value) descriptionOverflows.value = el.scrollHeight > el.clientHeight + 1
}
const descriptionObserver = new ResizeObserver(measureDescription)
watch(descriptionEl, (el, old) => {
  if (old) descriptionObserver.unobserve(old)
  if (el) {
    descriptionObserver.observe(el)
    void nextTick(measureDescription)
  }
})
onBeforeUnmount(() => descriptionObserver.disconnect())

function rowIcon (episode: Episode): string {
  const state = states.value.get(episode.id)
  if (state === 'seen') return 'mdi-check-circle'
  if (state === 'current') return 'mdi-play-circle'
  return 'mdi-play-circle-outline'
}

function rowTime (episode: Episode): string {
  const p = progress.get(episode.id)
  if (p && !p.watched && p.time > 10 && episode.duration) return `${formatDuration(p.time)} / ${formatDuration(episode.duration)}`
  return episode.duration ? formatDuration(episode.duration) : ''
}

function toggleWatched (episode: Episode): void {
  const watched = !progress.get(episode.id)?.watched
  if (watched && prefs.hideWatched) keptVisible.add(episode.id)
  progress.setWatched(episode.id, watched)
}

function toggleOrder (): void {
  prefs.order = prefs.order === 'asc' ? 'desc' : 'asc'
}

async function toggleFavorite (): Promise<void> {
  if (!release.value) return
  favoriteLoading.value = true
  try {
    await account.toggleFavorite(release.value.id)
  } finally {
    favoriteLoading.value = false
  }
}

async function load (): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    release.value = await releases.load(props.id)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (!release.value) {
    void load()
  } else {
    // Карточка из кэша показана сразу; тихо перечитать её — у онгоинга могли выйти серии.
    releases.load(props.id, true).then(r => { release.value = r }).catch(() => undefined)
  }
  void schedule.load().catch(() => undefined)
  // Подтянуть просмотры с сайта, чтобы отметки серий были свежими.
  void progress.sync(false)
})
</script>

<style scoped>
.release-page {
  min-height: 100%;
  padding-bottom: 40px;
}

.state {
  display: flex;
  justify-content: center;
  padding: calc(var(--bar-height) + 48px) 24px 48px;
}

/* ---------- шапка ---------- */
.hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 40px;
  min-height: clamp(440px, 64vh, 640px);
  padding: calc(var(--bar-height) + 32px) 40px 40px;
  isolation: isolate;
}

/* Холодное свечение за кадром (на главной — тёплое). */
.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background:
    radial-gradient(820px 560px at 80% 0%, rgba(52, 120, 210, 0.3), transparent 70%),
    radial-gradient(520px 380px at 0% 10%, rgba(60, 80, 150, 0.16), transparent 70%);
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
}

@media (prefers-reduced-motion: no-preference) {
  .fade-enter-active,
  .fade-leave-active {
    transition: opacity 0.6s ease;
  }
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scrim {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(90deg, rgba(11, 12, 16, 0.94) 0, rgba(11, 12, 16, 0.8) 42%, rgba(11, 12, 16, 0) 76%);
  -webkit-mask-image: linear-gradient(180deg, #000 70%, transparent);
  mask-image: linear-gradient(180deg, #000 70%, transparent);
}

/* Узкое окно: текст занимает больше ширины, затемнение тянется дальше вправо. */
@media (max-width: 1180px) {
  .scrim {
    background: linear-gradient(90deg, rgba(11, 12, 16, 0.94) 0, rgba(11, 12, 16, 0.84) 58%, rgba(11, 12, 16, 0.2) 92%);
  }
}

.body {
  flex: 1 1 auto;
  max-width: 600px;
  min-width: 0;
  text-shadow: 0 1px 12px rgba(0, 0, 0, 0.35);
}

.eyebrow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 8px;
  font-size: 13px;
  line-height: 20px;
  color: var(--text-2);
}

.dot {
  display: inline-block;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--text-3);
}

.title {
  margin: 8px 0 0;
  font-size: clamp(28px, 2.8vw, 40px);
  font-weight: 700;
  line-height: 1.22;
  letter-spacing: -0.025em;
}

.title--long {
  font-size: clamp(22px, 2vw, 28px);
  line-height: 1.25;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(30, 33, 41, 0.72);
  box-shadow: inset 0 0 0 1px var(--line-2);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  text-shadow: none;
}

.description {
  margin: 16px 0 0;
  font-size: 15px;
  line-height: 22px;
  color: var(--text-2);
  white-space: pre-line;
}

.more-text {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.more-text:hover {
  text-decoration: underline;
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

.actions {
  display: flex;
  flex-wrap: wrap;
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

/* Стеклянная панель фактов справа. */
.facts {
  flex: 0 0 300px;
  margin: 0 0 4px auto;
  padding: 4px 16px;
  border-radius: 16px;
  background: rgba(12, 14, 18, 0.82);
  backdrop-filter: blur(20px) saturate(1.3);
  box-shadow: inset 0 0 0 1px var(--glass-line);
}

.fact {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
  line-height: 20px;
}

.fact:last-child {
  border-bottom: 0;
}

.fact dt {
  width: 92px;
  flex: none;
  color: var(--text-2);
  white-space: nowrap;
}

.fact dd {
  margin: 0;
  min-width: 0;
  color: var(--text);
  font-weight: 500;
  overflow-wrap: anywhere;
}

/* Узкое окно: шапка остаётся в ряд, факты уже — серии видны на первом экране. */
@media (max-width: 1180px) {
  .hero {
    gap: 24px;
  }

  .facts {
    flex-basis: 264px;
  }

  .fact dt {
    width: 84px;
  }
}

/* ---------- серии ---------- */
.episodes {
  padding: 8px 40px 0;
}

.episodes-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  margin-bottom: 16px;
}

.episodes-head h2 {
  font-size: 16px;
  font-weight: 600;
}

.sub {
  font-size: 13px;
  color: var(--text-3);
}

.spacer {
  flex: 1;
}

.switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  font-size: 13px;
  color: var(--text-2);
  white-space: nowrap;
  cursor: pointer;
}

.switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.track {
  position: relative;
  width: 32px;
  height: 18px;
  flex: none;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.16);
  transition: background-color 0.15s;
}

.track::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-2);
  transition: transform 0.15s, background-color 0.15s;
}

.switch input:checked + .track {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(92, 225, 230, 0.45);
}

.switch input:checked + .track::after {
  transform: translateX(14px);
  background: var(--accent);
}

.switch input:focus-visible + .track {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--text-2);
  font-size: 13px;
  white-space: nowrap;
}

.tool:hover {
  color: var(--text);
}

.segmented {
  display: flex;
  padding: 2px;
  border-radius: 10px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
}

.seg {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--text-3);
}

.seg--on {
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
}

.tool:focus-visible,
.seg:focus-visible,
.more-text:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.empty {
  padding: 24px 0;
  color: var(--text-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px 20px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-right: 8px;
  border-radius: 10px;
}

.row:hover {
  background: var(--surface);
}

.row-link {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 52px;
  padding: 0 12px;
  border-radius: 10px;
  color: inherit;
  text-decoration: none;
}

.row-link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.row-icon {
  color: var(--text-3);
}

.row--seen .row-icon,
.row--current .row-icon {
  color: var(--accent);
}

.row-number {
  width: 76px;
  flex: none;
  font-size: 14px;
  font-weight: 600;
}

.row-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: var(--text-2);
}

.row--seen .row-number,
.row--seen .row-name {
  color: var(--text-3);
}

.row-time {
  flex: none;
  font-size: 13px;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}

.row-toggle {
  width: 32px;
  height: 32px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--text-2);
  opacity: 0;
}

.row:hover .row-toggle,
.row-toggle:focus-visible,
.row-toggle--on {
  opacity: 1;
}

.row-toggle--on {
  color: var(--accent);
}

.row-toggle:focus-visible {
  outline: 2px solid var(--accent);
}

.row-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}
</style>
