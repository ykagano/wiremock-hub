import { createRouter, createWebHistory } from 'vue-router'
import { useProjectStore } from '@/stores/project'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/projects'
    },
    {
      path: '/projects',
      name: 'projects',
      component: () => import('@/views/ProjectsView.vue')
    },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: () => import('@/views/ProjectDetailView.vue')
    },
    {
      path: '/mappings',
      name: 'mappings',
      component: () => import('@/views/MappingsView.vue'),
      meta: { requiresProject: true }
    },
    {
      path: '/mappings/new',
      name: 'mapping-new',
      component: () => import('@/views/MappingEditorView.vue'),
      meta: { requiresProject: true }
    },
    {
      path: '/mappings/:id',
      name: 'mapping-edit',
      component: () => import('@/views/MappingEditorView.vue'),
      meta: { requiresProject: true }
    },
    {
      path: '/requests',
      name: 'requests',
      component: () => import('@/views/RequestsView.vue'),
      meta: { requiresProject: true }
    },
    {
      path: '/requests/:instanceId/:requestId',
      name: 'request-detail',
      component: () => import('@/views/RequestDetailView.vue'),
      meta: { requiresProject: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue')
    }
  ]
})

// ナビゲーションガード
router.beforeEach((to, _from, next) => {
  // プロジェクト選択が必要なページ
  if (to.meta.requiresProject) {
    const projectStore = useProjectStore()
    if (!projectStore.currentProject) {
      next('/projects')
      return
    }
  }

  next()
})

export default router
