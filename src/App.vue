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
  </v-app>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { type RouteLocationNormalizedLoaded, useRoute, useRouter } from 'vue-router'
import AppRail from '@/components/shell/AppRail.vue'
import AppTitleBar from '@/components/shell/AppTitleBar.vue'
import { useAccountStore } from '@/stores/account'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { useNotificationsStore } from '@/stores/notifications'
import { useProgressStore } from '@/stores/progress'

const route = useRoute()
const router = useRouter()
const account = useAccountStore()
const progress = useProgressStore()
const notifications = useNotificationsStore()
const episodeIndex = useEpisodeIndexStore()

// В плеере общей панели окна нет: у плеера своя полоса с названием и кнопками окна.
const hideChrome = computed(() => route.meta.fullscreenLayout === true)
// В плеере колонки разделов нет: всё место под видео.
const showRail = computed(() => route.meta.fullscreenLayout !== true)
// Экраны с афишей: содержимое начинается под прозрачной панелью окна.
const isHero = computed(() => route.meta.hero === true)

// Над афишей панель прозрачная, пока страницу не прокрутили.
const scrolled = ref(false)
const barSolid = computed(() => !isHero.value || scrolled.value)
function onScroll (): void {
  scrolled.value = (mainEl.value?.scrollTop ?? 0) > 8
}

// Списки живут между переходами (сохраняют прокрутку), остальные экраны создаются заново.
const LISTS = new Set(['releases', 'catalog', 'schedule', 'favorites'])
function keepAliveKey (current: RouteLocationNormalizedLoaded): string {
  return LISTS.has(String(current.name)) ? String(current.name) : current.fullPath
}

// Прокручивается область содержимого, а не окно, поэтому позицию для списков запоминаем сами.
const mainEl = ref<HTMLElement | null>(null)
const scrollPositions = new Map<string, number>()
router.beforeEach((_to, from) => {
  if (mainEl.value) scrollPositions.set(keepAliveKey(from), mainEl.value.scrollTop)
})
router.afterEach(async (to, _from, failure) => {
  // Отменённая, прерванная или повторная навигация: остаёмся, где были.
  if (failure) return
  await nextTick()
  if (mainEl.value) mainEl.value.scrollTop = scrollPositions.get(keepAliveKey(to)) ?? 0
  onScroll()
})

// Повторный клик по текущему разделу в колонке — плавно наверх.
function scrollToTop (): void {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  mainEl.value?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
}

onMounted(async () => {
  await account.init()
  notifications.start()
  await progress.sync()
  // Узнать релизы для серий из прогресса — для отметок «N серий из M» на карточках.
  void episodeIndex.resolveUnknown()
})

// Перед закрытием окна отправить несохранённые тайм-коды.
window.addEventListener('beforeunload', () => { void progress.flush() })
// Вернулись в окно (например, после просмотра на сайте) — подтянуть свежие тайм-коды.
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

/* Полоса прокрутки начинается ниже панели окна, а не под кнопкой «Закрыть». */
.main--bar::-webkit-scrollbar-track {
  margin-top: var(--bar-height);
}
</style>
