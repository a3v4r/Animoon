/** Разделы приложения: колонка слева и переходы из поиска. */
export interface Section {
  name: string
  title: string
  icon: string
  activeIcon: string
  /** Другие слова, по которым раздел находится в поиске. */
  keywords: string[]
}

export const SECTIONS: Section[] = [
  { name: 'releases', title: 'Главная', icon: 'mdi-home-variant-outline', activeIcon: 'mdi-home-variant', keywords: ['новые серии', 'релизы', 'лента'] },
  { name: 'catalog', title: 'Каталог', icon: 'mdi-view-grid-outline', activeIcon: 'mdi-view-grid', keywords: ['фильтры', 'жанры', 'все аниме'] },
  { name: 'schedule', title: 'Расписание', icon: 'mdi-calendar-blank-outline', activeIcon: 'mdi-calendar-blank', keywords: ['сегодня', 'неделя', 'выход серий'] },
  { name: 'favorites', title: 'Избранное', icon: 'mdi-heart-outline', activeIcon: 'mdi-heart', keywords: ['мои', 'сохранённые'] }
]

export const SETTINGS_SECTION: Section = {
  name: 'settings',
  title: 'Настройки',
  icon: 'mdi-cog-outline',
  activeIcon: 'mdi-cog',
  keywords: ['аккаунт', 'вход', 'выход', 'качество', 'уведомления']
}

/** Разделы, подходящие под запрос поиска (по названию и ключевым словам). */
export function matchSections (query: string): Section[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return [...SECTIONS, SETTINGS_SECTION].filter(s =>
    s.title.toLowerCase().startsWith(q) || s.keywords.some(k => k.startsWith(q)))
}
