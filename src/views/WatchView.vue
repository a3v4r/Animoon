<template>
  <div
    class="watch"
    :class="{ 'watch--idle': idle && !holdUi, 'watch--list': listOpen }"
    @focusin="wake"
    @mousemove="wake"
  >
    <video
      ref="videoEl"
      class="video"
      disablepictureinpicture
      @canplay="buffering = false"
      @click="onSurfaceClick"
      @dblclick="onSurfaceDblclick"
      @durationchange="sync"
      @ended="onEnded"
      @loadedmetadata="sync"
      @pause="onPause"
      @play="sync"
      @playing="buffering = false"
      @progress="sync"
      @ratechange="sync"
      @timeupdate="onTimeUpdate"
      @volumechange="onVolumeChange"
      @waiting="buffering = true"
    />
    <div class="shade" />

    <!-- Верх: выход, название, перетаскивание окна (не в полноэкранном режиме) и кнопки окна. -->
    <header
      class="top chrome"
      v-bind="dragAttrs"
      @mouseenter="chromeHover = true"
      @mouseleave="chromeHover = false"
    >
      <button class="ui-btn glass-btn" title="К релизу" aria-label="К релизу" @click="leave">
        <v-icon icon="mdi-arrow-left" size="20" />
      </button>
      <div class="titles" v-bind="dragAttrs">
        <b class="ell" v-bind="dragAttrs">{{ release?.name.main }}</b>
        <span v-if="episode" class="ell" v-bind="dragAttrs">
          Серия {{ episode.ordinal }}<template v-if="episode.name"> · {{ episode.name }}</template>
        </span>
      </div>
      <div class="drag" v-bind="dragAttrs" />
      <window-controls v-if="!player.fullscreen" />
    </header>

    <!-- Большая кнопка на паузе (в том числе если пауза пришлась на подгрузку). -->
    <button
      v-if="state.paused && !loading && !error"
      class="ui-btn big-play"
      title="Смотреть (пробел)"
      aria-label="Смотреть"
      @click="togglePlay"
    >
      <v-icon icon="mdi-play" size="48" />
    </button>

    <div v-if="loading || (buffering && !state.paused)" class="center"><v-progress-circular indeterminate size="48" /></div>
    <v-alert v-if="error" class="center error" type="error" variant="tonal">{{ error }}</v-alert>

    <!-- Пропуск опенинга и следующая серия — над панелью. -->
    <div class="floating" @mouseenter="chromeHover = true" @mouseleave="chromeHover = false">
      <button v-if="showSkip" class="ui-btn skip" :class="{ 'skip--pinned': skipPinned }" @click="skipOpening">
        Пропустить опенинг <kbd>S</kbd>
      </button>
      <div v-else-if="showNext && next" class="next-card">
        <button class="ui-btn next-main" :aria-label="`Следующая серия: ${next.ordinal}`" @click="goTo(next)">
          <span class="next-thumb">
            <img v-if="thumbOf(next)" :src="thumbOf(next)" alt="">
            <v-icon icon="mdi-play" size="28" />
          </span>
          <span class="next-text">
            <span class="next-label">
              <template v-if="countdown != null">Следующая через {{ countdown }} с</template>
              <template v-else>Следующая · Серия {{ next.ordinal }} <kbd>N</kbd></template>
            </span>
            <span class="next-name clamp-2">{{ next.name || `Серия ${next.ordinal}` }}</span>
          </span>
        </button>
        <template v-if="countdown != null">
          <div class="countdown" :style="{ '--seconds': `${COUNTDOWN_SECONDS}s` }" />
          <button class="ui-btn cancel" @click="cancelCountdown">Отмена</button>
        </template>
      </div>
    </div>

    <!-- Низ: стеклянная панель с полосой перемотки и кнопками. -->
    <div class="panel chrome" @mouseenter="chromeHover = true" @mouseleave="chromeHover = false">
      <seek-bar :buffered="state.buffered" :current="state.time" :duration="state.duration" :marks="marks" @seek="seek" />
      <div class="controls">
        <button class="ui-btn ctl" :title="state.paused ? 'Смотреть (пробел)' : 'Пауза (пробел)'" :aria-label="state.paused ? 'Смотреть' : 'Пауза'" @click="togglePlay">
          <v-icon :icon="state.paused ? 'mdi-play' : 'mdi-pause'" size="26" />
        </button>
        <button class="ui-btn ctl" :disabled="!previous" title="Предыдущая серия" aria-label="Предыдущая серия" @click="goTo(previous)">
          <v-icon icon="mdi-skip-previous" size="24" />
        </button>
        <button class="ui-btn ctl" :disabled="!next" title="Следующая серия (N)" aria-label="Следующая серия" @click="goTo(next)">
          <v-icon icon="mdi-skip-next" size="24" />
        </button>
        <button class="ui-btn ctl" title="Назад на 10 с (J)" aria-label="Назад на 10 секунд" @click="seek(state.time - 10)">
          <v-icon icon="mdi-rewind-10" size="22" />
        </button>
        <button class="ui-btn ctl" title="Вперёд на 10 с (L)" aria-label="Вперёд на 10 секунд" @click="seek(state.time + 10)">
          <v-icon icon="mdi-fast-forward-10" size="22" />
        </button>
        <button class="ui-btn ctl" :title="isSilent ? 'Включить звук (M)' : 'Выключить звук (M)'" :aria-label="isSilent ? 'Включить звук' : 'Выключить звук'" @click="toggleMute">
          <v-icon :icon="volumeIcon" size="22" />
        </button>
        <!-- После работы мышью фокус с ползунка снимается, чтобы горячие клавиши сразу работали. -->
        <input
          aria-label="Громкость"
          :aria-valuetext="`${Math.round(displayedVolume * 100)}%`"
          class="volume"
          max="1"
          min="0"
          step="0.01"
          type="range"
          :style="{ '--level': `${displayedVolume * 100}%` }"
          :value="displayedVolume"
          @input="setVolume(Number(($event.target as HTMLInputElement).value))"
          @pointerup="($event.currentTarget as HTMLElement).blur()"
        >
        <span class="time">{{ formatDuration(state.time) }} <span>/ {{ formatDuration(state.duration) }}</span></span>

        <span class="mid ell">{{ midLine }}</span>

        <v-menu v-model="rateMenu" location="top end" :close-on-content-click="true" offset="8">
          <template #activator="{ props: menuProps }">
            <button v-bind="menuProps" class="ui-btn text-ctl" title="Скорость" :aria-label="`Скорость ${state.rate}×`">
              <v-icon icon="mdi-speedometer" size="20" /> {{ state.rate === 1 ? '1×' : `${state.rate}×` }}
            </button>
          </template>
          <v-list class="glass-menu" density="compact">
            <v-list-item v-for="rate in RATES" :key="rate" :active="rate === state.rate" :title="`${rate}×`" @click="setRate(rate)" />
          </v-list>
        </v-menu>

        <v-menu v-model="qualityMenu" location="top end" :close-on-content-click="true" offset="8">
          <template #activator="{ props: menuProps }">
            <button v-bind="menuProps" class="ui-btn text-ctl" title="Качество" :aria-label="`Качество ${activeQuality}p`">
              <v-icon icon="mdi-quality-high" size="20" /> {{ activeQuality }}p
            </button>
          </template>
          <v-list class="glass-menu" density="compact">
            <v-list-item v-for="q in qualities" :key="q" :active="q === activeQuality" :title="`${q}p`" @click="player.quality = q" />
          </v-list>
        </v-menu>

        <button
          ref="listBtn"
          class="ui-btn ctl"
          :class="{ 'ctl--on': listOpen }"
          title="Список серий"
          aria-label="Список серий"
          :aria-expanded="listOpen"
          @click="toggleList"
        >
          <v-icon icon="mdi-format-list-bulleted" size="22" />
        </button>
        <button class="ui-btn ctl" :title="player.fullscreen ? 'Выйти из полного экрана (F)' : 'Полный экран (F)'" :aria-label="player.fullscreen ? 'Выйти из полного экрана' : 'Полный экран'" @click="toggleFullscreen">
          <v-icon :icon="player.fullscreen ? 'mdi-fullscreen-exit' : 'mdi-fullscreen'" size="24" />
        </button>
      </div>
    </div>

    <!-- Список серий справа. -->
    <transition name="slide">
      <episode-list
        v-if="listOpen"
        ref="episodeList"
        :current-id="episode?.id"
        :episodes="episodes"
        :focus-on-open="listOpenedByKeyboard"
        @close="closeList"
        @select="goTo"
      />
    </transition>
  </div>
