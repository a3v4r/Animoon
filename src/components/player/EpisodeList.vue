<template>
  <!-- Отдельный компонент, чтобы список не перерисовывался с каждым кадром плеера -->
  <aside ref="root" class="episodes" aria-label="Серии" @keydown.esc.stop="emit('close')">
    <header class="head">
      <b class="font-display">Серии</b>
      <span>{{ episodes.length }}</span>
      <button class="ui-btn close" title="Закрыть" aria-label="Закрыть список серий" @click="emit('close')">
        <v-icon icon="mdi-close" size="20" />
      </button>
    </header>
    <div ref="listEl" class="list">
      <button
        v-for="item in episodes"
        :key="item.id"
        class="ui-btn item"
        :class="{ 'item--current': item.id === currentId, 'item--seen': progress.get(item.id)?.watched }"
        :aria-current="item.id === currentId ? 'true' : undefined"
        @click="emit('select', item)"
      >
        <span class="thumb">
          <img v-if="thumbOf(item)" :src="thumbOf(item)" alt="" loading="lazy">
          <v-icon v-if="progress.get(item.id)?.watched" class="check" icon="mdi-check-circle" size="18" />
        </span>
        <span class="text">
          <span class="number">
            Серия {{ item.ordinal }}<template v-if="item.id === currentId"> · сейчас</template>
            <span v-if="progress.get(item.id)?.watched" class="d-sr-only">, просмотрена</span>
          </span>
          <span class="name clamp-2">{{ item.name || '—' }}</span>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { mediaUrl } from '@/api/http'
import type { Episode } from '@/api/types'
import { useProgressStore } from '@/stores/progress'

const props = defineProps<{
  episodes: Episode[]
  currentId: string | undefined
  focusOnOpen: boolean
}>()

const emit = defineEmits<{ select: [episode: Episode], close: [] }>()

const progress = useProgressStore()
const root = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

function thumbOf (item: Episode): string {
  const preview = item.preview
  return mediaUrl(preview?.optimized?.thumbnail ?? preview?.thumbnail ?? preview?.optimized?.preview)
}

function containsFocus (): boolean {
  return root.value?.contains(document.activeElement) ?? false
}

defineExpose({ containsFocus })

onMounted(async () => {
  await nextTick()
  const current = listEl.value?.querySelector<HTMLElement>('.item--current')
  current?.scrollIntoView({ block: 'center' })
  if (props.focusOnOpen) current?.focus()
})
</script>

<style scoped>
.episodes {
  position: absolute;
  top: 72px;
  right: 24px;
  bottom: 140px;
  width: 360px;
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  background: rgba(14, 16, 22, 0.82);
  backdrop-filter: blur(24px) saturate(1.4);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12), 0 16px 48px rgba(0, 0, 0, 0.5);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 8px 16px;
}

.head b {
  font-size: 15px;
  font-weight: 600;
}

.head span {
  font-size: 13px;
  color: var(--text-3);
}

.close {
  margin-left: auto;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--text-2);
}

.close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text);
}

.close:focus-visible,
.item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.item {
  width: 100%;
  display: flex;
  gap: 12px;
  padding: 8px;
  border-radius: 10px;
  text-align: left;
}

.item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.item--current {
  background: var(--accent-soft);
}

.thumb {
  position: relative;
  width: 112px;
  height: 63px;
  flex: none;
  overflow: hidden;
  border-radius: 8px;
  background: var(--surface-2);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item--seen .thumb img {
  filter: brightness(0.55);
}

.check {
  position: absolute;
  right: 6px;
  top: 6px;
  color: var(--accent);
}

.text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.number {
  font-size: 12px;
  color: var(--text-3);
}

.item--current .number {
  color: var(--accent);
}

.name {
  margin-top: 2px;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
}
</style>
