<template>
  <div class="mapping-list">
    <div class="page-header">
      <h2>{{ t('mappings.title') }}</h2>
      <div class="header-actions">
        <el-button @click="fetchMappings" :loading="loading">
          <el-icon><Refresh /></el-icon>
          {{ t('common.refresh') }}
        </el-button>
        <el-button @click="handleExport" :loading="loading">
          <el-icon><Download /></el-icon>
          {{ t('mappings.export') }}
        </el-button>
        <el-button type="danger" plain @click="confirmResetAll">
          <el-icon><Delete /></el-icon>
          {{ t('mappings.reset') }}
        </el-button>
        <el-button type="primary" @click="createNewMapping">
          <el-icon><Plus /></el-icon>
          {{ t('mappings.add') }}
        </el-button>
      </div>
    </div>

    <!-- Search bar -->
    <div class="search-bar">
      <el-input
        v-model="searchQuery"
        :placeholder="t('mappings.search')"
        clearable
        style="width: 300px"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
      <el-select
        v-model="filterMethod"
        :placeholder="t('mappings.method')"
        clearable
        style="width: 150px"
      >
        <el-option label="GET" value="GET" />
        <el-option label="POST" value="POST" />
        <el-option label="PUT" value="PUT" />
        <el-option label="DELETE" value="DELETE" />
        <el-option label="PATCH" value="PATCH" />
        <el-option label="OPTIONS" value="OPTIONS" />
      </el-select>
    </div>

    <!-- Loading -->
    <el-skeleton v-if="loading && mappings.length === 0" :rows="5" animated />

    <!-- When there are no mappings -->
    <el-empty
      v-else-if="!loading && filteredMappings.length === 0"
      :description="t('mappings.noMappings')"
    >
      <el-button type="primary" @click="createNewMapping">
        {{ t('mappings.add') }}
      </el-button>
    </el-empty>

    <!-- Mapping list table -->
    <el-table
      v-else
      :data="paginatedMappings"
      stripe
      style="width: 100%"
      @row-click="handleRowClick"
      class="mapping-table"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="expand-content">
            <div class="expand-section">
              <h4>{{ t('editor.request') }}</h4>
              <pre class="code-block">{{ formatRequest(row.request) }}</pre>
            </div>
            <div class="expand-section">
              <h4>{{ t('editor.response') }}</h4>
              <pre class="code-block">{{ formatResponse(row.response) }}</pre>
            </div>
          </div>
        </template>
      </el-table-column>

      <el-table-column :label="t('mappings.method')" width="100">
        <template #default="{ row }">
          <el-tag :type="getMethodTagType(row.request.method)">
            {{ row.request.method || 'ANY' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('mappings.url')" min-width="300">
        <template #default="{ row }">
          <code class="url-text">{{ getUrl(row.request) }}</code>
        </template>
      </el-table-column>

      <el-table-column :label="t('mappings.status')" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.response.status)">
            {{ row.response.status }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('mappings.priority')" width="100" align="center">
        <template #default="{ row }">
          {{ row.priority || '-' }}
        </template>
      </el-table-column>

      <el-table-column :label="t('mappings.scenario')" width="150">
        <template #default="{ row }">
          <el-tag v-if="row.scenarioName" size="small">
            {{ row.scenarioName }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column :label="t('common.actions')" width="180" fixed="right">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              size="small"
              @click.stop="editMapping(row)"
            >
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button
              size="small"
              @click.stop="copyMapping(row)"
            >
              <el-icon><CopyDocument /></el-icon>
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click.stop="confirmDelete(row)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <div class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="filteredMappings.length"
        layout="total, sizes, prev, pager, next, jumper"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useMappingStore } from '@/stores/mapping'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Mapping, MappingRequest } from '@/types/wiremock'

const { t } = useI18n()
const router = useRouter()
const mappingStore = useMappingStore()
const { mappings, loading } = storeToRefs(mappingStore)

const searchQuery = ref('')
const filterMethod = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

// Filtering
const filteredMappings = computed(() => {
  let result = mappings.value

  // Method filter
  if (filterMethod.value) {
    result = result.filter(m => m.request.method === filterMethod.value)
  }

  // Search query filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(m => {
      const url = getUrl(m.request).toLowerCase()
      const method = (m.request.method || '').toLowerCase()
      const scenario = (m.scenarioName || '').toLowerCase()
      return url.includes(query) || method.includes(query) || scenario.includes(query)
    })
  }

  return result
})

// Pagination
const paginatedMappings = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredMappings.value.slice(start, end)
})

// Helper functions
function getUrl(request: MappingRequest): string {
  return request.url || request.urlPattern || request.urlPath || request.urlPathPattern || '/'
}

function getMethodTagType(method?: string): string {
  const types: Record<string, string> = {
    GET: 'success',
    POST: 'primary',
    PUT: 'warning',
    DELETE: 'danger',
    PATCH: 'info'
  }
  return types[method || ''] || 'info'
}

function getStatusTagType(status: number): string {
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'info'
  if (status >= 400 && status < 500) return 'warning'
  if (status >= 500) return 'danger'
  return 'info'
}

function formatRequest(request: MappingRequest): string {
  return JSON.stringify(request, null, 2)
}

function formatResponse(response: any): string {
  return JSON.stringify(response, null, 2)
}

// Actions
async function fetchMappings() {
  await mappingStore.fetchMappings()
}

function createNewMapping() {
  router.push('/mappings/new')
}

function editMapping(mapping: Mapping) {
  router.push(`/mappings/${mapping.id || mapping.uuid}`)
}

function handleRowClick(row: Mapping) {
  editMapping(row)
}

async function copyMapping(mapping: Mapping) {
  try {
    const newMapping: Mapping = {
      ...mapping,
      id: undefined,
      uuid: undefined,
      name: mapping.name ? `${mapping.name} (copy)` : undefined
    }
    await mappingStore.createMapping(newMapping)
    ElMessage.success(t('common.success'))
  } catch (error) {
    console.error('Failed to copy mapping:', error)
  }
}

function confirmDelete(mapping: Mapping) {
  ElMessageBox.confirm(
    t('common.confirmDelete'),
    t('common.confirm'),
    {
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      await mappingStore.deleteMapping(mapping.id || mapping.uuid!)
      ElMessage.success(t('common.success'))
    } catch (error) {
      console.error('Failed to delete mapping:', error)
    }
  }).catch(() => {
    // Cancelled
  })
}

function confirmResetAll() {
  ElMessageBox.confirm(
    t('mappings.confirmReset'),
    t('common.confirm'),
    {
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      await mappingStore.resetMappings()
      ElMessage.success(t('common.success'))
    } catch (error) {
      console.error('Failed to reset mappings:', error)
    }
  }).catch(() => {
    // Cancelled
  })
}

async function handleExport() {
  await mappingStore.exportStubs()
}

// Initialization
onMounted(() => {
  fetchMappings()
})
</script>

<style scoped>
.mapping-list {
  max-width: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.mapping-table {
  margin-bottom: 20px;
}

.mapping-table :deep(.el-table__row) {
  cursor: pointer;
}

.mapping-table :deep(.el-table__row):hover {
  background-color: #f5f7fa;
}

.url-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: #409eff;
}

.expand-content {
  padding: 20px;
  background-color: #f5f7fa;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.expand-section h4 {
  margin: 0 0 12px 0;
  color: #606266;
  font-size: 14px;
}

.code-block {
  background-color: #ffffff;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 12px;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