</template>

<script setup lang="ts">
import Hls from 'hls.js'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { mediaUrl } from '@/api/http'
import type { Episode, ReleaseFull } from '@/api/types'
import EpisodeList from '@/components/player/EpisodeList.vue'
import SeekBar, { type SeekMark } from '@/components/player/SeekBar.vue'
import WindowControls from '@/components/shell/WindowControls.vue'
import { type Quality, usePlayerStore } from '@/stores/player'
import { useProgressStore } from '@/stores/progress'
import { useReleasesStore } from '@/stores/releases'
import { useSettingsStore } from '@/stores/settings'
import { sortEpisodes } from '@/utils/episodes'
import { formatDuration } from '@/utils/time'
import { windowControls } from '@/utils/window'

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]
// Сколько секунд показывать «Следующая через N с» после конца серии.
const COUNTDOWN_SECONDS = 8
// Клавиши, которыми управляется сам ползунок громкости, когда на нём фокус.
const RANGE_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']

const props = defineProps<{ id: string, ordinal: string }>()

const router = useRouter()
const player = usePlayerStore()
const releases = useReleasesStore()
const progress = useProgressStore()
const { settings } = useSettingsStore()

const videoEl = ref<HTMLVideoElement | null>(null)
const release = ref<ReleaseFull | null>(null)
const loading = ref(true)
const buffering = ref(false)
const error = ref('')
const idle = ref(false)

