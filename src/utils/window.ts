// Управление окном Tauri. В обычном браузере (pnpm dev без Tauri) все вызовы ничего не делают.

import { getCurrentWindow } from '@tauri-apps/api/window'
import { openUrl } from '@tauri-apps/plugin-opener'

export const isTauri = '__TAURI_INTERNALS__' in window

const appWindow = isTauri ? getCurrentWindow() : null

export const windowControls = {
  minimize: () => appWindow?.minimize(),
  toggleMaximize: () => appWindow?.toggleMaximize(),
  close: () => appWindow?.close(),
  isFullscreen: async () => (await appWindow?.isFullscreen()) ?? false,
  setFullscreen: (value: boolean) => appWindow?.setFullscreen(value),
  isMaximized: async () => (await appWindow?.isMaximized()) ?? false,
  /** Подписка на изменение размера окна (в том числе разворачивание). */
  onResized: (callback: () => void) => appWindow?.onResized(callback)
}

/** Открыть ссылку в системном браузере. */
export function openExternal (url: string): void {
  if (isTauri) void openUrl(url)
  else window.open(url, '_blank', 'noopener')
}
