import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LoggedRequest } from '@/types/wiremock'
import { getWireMockAPI, hasWireMockAPI } from '@/services/wiremock'
import { ElMessage } from 'element-plus'

export const useRequestStore = defineStore('request', () => {
  const requests = ref<LoggedRequest[]>([])
  const unmatchedRequests = ref<LoggedRequest[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchRequests() {
    if (!hasWireMockAPI()) return

    loading.value = true
    error.value = null

    try {
      const api = getWireMockAPI()
      const response = await api.getRequests()
      requests.value = response.requests || []
    } catch (e: any) {
      error.value = e.message || 'リクエストログの取得に失敗しました'
      ElMessage.error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function fetchUnmatchedRequests() {
    if (!hasWireMockAPI()) return

    loading.value = true
    try {
      const api = getWireMockAPI()
      const response = await api.getUnmatchedRequests()
      unmatchedRequests.value = response.requests || []
    } catch (e: any) {
      error.value = e.message || 'マッチしなかったリクエストの取得に失敗しました'
      ElMessage.error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function resetRequests() {
    if (!hasWireMockAPI()) return

    loading.value = true
    try {
      const api = getWireMockAPI()
      await api.resetRequests()
      requests.value = []
      unmatchedRequests.value = []
      ElMessage.success('リクエストログをクリアしました')
    } catch (e: any) {
      error.value = e.message || 'リクエストログのクリアに失敗しました'
      ElMessage.error(error.value)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    requests,
    unmatchedRequests,
    loading,
    error,
    fetchRequests,
    fetchUnmatchedRequests,
    resetRequests
  }
})
