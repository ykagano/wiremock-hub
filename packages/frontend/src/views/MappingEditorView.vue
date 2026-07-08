<template>
  <div class="mapping-editor">
    <div class="page-header">
      <h2>{{ isNew ? t('editor.newMapping') : t('editor.title') }}</h2>
      <div class="header-actions">
        <el-button @click="goBack">
          <el-icon><Back /></el-icon>
          {{ t('common.back') }}
        </el-button>
        <el-tooltip
          v-if="!isNew"
          :disabled="!isFaultOrProxyResponse(formData.response)"
          :content="t('mappings.testDisabledFaultProxy')"
          placement="bottom"
        >
          <span>
            <el-button
              type="success"
              :disabled="isFaultOrProxyResponse(formData.response)"
              @click="openTestDialog"
            >
              <el-icon><CaretRight /></el-icon>
              {{ t('stubTest.testButton') }}
            </el-button>
          </span>
        </el-tooltip>
        <el-button type="primary" @click="handleSave" :loading="saving">
          <el-icon><Check /></el-icon>
          {{ t('common.save') }}
        </el-button>
      </div>
    </div>

    <!-- Basic Info (always visible above tabs) -->
    <el-card class="basic-info-card">
      <el-form
        :model="formData"
        :label-width="isMobile ? undefined : '150px'"
        :label-position="isMobile ? 'top' : 'left'"
      >
        <!-- Name -->
        <el-form-item :label="t('editor.stubName')">
          <el-input v-model="formData.name" :placeholder="t('editor.placeholder.stubName')" />
        </el-form-item>

        <!-- Description -->
        <el-form-item :label="t('editor.stubDescription')" class="description-item">
          <el-input
            v-model="stubDescription"
            type="textarea"
            :rows="2"
            :placeholder="t('editor.placeholder.stubDescription')"
          />
        </el-form-item>
      </el-form>
    </el-card>

    <el-tabs v-model="activeTab" type="card">
      <!-- Request settings -->
      <el-tab-pane :label="t('editor.request')" name="request">
        <el-card>
          <el-form
            :model="formData"
            :label-width="isMobile ? undefined : '150px'"
            :label-position="isMobile ? 'top' : 'left'"
          >
            <!-- Method -->
            <el-form-item :label="t('editor.requestMethod')">
              <el-select
                v-model="formData.request.method"
                :placeholder="t('labels.selectMethod')"
                clearable
              >
                <el-option label="GET" value="GET" />
                <el-option label="POST" value="POST" />
                <el-option label="PUT" value="PUT" />
                <el-option label="DELETE" value="DELETE" />
                <el-option label="PATCH" value="PATCH" />
                <el-option label="HEAD" value="HEAD" />
                <el-option label="OPTIONS" value="OPTIONS" />
              </el-select>
            </el-form-item>

            <!-- URL -->
            <el-form-item :label="t('editor.requestUrl')" required>
              <el-radio-group v-model="urlType" @change="handleUrlTypeChange">
                <el-radio value="url">{{ t('labels.urlMatch.exact') }}</el-radio>
                <el-radio value="urlPattern">{{ t('labels.urlMatch.regex') }}</el-radio>
                <el-radio value="urlPath">{{ t('labels.urlMatch.path') }}</el-radio>
                <el-radio value="urlPathPattern">{{ t('labels.urlMatch.pathPattern') }}</el-radio>
              </el-radio-group>
              <el-input
                v-model="urlValue"
                :placeholder="t('editor.placeholder.url')"
                style="margin-top: 8px"
              />
            </el-form-item>

            <!-- Headers -->
            <el-form-item :label="t('editor.requestHeaders')">
              <KeyValueEditor v-model="formData.request.headers" />
            </el-form-item>

            <!-- Query parameters -->
            <el-form-item :label="t('editor.queryParameters')">
              <KeyValueEditor v-model="formData.request.queryParameters" />
            </el-form-item>

            <!-- Body -->
            <el-form-item :label="t('editor.requestBody')" data-testid="request-body">
              <div style="width: 100%">
                <el-tabs v-model="requestBodyTab" type="border-card">
                  <el-tab-pane
                    :label="t('editor.text')"
                    name="text"
                    :disabled="hasNonExactBodyPattern"
                  >
                    <MonacoEditor v-model="requestBodyText" language="json" height="300px" />
                  </el-tab-pane>
                  <el-tab-pane :label="t('editor.bodyPatterns')" name="patterns">
                    <BodyPatternsEditor v-model="formData.request.bodyPatterns" />
                  </el-tab-pane>
                </el-tabs>
                <div v-if="hasNonExactBodyPattern" class="body-text-disabled-hint">
                  {{ t('editor.bodyTextTabDisabled') }}
                </div>
              </div>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- Response settings -->
      <el-tab-pane :label="t('editor.response')" name="response">
        <el-card>
          <el-form
            :model="formData"
            :label-width="isMobile ? undefined : '150px'"
            :label-position="isMobile ? 'top' : 'left'"
          >
            <!-- Status code -->
            <el-form-item :label="t('editor.responseStatus')">
              <el-input-number v-model="formData.response.status" :min="100" :max="599" />
            </el-form-item>

            <!-- Response headers -->
            <el-form-item :label="t('editor.responseHeaders')">
              <KeyValueEditor v-model="formData.response.headers" multi-value />
            </el-form-item>

            <!-- Response body -->
            <el-form-item :label="t('editor.responseBody')" data-testid="response-body">
              <MonacoEditor v-model="responseBody" language="json" height="300px" />
            </el-form-item>

            <!-- Delay -->
            <el-form-item :label="t('editor.responseDelay')">
              <el-input-number
                v-model="formData.response.fixedDelayMilliseconds"
                :min="0"
                :step="100"
              />
              <span style="margin-left: 8px">{{ t('labels.ms') }}</span>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- Advanced settings -->
      <el-tab-pane :label="t('editor.advanced')" name="advanced">
        <el-card>
          <el-form
            :model="formData"
            :label-width="isMobile ? undefined : '150px'"
            :label-position="isMobile ? 'top' : 'left'"
          >
            <!-- Priority -->
            <el-form-item :label="t('editor.priority')">
              <el-input-number v-model="formData.priority" :min="1" />
              <el-alert type="info" :closable="false" style="margin-top: 8px">
                {{ t('labels.priorityHint') }}
              </el-alert>
            </el-form-item>

            <!-- Scenario -->
            <el-form-item :label="t('editor.scenario')">
              <el-input
                v-model="formData.scenarioName"
                :placeholder="t('editor.placeholder.scenario')"
              />
            </el-form-item>

            <el-form-item :label="t('editor.requiredState')">
              <el-input
                v-model="formData.requiredScenarioState"
                :placeholder="t('editor.placeholder.requiredState')"
                :disabled="!formData.scenarioName"
              />
            </el-form-item>

            <el-form-item :label="t('editor.newState')">
              <el-input
                v-model="formData.newScenarioState"
                :placeholder="t('editor.placeholder.newState')"
                :disabled="!formData.scenarioName"
              />
            </el-form-item>

            <!-- Persistence -->
            <el-form-item :label="t('editor.persistent')">
              <el-switch v-model="formData.persistent" />
              <el-alert type="info" :closable="false" style="margin-top: 8px">
                {{ t('labels.persistentHint') }}
              </el-alert>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- JSON view -->
      <el-tab-pane :label="t('editor.json')" name="json">
        <el-card>
          <JsonEditor :modelValue="formData" @update:modelValue="handleJsonUpdate" :rows="25" />
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <StubTestDialog v-model="testDialogVisible" :stub-id="currentStubId" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useMappingStore } from '@/stores/mapping';
import { useResponsive } from '@/composables/useResponsive';
import { stubApi } from '@/services/api';
import { ElMessage } from 'element-plus';
import {
  isFaultOrProxyResponse,
  joinMultiValue,
  type BodyPattern,
  type Mapping
} from '@wiremock-hub/shared';
import { toMapping } from '@/utils/wiremock';
import JsonEditor from '@/components/mapping/JsonEditor.vue';
import KeyValueEditor from '@/components/mapping/KeyValueEditor.vue';
import BodyPatternsEditor from '@/components/mapping/BodyPatternsEditor.vue';
import StubTestDialog from '@/components/mapping/StubTestDialog.vue';
import MonacoEditor from '@/components/common/MonacoEditor.vue';

