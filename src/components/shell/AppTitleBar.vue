<template>
  <header class="bar" :class="{ 'bar--solid': solid }" data-tauri-drag-region>
    <div class="brand" data-tauri-drag-region>
      <span class="brand-cell" data-tauri-drag-region>
        <img class="mark" :src="markUrl" alt="" draggable="false" data-tauri-drag-region>
      </span>
      <span class="brand-name" data-tauri-drag-region>Animoon</span>
    </div>

    <button v-if="canGoBack" class="ui-btn icon-btn icon-btn--glass" title="Назад (Alt ←)" aria-label="Назад" @click="router.back()">
      <v-icon icon="mdi-arrow-left" size="20" />
    </button>

    <div class="drag" data-tauri-drag-region />

    <app-search />
    <app-notifications />

    <template v-if="isTauri">
      <span class="sep" />
      <window-controls />
    </template>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppNotifications from '@/components/AppNotifications.vue'
import AppSearch from '@/components/AppSearch.vue'
// ?no-inline: иначе Vite заинлайнит SVG как data:, а CSP img-src data: не пускает
import markUrl from '@/assets/brand/mark.svg?no-inline'
import { isTauri } from '@/utils/window'
import WindowControls from './WindowControls.vue'

defineProps<{ solid: boolean }>()

const router = useRouter()
const route = useRoute()

const historyState = ref(window.history.state as { back?: unknown } | null)
// Панель пересоздаётся после полноэкранного плеера, хук снимается вместе с ней
const removeAfterEach = router.afterEach(() => { historyState.value = window.history.state })
const canGoBack = computed(() => route.name !== 'releases' && historyState.value?.back != null)

onBeforeUnmount(removeAfterEach)
</script>

<style scoped>
.bar {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  z-index: 30;
  height: var(--bar-height);
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: calc(var(--bar-height) * 2);
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(6, 7, 10, 0.78), rgba(6, 7, 10, 0));
  transition: background 0.2s, height 0.2s;
}

.bar--solid::before {
  height: var(--bar-height);
  background: rgba(11, 12, 16, 0.94);
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  flex: none;
  margin-right: 8px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.brand-cell {
  width: var(--rail-width);
  height: var(--bar-height);
  display: grid;
  place-items: center;
}

.mark {
  width: 30px;
  height: 30px;
}

.drag {
  flex: 1;
  align-self: stretch;
}

.icon-btn {
  width: 36px;
  height: 36px;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--text);
  font-size: 20px;
}

.icon-btn--glass {
  background: var(--glass);
  border: 1px solid var(--glass-line);
}

.icon-btn:hover {
  background: rgba(40, 44, 54, 0.85);
}

.sep {
  width: 1px;
  height: 20px;
  margin: 0 0 0 8px;
  background: var(--line-2);
  flex: none;
}

button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

@media (max-width: 1100px) {
  .brand-name {
    display: none;
  }
}
</style>
