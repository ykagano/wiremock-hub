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
      path: '/registered-stubs',
      name: 'registered-stubs',
      component: () => import('@/views/RegisteredStubsView.vue'),
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

// Navigation guard
router.beforeEach(async (to, _from, next) => {
  const projectStore = useProjectStore()

  // Restore project from localStorage on all routes
  if (projectStore.projects.length === 0) {
    await projectStore.fetchProjects()
  }
  if (!projectStore.currentProject) {
    await projectStore.loadCurrentProject()
  }

  // Redirect to projects page if project is required but not selected
  if (to.meta.requiresProject && !projectStore.currentProject) {
    next('/projects')
    return
  }

  next()
})

export default router
