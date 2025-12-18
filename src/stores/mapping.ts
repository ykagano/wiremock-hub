import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Mapping } from '@/types/wiremock'
import { getWireMockAPI, hasWireMockAPI } from '@/services/wiremock'
import { ElMessage } from 'element-plus'

export const useMappingStore = defineStore('mapping', () => {
  const mappings = ref<Mapping[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchMappings() {
    if (!hasWireMockAPI()) {
      error.value = 'WireMock APIが初期化されていません'
      return
    }

    loading.value = true
    error.value = null

    try {
      const api = getWireMockAPI()
      const response = await api.getMappings()
      mappings.value = response.mappings || []
    } catch (e: any) {
      error.value = e.message || 'マッピングの取得に失敗しました'
      ElMessage.error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function createMapping(mapping: Mapping) {
    if (!hasWireMockAPI()) return

    loading.value = true
    try {
      const api = getWireMockAPI()
      const created = await api.createMapping(mapping)
      mappings.value.push(created)
      ElMessage.success('マッピングを作成しました')
      return created
    } catch (e: any) {
      error.value = e.message || 'マッピングの作成に失敗しました'
      ElMessage.error(error.value)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateMapping(id: string, mapping: Mapping) {
    if (!hasWireMockAPI()) return

    loading.value = true
    try {
      const api = getWireMockAPI()
      const updated = await api.updateMapping(id, mapping)
      const index = mappings.value.findIndex(m => m.id === id || m.uuid === id)
      if (index !== -1) {
        mappings.value[index] = updated
      }
      ElMessage.success('マッピングを更新しました')
      return updated
    } catch (e: any) {
      error.value = e.message || 'マッピングの更新に失敗しました'
      ElMessage.error(error.value)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteMapping(id: string) {
    if (!hasWireMockAPI()) return

    loading.value = true
    try {
      const api = getWireMockAPI()
      await api.deleteMapping(id)
      mappings.value = mappings.value.filter(m => m.id !== id && m.uuid !== id)
      ElMessage.success('マッピングを削除しました')
    } catch (e: any) {
      error.value = e.message || 'マッピングの削除に失敗しました'
      ElMessage.error(error.value)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function resetMappings() {
    if (!hasWireMockAPI()) return

    loading.value = true
    try {
      const api = getWireMockAPI()
      await api.resetMappings()
      mappings.value = []
      ElMessage.success('すべてのマッピングをリセットしました')
    } catch (e: any) {
      error.value = e.message || 'マッピングのリセットに失敗しました'
      ElMessage.error(error.value)
      throw e
    } finally {
      loading.value = false
    }
  }

  function clearMappings() {
    mappings.value = []
  }

  return {
    mappings,
    loading,
    error,
    fetchMappings,
    createMapping,
    updateMapping,
    deleteMapping,
    resetMappings,
    clearMappings
  }
})
