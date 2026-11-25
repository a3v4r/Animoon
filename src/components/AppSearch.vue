<template>
  <!-- Корень - div, а не v-menu: класс с родителя на v-menu уехал бы в оверлей -->
  <div class="search-root" :class="{ 'search-root--wide': focused || open }">
    <v-menu
      v-model="open"
      :close-on-content-click="true"
      :open-on-click="false"
      location="bottom end"
      max-height="480"
      max-width="440"
      offset="6"
    >
      <template #activator="{ props: menuProps }">
        <label v-bind="menuProps" class="search" :class="{ 'search--focus': focused }">
          <v-icon class="icon" :icon="loading ? 'mdi-loading mdi-spin' : 'mdi-magnify'" size="18" />
          <input
            ref="input"
            v-model="query"
            class="input"
            placeholder="Поиск и переход"
            spellcheck="false"
            @blur="focused = false"
            @focus="onFocus"
            @keydown.enter="openFirst"
            @keydown.esc="clear"
          >
          <kbd v-if="!query" class="kbd">Ctrl K</kbd>
          <button v-else class="ui-btn clear" title="Очистить" aria-label="Очистить" @mousedown.prevent="clear">
            <v-icon icon="mdi-close" size="16" />
          </button>
        </label>
      </template>

      <v-list v-if="hasQuery" class="results" density="compact">
        <v-list-item
          v-for="section in sections"
          :key="section.name"
          :prepend-icon="section.icon"
          :title="section.title"
          :to="{ name: section.name }"
          subtitle="Раздел"
        />
        <v-divider v-if="sections.length && results.length" />
        <!-- Без этой строки открытое меню во время загрузки - пустая полоска -->
        <v-list-item v-if="!searched && results.length === 0 && sections.length === 0" title="Ищем…" />
        <v-list-item v-if="!loading && searched && results.length === 0 && sections.length === 0" title="Ничего не нашлось" />
        <v-list-item
          v-for="release in results"
          :key="release.id"
          :subtitle="[release.type?.description, release.year].filter(Boolean).join(' · ')"
          :title="release.name.main"
          :to="{ name: 'release', params: { id: release.id } }"
        >
          <template #prepend>
            <v-avatar rounded="sm" size="40">
              <v-img :src="mediaUrl(release.poster.optimized?.thumbnail ?? release.poster.thumbnail)" cover />
            </v-avatar>
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { mediaUrl } from '@/api/http'
import { searchReleases } from '@/api/releases'
import type { Release } from '@/api/types'
import { matchSections } from '@/router/sections'

const router = useRouter()
const route = useRoute()

const input = ref<HTMLInputElement | null>(null)
const query = ref('')
const results = ref<Release[]>([])
const loading = ref(false)
const open = ref(false)
const focused = ref(false)
// Чтобы не мигало «Ничего не нашлось», пока идёт ввод
const searched = ref(false)

const sections = computed(() => matchSections(query.value))
const hasQuery = computed(() => query.value.trim().length > 0)

let timer: number | undefined
let requestId = 0

watch(query, value => {
  window.clearTimeout(timer)
  const text = value.trim()
  searched.value = false
  results.value = []
  open.value = text.length > 0 && (sections.value.length > 0 || text.length >= 2)
  if (text.length < 2) return
  timer = window.setTimeout(async () => {
    const id = ++requestId
    loading.value = true
    try {
      const found = await searchReleases(text)
      if (id === requestId) results.value = found
    } catch {
      if (id === requestId) results.value = []
    } finally {
      if (id === requestId) {
        loading.value = false
        searched.value = true
        open.value = query.value.trim().length > 0
      }
    }
  }, 350)
})

watch(() => route.fullPath, clear)

function onFocus (): void {
  focused.value = true
  if (sections.value.length > 0 || query.value.trim().length >= 2) open.value = true
}

function clear (): void {
  window.clearTimeout(timer)
  requestId++
  loading.value = false
  query.value = ''
  open.value = false
}

function openFirst (): void {
  const section = sections.value[0]
  const first = results.value[0]
  if (!section && !first) return
  open.value = false
  void router.push(section ? { name: section.name } : { name: 'release', params: { id: first!.id } })
}

function onKey (event: KeyboardEvent): void {
  if ((event.ctrlKey || event.metaKey) && event.code === 'KeyK') {
    event.preventDefault()
    input.value?.focus()
    input.value?.select()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.search-root {
  flex: 0 1 320px;
  min-width: 180px;
  transition: flex-basis 0.2s ease;
}

.search-root--wide {
  flex-basis: 440px;
}

@media (prefers-reduced-motion: reduce) {
  .search-root {
    transition: none;
  }
}

.search {
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 0 12px;
  border-radius: 10px;
  background: var(--glass);
  border: 1px solid var(--glass-line);
  color: var(--text-3);
  cursor: text;
  transition: border-color 0.15s, background-color 0.15s;
}

.search--focus {
  border-color: rgba(92, 225, 230, 0.55);
  background: rgba(16, 18, 24, 0.9);
}

.icon {
  font-size: 18px;
}

.input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  -webkit-user-select: text;
  user-select: text;
}

.input::placeholder {
  color: var(--text-3);
}

.kbd {
  flex: none;
  padding: 0 4px;
  border: 1px solid var(--line-2);
  border-radius: 6px;
  font: inherit;
  font-size: 11px;
  line-height: 16px;
  color: var(--text-3);
}

.clear {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-2);
  font-size: 16px;
}

.clear:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>
