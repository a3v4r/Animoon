/// <reference types="vite/client" />

import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    fullscreenLayout?: boolean
    hero?: boolean
  }
}