// Список серий справа.
const listOpen = ref(false)
const listOpenedByKeyboard = ref(false)
const listBtn = ref<HTMLButtonElement | null>(null)
const episodeList = ref<{ containsFocus: () => boolean } | null>(null)

// Открытые меню и курсор над панелями держат интерфейс на экране.
const rateMenu = ref(false)
const qualityMenu = ref(false)
const chromeHover = ref(false)
const holdUi = computed(() => chromeHover.value || rateMenu.value || qualityMenu.value || listOpen.value)

// Опенинг пропущен автоматически: кнопка остаётся, если пользователь вернулся назад в опенинг.
const autoSkipped = ref(false)
// Кнопка пропуска видна первые 8 секунд опенинга даже при простое.
const skipPinned = ref(false)
// Обратный отсчёт до следующей серии после конца текущей; null — нет отсчёта.
const countdown = ref<number | null>(null)

// Снимок состояния <video> для шаблона.
const state = reactive({ time: 0, duration: 0, buffered: 0, paused: true, volume: 1, muted: false, rate: 1 })

let hls: Hls | null = null
let idleTimer: number | undefined
let skipTimer: number | undefined
let countdownTimer: number | undefined
let clickTimer: number | undefined
let lastSaved = 0

const episodes = computed(() => sortEpisodes(release.value?.episodes ?? []))
const index = computed(() => episodes.value.findIndex(e => String(e.ordinal) === props.ordinal))
const episode = computed<Episode | undefined>(() => episodes.value[index.value])
const previous = computed(() => (index.value > 0 ? episodes.value[index.value - 1] : undefined))
const next = computed(() => (index.value >= 0 ? episodes.value[index.value + 1] : undefined))

