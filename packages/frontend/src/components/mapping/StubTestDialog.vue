<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="handleClose"
    :title="`${t('stubTest.title')}: ${stubName}`"
    width="800px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <!-- Request Preview -->
    <h4 style="margin-top: 0">{{ t('stubTest.requestPreview') }}</h4>
    <el-form label-width="120px" label-position="left">
      <el-form-item :label="t('stubTest.method')">
        <el-tag :type="getMethodTagType(requestMethod)">{{ requestMethod }}</el-tag>
      </el-form-item>

      <el-form-item :label="t('stubTest.url')">
        <el-input
          v-model="requestUrl"
          :placeholder="isPatternUrl ? t('stubTest.urlPlaceholder') : ''"
        />
        <div v-if="isPatternUrl" style="color: var(--el-color-warning); font-size: 12px; margin-top: 4px">
          {{ t('stubTest.urlRequired') }}
        </div>
      </el-form-item>

      <el-form-item v-if="Object.keys(requestHeaders).length > 0" :label="t('stubTest.headers')">
        <div class="headers-display">
          <div v-for="(value, key) in requestHeaders" :key="key" class="header-row">
            <code>{{ key }}: {{ value }}</code>
          </div>
        </div>
      </el-form-item>

      <el-form-item v-if="Object.keys(requestQueryParams).length > 0" :label="t('stubTest.queryParameters')">
        <div class="headers-display">
          <div v-for="(value, key) in requestQueryParams" :key="key" class="header-row">
            <code>{{ key }}={{ value }}</code>
          </div>
        </div>
      </el-form-item>

      <el-form-item v-if="requestBody" :label="t('stubTest.body')">
        <el-input
          v-model="requestBody"
          type="textarea"
          :rows="4"
          style="font-family: monospace"
        />
      </el-form-item>
    </el-form>

    <!-- Send Button -->
    <div style="text-align: center; margin-bottom: 16px">
      <el-button
        type="primary"
        @click="handleSendTest"
        :loading="testing"
      >
        {{ testing ? t('stubTest.sending') : t('stubTest.sendButton') }}
      </el-button>
    </div>

    <!-- Error Display -->
    <el-alert
      v-if="testError"
      :title="testError"
      type="error"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <!-- Test Results -->
    <template v-if="testResult">
      <h4>{{ t('stubTest.results') }}</h4>

      <!-- Summary -->
      <el-alert
        :title="t('stubTest.summary', { passed: testResult.summary.passed, total: testResult.summary.total })"
        :type="getSummaryType(testResult.summary)"
        show-icon
        :closable="false"
        style="margin-bottom: 16px"
      />

      <!-- Results Table -->
      <el-table :data="testResult.results" stripe>
        <el-table-column type="expand">
          <template #default="{ row }">
            <div class="expand-detail">
              <div v-if="row.error" style="margin-bottom: 12px">
                <strong>{{ t('stubTest.error') }}:</strong> {{ row.error }}
              </div>
              <div v-else class="body-comparison">
                <div class="body-column">
                  <h5>{{ t('stubTest.expectedBody') }}</h5>
                  <pre class="code-block">{{ formatBody(row.expectedBody) }}</pre>
                </div>
                <div class="body-column">
                  <h5>{{ t('stubTest.actualBody') }}</h5>
                  <pre class="code-block">{{ formatBody(row.actualBody) }}</pre>
                </div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('stubTest.instanceName')" min-width="150">
          <template #default="{ row }">
            <div>{{ row.instanceName }}</div>
            <div style="color: var(--wh-text-tertiary); font-size: 12px">{{ row.instanceUrl }}</div>
          </template>
        </el-table-column>

        <el-table-column :label="t('stubTest.status')" width="150" align="center">
          <template #default="{ row }">
            <div v-if="!row.success">
              <el-tag type="danger">{{ t('stubTest.connectionError') }}</el-tag>
            </div>
            <div v-else>
              <el-tag :type="row.matched ? 'success' : 'danger'">
                {{ row.matched ? t('stubTest.passed') : t('stubTest.failed') }}
              </el-tag>
              <div style="font-size: 12px; color: var(--wh-text-tertiary); margin-top: 4px">
                {{ row.expectedStatus }} / {{ row.actualStatus }}
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column :label="t('stubTest.bodyColumn')" width="120" align="center">
          <template #default="{ row }">
            <template v-if="!row.success">
              <span>{{ t('stubTest.bodyNA') }}</span>
            </template>
            <template v-else>
              <el-tag
                v-if="isBodyMatched(row.expectedBody, row.actualBody) === true"
                type="success"
                size="small"
              >{{ t('stubTest.bodyMatch') }}</el-tag>
              <el-tag
                v-else-if="isBodyMatched(row.expectedBody, row.actualBody) === false"
                type="warning"
                size="small"
              >{{ t('stubTest.bodyMismatch') }}</el-tag>
              <span v-else>{{ t('stubTest.bodyNA') }}</span>
            </template>
          </template>
        </el-table-column>

        <el-table-column :label="t('stubTest.responseTime')" width="100" align="center">
          <template #default="{ row }">
            {{ row.responseTimeMs ? `${row.responseTimeMs}ms` : t('stubTest.bodyNA') }}
          </template>
        </el-table-column>
      </el-table>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useMappingStore } from '@/stores/mapping'
