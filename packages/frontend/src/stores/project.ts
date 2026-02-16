import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { projectApi, wiremockInstanceApi, type Project, type WiremockInstance, type CreateProjectInput, type UpdateProjectInput, type CreateWiremockInstanceInput } from '@/services/api'
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'

const CURRENT_PROJECT_KEY = 'wiremock-hub-current-project'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProjectId = ref<string | null>(null)
  const wiremockInstances = ref<WiremockInstance[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const currentProject = computed(() => {
    if (!currentProjectId.value) return null
    return projects.value.find(p => p.id === currentProjectId.value) || null
  })

  // Fetch project list
  async function fetchProjects() {
    loading.value = true
    error.value = null
    try {
      projects.value = await projectApi.list()
    } catch (e: any) {
      error.value = e.message || t('messages.project.fetchFailed')
      ElMessage.error(error.value!)
    } finally {
      loading.value = false
    }
  }

  // Create project
  async function addProject(input: CreateProjectInput): Promise<Project | null> {
    loading.value = true
    try {
      const project = await projectApi.create(input)
      projects.value.push(project)
      ElMessage.success(t('messages.project.created'))
      return project
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.project.createFailed'))
      return null
    } finally {
      loading.value = false
    }
  }

  // Update project
  async function updateProject(id: string, input: UpdateProjectInput): Promise<Project | null> {
    loading.value = true
    try {
      const updated = await projectApi.update(id, input)
      const index = projects.value.findIndex(p => p.id === id)
      if (index !== -1) {
        projects.value[index] = updated
      }
      ElMessage.success(t('messages.project.updated'))
      return updated
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.project.updateFailed'))
      return null
    } finally {
      loading.value = false
    }
  }

  // Duplicate project
  async function duplicateProject(id: string): Promise<Project | null> {
    loading.value = true
    try {
      const duplicated = await projectApi.duplicate(id)
      projects.value.unshift(duplicated)
      ElMessage.success(t('messages.project.duplicated'))
      return duplicated
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.project.duplicateFailed'))
      return null
    } finally {
      loading.value = false
    }
  }

  // Delete project
  async function deleteProject(id: string): Promise<boolean> {
    loading.value = true
    try {
      await projectApi.delete(id)
      projects.value = projects.value.filter(p => p.id !== id)
      if (currentProjectId.value === id) {
        clearCurrentProject()
      }
      ElMessage.success(t('messages.project.deleted'))
      return true
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.project.deleteFailed'))
      return false
    } finally {
      loading.value = false
    }
  }

  // Set current project
  async function setCurrentProject(id: string) {
    currentProjectId.value = id
    localStorage.setItem(CURRENT_PROJECT_KEY, id)

    // Fetch WireMock instance list
    await fetchWiremockInstances(id)
  }

  // Restore saved current project
  async function loadCurrentProject() {
    try {
      const stored = localStorage.getItem(CURRENT_PROJECT_KEY)
      if (stored && projects.value.some(p => p.id === stored)) {
        await setCurrentProject(stored)
      }
    } catch (error) {
      console.error('Failed to load current project:', error)
    }
  }

  // Clear current project
  function clearCurrentProject() {
    currentProjectId.value = null
    wiremockInstances.value = []
    localStorage.removeItem(CURRENT_PROJECT_KEY)
  }

  // Fetch WireMock instance list
  async function fetchWiremockInstances(projectId: string) {
    try {
      wiremockInstances.value = await wiremockInstanceApi.list(projectId)
    } catch (e: any) {
      console.error('Failed to fetch WireMock instances:', e)
      wiremockInstances.value = []
    }
  }

  // Add WireMock instance
  async function addWiremockInstance(input: CreateWiremockInstanceInput): Promise<WiremockInstance | null> {
    try {
      const instance = await wiremockInstanceApi.create(input)
      wiremockInstances.value.push(instance)
      ElMessage.success(t('messages.instance.added'))
      return instance
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.instance.addFailed'))
      return null
    }
  }

  // Delete WireMock instance
  async function deleteWiremockInstance(id: string): Promise<boolean> {
    try {
      await wiremockInstanceApi.delete(id)
      wiremockInstances.value = wiremockInstances.value.filter(i => i.id !== id)
      ElMessage.success(t('messages.instance.deleted'))
      return true
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.instance.deleteFailed'))
      return false
    }
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    wiremockInstances,
    loading,
    error,
    fetchProjects,
    addProject,
    updateProject,
    duplicateProject,
    deleteProject,
    setCurrentProject,
    loadCurrentProject,
    clearCurrentProject,
    fetchWiremockInstances,
    addWiremockInstance,
    deleteWiremockInstance
  }
})
