import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/releases' },
    { path: '/releases', name: 'releases', component: () => import('@/views/ReleasesView.vue'), meta: { hero: true } },
    { path: '/catalog', name: 'catalog', component: () => import('@/views/CatalogView.vue') },
    { path: '/schedule', name: 'schedule', component: () => import('@/views/ScheduleView.vue') },
    { path: '/favorites', name: 'favorites', component: () => import('@/views/FavoritesView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/release/:id', name: 'release', component: () => import('@/views/ReleaseView.vue'), props: true, meta: { hero: true } },
    {
      path: '/watch/:id/:ordinal',
      name: 'watch',
      component: () => import('@/views/WatchView.vue'),
      props: true,
      meta: { fullscreenLayout: true }
    }
  ]
})

export default router