import type { Mapping, StubTestRequest } from '@/types/wiremock'

const { t } = useI18n()

// Type guard for WireMock matcher objects with equalTo field
function isMatcherWithEqualTo(value: unknown): value is { equalTo: string } {
  return typeof value === 'object' && value !== null && 'equalTo' in value && typeof (value as Record<string, unknown>).equalTo === 'string'
}

const props = defineProps<{
  modelValue: boolean
  stubId: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const mappingStore = useMappingStore()
const { testResult, testError, testing } = storeToRefs(mappingStore)

const stubName = ref('')
const requestMethod = ref('GET')
const requestUrl = ref('')
const requestHeaders = ref<Record<string, string>>({})
const requestQueryParams = ref<Record<string, string>>({})
const requestBody = ref('')
const isPatternUrl = ref(false)

// Build request from mapping when dialog opens
watch(() => props.modelValue, (visible) => {
  if (visible && props.stubId) {
    mappingStore.clearTestResult()
    buildRequestFromMapping()
  }
})

function buildRequestFromMapping() {
  const stub = mappingStore.getStubById(props.stubId)
  if (!stub) return

  const mapping = stub.mapping as unknown as Mapping
  stubName.value = stub.name || mapping.name || `${mapping.request.method || 'GET'} ${mapping.request.url || mapping.request.urlPath || mapping.request.urlPattern || mapping.request.urlPathPattern || '/'}`

  // Method
  requestMethod.value = mapping.request.method || 'GET'

  // URL
  isPatternUrl.value = false
  if (mapping.request.url) {
    requestUrl.value = mapping.request.url
  } else if (mapping.request.urlPath) {
    requestUrl.value = mapping.request.urlPath
  } else if (mapping.request.urlPattern || mapping.request.urlPathPattern) {
    isPatternUrl.value = true
    requestUrl.value = ''
  } else {
    requestUrl.value = '/'
  }

  // Headers (extract equalTo values)
  const headers: Record<string, string> = {}
  if (mapping.request.headers) {
    for (const [key, value] of Object.entries(mapping.request.headers)) {
      if (isMatcherWithEqualTo(value)) {
        headers[key] = value.equalTo
      }
    }
  }
  requestHeaders.value = headers

  // Query parameters (extract equalTo values)
  const queryParams: Record<string, string> = {}
  if (mapping.request.queryParameters) {
    for (const [key, value] of Object.entries(mapping.request.queryParameters)) {
      if (isMatcherWithEqualTo(value)) {
        queryParams[key] = value.equalTo
      }
    }
  }
  requestQueryParams.value = queryParams

  // Body (first equalTo/equalToJson)
  requestBody.value = ''
  if (mapping.request.bodyPatterns && mapping.request.bodyPatterns.length > 0) {
    const firstPattern = mapping.request.bodyPatterns[0]
    if (firstPattern.equalToJson) {
      requestBody.value = typeof firstPattern.equalToJson === 'string'
        ? firstPattern.equalToJson
        : JSON.stringify(firstPattern.equalToJson)
    } else if (firstPattern.equalTo) {
      requestBody.value = firstPattern.equalTo
    }
  }
}

async function handleSendTest() {
  const overrides: StubTestRequest = {}

  if (requestUrl.value) {
    overrides.url = requestUrl.value
  }

  if (requestBody.value) {
    overrides.body = requestBody.value
  }

  await mappingStore.testStub(props.stubId, overrides)
}

function handleClose(val: boolean) {
  if (!val) {
    mappingStore.clearTestResult()
  }
  emit('update:modelValue', val)
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

function getSummaryType(summary: { total: number; passed: number; failed: number }): string {
  if (summary.passed === summary.total) return 'success'
  if (summary.passed === 0) return 'error'
  return 'warning'
}

function isBodyMatched(expected?: string, actual?: string): boolean | null {
  if (expected === undefined || expected === null) return null
  if (actual === undefined || actual === null) return false

  try {
    const expectedObj = JSON.parse(expected)
    const actualObj = JSON.parse(actual)
    return JSON.stringify(expectedObj) === JSON.stringify(actualObj)
  } catch {
    return expected === actual
  }
}

function formatBody(body?: string): string {
  if (!body) return '-'
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}
</script>

<style scoped>
.headers-display {
  width: 100%;
}

.header-row {
  padding: 2px 0;
}

.header-row code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

.expand-detail {
  padding: 16px;
}

.body-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.body-column h5 {
  margin: 0 0 8px 0;
  color: var(--wh-text-secondary);
}

.code-block {
  background-color: var(--wh-code-bg);
  border: 1px solid var(--wh-code-border);
  border-radius: 4px;
  padding: 12px;
  margin: 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  overflow-x: auto;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
