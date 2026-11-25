<template>
  <div class="home">
    <div v-if="loading && latest.length === 0" class="state">
      <v-progress-circular indeterminate size="40" />
    </div>

    <div v-else-if="error && latest.length === 0" class="state">
      <v-alert type="error" variant="tonal" max-width="520">
        {{ error }}
        <template #append>
          <v-btn variant="text" @click="load">Повторить</v-btn>
        </template>
      </v-alert>
    </div>

    <template v-else>
      <home-hero v-model="heroIndex" :items="heroItems" />

      <div class="content">
        <release-shelf
          :more-to="{ name: 'catalog' }"
          :releases="shelfReleases"
          :subtitle="hasStarted ? 'начатые — первыми' : undefined"
          title="Новые серии"
        />
        <today-strip v-if="todayItems.length" class="today" :day-name="dayName" :items="todayItems" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, ref } from 'vue'
import { getLatest } from '@/api/releases'
import type { Release, ScheduleItem } from '@/api/types'
import HomeHero, { type HeroItem } from '@/components/home/HomeHero.vue'
import ReleaseShelf from '@/components/home/ReleaseShelf.vue'
import TodayStrip from '@/components/home/TodayStrip.vue'
import { useAccountStore } from '@/stores/account'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { useReleasesStore } from '@/stores/releases'
import { useScheduleStore, weekday } from '@/stores/schedule'

defineOptions({ name: 'ReleasesView' })

const DAY_NAMES = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье']
const HERO_SIZE = 5
const STALE_MS = 10 * 60 * 1000

const account = useAccountStore()
const index = useEpisodeIndexStore()
const releases = useReleasesStore()
const scheduleStore = useScheduleStore()

const latest = ref<Release[]>([])
const schedule = computed(() => scheduleStore.items)
const loading = ref(false)
const error = ref('')
const heroIndex = ref(0)
let loadedAt = 0

const dayOf = weekday
// ref, а не computed: Date не реактивен, после полуночи день остался бы вчерашним
const today = ref(dayOf())
const dayName = computed(() => DAY_NAMES[today.value - 1])

function syncDay (): boolean {
  const day = dayOf()
  if (day === today.value) return false
  today.value = day
  void load()
  return true
}

function isInProgress (release: Release): boolean {
  const p = index.releaseProgress(release)
  return p.watched > 0 && (p.released == null || p.watched < p.released)
}

const airsTodayById = computed(() => {
  const map = new Map<number, string>()
  for (const entry of schedule.value) {
    if (entry.release.publish_day?.value !== today.value || entry.published_release_episode) continue
    map.set(entry.release.id, entry.next_release_episode_number ? `Серия ${entry.next_release_episode_number} выйдет сегодня` : 'Выйдет сегодня')
  }
  return map
})

const heroItems = computed<HeroItem[]>(() => {
  const started = latest.value.filter(isInProgress)
  const fresh = latest.value.filter(r => !started.includes(r) && r.latest_episode)
  return [...started.slice(0, 3), ...fresh]
    .slice(0, HERO_SIZE)
    .map(release => ({
      release,
      mode: started.includes(release) ? 'continue' : 'fresh',
      airsToday: airsTodayById.value.get(release.id) ?? null
    }))
})

const hasStarted = computed(() => latest.value.some(isInProgress))

const shelfReleases = computed(() => {
  const current = heroItems.value[heroIndex.value]?.release.id
  const rest = latest.value.filter(r => r.id !== current)
  return [...rest.filter(isInProgress), ...rest.filter(r => !isInProgress(r))]
})

const todayItems = computed(() => {
  const own = (entry: ScheduleItem) => account.isFavorite(entry.release.id) || index.releaseProgress(entry.release).watched > 0
  const list = schedule.value.filter(entry => entry.release.publish_day?.value === today.value)
  return [...list.filter(own), ...list.filter(entry => !own(entry))]
})

async function load (): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [page] = await Promise.all([getLatest(1, 30), scheduleStore.load(true).catch(() => [] as ScheduleItem[])])
    today.value = dayOf()
    latest.value = page.data
    loadedAt = Date.now()
    if (heroIndex.value >= heroItems.value.length) heroIndex.value = 0
    refreshStale()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

// в ленте серия новее известной: перечитываем карточку, иначе "N из M" устареет
function refreshStale (): void {
  latest.value
    .filter(r => index.isStale(r) && index.releaseProgress(r).watched > 0)
    .slice(0, 5)
    .forEach(r => { void releases.load(r.id, true).catch(() => undefined) })
}

function isTyping (target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}

function onKey (event: KeyboardEvent): void {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return
  const count = heroItems.value.length
  if (count < 2) return
  if (event.code === 'ArrowRight') heroIndex.value = (heroIndex.value + 1) % count
  else if (event.code === 'ArrowLeft') heroIndex.value = (heroIndex.value - 1 + count) % count
}

onMounted(load)
let dayTimer: number | undefined

onActivated(() => {
  window.addEventListener('keydown', onKey)
  dayTimer = window.setInterval(syncDay, 60 * 1000)
  if (syncDay()) return
  if (loadedAt && Date.now() - loadedAt > STALE_MS) void load()
})
onDeactivated(() => {
  window.removeEventListener('keydown', onKey)
  window.clearInterval(dayTimer)
})
</script>

<style scoped>
.home {
  min-height: 100%;
  padding-bottom: 32px;
}

.state {
  display: flex;
  justify-content: center;
  padding: calc(var(--bar-height) + 48px) 24px 48px;
}

.content {
  position: relative;
  padding: 0 40px;
  margin-top: -24px;
}

.today {
  margin-top: 24px;
}
</style>
