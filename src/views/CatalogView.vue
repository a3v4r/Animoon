<template>
  <div class="catalog">
    <!-- live-область всегда в DOM, иначе диктор её не прочитает -->
    <div class="d-sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</div>

    <page-header title="Каталог" :subtitle="summary" :class="{ 'catalog-head--stale': list.stale.value }">
      <template #actions>
        <div ref="actionsEl" class="filters-end">
          <filter-menu
            v-model="sortingModel"
            :label="sortingLabel"
            :aria-label="`Сортировка: ${sortingLabel}`"
            :items="sortingItems"
            :clearable="false"
            :highlight="false"
            icon="mdi-sort"
          />
          <button v-if="activeCount" class="ui-btn filter-chip" @click="resetFilters($event, () => actionsEl?.querySelector('button'))">
            <v-icon icon="mdi-close" size="18" />
            Сбросить · {{ activeCount }}
          </button>
        </div>
      </template>

      <div ref="filtersEl" class="filters">
        <label class="name-search" :class="{ 'name-search--on': search }">
          <v-icon icon="mdi-magnify" size="18" />
          <input
            ref="searchInput"
            v-model="search"
            type="search"
            placeholder="Название"
            aria-label="Поиск по названию"
            @keydown.esc="search = ''"
          >
          <button v-if="search" class="ui-btn name-clear" aria-label="Очистить название" @click="clearSearch">
            <v-icon icon="mdi-close" size="16" />
          </button>
        </label>

        <filter-menu v-model="filters.genres" label="Жанры" multiple :items="genreItems" />
        <filter-menu v-model="filters.types" label="Тип" multiple :items="typeItems" />
        <filter-menu v-model="filters.seasons" label="Сезон" multiple :items="seasonItems" />

        <v-menu v-model="yearsOpen" :close-on-content-click="false" location="bottom start" offset="6">
          <template #activator="{ props: menuProps }">
            <button
              v-bind="menuProps"
              class="ui-btn filter-chip"
              :class="{ 'filter-chip--on': yearsText }"
              :aria-label="yearsText ? `Годы: ${yearsText}` : 'Годы'"
            >
              <span>Годы<template v-if="yearsText">: <b>{{ yearsText }}</b></template></span>
              <v-icon icon="mdi-chevron-down" size="18" />
            </button>
          </template>
          <div ref="yearsEl" class="years">
            <div v-for="column in yearColumns" :key="column.key" class="years-col">
              <div class="years-head" aria-hidden="true">{{ column.title }}</div>
              <v-list density="compact" class="years-list" bg-color="transparent" :aria-label="column.label">
                <v-list-item :active="filters[column.key] == null" title="Любой" @click="filters[column.key] = null" />
                <v-list-item
                  v-for="year in yearsDesc"
                  :key="year"
                  :active="filters[column.key] === year"
                  :title="String(year)"
                  @click="setYear(column.key, year)"
                />
              </v-list>
            </div>
          </div>
        </v-menu>

        <filter-menu v-model="filters.status" label="Статус" :items="statusItems" />
      </div>

      <genre-chips v-if="refs?.genres.length" v-model="filters.genres" class="genres" :genres="refs.genres" />
    </page-header>

    <release-grid
      class="results"
      :items="list.items.value"
      :error="list.error.value"
      :generation="list.generation.value"
      empty-text="Ничего не нашлось"
      @load="list.load"
      @reset="retry"
    >
      <template #empty-action>
        <!-- кнопка исчезает вместе с пустой сеткой, фокус уводим на фильтры -->
        <v-btn
          v-if="activeCount"
          variant="tonal"
          prepend-icon="mdi-filter-remove"
          @click="resetFilters($event, () => filtersEl?.querySelector<HTMLElement>('.filter-chip'))"
        >
          Сбросить фильтры
        </v-btn>
      </template>
    </release-grid>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { type CatalogFilters, type CatalogReferences, getCatalog, getCatalogReferences } from '@/api/catalog'
import ReleaseGrid from '@/components/ReleaseGrid.vue'
import FilterMenu, { type FilterItem } from '@/components/ui/FilterMenu.vue'
import GenreChips from '@/components/ui/GenreChips.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useInfiniteList } from '@/composables/useInfiniteList'
import { pluralize } from '@/utils/plural'
import { readJson, writeJson } from '@/utils/storage'

