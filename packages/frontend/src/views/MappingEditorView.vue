<template>
  <div class="mapping-editor">
    <div class="page-header">
      <h2>{{ isNew ? t('editor.newMapping') : t('editor.title') }}</h2>
      <div class="header-actions">
        <el-button @click="goBack">
          <el-icon><Back /></el-icon>
          {{ t('common.back') }}
        </el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          <el-icon><Check /></el-icon>
          {{ t('common.save') }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" type="card">
      <!-- Request settings -->
      <el-tab-pane :label="t('editor.request')" name="request">
        <el-card>
          <el-form :model="formData" label-width="150px" label-position="left">
            <!-- Method -->
            <el-form-item :label="t('editor.requestMethod')">
              <el-select v-model="formData.request.method" :placeholder="t('labels.selectMethod')" clearable>
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
            <el-form-item :label="t('editor.requestUrl')">
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
            <el-form-item :label="t('editor.requestBody')">
              <el-tabs type="border-card">
                <el-tab-pane :label="t('editor.text')">
                  <el-input
                    v-model="requestBodyText"
                    type="textarea"
                    :rows="10"
                    placeholder='{"key": "value"}'
                  />
                </el-tab-pane>
                <el-tab-pane :label="t('editor.bodyPatterns')">
                  <BodyPatternsEditor v-model="formData.request.bodyPatterns" />
                </el-tab-pane>
              </el-tabs>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- Response settings -->
      <el-tab-pane :label="t('editor.response')" name="response">
        <el-card>
          <el-form :model="formData" label-width="150px" label-position="left">
            <!-- Status code -->
            <el-form-item :label="t('editor.responseStatus')" required>
              <el-input-number
                v-model="formData.response.status"
                :min="100"
                :max="599"
              />
            </el-form-item>

            <!-- Response body -->
            <el-form-item :label="t('editor.responseBody')">
              <el-input
                v-model="formData.response.body"
                type="textarea"
                :rows="10"
                placeholder='{"message": "success"}'
                class="full-width-textarea"
              />
            </el-form-item>

            <!-- Response headers -->
            <el-form-item :label="t('editor.responseHeaders')">
              <KeyValueEditor v-model="formData.response.headers" />
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
          <el-form :model="formData" label-width="150px" label-position="left">
            <!-- Priority -->
            <el-form-item :label="t('editor.priority')">
              <el-input-number v-model="formData.priority" :min="1" />
              <el-alert
                type="info"
                :closable="false"
                style="margin-top: 8px"
              >
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
              <el-alert
                type="info"
                :closable="false"
                style="margin-top: 8px"
              >
                {{ t('labels.persistentHint') }}
              </el-alert>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- JSON view -->
      <el-tab-pane :label="t('editor.json')" name="json">
        <el-card>
          <JsonEditor
            v-model="formData"
            :rows="25"
          />
        </el-card>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMappingStore } from '@/stores/mapping'
import { stubApi } from '@/services/api'
import { ElMessage } from 'element-plus'
import type { Mapping } from '@/types/wiremock'
import JsonEditor from '@/components/mapping/JsonEditor.vue'
import KeyValueEditor from '@/components/mapping/KeyValueEditor.vue'
import BodyPatternsEditor from '@/components/mapping/BodyPatternsEditor.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const mappingStore = useMappingStore()

const activeTab = ref('request')
const saving = ref(false)
const urlType = ref<'url' | 'urlPattern' | 'urlPath' | 'urlPathPattern'>('url')
const urlValue = ref('')
const requestBodyText = ref('')

const isNew = computed(() => route.name === 'mapping-new')

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
})

// Handle URL type change
watch(urlValue, (newValue) => {
  // Clear existing URL settings
  delete formData.request.url
  delete formData.request.urlPattern
  delete formData.request.urlPath
  delete formData.request.urlPathPattern

  // Set new value
  if (newValue) {
    formData.request[urlType.value] = newValue
  }
})

function handleUrlTypeChange() {
  const currentValue = urlValue.value
  delete formData.request.url
  delete formData.request.urlPattern
  delete formData.request.urlPath
  delete formData.request.urlPathPattern

  if (currentValue) {
    formData.request[urlType.value] = currentValue
  }
}

// Initialization
onMounted(async () => {
  if (!isNew.value) {
    const id = route.params.id as string
    try {
      // Fetch the latest stub data from API
      const stub = await stubApi.get(id)
      const mapping = stub.mapping as unknown as Mapping

      if (mapping) {
        Object.assign(formData, JSON.parse(JSON.stringify(mapping)))

        // Detect URL type
        if (mapping.request.url) {
          urlType.value = 'url'
          urlValue.value = mapping.request.url
        } else if (mapping.request.urlPattern) {
          urlType.value = 'urlPattern'
          urlValue.value = mapping.request.urlPattern
        } else if (mapping.request.urlPath) {
          urlType.value = 'urlPath'
          urlValue.value = mapping.request.urlPath
        } else if (mapping.request.urlPathPattern) {
          urlType.value = 'urlPathPattern'
          urlValue.value = mapping.request.urlPathPattern
        }

        // Request body
        if (mapping.request.bodyPatterns && mapping.request.bodyPatterns[0]?.equalTo) {
          requestBodyText.value = mapping.request.bodyPatterns[0].equalTo
        }
      }
    } catch (error) {
      console.error('Failed to load mapping:', error)
      ElMessage.error(t('messages.mapping.loadFailed'))
    }
  }
})

async function handleSave() {
  // Validation
  if (!formData.response.status) {
    ElMessage.error(t('messages.mapping.statusRequired'))
    return
  }

  if (!urlValue.value) {
    ElMessage.error(t('messages.mapping.urlRequired'))
    return
  }

  saving.value = true
  try {
    // Convert request body to bodyPatterns
    if (requestBodyText.value && !formData.request.bodyPatterns) {
      formData.request.bodyPatterns = [
        { equalTo: requestBodyText.value }
      ]
    }

    if (isNew.value) {
      await mappingStore.createMapping(formData)
      ElMessage.success(t('messages.mapping.created'))
    } else {
      const id = route.params.id as string
      await mappingStore.updateMapping(id, formData)
      ElMessage.success(t('messages.mapping.updated'))
    }

    router.push('/mappings')
  } catch (error: any) {
    console.error('Failed to save mapping:', error)
    ElMessage.error(error.message || t('messages.mapping.saveFailed'))
  } finally {
    saving.value = false
  }
}

function goBack() {
  router.push('/mappings')
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

.full-width-textarea {
  width: 100%;
}

.full-width-textarea :deep(textarea) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}
</style>