const sources = computed<Partial<Record<Quality, string>>>(() => {
  const e = episode.value
  if (!e) return {}
  const list: Partial<Record<Quality, string>> = {}
  if (e.hls_480) list['480'] = e.hls_480
  if (e.hls_720) list['720'] = e.hls_720
  if (e.hls_1080) list['1080'] = e.hls_1080
  return list
})
const qualities = computed(() => (Object.keys(sources.value) as Quality[]).sort((a, b) => Number(b) - Number(a)))
// Выбранное качество; если серии в нём нет — лучшее доступное.
const activeQuality = computed<Quality>(() => (sources.value[player.quality] ? player.quality : qualities.value[0] ?? player.quality))

function range (r: { start: number | null, stop: number | null } | undefined) {
  return r?.start != null && r.stop != null && r.stop > r.start ? { start: r.start, stop: r.stop } : null
}
const opening = computed(() => range(episode.value?.opening))
const ending = computed(() => range(episode.value?.ending))
const marks = computed<SeekMark[]>(() => {
  const list: SeekMark[] = []
  if (opening.value) list.push({ kind: 'opening', ...opening.value })
  if (ending.value) list.push({ kind: 'ending', ...ending.value })
  return list
})

const inOpening = computed(() => opening.value != null && state.time >= opening.value.start && state.time < opening.value.stop - 1)
const inEnding = computed(() => ending.value != null && state.time >= ending.value.start && state.time < ending.value.stop - 1)
// Карточка «Следующая» — на эндинге, за полторы минуты до конца и во время отсчёта.
const nearEnd = computed(() => inEnding.value || (state.duration > 0 && state.duration - state.time < 90))
const showNext = computed(() => countdown.value != null || nearEnd.value)
const showSkip = computed(() => inOpening.value && (!settings.autoSkipOpening || autoSkipped.value))

// Перетаскивание окна за верхнюю полосу — только не в полноэкранном режиме.
const dragAttrs = computed(() => (player.fullscreen ? {} : { 'data-tauri-drag-region': '' }))

/** «Серия 4 из 9 · озвучка» в середине панели. */
const midLine = computed(() => {
  if (!episode.value || !release.value) return ''
  const voices = release.value.members.filter(m => m.role.value === 'voicing').map(m => m.nickname)
  return [`Серия ${episode.value.ordinal} из ${episodes.value.length}`, voices.join(', ')].filter(Boolean).join(' · ')
})

const isSilent = computed(() => state.muted || state.volume === 0)
const displayedVolume = computed(() => (isSilent.value ? 0 : state.volume))
const volumeIcon = computed(() => {
  if (isSilent.value) return 'mdi-volume-off'
  return state.volume < 0.5 ? 'mdi-volume-medium' : 'mdi-volume-high'
})

function thumbOf (item: Episode | undefined): string {
  const preview = item?.preview
  return mediaUrl(preview?.optimized?.thumbnail ?? preview?.thumbnail ?? preview?.optimized?.preview)
}

function sync (): void {
  const v = videoEl.value
  if (!v) return
  state.time = v.currentTime
  state.duration = Number.isFinite(v.duration) ? v.duration : (episode.value?.duration ?? 0)
  state.paused = v.paused
  state.volume = v.volume
  state.muted = v.muted
  state.rate = v.playbackRate
  state.buffered = v.buffered.length ? v.buffered.end(v.buffered.length - 1) : 0
}

