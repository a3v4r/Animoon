// Обёртка над localStorage с JSON и защитой от битых данных.

export function readJson<T> (key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw == null ? fallback : JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson (key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Переполнение или запрет хранилища не должен ломать приложение.
  }
}
