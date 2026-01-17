<template>
  <div class="request-detail">
    <div class="page-header">
      <el-button @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        {{ t('common.back') }}
      </el-button>
      <el-button type="primary" @click="openImportDialog" :disabled="!request">
        {{ t('requests.import.importAsStub') }}
      </el-button>
    </div>

    <el-skeleton v-if="loading" :rows="10" animated />

    <el-alert v-else-if="error" type="error" :title="error" :closable="false" />

    <template v-else-if="request">
      <el-card class="detail-card">
        <template #header>
          <div class="card-header">
            <span>{{ t('requests.requestSection') }}</span>
            <el-tag :type="getMethodTagType(request.request.method)" size="large">
              {{ request.request.method }}
            </el-tag>
          </div>
        </template>

        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('requests.url')">
            <code class="url-text">{{ request.request.absoluteUrl }}</code>
          </el-descriptions-item>
          <el-descriptions-item :label="t('requests.timestamp')">
            {{ formatDate(request.request.loggedDate) }}
          </el-descriptions-item>
          <el-descriptions-item v-if="request.request.clientIp" :label="t('requests.clientIp')">
            {{ request.request.clientIp }}
          </el-descriptions-item>
        </el-descriptions>

        <h4>{{ t('requests.headers') }}</h4>
        <el-table :data="requestHeaders" stripe size="small" style="width: 100%">
          <el-table-column prop="name" :label="t('requests.headerName')" width="200" />
          <el-table-column prop="value" :label="t('requests.headerValue')">
            <template #default="{ row }">
              <code class="header-value">{{ row.value }}</code>
            </template>
          </el-table-column>
        </el-table>

        <template v-if="request.request.queryParams && Object.keys(request.request.queryParams).length > 0">
          <h4>{{ t('requests.queryParams') }}</h4>
          <el-table :data="queryParams" stripe size="small" style="width: 100%">
            <el-table-column prop="name" :label="t('requests.paramName')" width="200" />
            <el-table-column prop="value" :label="t('requests.paramValue')">
              <template #default="{ row }">
                <code>{{ row.value }}</code>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-if="request.request.body">
          <h4>{{ t('requests.body') }}</h4>
          <div class="body-container">
            <pre class="body-content">{{ formatBody(request.request.body) }}</pre>
          </div>
        </template>
      </el-card>

      <el-card class="detail-card">
        <template #header>
          <div class="card-header">
            <span>{{ t('requests.responseSection') }}</span>
            <div class="response-info">
              <el-tag v-if="responseStatus" :type="getStatusTagType(responseStatus)">
                {{ responseStatus }}
              </el-tag>
              <span v-if="request.timing?.totalTime" class="response-time">
                {{ request.timing.totalTime }}ms
              </span>
            </div>
          </div>
        </template>

        <template v-if="responseHeaders.length > 0">
          <h4>{{ t('requests.headers') }}</h4>
          <el-table :data="responseHeaders" stripe size="small" style="width: 100%">
            <el-table-column prop="name" :label="t('requests.headerName')" width="200" />
            <el-table-column prop="value" :label="t('requests.headerValue')">
              <template #default="{ row }">
                <code class="header-value">{{ row.value }}</code>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <template v-if="responseBody">
          <h4>{{ t('requests.body') }}</h4>
          <div class="body-container">
            <pre class="body-content">{{ formatBody(responseBody) }}</pre>
          </div>
        </template>

        <el-empty v-if="!responseBody && responseHeaders.length === 0" :description="t('requests.noResponse')" />
      </el-card>

      <el-card v-if="request.wasMatched && request.stubMapping" class="detail-card">
        <template #header>
          <span>{{ t('requests.matchedStub') }}</span>
        </template>
        <el-descriptions :column="1" border>
          <el-descriptions-item :label="t('requests.stubName')">
            {{ request.stubMapping.name || '-' }}
          </el-descriptions-item>
          <el-descriptions-item :label="t('requests.stubId')">
            <code>{{ request.stubMapping.id || request.stubMapping.uuid }}</code>
          </el-descriptions-item>
        </el-descriptions>
      </el-card>
    </template>

    <ImportStubDialog
      v-if="request"
      v-model:visible="importDialogVisible"
      :request="request"
      :instance-id="instanceId"
      @imported="onStubImported"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { LoggedRequest } from '@/types/wiremock'
