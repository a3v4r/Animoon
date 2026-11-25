import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

import { createVuetify } from 'vuetify'
import { ru } from 'vuetify/locale'

// Палитра «Кинотеатр» (см. src/styles/main.scss): бирюзовый акцент и тёплый для расписания.
export default createVuetify({
  locale: { locale: 'ru', messages: { ru } },
  icons: { defaultSet: 'mdi' },
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#0b0c10',
          surface: '#15171d',
          'surface-variant': '#1e2129',
          primary: '#f5f6f8',
          secondary: '#5ce1e6',
          'on-secondary': '#04272b',
          warning: '#ffb547'
        }
      }
    }
  },
  defaults: {
    VBtn: { rounded: 'lg' }
  }
})
