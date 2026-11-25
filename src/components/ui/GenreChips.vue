<template>
  <div class="genres" role="toolbar" aria-label="Жанры">
    <div ref="strip" class="strip" @scroll.passive="update" @keydown="onKeydown">
      <button
        class="ui-btn chip"
        :class="{ 'chip--on': modelValue.length === 0 }"
        :aria-pressed="modelValue.length === 0"
        :tabindex="tabStop === 0 ? 0 : -1"
        @focus="current = 0"
        @click="clearAll"
      >
        Все жанры
      </button>
      <button
        v-for="(genre, i) in genres"
        :key="genre.id"
        class="ui-btn chip"
        :class="{ 'chip--on': modelValue.includes(genre.id) }"
        :aria-pressed="modelValue.includes(genre.id)"
        :tabindex="tabStop === i + 1 ? 0 : -1"
        @focus="current = i + 1"
        @click="toggle(genre.id)"
      >
        {{ genre.name }}
      </button>
    </div>
    <button v-show="canLeft" class="ui-btn edge edge--left" tabindex="-1" aria-hidden="true" @mousedown.prevent @click="scrollBy(-1)">
      <v-icon icon="mdi-chevron-left" size="20" />
    </button>
    <button v-show="canRight" class="ui-btn edge edge--right" tabindex="-1" aria-hidden="true" @mousedown.prevent @click="scrollBy(1)">
      <v-icon icon="mdi-chevron-right" size="20" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Genre } from '@/api/types'

const props = defineProps<{ genres: Genre[], modelValue: number[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>()

const strip = ref<HTMLElement | null>(null)
const canLeft = ref(false)
const canRight = ref(false)

const current = ref<number | null>(null)

const tabStop = computed(() => {
  if (current.value != null && current.value <= props.genres.length) return current.value
  const i = props.genres.findIndex(g => props.modelValue.includes(g.id))
  return i + 1
})

function clearAll (): void {
  // Новый [] перезагрузил бы каталог
  if (props.modelValue.length) emit('update:modelValue', [])
}

function toggle (id: number): void {
  const value = props.modelValue
  emit('update:modelValue', value.includes(id) ? value.filter(v => v !== id) : [...value, id])
}

function onKeydown (e: KeyboardEvent): void {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const chips = Array.from(strip.value?.querySelectorAll<HTMLElement>('.chip') ?? [])
  const from = chips.indexOf(e.target as HTMLElement)
  if (from < 0) return
  const to = e.key === 'ArrowRight' ? Math.min(from + 1, chips.length - 1)
    : e.key === 'ArrowLeft' ? Math.max(from - 1, 0)
      : e.key === 'Home' ? 0
        : e.key === 'End' ? chips.length - 1
          : null
  if (to == null) return
  e.preventDefault()
  const el = chips[to]
  // Прокручиваем сами: scrollIntoView учитывает scroll-padding, и чип не уходит под затухание
  el.focus({ preventScroll: true })
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

function update (): void {
  const el = strip.value
  if (!el) return
  canLeft.value = el.scrollLeft > 4
  canRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

function scrollBy (direction: 1 | -1): void {
  strip.value?.scrollBy({ left: direction * (strip.value.clientWidth * 0.7), behavior: 'smooth' })
}

const observer = new ResizeObserver(update)
onMounted(() => {
  if (strip.value) observer.observe(strip.value)
  update()
})
onBeforeUnmount(() => observer.disconnect())
watch(() => props.genres, () => {
  current.value = null
  nextTick(update)
})
</script>

<style scoped>
.genres {
  position: relative;
}

.strip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  /* Запас под кольцо фокуса, иначе лента его обрезает */
  padding: 4px;
  margin: -4px;
  scroll-padding-inline: 52px;
}

.strip::-webkit-scrollbar {
  display: none;
}

.chip {
  height: 28px;
  flex: none;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(30, 33, 41, 0.72);
  box-shadow: inset 0 0 0 1px var(--line-2);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: background-color 0.15s, color 0.15s;
}

.chip:hover {
  color: var(--text);
}

.chip--on {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px rgba(92, 225, 230, 0.4);
  color: var(--accent);
}

.chip:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.edge {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 48px;
  display: grid;
  align-items: center;
  color: var(--text);
}

.edge--left {
  left: -4px;
  justify-items: start;
  background: linear-gradient(90deg, var(--bg) 40%, transparent);
}

.edge--right {
  right: -4px;
  justify-items: end;
  background: linear-gradient(270deg, var(--bg) 40%, transparent);
}
</style>
