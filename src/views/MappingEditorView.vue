<template>
  <div class="mapping-editor">
    <div class="page-header">
      <h2>{{ isNew ? t('editor.newMapping') : t('editor.title') }}</h2>
      <div class="header-actions">
        <el-button @click="goBack">
          <el-icon><Back /></el-icon>
          {{ t('common.back') }}
        </el-button>
        <el-button type="primary" @click="saveMapping">
          <el-icon><Check /></el-icon>
          {{ t('common.save') }}
        </el-button>
      </div>
    </div>

    <el-alert
      type="info"
      :closable="false"
      style="margin-bottom: 20px"
    >
      <template #title>
        スタブエディタは次のフェーズで実装します
      </template>
    </el-alert>

    <el-card>
      <pre>{{ route.params }}</pre>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const isNew = computed(() => route.name === 'mapping-new')

function goBack() {
  router.push('/mappings')
}

function saveMapping() {
  // 次のフェーズで実装
}
</script>

<style scoped>
.mapping-editor {
  max-width: 1200px;
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
