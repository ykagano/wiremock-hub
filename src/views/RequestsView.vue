<template>
  <div class="request-log">
    <div class="page-header">
      <h2>{{ t('requests.title') }}</h2>
      <div class="header-actions">
        <el-button @click="fetchRequests" :loading="loading">
          <el-icon><Refresh /></el-icon>
          {{ t('requests.refresh') }}
        </el-button>
        <el-button type="danger" plain @click="confirmClear">
          <el-icon><Delete /></el-icon>
          {{ t('requests.clear') }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane :label="t('requests.all')" name="all">
        <RequestTable :requests="requests" />
      </el-tab-pane>
      <el-tab-pane :label="t('requests.matched')" name="matched">
        <RequestTable :requests="matchedRequests" />
      </el-tab-pane>
      <el-tab-pane :label="t('requests.unmatched')" name="unmatched">
        <RequestTable :requests="unmatchedOnlyRequests" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useRequestStore } from '@/stores/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import RequestTable from '@/components/request/RequestTable.vue'

const { t } = useI18n()
const requestStore = useRequestStore()
const { requests, unmatchedRequests, loading } = storeToRefs(requestStore)

const activeTab = ref('all')

const matchedRequests = computed(() => {
  return requests.value.filter(r => r.wasMatched)
})

const unmatchedOnlyRequests = computed(() => {
  return unmatchedRequests.value
})

async function fetchRequests() {
  await Promise.all([
    requestStore.fetchRequests(),
    requestStore.fetchUnmatchedRequests()
  ])
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
    // キャンセル
  })
}

onMounted(() => {
  fetchRequests()
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
</style>