function load (startAt: number): void {
  const video = videoEl.value
  const url = sources.value[activeQuality.value]
  if (!video) return
  if (!url) {
    error.value = 'У этой серии нет видео.'
    loading.value = false
    return
  }
  error.value = ''
  loading.value = true
  hls?.destroy()
  hls = null

  // Громкость и выключенный звук переносятся между сериями.
  video.volume = player.volume
  video.muted = player.muted
  if (Hls.isSupported()) {
    hls = new Hls({ maxBufferLength: 60, startPosition: startAt })
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      loading.value = false
      void video.play().catch(() => sync())
    })
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad()
      else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError()
      else {
        error.value = 'Не удалось воспроизвести видео.'
        loading.value = false
      }
    })
    hls.loadSource(url)
    hls.attachMedia(video)
  } else {
    video.src = url
    video.currentTime = startAt
    loading.value = false
    void video.play().catch(() => sync())
  }
}

/** С какого места начать: сохранённый прогресс, если серия не досмотрена. */
function startPosition (): number {
  const e = episode.value
  if (!e || !settings.resume) return 0
  const saved = progress.get(e.id)
  if (!saved || saved.watched || saved.time < 5) return 0
  return saved.time
}

function saveProgress (): void {
  const e = episode.value
  const v = videoEl.value
  if (!e || !v || v.currentTime < 1) return
  progress.save(e.id, v.currentTime, Number.isFinite(v.duration) ? v.duration : e.duration)
  lastSaved = Date.now()
}

function onTimeUpdate (): void {
  sync()
  if (settings.autoSkipOpening && !autoSkipped.value && inOpening.value) {
    autoSkipped.value = true
    skipOpening()
  }
  if (Date.now() - lastSaved > 10000) saveProgress()
}

function onPause (): void {
  sync()
  // Пауза во время подгрузки: индикатор не нужен, нужна большая кнопка.
  buffering.value = false
  saveProgress()
  void progress.flush()
  wake()
}

function onEnded (): void {
  saveProgress()
  void progress.flush()
  if (settings.autoNext && next.value) startCountdown()
  wake()
}

function startCountdown (): void {
  cancelCountdown()
  countdown.value = COUNTDOWN_SECONDS
  countdownTimer = window.setInterval(() => {
    if (countdown.value == null) return
    countdown.value -= 1
    if (countdown.value <= 0) goTo(next.value)
  }, 1000)
}

function cancelCountdown (): void {
  window.clearInterval(countdownTimer)
  countdown.value = null
}

function togglePlay (): void {
  const v = videoEl.value
  if (!v) return
  if (v.paused) void v.play()
  else v.pause()
}

// Одиночный клик по видео — пауза (или закрыть список серий), двойной — полный экран без лишней паузы.
function onSurfaceClick (event: MouseEvent): void {
  if (event.detail > 1) return
  window.clearTimeout(clickTimer)
  clickTimer = window.setTimeout(() => {
    if (listOpen.value) closeList()
    else togglePlay()
  }, 220)
}

function onSurfaceDblclick (): void {
  window.clearTimeout(clickTimer)
  void toggleFullscreen()
}

function seek (time: number): void {
  if (videoEl.value) videoEl.value.currentTime = Math.max(0, Math.min(time, state.duration || time))
}

/** Громкость с шагом в сотые; ноль — это «выключить звук», а прежняя громкость сохраняется. */
function setVolume (value: number): void {
  const v = videoEl.value
  if (!v) return
  const level = Math.round(Math.min(1, Math.max(0, value)) * 100) / 100
  if (level <= 0) {
    v.muted = true
    return
  }
  v.volume = level
  v.muted = false
}

function toggleMute (): void {
  const v = videoEl.value
  if (!v) return
  if (v.muted || v.volume === 0) {
    if (v.volume === 0) v.volume = player.volume > 0 ? player.volume : 1
    v.muted = false
  } else {
    v.muted = true
  }
}

function onVolumeChange (): void {
  sync()
  const v = videoEl.value
  if (!v) return
  player.muted = v.muted
  if (v.volume > 0) player.volume = Math.round(v.volume * 100) / 100
}

function setRate (rate: number): void {
  if (videoEl.value) videoEl.value.playbackRate = rate
}

function skipOpening (): void {
  if (opening.value) seek(opening.value.stop)
}