const { t } = useI18n();
const { isMobile } = useResponsive();
const route = useRoute();
const router = useRouter();
const mappingStore = useMappingStore();

const activeTab = ref('request');
const saving = ref(false);
const testDialogVisible = ref(false);
const currentStubId = computed(() => (route.params.id as string) || '');
const urlType = ref<'url' | 'urlPattern' | 'urlPath' | 'urlPathPattern'>('url');
const urlValue = ref('');
const requestBodyText = ref('');
const requestBodyMatchType = ref<'equalTo' | 'equalToJson'>('equalTo');
const requestBodyTab = ref('text');

const isNew = computed(() => route.name === 'mapping-new');

const responseBody = computed({
  get: () => {
    if (formData.response.body !== undefined) return formData.response.body;
    if (formData.response.jsonBody !== undefined) {
      return JSON.stringify(formData.response.jsonBody, null, 2);
    }
    return '';
  },
  set: (val: string) => {
    if (!val) {
      formData.response.body = undefined;
      delete formData.response.jsonBody;
      return;
    }
    // Try to parse as JSON and store as jsonBody if Content-Type is JSON
    // (multi-value headers are arrays, so normalize before matching)
    const contentType = joinMultiValue(formData.response.headers?.['Content-Type'] || '');
    if (contentType.includes('json')) {
      try {
        formData.response.jsonBody = JSON.parse(val);
        formData.response.body = undefined;
        return;
      } catch {
        // Not valid JSON, fall through to body
      }
    }
    formData.response.body = val;
    delete formData.response.jsonBody;
  }
});