import api from '@/services/api'
import ImportStubDialog from '@/components/request/ImportStubDialog.vue'
import { useRequestStore } from '@/stores/request'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const requestStore = useRequestStore()

const instanceId = computed(() => route.params.instanceId as string)
const requestId = computed(() => route.params.requestId as string)

const loading = ref(false)
const error = ref<string | null>(null)
const request = ref<LoggedRequest | null>(null)
const importDialogVisible = ref(false)

const requestHeaders = computed(() => {
  if (!request.value?.request.headers) return []
  return Object.entries(request.value.request.headers).map(([name, value]) => ({
    name,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
  }))
})

const responseHeaders = computed(() => {
  const headers = request.value?.response?.headers || request.value?.responseDefinition?.headers
  if (!headers) return []
  return Object.entries(headers).map(([name, value]) => ({
    name,
    value: typeof value === 'object' ? JSON.stringify(value) : String(value)
  }))
})

const queryParams = computed(() => {
  if (!request.value?.request.queryParams) return []
  return Object.entries(request.value.request.queryParams).map(([name, value]) => ({
    name,
    value: String(value)
  }))
})

const responseStatus = computed(() => {
  return request.value?.response?.status || request.value?.responseDefinition?.status
})

const responseBody = computed(() => {
  return request.value?.response?.body || request.value?.responseDefinition?.body
})

function formatDate(timestamp: number) {
  return dayjs(timestamp).format('YYYY/MM/DD HH:mm:ss.SSS')
}

function formatBody(body: string): string {
  try {
    const parsed = JSON.parse(body)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return body
  }
}

function getMethodTagType(method: string): string {
  const types: Record<string, string> = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'danger',
    PATCH: 'info'
  }
  return types[method] || 'info'
}

function getStatusTagType(status: number): string {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'info'
  if (status >= 400 && status < 500) return 'warning'
  if (status >= 500) return 'danger'
  return 'info'
}

function goBack() {
  router.push({ name: 'requests' })
}

function openImportDialog() {
  importDialogVisible.value = true
}

function onStubImported() {
  ElMessage.success(t('requests.import.success'))
}

async function fetchRequestDetail() {
  if (!instanceId.value || !requestId.value) return

  // Check if request data was passed via Pinia store (for unmatched requests)
  const pendingRequest = requestStore.consumePendingRequestDetail()
  if (pendingRequest) {
    request.value = pendingRequest
    return
  }

  // Unmatched requests cannot be fetched individually from WireMock API
  // They need to be accessed via the store from the requests list
  if (requestId.value.startsWith('unmatched-')) {
    error.value = t('requests.unmatchedNotAvailable')
    return
  }

  loading.value = true
  error.value = null

  try {
    const response = await api.get(`/wiremock-instances/${instanceId.value}/requests/${requestId.value}`)
    if (response.data.success) {
      request.value = response.data.data
    } else {
      error.value = response.data.error || t('requests.fetchError')
    }
  } catch (e: any) {
    console.error('Failed to fetch request detail:', e)
    error.value = e.response?.data?.error || t('requests.fetchError')
  } finally {
    loading.value = false
  }
}

// Watch for route changes
watch(
  () => [route.params.instanceId, route.params.requestId],
  () => {
    fetchRequestDetail()
  },
  { immediate: true }
)
</script>

<style scoped>
.request-detail {
  max-width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.detail-card {
  margin-bottom: 16px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.response-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.response-time {
  color: #909399;
  font-size: 14px;
}

.url-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: #409eff;
  word-break: break-all;
}

.header-value {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  word-break: break-all;
}

h4 {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: #606266;
}

.body-container {
  background-color: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  max-height: 400px;
  overflow: auto;
}

.body-content {
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
