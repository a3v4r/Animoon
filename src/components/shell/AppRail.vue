<template>
  <nav class="rail" aria-label="Разделы">
    <router-link
      v-for="item in items"
      :key="item.name"
      v-slot="{ href, navigate }"
      :to="{ name: item.name }"
      custom
    >
      <a
        :href="href"
        class="rail-item"
        :class="{ 'rail-item--active': isActive(item.name) }"
        :title="item.title"
        :aria-label="item.title"
        :aria-current="isActive(item.name) ? 'page' : undefined"
        @click="onClick($event, item.name, navigate)"
      >
        <v-icon :icon="isActive(item.name) ? item.activeIcon : item.icon" size="22" />
      </a>
    </router-link>

    <span class="spacer" />

    <router-link v-slot="{ href, navigate }" :to="{ name: 'settings' }" custom>
      <a
        :href="href"
        class="rail-item"
        :class="{ 'rail-item--active': isActive('settings') }"
        title="Настройки"
        aria-label="Настройки"
        :aria-current="isActive('settings') ? 'page' : undefined"
        @click="onClick($event, 'settings', navigate)"
      >
        <v-icon icon="mdi-cog-outline" size="22" />
      </a>
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { SECTIONS } from '@/router/sections'

const emit = defineEmits<{ reselect: [] }>()

const route = useRoute()

const items = SECTIONS

function isActive (name: string): boolean {
  return route.name === name
}

function onClick (e: MouseEvent, name: string, navigate: (e?: MouseEvent) => unknown): void {
  if (isActive(name)) {
    e.preventDefault()
    emit('reselect')
    return
  }
  void navigate(e)
}
</script>

<style scoped>
.rail {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  z-index: 20;
  width: var(--rail-width);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: calc(var(--bar-height) + 16px) 0 16px;
  background: rgba(11, 12, 16, 0.8);
  border-right: 1px solid var(--line);
}

.rail-item {
  position: relative;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--text-3);
  font-size: 22px;
  text-decoration: none;
  transition: background-color 0.15s, color 0.15s;
}

.rail-item:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.06);
}

.rail-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.rail-item--active,
.rail-item--active:hover {
  color: var(--accent);
  background: var(--accent-soft);
}

.rail-item--active::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 10px;
  width: 4px;
  height: 20px;
  border-radius: 0 2px 2px 0;
  background: var(--accent);
}

.spacer {
  flex: 1;
}
</style>
