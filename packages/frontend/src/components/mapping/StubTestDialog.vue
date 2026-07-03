<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="handleClose"
    :title="`${t('stubTest.title')}: ${stubName}`"
    width="min(800px, 90vw)"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <!-- Request Preview -->
    <h4 style="margin-top: 0">{{ t('stubTest.requestPreview') }}</h4>
    <el-form
      :label-width="isMobile ? undefined : '120px'"
      :label-position="isMobile ? 'top' : 'left'"
    >
      <el-form-item :label="t('stubTest.method')">
        <el-tag :type="getMethodTagType(requestMethod)">{{ requestMethod }}</el-tag>
      </el-form-item>

      <el-form-item :label="t('stubTest.url')">
        <el-input
          v-model="requestUrl"
          :placeholder="isPatternUrl ? t('stubTest.urlPlaceholder') : ''"
        />
        <div
          v-if="isPatternUrl"
          style="color: var(--el-color-warning); font-size: 12px; margin-top: 4px"
        >
          {{ t('stubTest.urlRequired') }}
        </div>
      </el-form-item>

      <el-form-item :label="t('stubTest.headers')">
        <KeyValueEditor v-model="requestHeaders" />
      </el-form-item>

      <el-form-item :label="t('stubTest.queryParameters')">
        <KeyValueEditor v-model="requestQueryParams" />
      </el-form-item>

      <el-form-item :label="t('stubTest.body')">
        <el-input
          v-model="requestBody"
          type="textarea"
          :rows="6"
          :placeholder="t('stubTest.bodyPlaceholder')"
          data-testid="stub-test-body"
          style="font-family: monospace"
        />
        <div v-if="bodyHints.length > 0" class="body-hint">
          {{ t('stubTest.bodyHint', { patterns: bodyHints.join(', ') }) }}
        </div>
      </el-form-item>
    </el-form>

    <!-- Send Button -->
    <div style="text-align: center; margin-bottom: 16px">
      <el-button type="primary" @click="handleSendTest" :loading="testing">
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
        :title="
          t('stubTest.summary', {
            passed: testResult.summary.passed,
            total: testResult.summary.total
          })
        "
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
                >{{ t('stubTest.bodyMatch') }}</el-tag
              >
              <el-tag
                v-else-if="isBodyMatched(row.expectedBody, row.actualBody) === false"
                type="warning"
                size="small"
                >{{ t('stubTest.bodyMismatch') }}</el-tag
              >
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
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import {
  extractEqualToValues,
  generateSampleBody,
  type StubTestRequest
} from '@wiremock-hub/shared';
import KeyValueEditor from '@/components/mapping/KeyValueEditor.vue';
import { useMappingStore } from '@/stores/mapping';
import { useResponsive } from '@/composables/useResponsive';
import { getMethodTagType, toMapping } from '@/utils/wiremock';

const { t } = useI18n();
const { isMobile } = useResponsive();

