<template>
  <el-dialog
    :model-value="visible"
    :title="t('requests.import.title')"
    width="min(600px, 90vw)"
    @update:model-value="$emit('update:visible', $event)"
    @close="resetForm"
  >
    <el-form :model="form" :label-width="isMobile ? undefined : '160px'" :label-position="isMobile ? 'top' : 'top'">
      <el-form-item :label="t('requests.import.stubName')" required>
        <el-input v-model="form.name" :placeholder="t('requests.import.placeholder.stubName')" />
      </el-form-item>

      <el-divider content-position="left">{{ t('requests.import.requestMatching') }}</el-divider>

      <el-form-item :label="t('requests.import.urlMatchType')">
        <el-select v-model="form.urlMatchType" style="width: 100%">
          <el-option :label="t('requests.import.urlMatchOptions.urlPath')" value="urlPath" />
          <el-option :label="t('requests.import.urlMatchOptions.urlPathPattern')" value="urlPathPattern" />
          <el-option :label="t('requests.import.urlMatchOptions.url')" value="url" />
          <el-option :label="t('requests.import.urlMatchOptions.urlPattern')" value="urlPattern" />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('requests.import.urlPattern')">
        <el-input v-model="form.urlPattern" />
      </el-form-item>

      <el-form-item :label="t('requests.import.matchHeaders')">
        <el-checkbox-group v-model="form.matchHeaders">
          <div v-for="header in availableRequestHeaders" :key="header" class="header-checkbox">
            <el-checkbox :label="header" :value="header">
              {{ header }}
              <el-tag v-if="sensitiveHeaders.includes(header.toLowerCase())" type="warning" size="small">
                {{ t('requests.import.sensitiveDataWarning') }}
              </el-tag>
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item v-if="request.request.body" :label="t('requests.import.bodyMatchType')">
        <el-select v-model="form.bodyMatchType" clearable style="width: 100%">
          <el-option :label="t('requests.import.noBodyMatch')" value="" />
          <el-option :label="t('requests.import.bodyMatchOptions.equalToJson')" value="equalToJson" />
          <el-option :label="t('requests.import.bodyMatchOptions.equalTo')" value="equalTo" />
          <el-option :label="t('requests.import.bodyMatchOptions.contains')" value="contains" />
          <el-option :label="t('requests.import.bodyMatchOptions.matches')" value="matches" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="form.bodyMatchType === 'equalToJson'">
        <el-checkbox v-model="form.bodyMatchOptions.ignoreArrayOrder">
          {{ t('requests.import.ignoreArrayOrder') }}
        </el-checkbox>
        <el-checkbox v-model="form.bodyMatchOptions.ignoreExtraElements">
          {{ t('requests.import.ignoreExtraElements') }}
        </el-checkbox>
      </el-form-item>

      <el-divider content-position="left">{{ t('requests.import.responseSettings') }}</el-divider>

      <el-form-item :label="t('requests.import.responseHeaders')">
        <el-checkbox-group v-model="form.responseHeaders">
          <div v-for="header in availableResponseHeaders" :key="header" class="header-checkbox">
            <el-checkbox :label="header" :value="header">{{ header }}</el-checkbox>
          </div>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item>
        <el-checkbox v-model="form.enableTemplating">
          {{ t('requests.import.enableTemplating') }}
        </el-checkbox>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">
        {{ t('common.cancel') }}
      </el-button>
      <el-button type="primary" :loading="loading" @click="handleImport">
        {{ t('requests.import.import') }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useResponsive } from '@/composables/useResponsive'
import { ElMessage } from 'element-plus'
import api from '@/services/api'
import type { LoggedRequest } from '@/types/wiremock'

const props = defineProps<{
  visible: boolean
  request: LoggedRequest
  instanceId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'imported'): void
}>()

const { t } = useI18n()
const { isMobile } = useResponsive()
const projectStore = useProjectStore()
const loading = ref(false)

const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']

const form = reactive({
  name: '',
  urlMatchType: 'urlPath' as 'url' | 'urlPath' | 'urlPattern' | 'urlPathPattern',
  urlPattern: '',
  matchHeaders: [] as string[],
  bodyMatchType: '' as '' | 'equalTo' | 'equalToJson' | 'contains' | 'matches',
  bodyMatchOptions: {
    ignoreArrayOrder: false,
    ignoreExtraElements: true
  },
  responseHeaders: ['Content-Type'] as string[],
  enableTemplating: false
})

const availableRequestHeaders = computed(() => {
  if (!props.request?.request.headers) return []
  return Object.keys(props.request.request.headers).filter(h => h.toLowerCase() !== 'host')
})

const availableResponseHeaders = computed(() => {
  const headers = props.request?.response?.headers || props.request?.responseDefinition?.headers
  if (!headers) return []
  return Object.keys(headers)
})

function extractPath(url: string): string {
  try {
    const urlObj = new URL(url, 'http://localhost')
    return urlObj.pathname
  } catch {
    return url.split('?')[0]
  }
}

function initForm() {
  if (!props.request) return

  const method = props.request.request.method
  const path = extractPath(props.request.request.url)
  form.name = `${method} ${path}`
  form.urlPattern = path

  // Default to Content-Type for header matching if available
  form.matchHeaders = []
  if (props.request.request.headers['Content-Type']) {
    form.matchHeaders.push('Content-Type')
  }

  // Default body match type for JSON requests
  if (props.request.request.body) {
    try {
      JSON.parse(props.request.request.body)
      form.bodyMatchType = 'equalToJson'
    } catch {
      form.bodyMatchType = ''
    }
  } else {
    form.bodyMatchType = ''
  }
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    initForm()
  }
})

function resetForm() {
  form.name = ''
  form.urlMatchType = 'urlPath'
  form.urlPattern = ''
  form.matchHeaders = []
  form.bodyMatchType = ''
  form.bodyMatchOptions = {
    ignoreArrayOrder: false,
    ignoreExtraElements: true
  }
  form.responseHeaders = ['Content-Type']
  form.enableTemplating = false
}

async function handleImport() {
  if (!form.name) {
    ElMessage.warning(t('requests.import.nameRequired'))
    return
  }

  if (!projectStore.currentProjectId) {
    ElMessage.error(t('requests.import.noProject'))
    return
  }

  loading.value = true

  try {
    const payload = {
      projectId: projectStore.currentProjectId,
      name: form.name,
      urlMatchType: form.urlMatchType,
      urlPattern: form.urlPattern,
      matchHeaders: form.matchHeaders,
      bodyMatchType: form.bodyMatchType || undefined,
      bodyMatchOptions: form.bodyMatchType === 'equalToJson' ? form.bodyMatchOptions : undefined,
      responseHeaders: form.responseHeaders,
      enableTemplating: form.enableTemplating
    }

    await api.post(`/wiremock-instances/${props.instanceId}/requests/${props.request.id}/import`, payload)

    emit('imported')
    emit('update:visible', false)
  } catch (error: any) {
    console.error('Failed to import stub:', error)
    ElMessage.error(error.response?.data?.error || t('requests.import.failed'))
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.header-checkbox {
  display: block;
  margin-bottom: 8px;
}

.el-divider {
  margin: 24px 0 16px;
}
</style>
