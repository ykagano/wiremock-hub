import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'projects',
      component: () => import('@/views/ProjectsView.vue')
    },
    {
      path: '/mappings',
      name: 'mappings',
      component: () => import('@/views/MappingsView.vue')
    },
    {
      path: '/requests',
      name: 'requests',
      component: () => import('@/views/RequestsView.vue')
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    }
  ]
})

export default router
