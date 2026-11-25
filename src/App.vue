<template>
  <v-app>
    <app-title-bar v-if="!hideChrome" :solid="barSolid" />
    <app-rail v-if="showRail" @reselect="scrollToTop" />
    <main
      ref="mainEl"
      class="main"
      :class="{ 'main--rail': showRail, 'main--bar': !hideChrome, 'main--under-bar': !hideChrome && !isHero }"
      @scroll.passive="onScroll"
    >
      <router-view v-slot="{ Component, route: current }">
        <keep-alive :include="['ReleasesView', 'CatalogView', 'ScheduleView', 'FavoritesView']">
          <component :is="Component" :key="keepAliveKey(current)" />
        </keep-alive>
      </router-view>
    </main>
    <update-banner :hide-plaque="hideChrome" />
  </v-app>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { type RouteLocationNormalizedLoaded, useRoute, useRouter } from 'vue-router'
import AppRail from '@/components/shell/AppRail.vue'
import AppTitleBar from '@/components/shell/AppTitleBar.vue'
import UpdateBanner from '@/components/shell/UpdateBanner.vue'
import { useAccountStore } from '@/stores/account'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { useNotificationsStore } from '@/stores/notifications'
import { useProgressStore } from '@/stores/progress'
import { useUpdaterStore } from '@/stores/updater'

const route = useRoute()
const router = useRouter()
const account = useAccountStore()
const progress = useProgressStore()
const notifications = useNotificationsStore()
const episodeIndex = useEpisodeIndexStore()

const hideChrome = computed(() => route.meta.fullscreenLayout === true)
const showRail = computed(() => route.meta.fullscreenLayout !== true)
const isHero = computed(() => route.meta.hero === true)

const scrolled = ref(false)
const barSolid = computed(() => !isHero.value || scrolled.value)
function onScroll (): void {
  scrolled.value = (mainEl.value?.scrollTop ?? 0) > 8
}

// списки по имени (одна копия в keep-alive), остальное по fullPath, чтобы пересоздавалось
const LISTS = new Set(['releases', 'catalog', 'schedule', 'favorites'])
function keepAliveKey (current: RouteLocationNormalizedLoaded): string {
  return LISTS.has(String(current.name)) ? String(current.name) : current.fullPath
}

// скроллится main, а не окно, поэтому позицию списков запоминаем сами
const mainEl = ref<HTMLElement | null>(null)
const scrollPositions = new Map<string, number>()
router.beforeEach((_to, from) => {
  if (mainEl.value) scrollPositions.set(keepAliveKey(from), mainEl.value.scrollTop)
})
router.afterEach(async (to, _from, failure) => {
  if (failure) return
  await nextTick()
  if (mainEl.value) mainEl.value.scrollTop = scrollPositions.get(keepAliveKey(to)) ?? 0
  onScroll()
})

function scrollToTop (): void {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  mainEl.value?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
}

const updater = useUpdaterStore()

onMounted(async () => {
  updater.start()
  await account.init()
  notifications.start()
  await progress.sync()
  void episodeIndex.resolveUnknown()
})

window.addEventListener('beforeunload', () => { void progress.flush() })
window.addEventListener('focus', () => { void progress.sync(false) })
</script>

<style scoped>
.main {
  position: fixed;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--bg);
}

.main--rail {
  left: var(--rail-width);
}

.main--under-bar {
  padding-top: var(--bar-height);
}

.main--bar::-webkit-scrollbar-track {
  margin-top: var(--bar-height);
}
</style>