function goTo (target: Episode | undefined): void {
  if (!target) return
  cancelCountdown()
  saveProgress()
  void router.replace({ name: 'watch', params: { id: props.id, ordinal: target.ordinal } })
}

async function toggleFullscreen (): Promise<void> {
  player.fullscreen = !player.fullscreen
  await windowControls.setFullscreen(player.fullscreen)
}

async function leave (): Promise<void> {
  if (player.fullscreen) await toggleFullscreen()
  void router.push({ name: 'release', params: { id: props.id } })
}

function toggleList (event: MouseEvent): void {
  if (listOpen.value) {
    closeList()
    return
  }
  // detail === 0 — нажали с клавиатуры (Enter/пробел), а не мышью.
  listOpenedByKeyboard.value = event.detail === 0
  listOpen.value = true
}

/** Закрыть список; если фокус был в нём — вернуть его на кнопку списка. */
function closeList (): void {
  const hadFocus = episodeList.value?.containsFocus() ?? false
  listOpen.value = false
  if (hadFocus) void nextTick(() => listBtn.value?.focus())
}

// Интерфейс прячется через 3 секунды без движения мыши, пока видео играет,
// но не пока курсор над панелью, открыто меню или список серий.
function wake (): void {
  idle.value = false
  window.clearTimeout(idleTimer)
  idleTimer = window.setTimeout(() => {
    if (holdUi.value) {
      wake()
      return
    }
    idle.value = !(videoEl.value?.paused ?? true)
  }, 3000)
}

// Закрыли меню — интерфейс не пропадает в тот же миг.
watch([rateMenu, qualityMenu], ([rate, quality]) => {
  if (!rate && !quality) wake()
})

// Вошли в опенинг — кнопка пропуска видна 8 секунд даже без движения мыши.
watch(inOpening, value => {
  window.clearTimeout(skipTimer)
  skipPinned.value = value
  if (value) skipTimer = window.setTimeout(() => { skipPinned.value = false }, 8000)
})

/** Любая клавиша показывает интерфейс (до остальной обработки). */
function onAnyKey (): void {
  wake()
}