const stubDescription = ref('');

const formData = reactive<Mapping>({
  request: {
    method: 'GET'
  },
  response: {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  },
  priority: 5,
  persistent: true
});

// Patterns the text helper cannot represent (matchesJsonPath, contains, matches, ...)
// are managed via the Body Patterns / JSON editors; the Text tab is disabled for them.
// NOTE: must be declared after formData — the immediate watch evaluates the computed during setup.
const hasNonExactBodyPattern = computed(() =>
  (formData.request?.bodyPatterns ?? []).some(
    (p) => p.equalTo === undefined && p.equalToJson === undefined
  )
);

watch(
  hasNonExactBodyPattern,
  (disabled) => {
    if (disabled && requestBodyTab.value === 'text') {
      requestBodyTab.value = 'patterns';
    }
  },
  { immediate: true }
);

// Handle URL type change
watch(urlValue, (newValue) => {
  // Clear existing URL settings
  delete formData.request.url;
  delete formData.request.urlPattern;
  delete formData.request.urlPath;
  delete formData.request.urlPathPattern;

  // Set new value
  if (newValue) {
    formData.request[urlType.value] = newValue;
  }
});

function handleUrlTypeChange() {
  const currentValue = urlValue.value;
  delete formData.request.url;
  delete formData.request.urlPattern;
  delete formData.request.urlPath;
  delete formData.request.urlPathPattern;

  if (currentValue) {
    formData.request[urlType.value] = currentValue;
  }
}

// Sync helper refs (urlType, urlValue, requestBodyText) from request data
function syncHelperRefsFromRequest(req: Mapping['request']) {
  if (req.url) {
    urlType.value = 'url';
    urlValue.value = req.url;
  } else if (req.urlPattern) {
    urlType.value = 'urlPattern';
    urlValue.value = req.urlPattern;
  } else if (req.urlPath) {
    urlType.value = 'urlPath';
    urlValue.value = req.urlPath;
  } else if (req.urlPathPattern) {
    urlType.value = 'urlPathPattern';
    urlValue.value = req.urlPathPattern;
  } else {
    urlValue.value = '';
  }

  syncBodyTextFromPatterns(req.bodyPatterns);
}

// Derive the Text-tab helper (requestBodyText / requestBodyMatchType) from the
// first exact body pattern. Non-exact patterns leave the (disabled) Text tab empty.
function syncBodyTextFromPatterns(bodyPatterns?: BodyPattern[]) {
  const bp = bodyPatterns?.[0];
  if (bp?.equalToJson) {
    requestBodyText.value = bp.equalToJson;
    requestBodyMatchType.value = 'equalToJson';
  } else {
    requestBodyText.value = bp?.equalTo || '';
    requestBodyMatchType.value = 'equalTo';
  }
}

