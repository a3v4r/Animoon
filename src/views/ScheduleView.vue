<template>
  <div class="schedule">
    <page-header title="Расписание" :subtitle="summary">
      <nav v-if="days.length" class="day-jump" aria-label="Дни недели">
        <button
          v-for="day in days"
          :key="day.value"
          class="ui-btn filter-chip"
          :class="{ 'day-jump--today': day.value === today }"
          :aria-current="day.value === today ? 'date' : undefined"
          @click="jumpTo(day.value)"
        >
          {{ day.short }}<span class="d-sr-only">, {{ day.title }}<template v-if="day.value === today">, сегодня</template></span>
          <span class="day-count">{{ day.items.length }}<span class="d-sr-only"> {{ pluralize(day.items.length, ['релиз', 'релиза', 'релизов']) }}</span></span>
        </button>
      </nav>
    </page-header>

    <empty-state v-if="loading && items.length === 0">
      <v-progress-circular indeterminate size="32" color="secondary" aria-label="Загрузка" />
    </empty-state>

    <empty-state
      v-else-if="error && items.length === 0"
      alert
      icon="mdi-cloud-off-outline"
      title="Не удалось загрузить расписание"
      :text="error"
    >
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="load">Повторить</v-btn>
    </empty-state>

    <template v-else>
      <section
        v-for="day in days"
        :id="`day-${day.value}`"
        :key="day.value"
        class="day"
        :class="{ 'day--today': day.value === today }"
        :aria-labelledby="`day-title-${day.value}`"
      >
        <header class="day-head">
          <h2 :id="`day-title-${day.value}`" class="day-title font-display" tabindex="-1">{{ day.title }}</h2>
          <span v-if="day.value === today" class="badge badge--warm">Сегодня</span>
          <span v-else-if="day.value === tomorrow" class="badge badge--glass">Завтра</span>
          <span class="day-sub">{{ day.items.length }} {{ pluralize(day.items.length, ['релиз', 'релиза', 'релизов']) }}</span>
        </header>
        <div class="grid">
          <div v-for="item in day.items" :key="item.release.id" class="item">
            <release-card no-today :release="item.release" />
            <div v-if="item.published_release_episode" class="note note--out">
              <v-icon icon="mdi-check" size="14" />
              Вышла серия {{ item.published_release_episode.ordinal }}
            </div>
            <div v-else-if="item.next_release_episode_number" class="note" :class="{ 'note--soon': day.value === today }">
              <v-icon icon="mdi-clock-outline" size="14" />
              <template v-if="day.value === today">Серия {{ item.next_release_episode_number }} — сегодня</template>
              <template v-else>Ждём серию {{ item.next_release_episode_number }}</template>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'
import type { ScheduleItem } from '@/api/types'
import ReleaseCard from '@/components/ReleaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useScheduleStore, weekday } from '@/stores/schedule'
import { pluralize } from '@/utils/plural'

defineOptions({ name: 'ScheduleView' })

const DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
const DAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']

const scheduleStore = useScheduleStore()
const items = computed<ScheduleItem[]>(() => scheduleStore.items)
const loading = ref(false)
const error = ref('')

const today = ref(weekday())
const tomorrow = computed(() => (today.value % 7) + 1)

const days = computed(() => DAY_NAMES
  .map((title, i) => ({
    value: i + 1,
    title,
    short: DAY_SHORT[i],
    items: items.value.filter(item => item.release.publish_day?.value === i + 1)
  }))
  .filter(day => day.items.length > 0)
  .sort((a, b) => ((a.value - today.value + 7) % 7) - ((b.value - today.value + 7) % 7)))

const summary = computed(() => {
  const total = items.value.length
  return total ? `${total} ${pluralize(total, ['релиз', 'релиза', 'релизов'])} на неделе` : ''
})

function jumpTo (day: number): void {
  const section = document.getElementById(`day-${day}`)
  section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  // preventScroll, иначе фокус сбивает плавную прокрутку
  section?.querySelector<HTMLElement>('.day-title')?.focus({ preventScroll: true })
}

async function load (): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    await scheduleStore.load(true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function refreshDay (): void {
  const now = weekday()
  if (now === today.value) return
  today.value = now
  scheduleStore.load(true).catch(() => {})
}

// после сна или троттлинга фона таймер опаздывает, поэтому ещё visibilitychange и focus
let midnightTimer: ReturnType<typeof setTimeout> | undefined

function armMidnight (): void {
  clearTimeout(midnightTimer)
  const next = new Date()
  next.setHours(24, 0, 1, 0)
  midnightTimer = setTimeout(() => {
    refreshDay()
    armMidnight()
  }, next.getTime() - Date.now())
}

function onVisibility (): void {
  if (document.visibilityState === 'visible') refreshDay()
}

function stopWatchingDay (): void {
  clearTimeout(midnightTimer)
  midnightTimer = undefined
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('focus', refreshDay)
}

onMounted(load)
// в keep-alive onActivated срабатывает и при первом монтировании
onActivated(() => {
  refreshDay()
  scheduleStore.load().catch(() => {})
  armMidnight()
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('focus', refreshDay)
})
onDeactivated(stopWatchingDay)
onBeforeUnmount(stopWatchingDay)
</script>

<style scoped>
.schedule {
  padding-bottom: 40px;
}

.day-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.day-count {
  font-size: 12px;
  color: var(--text-3);
}

.day-jump--today {
  color: var(--warm);
  box-shadow: inset 0 0 0 1px rgba(255, 181, 71, 0.4);
}

.day-jump--today:hover {
  color: var(--warm);
}

.day {
  padding: 32px 40px 0;
  scroll-margin-top: calc(var(--bar-height) + 8px);
}

.day-head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 16px;
}

.day-title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
  border-radius: 4px;
}

.day-title:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.day--today .day-title {
  color: var(--warm);
}

.day-sub {
  font-size: 13px;
  color: var(--text-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 24px 16px;
}

.item {
  min-width: 0;
}

.note {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-3);
}

.note--out {
  color: var(--accent);
}

.note--soon {
  color: var(--warm);
}

</style>
