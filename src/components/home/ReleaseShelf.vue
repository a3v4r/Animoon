<template>
  <section class="shelf">
    <header class="head">
      <h2 class="font-display">{{ title }}</h2>
      <span v-if="subtitle" class="sub">{{ subtitle }}</span>
      <router-link v-if="moreTo" class="more" :to="moreTo">Все <v-icon icon="mdi-chevron-right" size="18" /></router-link>
    </header>

    <div class="viewport">
      <button v-show="canScrollLeft" class="ui-btn nav nav--left" title="Назад" aria-label="Прокрутить назад" @click="scrollBy(-1)">
        <v-icon icon="mdi-chevron-left" size="28" />
      </button>
      <!-- Колесо мыши прокручивает страницу; полку листают стрелки, Shift + колесо или жест тачпада. -->
      <div ref="strip" class="strip" @scroll.passive="updateArrows">
        <div v-for="release in releases" :key="release.id" class="item">
          <release-card compact :release="release" />
        </div>
        <router-link v-if="moreTo" class="all" :to="moreTo">
          <v-icon icon="mdi-arrow-right" size="24" />
          Все
        </router-link>
      </div>
      <button v-show="canScrollRight" class="ui-btn nav nav--right" title="Дальше" aria-label="Прокрутить дальше" @click="scrollBy(1)">
        <v-icon icon="mdi-chevron-right" size="28" />
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import type { Release } from '@/api/types'
import ReleaseCard from '@/components/ReleaseCard.vue'

const props = defineProps<{
  title: string
  subtitle?: string
  releases: Release[]
  moreTo?: RouteLocationRaw
}>()

const strip = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)
let savedScroll = 0

function updateArrows (): void {
  const el = strip.value
  if (!el || !el.isConnected) return
  canScrollLeft.value = el.scrollLeft > 4
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
}

/** Прокрутить на ширину видимой части. */
function scrollBy (direction: 1 | -1): void {
  const el = strip.value
  if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' })
}

watch(() => props.releases.length, async () => {
  await nextTick()
  updateArrows()
})

// Стрелки пересчитываются при любом изменении размера полки (окно, колонка разделов).
const observer = new ResizeObserver(updateArrows)
onMounted(() => {
  if (strip.value) observer.observe(strip.value)
  updateArrows()
})
onBeforeUnmount(() => observer.disconnect())

// Главная живёт между переходами: вернуть полку на прежнее место.
onDeactivated(() => { savedScroll = strip.value?.scrollLeft ?? 0 })
onActivated(async () => {
  await nextTick()
  if (strip.value) strip.value.scrollLeft = savedScroll
  updateArrows()
})
</script>

<style scoped>
/* Размеры карточки в одном месте: от них зависят высота плитки «Все» и стрелок. */
.shelf {
  --card-w: 136px;
  --poster-h: calc(var(--card-w) * 1.5);
}

.head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.head h2 {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
}

.sub {
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

.more {
  margin-left: auto;
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

.viewport {
  position: relative;
}

.strip {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  scrollbar-width: none;
  padding: 4px 2px 8px;
  margin: -4px -2px -8px;
}

.strip::-webkit-scrollbar {
  display: none;
}

.item {
  flex: none;
  width: var(--card-w);
}

.all {
  flex: none;
  width: 76px;
  height: var(--poster-h);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: 10px;
  background: var(--surface);
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--text-2);
  font-size: 13px;
  text-decoration: none;
}

.all:hover {
  color: var(--text);
  background: var(--surface-2);
}

/* Стрелки по краям полки поверх постеров. */
.nav {
  position: absolute;
  top: 0;
  z-index: 2;
  width: 40px;
  height: var(--poster-h);
  display: grid;
  place-items: center;
  color: var(--text);
  opacity: 0;
  transition: opacity 0.15s;
}

.viewport:hover .nav,
.nav:focus-visible {
  opacity: 1;
}

.nav--left {
  left: -16px;
  background: linear-gradient(90deg, var(--bg) 30%, transparent);
}

.nav--right {
  right: -16px;
  background: linear-gradient(270deg, var(--bg) 30%, transparent);
}
</style>
