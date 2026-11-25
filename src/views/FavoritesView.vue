<template>
  <div class="favorites">
    <page-header title="Избранное" :subtitle="summary">
      <template v-if="groups.length > 1" #actions>
        <v-btn
          variant="text"
          size="small"
          :prepend-icon="allCollapsed ? 'mdi-unfold-more-horizontal' : 'mdi-unfold-less-horizontal'"
          @click="setAll(!allCollapsed)"
        >
          {{ allCollapsed ? 'Развернуть все' : 'Свернуть все' }}
        </v-btn>
      </template>
      <nav v-if="groups.length > 1" class="year-jump" aria-label="Годы">
        <button v-for="group in groups" :key="group.year" class="ui-btn filter-chip" @click="jumpTo(group.year)">
          {{ group.year }}<span class="d-sr-only"> год</span>
          <span class="count">{{ group.releases.length }}<span class="d-sr-only"> {{ pluralize(group.releases.length, ['релиз', 'релиза', 'релизов']) }}</span></span>
        </button>
      </nav>
    </page-header>

    <empty-state
      v-if="!account.isAuthorized"
      icon="mdi-heart-outline"
      title="Нужен вход"
      text="Войдите в аккаунт AniLibria, чтобы видеть избранное."
    >
      <v-btn color="secondary" :to="{ name: 'login' }">Войти</v-btn>
    </empty-state>

    <empty-state v-else-if="loading && releases.length === 0">
      <v-progress-circular indeterminate size="32" color="secondary" aria-label="Загрузка" />
    </empty-state>

    <empty-state
      v-else-if="error && releases.length === 0"
      alert
      icon="mdi-cloud-off-outline"
      title="Не удалось загрузить избранное"
      :text="error"
    >
      <v-btn variant="tonal" prepend-icon="mdi-refresh" @click="load">Повторить</v-btn>
    </empty-state>

    <empty-state
      v-else-if="releases.length === 0"
      icon="mdi-heart-plus-outline"
      title="В избранном пока пусто"
      text="Добавляйте релизы кнопкой с сердцем на странице релиза — здесь они соберутся по годам."
    >
      <v-btn variant="tonal" :to="{ name: 'catalog' }">Открыть каталог</v-btn>
    </empty-state>

    <!-- По годам выхода: сводка года и сворачивание (запоминается). -->
    <section
      v-for="group in groups"
      v-else
      :id="`year-${group.year}`"
      :key="group.year"
      class="year"
      :aria-labelledby="`year-title-${group.year}`"
    >
      <!-- Заголовок-аккордеон: кнопка внутри h2 (заголовок в кнопке недопустим). -->
      <h2 :id="`year-title-${group.year}`" class="year-h">
        <button
          class="ui-btn year-head"
          :aria-expanded="!collapsed.has(group.year)"
          :aria-controls="`year-grid-${group.year}`"
          @click="toggle(group.year)"
        >
          <span class="year-title font-display">{{ group.year }}</span>
          <span class="year-sub">
            {{ group.releases.length }} {{ pluralize(group.releases.length, ['релиз', 'релиза', 'релизов']) }}
            · {{ group.episodes }} {{ pluralize(group.episodes, ['серия', 'серии', 'серий']) }}
          </span>
          <span class="line" />
          <v-icon :icon="collapsed.has(group.year) ? 'mdi-chevron-down' : 'mdi-chevron-up'" size="22" class="chevron" />
        </button>
      </h2>
      <div class="year-genres ell" :title="group.genres.join(', ')">{{ group.genres.slice(0, 6).join(' · ') }}</div>

      <div v-if="!collapsed.has(group.year)" :id="`year-grid-${group.year}`" class="grid">
        <release-card v-for="release in group.releases" :key="release.id" :release="release" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { getAllFavorites } from '@/api/account'
import type { ReleaseFull } from '@/api/types'
import ReleaseCard from '@/components/ReleaseCard.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useAccountStore } from '@/stores/account'
import { useEpisodeIndexStore } from '@/stores/episodeIndex'
import { pluralize } from '@/utils/plural'
import { readJson, writeJson } from '@/utils/storage'

defineOptions({ name: 'FavoritesView' })