defineOptions({ name: 'CatalogView' })

const FILTERS_KEY = 'catalog.filters'
const DEFAULT_SORTING = 'FRESH_AT_DESC'

interface FilterState {
  genres: number[]
  types: string[]
  seasons: string[]
  fromYear: number | null
  toYear: number | null
  status: string | null
  sorting: string
}

type YearKey = 'fromYear' | 'toYear'

const emptyFilters = (): FilterState => ({
  genres: [],
  types: [],
  seasons: [],
  fromYear: null,
  toYear: null,
  status: null,
  sorting: DEFAULT_SORTING
})

const refs = ref<CatalogReferences | null>(null)
const filters = reactive<FilterState>({ ...emptyFilters(), ...readJson<Partial<FilterState>>(FILTERS_KEY, {}) })
const search = ref('')
const appliedSearch = ref('')
const yearsOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const filtersEl = ref<HTMLElement | null>(null)
const actionsEl = ref<HTMLElement | null>(null)
const yearsEl = ref<HTMLElement | null>(null)

const genreItems = computed<FilterItem<number>[]>(() => (refs.value?.genres ?? []).map(g => ({ value: g.id, title: g.name })))
const typeItems = computed<FilterItem<string>[]>(() => (refs.value?.types ?? []).map(t => ({ value: t.value, title: t.description })))
const seasonItems = computed<FilterItem<string>[]>(() => (refs.value?.seasons ?? []).map(s => ({ value: s.value, title: s.description })))
const statusItems = computed<FilterItem<string>[]>(() =>
  (refs.value?.publishStatuses ?? []).map(s => ({ value: s.value, title: s.description })))
const sortingItems = computed<FilterItem<string>[]>(() => (refs.value?.sorting ?? []).map(s => ({ value: s.value, title: s.label })))

const yearsDesc = computed(() => [...(refs.value?.years ?? [])].sort((a, b) => b - a))
const yearColumns: { key: YearKey, title: string, label: string }[] = [
  { key: 'fromYear', title: 'С', label: 'Год с' },
  { key: 'toYear', title: 'По', label: 'Год по' }
]

const yearsText = computed(() => {
  const { fromYear: from, toYear: to } = filters
  if (from && to) return from === to ? String(from) : `${Math.min(from, to)}–${Math.max(from, to)}`
  if (from) return `с ${from}`
  if (to) return `до ${to}`
  return ''
})

function setYear (key: YearKey, year: number): void {
  filters[key] = year
  const other: YearKey = key === 'fromYear' ? 'toYear' : 'fromYear'
  const otherYear = filters[other]
  if (otherYear != null && (key === 'fromYear' ? year > otherYear : year < otherYear)) filters[other] = year
}

const sortingModel = computed({
  get: () => filters.sorting,
  set: (value: string | string[] | null) => {
    if (typeof value === 'string') filters.sorting = value
  }
})
const sortingLabel = computed(() =>
  refs.value?.sorting.find(s => s.value === filters.sorting)?.label ?? 'Сортировка')

const titleOf = <V extends string | number>(items: FilterItem<V>[], values: V[]) =>
  values.map(v => items.find(i => i.value === v)?.title ?? String(v))

const releasesText = (total: number) => `${total.toLocaleString('ru-RU')} ${pluralize(total, ['релиз', 'релиза', 'релизов'])}`

const summary = computed(() => {
  const parts: string[] = []
  const total = list.total.value
  if (total != null) parts.push(releasesText(total))
  if (appliedSearch.value) parts.push(`«${appliedSearch.value}»`)
  const genres = titleOf(genreItems.value, filters.genres)
  if (genres.length) parts.push(genres.length === 1 ? genres[0] : `${genres[0]} +${genres.length - 1}`)
  parts.push(...titleOf(typeItems.value, filters.types))
  parts.push(...titleOf(seasonItems.value, filters.seasons).map(s => s.toLowerCase()))
  if (yearsText.value) parts.push(yearsText.value)
  if (filters.status) parts.push(titleOf(statusItems.value, [filters.status])[0].toLowerCase())
  const sorting = refs.value?.sorting.find(s => s.value === filters.sorting)?.label
  if (sorting) parts.push(sorting.toLowerCase())
  return parts.join(' · ')
})

