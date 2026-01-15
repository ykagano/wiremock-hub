<template>
  <div>
    <el-empty
      v-if="requests.length === 0"
      :description="t('requests.noRequests')"
    />

    <el-table
      v-else
      :data="requests"
      stripe
      style="width: 100%"
      :row-class-name="() => 'clickable-row'"
      @row-click="onRowClick"
    >
      <el-table-column :label="t('requests.timestamp')" width="180">
        <template #default="{ row }">
          {{ formatDate(row.request.loggedDate) }}
        </template>
      </el-table-column>

      <el-table-column :label="t('requests.method')" width="100">
        <template #default="{ row }">
          <el-tag :type="getMethodTagType(row.request.method)">
            {{ row.request.method }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('requests.url')" min-width="300">
        <template #default="{ row }">
          <code class="url-text">{{ row.request.url }}</code>
        </template>
      </el-table-column>

      <el-table-column :label="t('requests.status')" width="100">
        <template #default="{ row }">
          <el-tag v-if="getResponseStatus(row)" :type="getStatusTagType(getResponseStatus(row)!)">
            {{ getResponseStatus(row) }}
          </el-tag>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column :label="t('requests.responseTime')" width="100">
        <template #default="{ row }">
          <span v-if="row.timing?.totalTime">{{ row.timing.totalTime }}ms</span>
          <span v-else>-</span>
        </template>
      </el-table-column>

      <el-table-column label="Matched" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.wasMatched" type="success" size="small">
            <el-icon><Check /></el-icon>
          </el-tag>
          <el-tag v-else type="danger" size="small">
            <el-icon><Close /></el-icon>
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="t('common.actions')" width="80" align="center">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click.stop="onRowClick(row)">
            {{ t('requests.detail') }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { LoggedRequest } from '@/types/wiremock'
import dayjs from 'dayjs'

defineProps<{
  requests: LoggedRequest[]
}>()

const emit = defineEmits<{
  (e: 'row-click', request: LoggedRequest): void
}>()

const { t } = useI18n()

function formatDate(timestamp: number) {
  return dayjs(timestamp).format('YYYY/MM/DD HH:mm:ss')
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

function getResponseStatus(row: LoggedRequest): number | undefined {
  return row.response?.status || row.responseDefinition?.status
}

function onRowClick(row: LoggedRequest) {
  emit('row-click', row)
}
</script>

<style scoped>
.url-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: #409eff;
}

:deep(.clickable-row) {
  cursor: pointer;
}

:deep(.clickable-row:hover) {
  background-color: var(--el-table-row-hover-bg-color);
}
</style>
