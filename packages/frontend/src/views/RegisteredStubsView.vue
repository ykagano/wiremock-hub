<template>
  <div class="registered-stubs">
    <div class="page-header">
      <h2>{{ t('registeredStubs.title') }}</h2>
      <div class="header-actions">
        <el-select
          v-model="selectedInstanceId"
          :placeholder="t('registeredStubs.selectInstance')"
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
        <el-button @click="fetchMappings" :loading="loading" :disabled="!selectedInstanceId">
          <el-icon><Refresh /></el-icon>
          {{ t('registeredStubs.refresh') }}
        </el-button>
      </div>
    </div>

    <el-empty v-if="wiremockInstances.length === 0" :description="t('registeredStubs.noInstances')" />
    <el-empty v-else-if="!selectedInstanceId" :description="t('registeredStubs.selectInstance')" />

    <template v-else>
      <el-table
        :data="paginatedMappings"
        v-loading="loading"
        stripe
        style="width: 100%"
        row-key="id"
      >
        <el-table-column type="expand">
          <template #default="{ row }">
            <div style="padding: 12px 24px;">
              <pre class="mapping-json">{{ JSON.stringify(row, null, 2) }}</pre>
            </div>
          </template>
        </el-table-column>
        <el-table-column :label="t('registeredStubs.projectName')" min-width="160">
          <template #default="{ row }">
            <el-tag v-if="row.metadata?.hub_project_name" type="success" size="small">
              {{ row.metadata.hub_project_name }}
            </el-tag>
            <el-tag v-else type="info" size="small">
              {{ t('registeredStubs.external') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('registeredStubs.method')" width="100">
          <template #default="{ row }">
            <el-tag :type="getMethodTagType(row.request?.method)" size="small">
              {{ row.request?.method || 'ANY' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column :label="t('registeredStubs.url')" min-width="250">
          <template #default="{ row }">
            {{ getUrl(row.request) }}
          </template>
        </el-table-column>
        <el-table-column :label="t('registeredStubs.status')" width="80">
          <template #default="{ row }">
            {{ row.response?.status || '—' }}
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" :label="t('registeredStubs.priority')" width="80">
          <template #default="{ row }">
            {{ row.priority ?? '—' }}
          </template>
        </el-table-column>
        <el-table-column v-if="!isMobile" :label="t('registeredStubs.scenario')" width="150">
          <template #default="{ row }">
            {{ row.scenarioName || '—' }}
          </template>
        </el-table-column>
      </el-table>

      <div v-if="mappings.length > 0" class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="mappings.length"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>

      <el-empty v-if="!loading && mappings.length === 0" :description="t('registeredStubs.noMappings')" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { wiremockInstanceApi } from '@/services/api'
import { ElMessage } from 'element-plus'
import type { Mapping } from '@/types/wiremock'
import { getMethodTagType, getUrl } from '@/utils/wiremock'
import { useResponsive } from '@/composables/useResponsive'

const { t } = useI18n()
const { isMobile } = useResponsive()
const projectStore = useProjectStore()
const { wiremockInstances } = storeToRefs(projectStore)

const selectedInstanceId = ref<string | null>(null)
const mappings = ref<Mapping[]>([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(20)

const paginatedMappings = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return mappings.value.slice(start, end)
})

function onInstanceChange(instanceId: string) {
  if (instanceId) {
    fetchMappings()
  }
}

async function fetchMappings() {
  if (!selectedInstanceId.value) return

  loading.value = true
  try {
    const data = await wiremockInstanceApi.getMappings(selectedInstanceId.value)
    mappings.value = data?.mappings || []
    currentPage.value = 1
  } catch (error) {
    console.error('Failed to fetch mappings:', error)
    mappings.value = []
    ElMessage.error(t('registeredStubs.fetchFailed'))
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  if (projectStore.currentProjectId) {
    await projectStore.fetchWiremockInstances(projectStore.currentProjectId)
  }

  if (wiremockInstances.value.length > 0) {
    selectedInstanceId.value = wiremockInstances.value[0].id
    onInstanceChange(selectedInstanceId.value)
  }
})

watch(wiremockInstances, (instances) => {
  if (instances.length > 0 && !selectedInstanceId.value) {
    selectedInstanceId.value = instances[0].id
    onInstanceChange(selectedInstanceId.value)
  } else if (instances.length === 0) {
    selectedInstanceId.value = null
    mappings.value = []
  }
})
</script>

<style scoped>
.registered-stubs {
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

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

.mapping-json {
  background-color: var(--wh-code-bg);
  border: 1px solid var(--wh-code-border);
  border-radius: 4px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}
</style>