const announcement = computed(() => {
  const total = list.total.value
  if (total == null || list.stale.value) return ''
  return total === 0 ? 'Ничего не нашлось' : `Найдено ${releasesText(total)}`
})

const activeCount = computed(() => [
  filters.genres.length > 0,
  filters.types.length > 0,
  filters.seasons.length > 0,
  filters.fromYear != null || filters.toYear != null,
  filters.status != null,
  search.value.trim() !== ''
].filter(Boolean).length)

function toApi (): CatalogFilters {
  return {
    genres: filters.genres.length ? filters.genres : undefined,
    types: filters.types.length ? filters.types : undefined,
    seasons: filters.seasons.length ? filters.seasons : undefined,
    years: filters.fromYear || filters.toYear
      ? { from_year: filters.fromYear ?? undefined, to_year: filters.toYear ?? undefined }
      : undefined,
    publish_statuses: filters.status ? [filters.status] : undefined,
    search: appliedSearch.value || undefined,
    sorting: filters.sorting
  }
}

const list = useInfiniteList(page => getCatalog(page, toApi()))

let searchTimer: number | undefined

function resetFilters (event: Event, focusTarget: () => HTMLElement | null | undefined): void {
  const hadFocus = event.currentTarget === document.activeElement
  window.clearTimeout(searchTimer)
  search.value = ''
  appliedSearch.value = ''
  Object.assign(filters, { ...emptyFilters(), sorting: filters.sorting })
  if (hadFocus) void nextTick(() => focusTarget()?.focus())
}

function clearSearch (): void {
  search.value = ''
  searchInput.value?.focus()
}

// сравниваем строкой: присвоение нового пустого массива не должно перезагружать выдачу
watch(() => JSON.stringify(filters), () => writeJson(FILTERS_KEY, filters))
watch(() => JSON.stringify(toApi()), () => list.reset())

watch(search, value => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => {
    appliedSearch.value = (value ?? '').trim()
  }, 500)
})

// содержимое v-menu монтируется лениво, поэтому ждём nextTick
watch(yearsOpen, async open => {
  if (!open) return
  await nextTick()
  yearsEl.value?.querySelectorAll<HTMLElement>('.years-list').forEach(column => {
    const item = column.querySelector<HTMLElement>('.v-list-item--active')
    if (item) column.scrollTop = item.offsetTop - (column.clientHeight - item.offsetHeight) / 2
  })
})

let refsLoading = false
async function loadRefs (): Promise<void> {
  if (refs.value || refsLoading) return
  refsLoading = true
  try {
    refs.value = await getCatalogReferences()
  } catch {
    // без справочников фильтры пустые, но выдача работает
  } finally {
    refsLoading = false
  }
}
onMounted(loadRefs)
onActivated(loadRefs)

function retry (): void {
  void loadRefs()
  list.reset()
}
</script>

<style scoped>
.catalog {
  padding-bottom: 40px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
}

.filters-end {
  display: flex;
  gap: 8px;
  align-self: center;
}

.catalog-head--stale :deep(.subtitle) {
  opacity: 0.5;
}

.genres {
  margin-top: 12px;
}

.results {
  padding: 24px 40px 0;
}

.name-search {
  flex: 1 1 120px;
  min-width: 120px;
  max-width: 220px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 0 12px;
  border-radius: 10px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
  color: var(--text-3);
  cursor: text;
}

.name-search:focus-within {
  box-shadow: inset 0 0 0 1px var(--accent);
}

.name-search--on {
  color: var(--accent);
}

.name-search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 14px;
  user-select: text;
}

.name-search input::placeholder {
  color: var(--text-3);
}

.name-search input::-webkit-search-cancel-button {
  display: none;
}

.name-clear {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-2);
}

.name-clear:hover {
  color: var(--text);
  background: var(--line-2);
}

.years {
  display: flex;
  padding: 8px;
  gap: 4px;
  border-radius: 12px;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line-2), 0 16px 40px rgba(0, 0, 0, 0.5);
}

.years-col {
  width: 110px;
}

.years-head {
  padding: 4px 12px 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}

.years-list {
  position: relative;
  max-height: 320px;
  overflow-y: auto;
  padding: 0;
}
</style>
