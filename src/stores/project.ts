import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Project } from '@/types/wiremock'
import { initWireMockAPI } from '@/services/wiremock'

const STORAGE_KEY = 'wiremock-jp-projects'
const CURRENT_PROJECT_KEY = 'wiremock-jp-current-project'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([])
  const currentProjectId = ref<string | null>(null)

  const currentProject = computed(() => {
    if (!currentProjectId.value) return null
    return projects.value.find(p => p.id === currentProjectId.value) || null
  })

  function loadProjects() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        projects.value = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
      projects.value = []
    }
  }

  function saveProjects() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects.value))
    } catch (error) {
      console.error('Failed to save projects:', error)
    }
  }

  function addProject(project: Omit<Project, 'id' | 'createdAt'>): Project {
    const newProject: Project = {
      ...project,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }
    projects.value.push(newProject)
    saveProjects()
    return newProject
  }

  function updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'createdAt'>>) {
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = { ...projects.value[index], ...updates }
      saveProjects()
    }
  }

  function deleteProject(id: string) {
    projects.value = projects.value.filter(p => p.id !== id)
    if (currentProjectId.value === id) {
      currentProjectId.value = null
      localStorage.removeItem(CURRENT_PROJECT_KEY)
    }
    saveProjects()
  }

  function setCurrentProject(id: string) {
    const project = projects.value.find(p => p.id === id)
    if (!project) return

    currentProjectId.value = id
    localStorage.setItem(CURRENT_PROJECT_KEY, id)

    // WireMock API初期化
    initWireMockAPI(project.baseUrl)
  }

  function loadCurrentProject() {
    try {
      const stored = localStorage.getItem(CURRENT_PROJECT_KEY)
      if (stored && projects.value.some(p => p.id === stored)) {
        setCurrentProject(stored)
      }
    } catch (error) {
      console.error('Failed to load current project:', error)
    }
  }

  function clearCurrentProject() {
    currentProjectId.value = null
    localStorage.removeItem(CURRENT_PROJECT_KEY)
  }

  return {
    projects,
    currentProjectId,
    currentProject,
    loadProjects,
    addProject,
    updateProject,
    deleteProject,
    setCurrentProject,
    loadCurrentProject,
    clearCurrentProject
  }
})
