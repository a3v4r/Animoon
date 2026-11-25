<template>
  <div
    ref="bar"
    class="seek"
    role="slider"
    aria-label="Перемотка"
    :aria-valuemax="Math.round(duration)"
    :aria-valuemin="0"
    :aria-valuenow="Math.round(ariaTime)"
    :aria-valuetext="`${formatDuration(ariaTime)} из ${formatDuration(duration)}`"
    tabindex="0"
    @blur="focused = false"
    @focus="onFocus"
    @keydown="onKeydown"
    @mousedown="startDrag"
    @mouseleave="hover = null"
    @mousemove="onHover"
  >
    <div class="track" />
    <div class="buffered" :style="{ width: percent(buffered) }" />
    <div class="played" :style="{ width: percent(dragTime ?? current) }" />
    <div
      v-for="mark in marks"
      :key="mark.kind"
      class="mark"
      :class="{ 'mark--hover': hoverMark === mark }"
      :style="{ left: percent(mark.start), width: percent(mark.stop - mark.start) }"
    />
    <span v-if="endingMark && hoverMark !== endingMark" class="mark-label" :style="{ left: percent((endingMark.start + endingMark.stop) / 2) }">
      Эндинг
    </span>
    <div class="thumb" :style="{ left: percent(dragTime ?? current) }" />

    <div v-if="hover != null" class="tooltip" :class="tooltipAlign" :style="{ left: percent(hover) }">
      <template v-if="hoverMark">
        <b>{{ hoverMark.kind === 'opening' ? 'Опенинг' : 'Эндинг' }}</b>
        {{ formatDuration(hoverMark.start) }}–{{ formatDuration(hoverMark.stop) }}
        <template v-if="hoverMark.kind === 'opening'"> · пропустить <kbd>S</kbd></template>
      </template>
      <template v-else>{{ formatDuration(hover) }}</template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { formatDuration } from '@/utils/time'

export interface SeekMark {
  kind: 'opening' | 'ending'
  start: number
  stop: number
}

const props = defineProps<{
  current: number
  duration: number
  buffered: number
  marks: SeekMark[]
}>()

const emit = defineEmits<{ seek: [time: number] }>()

const bar = ref<HTMLElement | null>(null)
// В фокусе aria-значение меняется только при перемотке, иначе диктор читает время без конца
const focused = ref(false)
const frozenTime = ref(0)
const ariaTime = computed(() => (focused.value ? frozenTime.value : props.current))

function onFocus (): void {
  focused.value = true
  frozenTime.value = props.current
}

function seekTo (time: number): void {
  const target = Math.min(Math.max(0, time), props.duration || time)
  frozenTime.value = target
  emit('seek', target)
}
const hover = ref<number | null>(null)
const dragTime = ref<number | null>(null)

const endingMark = computed(() => props.marks.find(m => m.kind === 'ending'))
const hoverMark = computed(() => {
  const time = hover.value
  return time == null ? undefined : props.marks.find(m => time >= m.start && time <= m.stop)
})

const tooltipAlign = computed(() => {
  if (hover.value == null || !props.duration) return ''
  const ratio = hover.value / props.duration
  if (ratio < 0.12) return 'tooltip--start'
  if (ratio > 0.88) return 'tooltip--end'
  return ''
})

function percent (time: number): string {
  if (!props.duration) return '0%'
  return `${Math.min(100, Math.max(0, (time / props.duration) * 100))}%`
}

function timeAt (clientX: number): number {
  const rect = bar.value?.getBoundingClientRect()
  if (!rect || !props.duration) return 0
  return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)) * props.duration
}

function onHover (event: MouseEvent): void {
  hover.value = timeAt(event.clientX)
}

function onDrag (event: MouseEvent): void {
  dragTime.value = timeAt(event.clientX)
  hover.value = dragTime.value
}

function stopDrag (event: MouseEvent): void {
  seekTo(timeAt(event.clientX))
  dragTime.value = null
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
}

function startDrag (event: MouseEvent): void {
  if (event.button !== 0) return
  dragTime.value = timeAt(event.clientX)
  window.addEventListener('mousemove', onDrag)
  window.addEventListener('mouseup', stopDrag)
}

// stopPropagation: иначе плеер перемотает второй раз
function onKeydown (event: KeyboardEvent): void {
  const step = { ArrowLeft: -5, ArrowRight: 5, PageDown: -30, PageUp: 30 }[event.key]
  if (step != null) seekTo(ariaTime.value + step)
  else if (event.key === 'Home') seekTo(0)
  else if (event.key === 'End') seekTo(props.duration)
  else return
  event.preventDefault()
  event.stopPropagation()
}

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onDrag)
  window.removeEventListener('mouseup', stopDrag)
})
</script>

<style scoped>
.seek {
  position: relative;
  height: 16px;
  cursor: pointer;
  outline: none;
}

.track,
.buffered,
.played,
.mark {
  position: absolute;
  top: 6px;
  height: 4px;
  border-radius: 2px;
  transition: top 0.1s, height 0.1s;
}

.seek:hover .track,
.seek:hover .buffered,
.seek:hover .played,
.seek:hover .mark {
  top: 5px;
  height: 6px;
}

.track {
  left: 0;
  right: 0;
  background: rgba(255, 255, 255, 0.2);
}

.buffered {
  left: 0;
  background: rgba(255, 255, 255, 0.34);
}

.played {
  left: 0;
  background: var(--accent);
}

.mark {
  background: var(--warm);
  border-radius: 0;
  box-shadow: -2px 0 0 rgba(14, 16, 22, 0.9), 2px 0 0 rgba(14, 16, 22, 0.9);
}

.seek .mark--hover {
  top: 4px;
  height: 8px;
  border-radius: 2px;
}

.mark-label {
  position: absolute;
  top: -14px;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 600;
  line-height: 12px;
  color: var(--warm);
  white-space: nowrap;
  pointer-events: none;
}

.thumb {
  position: absolute;
  top: 1px;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 4px rgba(92, 225, 230, 0.3);
  transform: scale(0.7);
  transition: transform 0.1s;
}

.seek:hover .thumb,
.seek:focus-visible .thumb {
  transform: scale(1);
}

.seek:focus-visible .track {
  box-shadow: 0 0 0 2px var(--accent);
}

.tooltip {
  position: absolute;
  bottom: 26px;
  transform: translateX(-50%);
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(14, 16, 22, 0.92);
  box-shadow: inset 0 0 0 1px var(--glass-line);
  font-size: 12px;
  color: var(--text-2);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  pointer-events: none;
}

.tooltip--start {
  transform: translateX(-12px);
}

.tooltip--end {
  transform: translateX(calc(-100% + 12px));
}

.tooltip b {
  color: var(--warm);
  font-weight: 600;
}

.tooltip kbd {
  margin-left: 4px;
  padding: 0 4px;
  border: 1px solid var(--line-2);
  border-radius: 5px;
  font: inherit;
  font-size: 11px;
}
</style>
