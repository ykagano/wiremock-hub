import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LoggedRequest } from '@/types/wiremock'
import { wiremockInstanceApi } from '@/services/api'
import { ElMessage } from 'element-plus'
import { t } from '@/i18n'

export const useRequestStore = defineStore('request', () => {
  const requests = ref<LoggedRequest[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const currentInstanceId = ref<string | null>(null)
  // Temporary storage for request detail (used for unmatched requests that can't be fetched by ID)
  const pendingRequestDetail = ref<LoggedRequest | null>(null)

  function setCurrentInstance(instanceId: string | null) {
    currentInstanceId.value = instanceId
    // Clear requests when instance changes
    if (!instanceId) {
      requests.value = []
    }
  }

  function setPendingRequestDetail(request: LoggedRequest | null) {
    pendingRequestDetail.value = request
  }

  function consumePendingRequestDetail(): LoggedRequest | null {
    const request = pendingRequestDetail.value
    pendingRequestDetail.value = null
    return request
  }

  async function fetchRequests() {
    if (!currentInstanceId.value) return

    loading.value = true
    error.value = null

    try {
      const response = await wiremockInstanceApi.getRequests(currentInstanceId.value)
      requests.value = response?.requests || []
    } catch (e: any) {
      error.value = e.message || t('messages.request.fetchFailed')
      ElMessage.error(error.value!)
    } finally {
      loading.value = false
    }
  }

  async function resetRequests() {
    if (!currentInstanceId.value) return

    loading.value = true
    try {
      await wiremockInstanceApi.clearRequests(currentInstanceId.value)
      requests.value = []
      ElMessage.success(t('messages.request.cleared'))
    } catch (e: any) {
      error.value = e.message || t('messages.request.clearFailed')
      ElMessage.error(error.value!)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    requests,
    loading,
    error,
    currentInstanceId,
    pendingRequestDetail,
    setCurrentInstance,
    setPendingRequestDetail,
    consumePendingRequestDetail,
    fetchRequests,
    resetRequests
  }
})
