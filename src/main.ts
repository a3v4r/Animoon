import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import { startUiScale } from './composables/useUiScale'
import './styles/main.scss'

const app = createApp(App)
  .use(createPinia())
  .use(router)
  .use(vuetify)

// зум до mount, иначе развёрнутое окно мелькает мелким; больше 300 мс не ждём
void Promise.race([
  startUiScale().catch(() => {}),
  new Promise(resolve => setTimeout(resolve, 300))
]).finally(() => app.mount('#app'))
