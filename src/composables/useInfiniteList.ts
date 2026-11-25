import { ref } from 'vue'
import type { Paginated } from '@/api/types'

type LoadStatus = 'ok' | 'empty' | 'error'

/**
 * Постраничная загрузка для v-infinite-scroll.
 * reset() очищает список и меняет key, чтобы v-infinite-scroll начал заново.
 * total после reset() держит прежнее число (stale = true), пока не ответит первая страница.
 */
export function useInfiniteList<T extends { id: number }> (fetchPage: (page: number) => Promise<Paginated<T>>) {
  const items = ref<T[]>([]) as { value: T[] }
  const error = ref('')
  const generation = ref(0)
  const total = ref<number | null>(null)
  const stale = ref(false)
  let page = 1

  async function load ({ done }: { done: (status: LoadStatus) => void }): Promise<void> {
    const requested = generation.value
    try {
      const { data, meta } = await fetchPage(page)
      if (requested !== generation.value) return
      const known = new Set(items.value.map(item => item.id))
      items.value.push(...data.filter(item => !known.has(item.id)))
      total.value = meta.pagination.total
      stale.value = false
      error.value = ''
      page++
      done(meta.pagination.current_page >= meta.pagination.total_pages ? 'empty' : 'ok')
    } catch (e) {
      if (requested !== generation.value) return
      // Первая страница не пришла — старое число к новым условиям не относится.
      if (page === 1) total.value = null
      stale.value = false
      error.value = e instanceof Error ? e.message : String(e)
      done('error')
    }
  }

  function reset (): void {
    items.value = []
    stale.value = true
    error.value = ''
    page = 1
    generation.value++
  }

  return { items, error, generation, total, stale, load, reset }
}