function onKey (event: KeyboardEvent): void {
  const v = videoEl.value
  // Сочетания с Ctrl/Alt (например, Ctrl K — поиск) плеер не перехватывает.
  if (!v || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target instanceof HTMLElement ? event.target : null
  if (target) {
    if (target.isContentEditable || target.matches('input:not([type=range]), textarea, select')) return
    // На ползунке громкости его собственные клавиши остаются ему, остальные — плееру.
    if (target.matches('input[type=range]') && RANGE_KEYS.includes(event.key)) return
  }
  // Кнопка, на которую перешли с клавиатуры, нажимается пробелом как обычно.
  const keyboardButton = !!target?.closest('button, a[href], [role=button]') && !!target?.matches(':focus-visible')

  switch (event.code) {
    case 'Space':
      if (keyboardButton) return
      event.preventDefault()
      togglePlay()
      break
    case 'KeyK':
      togglePlay()
      break
    case 'KeyF':
      void toggleFullscreen()
      break
    case 'Escape':
      // Открытое меню закроет сам Vuetify — больше ничего не делаем.
      if (rateMenu.value || qualityMenu.value) break
      if (countdown.value != null) cancelCountdown()
      else if (listOpen.value) closeList()
      else if (player.fullscreen) void toggleFullscreen()
      break
    case 'ArrowRight':
      event.preventDefault()
      seek(v.currentTime + 5)
      break
    case 'ArrowLeft':
      event.preventDefault()
      seek(v.currentTime - 5)
      break
    case 'KeyL':
      seek(v.currentTime + 10)
      break
    case 'KeyJ':
      seek(v.currentTime - 10)
      break
    case 'ArrowUp':
      event.preventDefault()
      setVolume(displayedVolume.value + 0.05)
      break
    case 'ArrowDown':
      event.preventDefault()
      setVolume(displayedVolume.value - 0.05)
      break
    case 'KeyM':
      toggleMute()
      break
    case 'KeyN':
      goTo(next.value)
      break
    case 'KeyS':
      if (inOpening.value) skipOpening()
      break
  }
}

// Смена качества: продолжить с того же места.
watch(activeQuality, (value, old) => {
  if (old && value !== old) load(videoEl.value?.currentTime ?? 0)
})

onMounted(async () => {
  window.addEventListener('keydown', onAnyKey, true)
  window.addEventListener('keydown', onKey)
  wake()
  try {
    release.value = await releases.load(props.id)
    // Серии нет в карточке из кэша (например, открыли новую серию из уведомления) — перечитать.
    if (!episode.value) release.value = await releases.load(props.id, true)
    if (!episode.value) {
      error.value = 'Серия не найдена.'
      loading.value = false
      return
    }
    load(startPosition())
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    loading.value = false
  }
})

onBeforeUnmount(() => {
  saveProgress()
  void progress.flush()
  // Ушли из плеера совсем (а не на другую серию) — выйти из полного экрана.
  if (player.fullscreen && router.currentRoute.value.name !== 'watch') void toggleFullscreen()
  window.removeEventListener('keydown', onAnyKey, true)
  window.removeEventListener('keydown', onKey)
  window.clearTimeout(idleTimer)
  window.clearTimeout(skipTimer)
  window.clearTimeout(clickTimer)
  window.clearInterval(countdownTimer)
  hls?.destroy()
})
</script>

<style scoped>
.watch {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
}

.video {
  width: 100%;
  height: 100%;
  display: block;
  background: #000;
}

/* Затемнение сверху и снизу — под название и панель. */
.shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.66) 0, rgba(0, 0, 0, 0) 160px),
    linear-gradient(0deg, rgba(0, 0, 0, 0.72) 0, rgba(0, 0, 0, 0) 300px);
  transition: opacity 0.3s;
}

.chrome {
  transition: opacity 0.3s;
}

/* Мышь не двигается, видео играет — всё прячется (кроме закреплённого пропуска и «Следующей»). */
.watch--idle {
  cursor: none;
}

.watch--idle .chrome,
.watch--idle .shade,
.watch--idle .skip:not(.skip--pinned) {
  opacity: 0;
  pointer-events: none;
}

/* Работают с клавиатуры — панель с фокусом остаётся видна. */
.watch--idle .chrome:has(:focus-visible) {
  opacity: 1;
  pointer-events: auto;
}

/* ---------- верх ---------- */
.top {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: var(--bar-height);
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 16px;
}

.glass-btn {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  color: var(--text);
}

.glass-btn:hover {
  background: rgba(40, 44, 54, 0.85);
}

.titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin-left: 8px;
}

.titles b {
  font-size: 15px;
  font-weight: 600;
}

.titles span {
  font-size: 13px;
  color: var(--text-2);
}

.drag {
  flex: 1;
  align-self: stretch;
}

/* ---------- центр ---------- */
.big-play {
  position: absolute;
  left: 50%;
  top: 46%;
  width: 88px;
  height: 88px;
  margin: -44px 0 0 -44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--glass);
  backdrop-filter: blur(20px);
  box-shadow: inset 0 0 0 1px var(--glass-line), 0 4px 24px rgba(0, 0, 0, 0.35);
  color: #fff;
  transition: transform 0.15s, background-color 0.15s;
}

.big-play:hover {
  transform: scale(1.06);
  background: rgba(40, 44, 54, 0.85);
}

.center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.error {
  max-width: 480px;
}

/* ---------- над панелью ---------- */
.floating {
  position: absolute;
  right: 24px;
  bottom: 140px;
  display: flex;
  justify-content: flex-end;
  transition: right 0.2s;
}

/* Открыт список серий — карточки сдвигаются левее него. */
.watch--list .floating {
  right: calc(24px + 360px + 16px);
}