// Persist the Text-tab helper into formData.request.bodyPatterns. No-op when
// non-exact patterns are present (the Text tab is disabled for them).
function flushBodyTextToPatterns() {
  if (hasNonExactBodyPattern.value) return;
  if (requestBodyText.value) {
    formData.request.bodyPatterns = [{ [requestBodyMatchType.value]: requestBodyText.value }];
  } else {
    delete formData.request.bodyPatterns;
  }
}

// Keep the two body editors consistent when switching tabs so the active tab
// always reflects the current body ("what you see is what gets saved").
watch(requestBodyTab, (tab, prev) => {
  if (tab === prev) return;
  if (prev === 'text') flushBodyTextToPatterns();
  if (tab === 'text') syncBodyTextFromPatterns(formData.request.bodyPatterns);
});

// Initialization
onMounted(async () => {
  // Pre-fill scenarioName from query parameter (e.g. from ScenariosView "Create new stub")
  const queryScenarioName = route.query.scenarioName as string | undefined;
  if (isNew.value && queryScenarioName) {
    formData.scenarioName = queryScenarioName;
    const queryRequiredState = route.query.requiredScenarioState as string | undefined;
    formData.requiredScenarioState = queryRequiredState || 'Started';
  }

  if (!isNew.value) {
    const id = route.params.id as string;
    try {
      // Fetch the latest stub data from API
      const stub = await stubApi.get(id);
      const mapping = toMapping(stub);

      // Load description from stub (not from mapping)
      stubDescription.value = stub.description || '';

      if (mapping) {
        Object.assign(formData, JSON.parse(JSON.stringify(mapping)));
        // Restore name from stub DB column (mapping may not contain it after import cleanup)
        formData.name = stub.name || formData.name;
        syncHelperRefsFromRequest(mapping.request);
      }
    } catch (error) {
      console.error('Failed to load mapping:', error);
      ElMessage.error(t('messages.mapping.loadFailed'));
    }
  }
});

async function handleSave() {
  // Validation: fault/proxy responses have no fixed status (WireMock ignores it)
  if (!formData.response.status && !isFaultOrProxyResponse(formData.response)) {
    ElMessage.error(t('messages.mapping.statusRequired'));
    return;
  }

  if (!urlValue.value) {
    ElMessage.error(t('messages.mapping.urlRequired'));
    return;
  }

  // el-input-number emits null when cleared; drop it so no "status": null persists
  if (formData.response.status == null) {
    delete formData.response.status;
  }

  saving.value = true;
  try {
    // Sync the Text tab into bodyPatterns only when it is the active editor. On the
    // Body Patterns tab, formData.request.bodyPatterns is already maintained by
    // BodyPatternsEditor (v-model), so overwriting it from the empty/stale Text
    // field would silently drop exact (equalTo / equalToJson) patterns.
    if (requestBodyTab.value === 'text') {
      flushBodyTextToPatterns();
    }

    if (isNew.value) {
      await mappingStore.createMapping(formData, stubDescription.value);
      ElMessage.success(t('messages.mapping.created'));
    } else {
      const id = route.params.id as string;
      await mappingStore.updateMapping(id, formData, stubDescription.value);
      ElMessage.success(t('messages.mapping.updated'));
    }

    router.push('/mappings');
  } catch (error: any) {
    console.error('Failed to save mapping:', error);
    ElMessage.error(error.message || t('messages.mapping.saveFailed'));
  } finally {
    saving.value = false;
  }
}

function handleJsonUpdate(newValue: Mapping | undefined) {
  if (newValue) {
    // Clear all existing keys, then merge new data
    for (const key of Object.keys(formData)) {
      delete (formData as any)[key];
    }
    Object.assign(formData, newValue);
    syncHelperRefsFromRequest(formData.request || {});
  }
}

function goBack() {
  router.push('/mappings');
}

function openTestDialog() {
  testDialogVisible.value = true;
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
  gap: 12px;
}

.basic-info-card {
  margin-bottom: 16px;
}

.description-item {
  margin-bottom: 0;
}

/* Prevent Monaco Editor from expanding beyond its parent flex/block chain */
:deep(.el-card__body) {
  overflow: hidden;
}

/* Make border-card tabs fill the full form-item width */
:deep(.el-form-item__content > .el-tabs--border-card) {
  width: 100%;
}

.body-text-disabled-hint {
  color: var(--el-color-warning);
  font-size: 12px;
  margin-top: 4px;
}
</style>