const props = defineProps<{
  modelValue: boolean;
  stubId: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

const mappingStore = useMappingStore();
const { testResult, testError, testing } = storeToRefs(mappingStore);

const stubName = ref('');
const requestMethod = ref('GET');
const requestUrl = ref('');
const requestHeaders = ref<Record<string, string> | undefined>({});
const requestQueryParams = ref<Record<string, string> | undefined>({});
const requestBody = ref('');
const bodyHints = ref<string[]>([]);
const isPatternUrl = ref(false);

// Build request from mapping when dialog opens
watch(
  () => props.modelValue,
  (visible) => {
    if (visible && props.stubId) {
      mappingStore.clearTestResult();
      buildRequestFromMapping();
    }
  }
);

function buildRequestFromMapping() {
  const stub = mappingStore.getStubById(props.stubId);
  if (!stub) return;

  const mapping = toMapping(stub);
  stubName.value =
    stub.name ||
    mapping.name ||
    `${mapping.request.method || 'GET'} ${mapping.request.url || mapping.request.urlPath || mapping.request.urlPattern || mapping.request.urlPathPattern || '/'}`;

  // Method
  requestMethod.value = mapping.request.method || 'GET';

  // URL
  isPatternUrl.value = false;
  if (mapping.request.url) {
    requestUrl.value = mapping.request.url;
  } else if (mapping.request.urlPath) {
    requestUrl.value = mapping.request.urlPath;
  } else if (mapping.request.urlPattern || mapping.request.urlPathPattern) {
    // Prefill the pattern itself as a starting point; the user edits it into a concrete URL
    isPatternUrl.value = true;
    requestUrl.value = mapping.request.urlPattern || mapping.request.urlPathPattern || '';
  } else {
    requestUrl.value = '/';
  }

  // Headers / query parameters (extract equalTo values)
  requestHeaders.value = extractEqualToValues(mapping.request.headers);
  requestQueryParams.value = extractEqualToValues(mapping.request.queryParameters);

  // Body: generate a sample that satisfies the stub's body patterns
  const sample = generateSampleBody(mapping.request.bodyPatterns);
  requestBody.value = sample.body ?? '';
  bodyHints.value = sample.hints;
}

async function handleSendTest() {
  // Send the full edited request; the backend uses these as-is instead of the stub's values
  const overrides: StubTestRequest = {
    headers: requestHeaders.value ?? {},
    queryParameters: requestQueryParams.value ?? {},
    body: requestBody.value
  };

  if (requestUrl.value) {
    overrides.url = requestUrl.value;
  }

  await mappingStore.testStub(props.stubId, overrides);
}

function handleClose(val: boolean) {
  if (!val) {
    mappingStore.clearTestResult();
  }
  emit('update:modelValue', val);
}

function getSummaryType(summary: { total: number; passed: number; failed: number }): string {
  if (summary.passed === summary.total) return 'success';
  if (summary.passed === 0) return 'error';
  return 'warning';
}

function containsTemplate(value: string): boolean {
  return /\{\{.*?\}\}/.test(value);
}

function deepCompare(expected: unknown, actual: unknown): boolean {
  // If expected is a string containing template variables, skip comparison
  if (typeof expected === 'string' && containsTemplate(expected)) {
    return true;
  }

  // Both must be the same type
  if (typeof expected !== typeof actual) return false;

  // Primitives: exact match
  if (expected === null || actual === null) return expected === actual;
  if (typeof expected !== 'object') return expected === actual;

  // Arrays
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || expected.length !== actual.length) return false;
    return expected.every((item, i) => deepCompare(item, actual[i]));
  }

  // Objects
  if (Array.isArray(actual)) return false;
  const expectedObj = expected as Record<string, unknown>;
  const actualObj = actual as Record<string, unknown>;
  const expectedKeys = Object.keys(expectedObj);
  const actualKeys = Object.keys(actualObj);
  if (expectedKeys.length !== actualKeys.length) return false;
  return expectedKeys.every(
    (key) => key in actualObj && deepCompare(expectedObj[key], actualObj[key])
  );
}

function isBodyMatched(expected?: string, actual?: string): boolean | null {
  if (expected === undefined || expected === null) return null;
  if (actual === undefined || actual === null) return false;

  try {
    const expectedObj = JSON.parse(expected);
    const actualObj = JSON.parse(actual);
    return deepCompare(expectedObj, actualObj);
  } catch {
    // Non-JSON: if expected contains template, treat as match
    if (containsTemplate(expected)) return true;
    return expected === actual;
  }
}

function formatBody(body?: string): string {
  if (!body) return '-';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
</script>

<style scoped>
.body-hint {
  color: var(--el-color-warning);
  font-size: 12px;
  margin-top: 4px;
}

.expand-detail {
  padding: 16px;
}

.body-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 768px) {
  .body-comparison {
    grid-template-columns: 1fr;
  }
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
