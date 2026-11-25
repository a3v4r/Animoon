<template>
  <!-- Живая область смонтирована всегда: диктор объявляет только изменения внутри уже существующей области. -->
  <div class="d-sr-only" role="status" aria-live="polite">{{ announcement }}</div>

  <transition name="slide">
    <aside v-if="updater.showBanner && !hidePlaque" class="update" aria-label="Обновление приложения">
      <span class="icon" aria-hidden="true"><v-icon :icon="icon" size="22" /></span>
      <div class="text">
        <div ref="titleEl" class="title" tabindex="-1">{{ title }}</div>
        <div class="sub" :class="{ 'sub--error': updater.installError }">{{ sub }}</div>
        <v-progress-linear
          v-if="updater.status === 'downloading'"
          class="bar"
          color="secondary"
          bg-color="white"
          rounded
          height="4"
          :model-value="updater.progress != null ? updater.progress * 100 : undefined"
          :indeterminate="updater.progress == null"
          aria-label="Скачивание обновления"
        />
      </div>
      <div v-if="updater.status === 'available'" class="actions">
        <v-btn color="secondary" size="small" @click="act(updater.install)">
          {{ updater.installError ? 'Повторить' : 'Обновить' }}
        </v-btn>
        <v-btn variant="text" size="small" @click="updater.dismiss">Позже</v-btn>
      </div>
      <div v-else-if="updater.status === 'ready'" class="actions">
        <v-btn color="secondary" size="small" @click="act(updater.finish)">Установить</v-btn>
      </div>
    </aside>
  </transition>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useUpdaterStore } from '@/stores/updater'

/** В плеере плашку не показываем, но живая область остаётся смонтированной. */
defineProps<{ hidePlaque?: boolean }>()

const updater = useUpdaterStore()
const titleEl = ref<HTMLElement | null>(null)

/** После нажатия кнопка пропадает (меняется состояние) — фокус переводим на заголовок плашки, а не в никуда. */
function act (action: () => Promise<void>): void {
  const promise = action()
  void nextTick(() => {
    if (document.activeElement === document.body) titleEl.value?.focus()
  })
  void promise
}

const icon = computed(() => updater.installError ? 'mdi-alert-circle-outline' : 'mdi-arrow-up-bold-circle-outline')

const title = computed(() => {
  switch (updater.status) {
    case 'downloading': return `Скачивается версия ${updater.version}`
    case 'ready': return `Версия ${updater.version} скачана`
    case 'installing': return `Устанавливается версия ${updater.version}`
    default: return `Доступна версия ${updater.version}`
  }
})

const sub = computed(() => {
  if (updater.installError) return `Не удалось обновиться: ${updater.installError}.`
  switch (updater.status) {
    case 'downloading': return updater.progress != null ? `${Math.round(updater.progress * 100)}%` : 'Подождите…'
    case 'ready': return 'Установится, когда вы выйдете из плеера; приложение перезапустится.'
    case 'installing': return 'Приложение сейчас перезапустится.'
    default: return 'Приложение перезапустится после установки.'
  }
})

// Для диктора — только смены состояния, без процентов.
const announcement = computed(() => {
  if (!updater.showBanner) return ''
  return updater.installError ? `${title.value}. ${sub.value}` : title.value
})
</script>

<style scoped>
/* Плашка в правом нижнем углу, поверх содержимого; в плеере не показывается (App.vue). */
.update {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 20;
  width: min(420px, calc(100vw - 48px));
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line-2), 0 16px 40px rgba(0, 0, 0, 0.5);
}

.icon {
  flex: none;
  color: var(--accent);
}

.text {
  flex: 1;
  min-width: 0;
}

.title {
  font-size: 14px;
  font-weight: 600;
  outline: none;
}

.sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-3);
}

.sub--error {
  color: #ff8a80;
}

.bar {
  margin-top: 8px;
}

.actions {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateY(12px);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .slide-enter-active,
  .slide-leave-active {
    transition: none;
  }
}
</style>