const COLLAPSED_KEY = 'favorites.collapsedYears'

const account = useAccountStore()
const index = useEpisodeIndexStore()

const releases = ref<ReleaseFull[]>([])
const loading = ref(false)
const error = ref('')
const collapsed = ref(new Set<number>(readJson<number[]>(COLLAPSED_KEY, [])))

interface YearGroup {
  year: number
  releases: ReleaseFull[]
  episodes: number
  genres: string[]
}

// Годы по убыванию; внутри года порядок API — недавно обновлённые первыми.
// Жанры года — от частых к редким: в строку попадают характерные, а не первые по алфавиту.
const groups = computed<YearGroup[]>(() => {
  const byYear = new Map<number, ReleaseFull[]>()
  for (const release of releases.value) {
    if (!byYear.has(release.year)) byYear.set(release.year, [])
    byYear.get(release.year)!.push(release)
  }
  return [...byYear.entries()]
    .sort(([a], [b]) => b - a)
    .map(([year, list]) => ({
      year,
      releases: list,
      episodes: list.reduce((sum, r) => sum + r.episodes.length, 0),
      genres: genresByCount(list)
    }))
})

function genresByCount (list: ReleaseFull[]): string[] {
  const counts = new Map<string, number>()
  for (const release of list) {
    for (const genre of release.genres) counts.set(genre.name, (counts.get(genre.name) ?? 0) + 1)
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ru'))
    .map(([name]) => name)
}

const summary = computed(() => {
  const total = releases.value.length
  return total ? `${total} ${pluralize(total, ['релиз', 'релиза', 'релизов'])}` : ''
})

const allCollapsed = computed(() => groups.value.length > 0 && groups.value.every(g => collapsed.value.has(g.year)))

function setAll (value: boolean): void {
  collapsed.value = new Set(value ? groups.value.map(g => g.year) : [])
  writeJson(COLLAPSED_KEY, [...collapsed.value])
}

function jumpTo (year: number): void {
  if (collapsed.value.has(year)) toggle(year)
  void nextTick(() => {
    const section = document.getElementById(`year-${year}`)
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Фокус на кнопку года (уже раскрытого): следующий Tab — в его сетку.
    section?.querySelector<HTMLElement>('.year-head')?.focus({ preventScroll: true })
  })
}

function toggle (year: number): void {
  const next = new Set(collapsed.value)
  if (next.has(year)) next.delete(year)
  else next.add(year)
  collapsed.value = next
  writeJson(COLLAPSED_KEY, [...next])
}

// Номер последней загрузки: ответ устаревшего запроса (или пришедший после выхода) отбрасывается.
let loadSeq = 0

async function load (): Promise<void> {
  const seq = ++loadSeq
  if (!account.isAuthorized) {
    // Вышли — убрать данные прошлого аккаунта, иначе они остаются в шапке и мелькают при следующем входе.
    releases.value = []
    error.value = ''
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const list = await getAllFavorites()
    if (seq !== loadSeq) return
    // В избранном релизы приходят со списком серий — заодно запомнить их для отметок на карточках.
    for (const release of list) index.learn(release)
    releases.value = list
  } catch (e) {
    if (seq === loadSeq) error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(load)

// Добавили или убрали релиз на другой странице, вошли или вышли — перечитать.
watch(() => [account.favoriteIds, account.isAuthorized], () => { void load() })
</script>

<style scoped>
.favorites {
  padding-bottom: 40px;
}

.year-jump {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 20px;
}

.count {
  font-size: 12px;
  color: var(--text-3);
}

.year {
  padding: 32px 40px 0;
  scroll-margin-top: calc(var(--bar-height) + 8px);
}

.year-h {
  margin: 0;
  font: inherit;
}

.year-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  border-radius: 8px;
}

.year-head:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.year-title {
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
}

.year-sub {
  font-size: 13px;
  color: var(--text-3);
  white-space: nowrap;
}

.line {
  flex: 1;
  height: 1px;
  background: var(--line);
}

.chevron {
  color: var(--text-3);
  transition: color 0.15s;
}

.year-head:hover .chevron {
  color: var(--text);
}

.year-genres {
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 24px 16px;
  margin-top: 16px;
}
</style>
