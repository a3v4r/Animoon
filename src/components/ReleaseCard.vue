<template>
  <!-- Плашки и прогресс в описании, а не в имени ссылки: иначе диктор читает название после них -->
  <router-link
    class="card"
    :class="{ 'card--compact': compact }"
    :to="{ name: 'release', params: { id: release.id } }"
    :aria-labelledby="`${uid}-name`"
    :aria-describedby="describedBy"
  >
    <div class="poster">
      <v-img :src="poster" alt="" aspect-ratio="0.6667" cover>
        <template #placeholder><div class="placeholder" /></template>
      </v-img>

      <div :id="`${uid}-badge`" class="badges">
        <span v-if="isToday" class="badge badge--sm badge--warm">Сегодня</span>
        <span v-else-if="hasNew" class="badge badge--sm badge--accent">
          {{ latestOrdinal != null ? `Новая · серия ${latestOrdinal}` : 'Новая серия' }}
        </span>
        <span v-else-if="latestOrdinal != null" class="badge badge--sm badge--glass">Серия {{ latestOrdinal }}</span>
      </div>

      <template v-if="progress.watched > 0">
        <div class="shade" />
        <div :id="`${uid}-progress`" class="progress">
          <span v-if="isDone" class="progress-text"><v-icon icon="mdi-check" size="14" /> {{ doneText }}</span>
          <span v-else class="progress-text">{{ progressText }}</span>
          <div v-if="!isDone && ratio != null" class="thin-progress"><i :style="{ width: `${ratio * 100}%` }" /></div>
        </div>
      </template>
    </div>

    <div :id="`${uid}-name`" class="name" :class="compact ? 'ell' : 'clamp-2'" :title="release.name.main">{{ release.name.main }}</div>
    <div v-if="!compact" :id="`${uid}-meta`" class="meta ell">{{ meta }}</div>
  </router-link>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'
import { mediaUrl } from '@/api/http'
import type { Release } from '@/api/types'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { useScheduleStore } from '@/stores/schedule'

const props = defineProps<{
  release: Release & { episodes?: unknown[] }
  compact?: boolean
  noToday?: boolean
}>()

const uid = useId()

const index = useEpisodeIndexStore()

const poster = computed(() => mediaUrl(props.release.poster.optimized?.preview ?? props.release.poster.preview))
const latestOrdinal = computed(() => props.release.latest_episode?.ordinal ?? null)

const meta = computed(() => [
  props.release.type?.description,
  props.release.year,
  props.release.season?.description
].filter(Boolean).join(' · '))

const progress = computed(() => index.releaseProgress(props.release))
const isDone = computed(() => progress.value.released != null && progress.value.watched >= progress.value.released)
const ratio = computed(() => (progress.value.released ? Math.min(1, progress.value.watched / progress.value.released) : null))

const hasNew = computed(() => {
  const { watched, released } = progress.value
  return released != null && watched > 0 && released - watched === 1
})

// День берём из релиза: каталог и избранное расписание не грузят
const schedule = useScheduleStore()
const isToday = computed(() => !props.noToday && props.release.is_ongoing && props.release.publish_day?.value === schedule.today)

const describedBy = computed(() => [
  (isToday.value || hasNew.value || latestOrdinal.value != null) && `${uid}-badge`,
  progress.value.watched > 0 && `${uid}-progress`,
  !props.compact && `${uid}-meta`
].filter(Boolean).join(' ') || undefined)

const doneText = computed(() => (progress.value.total && progress.value.released === progress.value.total ? 'Просмотрено' : 'Все вышедшие'))

const progressText = computed(() => {
  const { watched, released } = progress.value
  return released != null ? `Просмотрено ${watched} из ${released}` : `Просмотрено ${watched}`
})
</script>

<style scoped>
.card {
  display: block;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.poster {
  position: relative;
  overflow: hidden;
  border-radius: 10px;
  background: var(--surface-2);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.card:hover .poster {
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px rgba(92, 225, 230, 0.55), 0 12px 28px rgba(0, 0, 0, 0.45);
}

.card:focus-visible {
  outline: none;
}

.card:focus-visible .poster {
  box-shadow: 0 0 0 2px var(--accent);
}

.placeholder {
  width: 100%;
  height: 100%;
  background: var(--surface-2);
}

/* Справа: слева сверху на постерах водяной знак */
.badges {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 8px;
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  overflow: hidden;
}

.shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(0deg, rgba(6, 7, 10, 0.88) 0, rgba(6, 7, 10, 0) 34%);
}

.progress {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 8px;
}

.progress-text {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.name {
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.name.clamp-2 {
  min-height: 40px;
}

.card--compact .name {
  font-size: 13px;
}

.meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
}
</style>