kbd {
  margin-left: 6px;
  padding: 0 4px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 5px;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
}

.skip {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 18px;
  border-radius: 12px;
  background: var(--accent);
  color: var(--accent-ink);
  font-size: 15px;
  font-weight: 600;
  transition: opacity 0.3s;
}

.skip kbd {
  border-color: rgba(4, 39, 43, 0.4);
}

.next-card {
  position: relative;
  width: 360px;
  overflow: hidden;
  border-radius: 16px;
  background: rgba(14, 16, 22, 0.56);
  backdrop-filter: blur(24px) saturate(1.4);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
}

.next-card:hover {
  box-shadow: inset 0 0 0 1px rgba(92, 225, 230, 0.6);
}

.next-main {
  width: 100%;
  display: flex;
  gap: 12px;
  padding: 12px;
  text-align: left;
}

.next-thumb {
  position: relative;
  width: 128px;
  height: 72px;
  flex: none;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: var(--surface-2);
}

.next-thumb img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Затемнение под значком ▶, чтобы он читался на светлом кадре. */
.next-thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.25);
}

.next-thumb .v-icon {
  position: relative;
  z-index: 1;
}

.next-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.next-label {
  font-size: 12px;
  color: var(--text-3);
}

.next-name {
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

/* Полоска обратного отсчёта по низу карточки. */
.countdown {
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: 100%;
  background: var(--accent);
  transform-origin: left;
  animation: countdown var(--seconds) linear forwards;
}

@keyframes countdown {
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
}

.cancel {
  position: absolute;
  right: 12px;
  bottom: 12px;
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
}

.cancel:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* ---------- панель ---------- */
.panel {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 24px;
  padding: 20px 16px 12px;
  border-radius: 20px;
  background: rgba(14, 16, 22, 0.5);
  backdrop-filter: blur(28px) saturate(1.5);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 16px 48px rgba(0, 0, 0, 0.4);
}

.panel :deep(.seek) {
  margin: 0 8px 8px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 40px;
}

.ctl {
  width: 40px;
  height: 40px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--text);
}

.ctl:hover:not(:disabled),
.text-ctl:hover {
  background: rgba(255, 255, 255, 0.1);
}

.ctl:disabled {
  opacity: 0.35;
  cursor: default;
}

.ctl--on {
  background: var(--accent-soft);
  color: var(--accent);
}

.text-ctl {
  height: 40px;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  border-radius: 10px;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.text-ctl .v-icon {
  color: var(--text-2);
}

.ctl:focus-visible,
.text-ctl:focus-visible,
.glass-btn:focus-visible,
.big-play:focus-visible,
.skip:focus-visible,
.next-main:focus-visible,
.cancel:focus-visible,
.volume:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Громкость: тонкая полоса, заполненная часть белая. */
.volume {
  width: 80px;
  height: 16px;
  flex: none;
  margin: 0 8px 0 4px;
  background: transparent;
  cursor: pointer;
  appearance: none;
}

.volume::-webkit-slider-runnable-track {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(90deg, var(--text) var(--level), rgba(255, 255, 255, 0.2) var(--level));
}

.volume::-webkit-slider-thumb {
  width: 12px;
  height: 12px;
  margin-top: -4px;
  border-radius: 50%;
  background: #fff;
  appearance: none;
}

.time {
  margin-left: 8px;
  flex: none;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.time span {
  color: var(--text-3);
}

.mid {
  flex: 1;
  min-width: 0;
  padding: 0 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-3);
}

/* Узкое окно: средняя подпись уходит, остальное помещается. */
@media (max-width: 1100px) {
  .mid {
    visibility: hidden;
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>

<!-- Меню скорости и качества рисуются вне плеера (в оверлее), поэтому стиль без scoped. -->
<style>
.glass-menu.v-list {
  background: rgba(14, 16, 22, 0.92) !important;
  backdrop-filter: blur(20px);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  border-radius: 12px !important;
}
</style>
