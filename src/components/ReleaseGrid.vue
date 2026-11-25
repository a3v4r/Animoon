<template>
  <div class="release-grid">
    <empty-state v-if="error && items.length === 0" alert icon="mdi-cloud-off-outline" title="Не удалось загрузить" :text="error">
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="emit('reset')">Повторить</v-btn>
    </empty-state>

    <v-infinite-scroll v-else :key="generation" :items="items" empty-text="" @load="onLoad">
      <div class="grid" @mouseover="onGridOver" @mouseleave="onGridLeave" @focusin="hideHover">
        <release-card v-for="release in items" :key="release.id" :release="release" :data-release-id="release.id" />
      </div>
      <template #empty>
        <empty-state v-if="items.length === 0" icon="mdi-movie-search-outline" :title="emptyText">
          <slot name="empty-action" />
        </empty-state>
      </template>
      <template #loading>
        <v-progress-circular indeterminate size="32" color="secondary" aria-label="Загрузка" />
      </template>
      <template #error="{ props: errorProps }">
        <v-btn variant="tonal" prepend-icon="mdi-refresh" v-bind="errorProps">Не загрузилось, повторить</v-btn>
      </template>
    </v-infinite-scroll>

    <release-hover-card
      :model-value="hoverOpen"
      :release="hoverRelease"
      :target="hoverTarget"
      @update:model-value="onHoverToggle"
      @enter="cancelClose"
      @leave="scheduleClose"
    />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, ref, shallowRef, watch } from 'vue'
import type { Release } from '@/api/types'
import ReleaseCard from './ReleaseCard.vue'
import ReleaseHoverCard from './ReleaseHoverCard.vue'
import EmptyState from './ui/EmptyState.vue'

type LoadStatus = 'ok' | 'empty' | 'error'

const OPEN_DELAY = 600
const CLOSE_DELAY = 150

const props = withDefaults(defineProps<{
  items: Release[]
  error: string
  generation: number
  emptyText?: string
}>(), { emptyText: 'Ничего не нашлось' })

const emit = defineEmits<{
  load: [payload: { done: (status: LoadStatus) => void }]
  reset: []
}>()

function onLoad (payload: { done: (status: LoadStatus) => void }): void {
  emit('load', payload)
}

const hoverOpen = ref(false)
const hoverRelease = shallowRef<Release | null>(null)
const hoverTarget = shallowRef<HTMLElement>()
let hoverCard: HTMLElement | null = null
let pendingCard: HTMLElement | null = null
let ignoredCard: HTMLElement | null = null
let openTimer = 0
let closeTimer = 0

function cancelClose (): void {
  window.clearTimeout(closeTimer)
}

function cardOf (event: Event): HTMLElement | null {
  return (event.target as Element | null)?.closest<HTMLElement>('[data-release-id]') ?? null
}

function onGridOver (event: MouseEvent): void {
  const card = cardOf(event)
  if (hoverOpen.value) {
    if (card === hoverCard) {
      cancelClose()
      return
    }
    scheduleClose()
  }
  if (card !== ignoredCard) ignoredCard = null
  if (card === pendingCard) return
  window.clearTimeout(openTimer)
  pendingCard = card && card !== ignoredCard ? card : null
  if (pendingCard) {
    const target = pendingCard
    openTimer = window.setTimeout(() => showHover(target), OPEN_DELAY)
  }
}

function onGridLeave (): void {
  window.clearTimeout(openTimer)
  pendingCard = null
  ignoredCard = null
  if (hoverOpen.value) scheduleClose()
}

function showHover (card: HTMLElement): void {
  pendingCard = null
  const id = Number(card.dataset.releaseId)
  const release = props.items.find(item => item.id === id)
  if (!release || !card.isConnected) return
  cancelClose()
  hoverCard = card
  hoverRelease.value = release
  hoverTarget.value = card.querySelector<HTMLElement>('.poster') ?? card
  hoverOpen.value = true
}

function scheduleClose (): void {
  cancelClose()
  closeTimer = window.setTimeout(() => {
    hoverOpen.value = false
    hoverCard = null
  }, CLOSE_DELAY)
}

function hideHover (): void {
  window.clearTimeout(openTimer)
  cancelClose()
  pendingCard = null
  hoverOpen.value = false
  hoverCard = null
}

// Закрыли Esc/прокруткой: не открывать снова, пока курсор на той же карточке
function onHoverToggle (value: boolean): void {
  if (value) return
  ignoredCard = hoverCard
  hideHover()
}

watch(() => props.generation, hideHover)
onDeactivated(hideHover)
// При деактивации v-menu закрывается сам, это не ручное закрытие
onActivated(() => { ignoredCard = null })
onBeforeUnmount(hideHover)
</script>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 24px 16px;
  width: 100%;
}

/* overflow от Vuetify режет фокус и подъём крайних карточек; подгрузку ловит IO с root = окно */
.release-grid :deep(.v-infinite-scroll) {
  overflow: visible;
}
</style>
