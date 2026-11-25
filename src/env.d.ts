/// <reference types="vite/client" />

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Экран, у которого в полноэкранном режиме скрывается панель окна. */
    fullscreenLayout?: boolean
    /** Экран с афишей: содержимое уходит под прозрачную панель окна. */
    hero?: boolean
  }
}
