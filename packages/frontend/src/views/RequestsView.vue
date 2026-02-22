<template>
  <div class="request-log">
    <div class="page-header">
      <h2>{{ t('requests.title') }}</h2>
      <div class="header-actions">
        <el-select
          v-model="selectedInstanceId"
          :placeholder="t('requests.selectInstance')"
          :style="{ width: isMobile ? '100%' : '200px', marginRight: isMobile ? '0' : '12px', marginBottom: isMobile ? '8px' : '0' }"
          @change="onInstanceChange"
        >
          <el-option
            v-for="instance in wiremockInstances"
            :key="instance.id"
            :label="instance.name"
            :value="instance.id"
          />
        </el-select>
        <el-button @click="fetchRequests" :loading="loading" :disabled="!selectedInstanceId">
          <el-icon><Refresh /></el-icon>
          {{ t('requests.refresh') }}
        </el-button>
        <el-button type="danger" plain @click="confirmClear" :disabled="!selectedInstanceId">
          <el-icon><Delete /></el-icon>
          {{ t('requests.clear') }}
        </el-button>
      </div>
    </div>

    <el-empty v-if="wiremockInstances.length === 0" :description="t('requests.noInstances')" />

    <el-empty v-else-if="!selectedInstanceId" :description="t('requests.selectInstance')" />

    <template v-else>
      <RequestFilter @filter-change="onFilterChange" />

      <el-tabs v-model="activeTab">
        <el-tab-pane :label="`${t('requests.all')} (${filteredRequests.length})`" name="all">
          <RequestTable :requests="filteredRequests" @row-click="onRequestClick" />
        </el-tab-pane>
        <el-tab-pane :label="`${t('requests.matched')} (${filteredMatchedRequests.length})`" name="matched">
          <RequestTable :requests="filteredMatchedRequests" @row-click="onRequestClick" />
        </el-tab-pane>
        <el-tab-pane :label="`${t('requests.unmatched')} (${filteredUnmatchedRequests.length})`" name="unmatched">
          <RequestTable :requests="filteredUnmatchedRequests" @row-click="onRequestClick" />
        </el-tab-pane>
      </el-tabs>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useRequestStore } from '@/stores/request'
import { useProjectStore } from '@/stores/project'
import { ElMessage, ElMessageBox } from 'element-plus'
import RequestTable from '@/components/request/RequestTable.vue'
import RequestFilter, { type FilterState } from '@/components/request/RequestFilter.vue'
import type { LoggedRequest } from '@/types/wiremock'
import { useResponsive } from '@/composables/useResponsive'

const { t } = useI18n()
const { isMobile } = useResponsive()
const router = useRouter()
const requestStore = useRequestStore()
const projectStore = useProjectStore()
const { requests, loading } = storeToRefs(requestStore)
const { wiremockInstances } = storeToRefs(projectStore)

const activeTab = ref('all')
const selectedInstanceId = ref<string | null>(null)

const filter = reactive<FilterState>({
  urlPattern: '',
  method: '',
  statusFrom: undefined,
  statusTo: undefined
})

function applyFilter(requestList: LoggedRequest[]): LoggedRequest[] {
  if (!requestList) return []
  return requestList.filter(r => {
    // Null check for request object
    if (!r || !r.request) {
      return false
    }
    // URL filter
    if (filter.urlPattern && !r.request.url?.toLowerCase().includes(filter.urlPattern.toLowerCase())) {
      return false
    }
    // Method filter
    if (filter.method && r.request.method !== filter.method) {
      return false
    }
    // Status filter
    const status = r.response?.status || r.responseDefinition?.status
    if (filter.statusFrom && (!status || status < filter.statusFrom)) {
      return false
    }
    if (filter.statusTo && (!status || status > filter.statusTo)) {
      return false
    }
    return true
  })
}

const filteredRequests = computed(() => {
  return applyFilter(requests.value)
})

const filteredMatchedRequests = computed(() => {
  return applyFilter(requests.value.filter(r => r.wasMatched))
})

const filteredUnmatchedRequests = computed(() => {
  return applyFilter(requests.value.filter(r => r.wasMatched === false))
})

function onFilterChange(newFilter: FilterState) {
  Object.assign(filter, newFilter)
}

function onRequestClick(request: LoggedRequest) {
  if (selectedInstanceId.value) {
    // For unmatched requests (wasMatched is not strictly true), store the request data in Pinia store
    // since WireMock API doesn't provide individual request lookup for unmatched requests
    const isUnmatched = request.wasMatched !== true
    if (isUnmatched) {
      requestStore.setPendingRequestDetail(request)
    }
    router.push({
      name: 'request-detail',
      params: {
        instanceId: selectedInstanceId.value,
        requestId: request.id
      }
    })
  }
}

function onInstanceChange(instanceId: string) {
  requestStore.setCurrentInstance(instanceId)
  if (instanceId) {
    fetchRequests()
  }
}

async function fetchRequests() {
  await requestStore.fetchRequests()
}

function confirmClear() {
  ElMessageBox.confirm(
    t('requests.confirmClear'),
    t('common.confirm'),
    {
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      await requestStore.resetRequests()
      ElMessage.success(t('common.success'))
    } catch (error) {
      console.error('Failed to clear requests:', error)
    }
  }).catch(() => {
    // Cancelled
  })
}

// On initialization, fetch instances and select the first one
onMounted(async () => {
  // Always fetch the latest instances if current project is set
  if (projectStore.currentProjectId) {
    await projectStore.fetchWiremockInstances(projectStore.currentProjectId)
  }

  if (wiremockInstances.value.length > 0) {
    selectedInstanceId.value = wiremockInstances.value[0].id
    onInstanceChange(selectedInstanceId.value)
  }
})

// Re-check when instance list changes
watch(wiremockInstances, (instances) => {
  if (instances.length > 0 && !selectedInstanceId.value) {
    selectedInstanceId.value = instances[0].id
    onInstanceChange(selectedInstanceId.value)
  } else if (instances.length === 0) {
    selectedInstanceId.value = null
    requestStore.setCurrentInstance(null)
  }
})
</script>

<style scoped>
.request-log {
  max-width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;
}

.page-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
</style>
