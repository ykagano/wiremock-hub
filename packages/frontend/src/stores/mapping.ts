import { defineStore } from 'pinia'
import { ref } from 'vue'
import { stubApi, wiremockInstanceApi, type Stub, type CreateStubInput, type UpdateStubInput } from '@/services/api'
import { useProjectStore } from './project'
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'
import type { Mapping } from '@/types/wiremock'

export const useMappingStore = defineStore('mapping', () => {
  const stubs = ref<Stub[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // Expose mappings for backward compatibility (generated from stub's mapping field)
  const mappings = ref<Mapping[]>([])

  // Fetch stub list
  async function fetchMappings() {
    const projectStore = useProjectStore()
    if (!projectStore.currentProjectId) {
      error.value = t('messages.project.notSelected')
      return
    }

    loading.value = true
    error.value = null

    try {
      stubs.value = await stubApi.list(projectStore.currentProjectId)
      // Generate mappings from stubs (for backward compatibility)
      mappings.value = stubs.value.map(s => ({
        ...s.mapping as Mapping,
        id: s.id
      }))
    } catch (e: any) {
      error.value = e.message || t('messages.stub.fetchFailed')
      ElMessage.error(error.value!)
    } finally {
      loading.value = false
    }
  }

  // Create stub
  async function createMapping(mapping: Mapping): Promise<Stub | null> {
    const projectStore = useProjectStore()
    if (!projectStore.currentProjectId) return null

    loading.value = true
    try {
      const input: CreateStubInput = {
        projectId: projectStore.currentProjectId,
        name: mapping.name,
        mapping: mapping as Record<string, unknown>
      }
      const created = await stubApi.create(input)
      stubs.value.push(created)
      mappings.value.push({ ...mapping, id: created.id })
      ElMessage.success(t('messages.stub.created'))
      return created
    } catch (e: any) {
      error.value = e.message || t('messages.stub.createFailed')
      ElMessage.error(error.value!)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Update stub
  async function updateMapping(id: string, mapping: Mapping): Promise<Stub | null> {
    loading.value = true
    try {
      const input: UpdateStubInput = {
        name: mapping.name,
        mapping: mapping as Record<string, unknown>
      }
      const updated = await stubApi.update(id, input)
      const index = stubs.value.findIndex(s => s.id === id)
      if (index !== -1) {
        stubs.value[index] = updated
        mappings.value[index] = { ...mapping, id: updated.id }
      }
      ElMessage.success(t('messages.stub.updated'))
      return updated
    } catch (e: any) {
      error.value = e.message || t('messages.stub.updateFailed')
      ElMessage.error(error.value!)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Delete stub
  async function deleteMapping(id: string): Promise<boolean> {
    loading.value = true
    try {
      await stubApi.delete(id)
      stubs.value = stubs.value.filter(s => s.id !== id)
      mappings.value = mappings.value.filter(m => m.id !== id)
      ElMessage.success(t('messages.stub.deleted'))
      return true
    } catch (e: any) {
      error.value = e.message || t('messages.stub.deleteFailed')
      ElMessage.error(error.value!)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Sync to WireMock
  async function syncToWiremock(stubId: string, instanceId: string): Promise<boolean> {
    loading.value = true
    try {
      await stubApi.sync(stubId, instanceId)
      ElMessage.success(t('messages.stub.synced'))
      return true
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.stub.syncFailed'))
      return false
    } finally {
      loading.value = false
    }
  }

  // Sync all stubs to WireMock
  async function syncAllToWiremock(instanceId: string): Promise<{ success: number; failed: number } | null> {
    const projectStore = useProjectStore()
    if (!projectStore.currentProjectId) return null

    loading.value = true
    try {
      const result = await stubApi.syncAll(projectStore.currentProjectId, instanceId)
      if (result.failed === 0) {
        ElMessage.success(t('messages.stub.syncedCount', { count: result.success }))
      } else {
        ElMessage.warning(t('messages.stub.syncResult', { success: result.success, failed: result.failed }))
      }
      return result
    } catch (e: any) {
      ElMessage.error(e.message || t('messages.stub.syncFailed'))
      return null
    } finally {
      loading.value = false
    }
  }

  function clearMappings() {
    stubs.value = []
    mappings.value = []
  }

  // Get stub by ID
  function getStubById(id: string): Stub | undefined {
    return stubs.value.find(s => s.id === id)
  }

  // Reset WireMock instance mappings
  async function resetMappings(): Promise<boolean> {
    const projectStore = useProjectStore()
    if (!projectStore.currentProjectId) {
      ElMessage.warning(t('messages.project.notSelected'))
      return false
    }

    // Load instances if not already loaded
    if (projectStore.wiremockInstances.length === 0) {
      await projectStore.fetchWiremockInstances(projectStore.currentProjectId)
    }

    if (projectStore.wiremockInstances.length === 0) {
      ElMessage.warning(t('messages.instance.notAvailable'))
      return false
    }

    loading.value = true
    let successCount = 0
    let failCount = 0

    try {
      for (const instance of projectStore.wiremockInstances) {
        if (!instance.isActive) continue
        try {
          await wiremockInstanceApi.reset(instance.id)
          successCount++
        } catch {
          failCount++
        }
      }

      if (failCount === 0) {
        ElMessage.success(t('messages.stub.resetSuccess'))
      } else {
        ElMessage.warning(t('messages.stub.syncResult', { success: successCount, failed: failCount }))
      }
      return failCount === 0
    } catch (e: any) {
      error.value = e.message || t('messages.stub.resetFailed')
      ElMessage.error(error.value!)
      return false
    } finally {
      loading.value = false
    }
  }

  // Export stubs to JSON file
  async function exportStubs(): Promise<boolean> {
    const projectStore = useProjectStore()
    if (!projectStore.currentProjectId) {
      ElMessage.warning(t('messages.project.notSelected'))
      return false
    }

    loading.value = true
    try {
      const blob = await stubApi.exportStubs(projectStore.currentProjectId)

      // Generate filename for download
      const projectName = projectStore.currentProject?.name || 'project'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-stubs-${timestamp}.json`

      // Download the file
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      ElMessage.success(t('messages.stub.exported'))
      return true
    } catch (e: any) {
      error.value = e.message || t('messages.stub.exportFailed')
      ElMessage.error(error.value!)
      return false
    } finally {
      loading.value = false
    }
  }

  return {
    stubs,
    mappings,
    loading,
    error,
    fetchMappings,
    createMapping,
    updateMapping,
    deleteMapping,
    syncToWiremock,
    syncAllToWiremock,
    clearMappings,
    getStubById,
    resetMappings,
    exportStubs
  }
})
