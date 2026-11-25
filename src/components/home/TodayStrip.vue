<template>
  <section class="today">
    <div class="label">
      <b class="font-display">Сегодня</b>
      <span>{{ dayName }} · {{ items.length }} {{ pluralize(items.length, ['релиз', 'релиза', 'релизов']) }}</span>
    </div>

    <div ref="list" class="list">
      <router-link
        v-for="entry in items.slice(0, visibleCount)"
        :key="entry.release.id"
        class="entry"
        :to="{ name: 'release', params: { id: entry.release.id } }"
      >
        <img :src="thumb(entry)" alt="" loading="lazy">
        <div class="text">
          <div class="title ell">{{ entry.release.name.main }}</div>
          <div class="status ell" :class="{ 'status--out': entry.published_release_episode }">{{ status(entry) }}</div>
        </div>
      </router-link>
    </div>

    <router-link class="more" :to="{ name: 'schedule' }">Расписание <v-icon icon="mdi-chevron-right" size="18" /></router-link>
  </section>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mediaUrl } from '@/api/http'
import type { ScheduleItem } from '@/api/types'
import { pluralize } from '@/utils/plural'

defineProps<{ items: ScheduleItem[], dayName: string }>()

// Сколько позиций помещается в одну строку: лишние не рисуем, чтобы до скрытых
// нельзя было дойти Tab'ом. Колонка от 190 px, промежуток 16 px.
const COLUMN = 190
const GAP = 16
const list = ref<HTMLElement | null>(null)
const visibleCount = ref(4)
const observer = new ResizeObserver(([entry]) => {
  visibleCount.value = Math.max(1, Math.floor((entry.contentRect.width + GAP) / (COLUMN + GAP)))
})
onMounted(() => { if (list.value) observer.observe(list.value) })
onBeforeUnmount(() => observer.disconnect())

function thumb (entry: ScheduleItem): string {
  return mediaUrl(entry.release.poster.optimized?.thumbnail ?? entry.release.poster.thumbnail)
}

function status (entry: ScheduleItem): string {
  if (entry.published_release_episode) return `Вышла серия ${entry.published_release_episode.ordinal}`
  if (entry.next_release_episode_number) return `Серия ${entry.next_release_episode_number}`
  return 'Ожидается'
}
</script>

<style scoped>
.today {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 64px;
  padding: 4px 16px;
  border-radius: 16px;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--line);
}

.label {
  width: 140px;
  flex: none;
  display: flex;
  flex-direction: column;
}

.label b {
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--warm);
}

.label span {
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
  white-space: nowrap;
}

.list {
  flex: 1;
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  grid-template-rows: 56px;
  column-gap: 16px;
}

.entry {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  border-radius: 8px;
  color: inherit;
  text-decoration: none;
}

.entry img {
  width: 32px;
  height: 48px;
  flex: none;
  border-radius: 6px;
  object-fit: cover;
  background: var(--surface-2);
}

.entry:hover .title {
  color: var(--accent);
}

.entry:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.more:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

.text {
  min-width: 0;
}

.title {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}

.status {
  font-size: 12px;
  line-height: 16px;
  color: var(--warm);
}

.status--out {
  color: var(--accent);
}

.more {
  flex: none;
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  color: var(--text-3);
  text-decoration: none;
  white-space: nowrap;
}

.more:hover {
  color: var(--text);
}
</style>
