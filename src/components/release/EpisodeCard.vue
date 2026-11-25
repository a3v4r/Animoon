<template>
  <!-- Кнопка отметки - сосед ссылки, а не внутри: интерактив внутри <a> недопустим -->
  <div class="episode" :class="{ 'episode--seen': state === 'seen', 'episode--current': state === 'current' }">
    <div class="preview" aria-hidden="true">
      <img v-if="thumb" :src="thumb" alt="" loading="lazy">
      <span v-if="state === 'seen'" class="badge badge--sm badge--glass mark"><v-icon icon="mdi-check" /> Просмотрено</span>
      <span v-else-if="state === 'current'" class="badge badge--sm badge--accent mark">
        {{ resumeTime ? `Продолжить · ${resumeTime}` : 'Следующая' }}
      </span>
      <span v-if="state !== 'seen' && duration" class="badge badge--sm badge--glass duration">{{ duration }}</span>
      <span v-if="state === 'current'" class="play"><v-icon icon="mdi-play" size="24" /></span>
      <div v-if="progressRatio != null" class="bar" :class="{ 'bar--seen': state === 'seen' }">
        <i :style="{ width: `${progressRatio * 100}%` }" />
      </div>
    </div>

    <router-link class="link" :to="{ name: 'watch', params: { id: episode.release_id, ordinal: episode.ordinal } }">
      <span class="number">Серия {{ episode.ordinal }}</span>
      <span class="name ell" :title="episode.name ?? undefined">{{ episode.name || '—' }}</span>
      <span v-if="statusText" class="d-sr-only">, {{ statusText }}</span>
    </router-link>

    <button
      class="ui-btn toggle"
      :class="{ 'toggle--on': state === 'seen' }"
      :aria-label="`Серия ${episode.ordinal} просмотрена`"
      :aria-pressed="state === 'seen'"
      :title="state === 'seen' ? 'Снять отметку «просмотрено»' : 'Отметить просмотренной'"
      @click="emit('toggle-watched')"
    >
      <v-icon :icon="state === 'seen' ? 'mdi-check-circle' : 'mdi-check-circle-outline'" size="18" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { mediaUrl } from '@/api/http'
import type { Episode } from '@/api/types'
import type { EpisodeProgress } from '@/stores/progress'
import { formatDuration } from '@/utils/time'

const props = defineProps<{
  episode: Episode
  progress: EpisodeProgress | undefined
  state: 'seen' | 'current' | 'other'
}>()

const emit = defineEmits<{ 'toggle-watched': [] }>()

const thumb = computed(() => {
  const preview = props.episode.preview
  return mediaUrl(preview?.optimized?.preview ?? preview?.optimized?.src ?? preview?.preview)
})

const duration = computed(() => (props.episode.duration ? formatDuration(props.episode.duration) : ''))

const resumeTime = computed(() => {
  const p = props.progress
  return p && !p.watched && p.time > 10 ? formatDuration(p.time) : ''
})

const progressRatio = computed(() => {
  if (props.state === 'seen') return 1
  const p = props.progress
  if (!p || p.time <= 10 || !props.episode.duration) return null
  return Math.min(1, p.time / props.episode.duration)
})

const statusText = computed(() => {
  if (props.state === 'seen') return 'просмотрена'
  if (props.state === 'current') return resumeTime.value ? `следующая, продолжить с ${resumeTime.value}` : 'следующая'
  return ''
})
</script>

<style scoped>
.episode {
  position: relative;
  min-width: 0;
}

.preview {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 10px;
  background: var(--surface-2);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}

.preview img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.episode--seen .preview img {
  filter: brightness(0.55) saturate(0.8);
}

.episode--current .preview {
  box-shadow: 0 0 0 2px var(--accent);
}

.episode:hover .preview {
  transform: translateY(-2px);
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35), 0 12px 28px rgba(0, 0, 0, 0.45);
}

.episode--current:hover .preview {
  box-shadow: 0 0 0 2px var(--accent), 0 12px 28px rgba(0, 0, 0, 0.45);
}

.episode:has(.link:focus-visible) .preview {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--text);
}

.mark {
  position: absolute;
  left: 8px;
  top: 8px;
}

.duration {
  position: absolute;
  right: 8px;
  bottom: 10px;
}

.play {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 44px;
  height: 44px;
  margin: -22px 0 0 -22px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: rgba(8, 9, 12, 0.56);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.bar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 4px;
  background: rgba(255, 255, 255, 0.16);
}

.bar > i {
  display: block;
  height: 100%;
  background: var(--accent);
}

.bar--seen > i {
  background: rgba(255, 255, 255, 0.7);
}

.link {
  display: block;
  color: inherit;
  text-decoration: none;
  outline: none;
}

.link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 10px;
}

.number {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  line-height: 16px;
  color: var(--text-3);
}

.name {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.episode--seen .name {
  color: var(--text-2);
}

.toggle {
  position: absolute;
  z-index: 2;
  right: 8px;
  top: 8px;
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: rgba(8, 9, 12, 0.72);
  box-shadow: inset 0 0 0 1px var(--glass-line);
  color: var(--text);
  opacity: 0;
  transition: opacity 0.15s;
}

.toggle--on {
  color: var(--accent);
}

.episode:hover .toggle,
.toggle:focus-visible,
.toggle--on {
  opacity: 1;
}

.toggle:hover {
  background: rgba(30, 33, 41, 0.92);
}

.toggle:focus-visible {
  outline: 2px solid var(--accent);
}
</style>
