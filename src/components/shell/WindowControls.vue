<template>
  <div v-if="isTauri" class="window-controls">
    <button class="ui-btn win-btn" title="Свернуть" aria-label="Свернуть" @click="windowControls.minimize()">
      <v-icon icon="mdi-window-minimize" size="16" />
    </button>
    <button
      class="ui-btn win-btn"
      :title="maximized ? 'Восстановить' : 'Развернуть'"
      :aria-label="maximized ? 'Восстановить' : 'Развернуть'"
      @click="windowControls.toggleMaximize()"
    >
      <v-icon :icon="maximized ? 'mdi-window-restore' : 'mdi-window-maximize'" size="16" />
    </button>
    <button class="ui-btn win-btn win-btn--close" title="Закрыть" aria-label="Закрыть" @click="windowControls.close()">
      <v-icon icon="mdi-window-close" size="16" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { isTauri, windowControls } from '@/utils/window'

const maximized = ref(false)
async function updateMaximized (): Promise<void> {
  maximized.value = await windowControls.isMaximized()
}

let unlistenResize: (() => void) | undefined
let alive = true
onMounted(async () => {
  if (!isTauri) return
  await updateMaximized()
  const unlisten = await windowControls.onResized(() => { void updateMaximized() })
  // Компонент могли размонтировать, пока ждали подписку
  if (alive) unlistenResize = unlisten
  else unlisten?.()
})
onBeforeUnmount(() => {
  alive = false
  unlistenResize?.()
})
</script>

<style scoped>
.window-controls {
  display: flex;
  align-self: stretch;
}

.win-btn {
  width: 46px;
  height: var(--bar-height);
  display: grid;
  place-items: center;
  color: var(--text-2);
  transition: background-color 0.12s, color 0.12s;
}

.win-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.win-btn--close:hover {
  background: #c42b1c;
  color: #fff;
}

.win-btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
</style>
