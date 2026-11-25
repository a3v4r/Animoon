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

// Масштаб ставим до первого кадра, иначе развёрнутое окно сначала рисуется мелким и потом перестраивается.
// Ждём не дольше 300 мс: если окно не ответит, интерфейс всё равно появится (в 100%).
void Promise.race([
  startUiScale().catch(() => {}),
  new Promise(resolve => setTimeout(resolve, 300))
]).finally(() => app.mount('#app'))
