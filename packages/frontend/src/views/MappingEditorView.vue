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
      <!-- リクエスト設定 -->
      <el-tab-pane :label="t('editor.request')" name="request">
        <el-card>
          <el-form :model="formData" label-width="150px" label-position="left">
            <!-- メソッド -->
            <el-form-item :label="t('editor.requestMethod')">
              <el-select v-model="formData.request.method" placeholder="メソッドを選択" clearable>
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
                <el-radio value="url">完全一致</el-radio>
                <el-radio value="urlPattern">正規表現</el-radio>
                <el-radio value="urlPath">パス一致</el-radio>
                <el-radio value="urlPathPattern">パスパターン</el-radio>
              </el-radio-group>
              <el-input
                v-model="urlValue"
                placeholder="/api/users"
                style="margin-top: 8px"
              />
            </el-form-item>

            <!-- ヘッダー -->
            <el-form-item :label="t('editor.requestHeaders')">
              <KeyValueEditor v-model="formData.request.headers" />
            </el-form-item>

            <!-- クエリパラメータ -->
            <el-form-item label="Query Parameters">
              <KeyValueEditor v-model="formData.request.queryParameters" />
            </el-form-item>

            <!-- ボディ -->
            <el-form-item :label="t('editor.requestBody')">
              <el-tabs type="border-card">
                <el-tab-pane label="Text">
                  <el-input
                    v-model="requestBodyText"
                    type="textarea"
                    :rows="10"
                    placeholder='{"key": "value"}'
                  />
                </el-tab-pane>
                <el-tab-pane label="Body Patterns">
                  <BodyPatternsEditor v-model="formData.request.bodyPatterns" />
                </el-tab-pane>
              </el-tabs>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- レスポンス設定 -->
      <el-tab-pane :label="t('editor.response')" name="response">
        <el-card>
          <el-form :model="formData" label-width="150px" label-position="left">
            <!-- ステータスコード -->
            <el-form-item :label="t('editor.responseStatus')" required>
              <el-input-number
                v-model="formData.response.status"
                :min="100"
                :max="599"
              />
            </el-form-item>

            <!-- レスポンスボディ -->
            <el-form-item :label="t('editor.responseBody')">
              <el-input
                v-model="formData.response.body"
                type="textarea"
                :rows="10"
                placeholder='{"message": "success"}'
                class="full-width-textarea"
              />
            </el-form-item>

            <!-- レスポンスヘッダー -->
            <el-form-item :label="t('editor.responseHeaders')">
              <KeyValueEditor v-model="formData.response.headers" />
            </el-form-item>

            <!-- 遅延 -->
            <el-form-item :label="t('editor.responseDelay')">
              <el-input-number
                v-model="formData.response.fixedDelayMilliseconds"
                :min="0"
                :step="100"
              />
              <span style="margin-left: 8px">ミリ秒</span>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- 詳細設定 -->
      <el-tab-pane :label="t('editor.advanced')" name="advanced">
        <el-card>
          <el-form :model="formData" label-width="150px" label-position="left">
            <!-- 優先度 -->
            <el-form-item :label="t('editor.priority')">
              <el-input-number v-model="formData.priority" :min="1" />
              <el-alert
                type="info"
                :closable="false"
                style="margin-top: 8px"
              >
                優先度が高いほど先にマッチングされます（小さい数値 = 高優先度）
              </el-alert>
            </el-form-item>

            <!-- シナリオ -->
            <el-form-item :label="t('editor.scenario')">
              <el-input
                v-model="formData.scenarioName"
                placeholder="login-flow"
              />
            </el-form-item>

            <el-form-item :label="t('editor.requiredState')">
              <el-input
                v-model="formData.requiredScenarioState"
                placeholder="Started"
                :disabled="!formData.scenarioName"
              />
            </el-form-item>

            <el-form-item :label="t('editor.newState')">
              <el-input
                v-model="formData.newScenarioState"
                placeholder="LoggedIn"
                :disabled="!formData.scenarioName"
              />
            </el-form-item>

            <!-- 永続化 -->
            <el-form-item label="Persistent">
              <el-switch v-model="formData.persistent" />
              <el-alert
                type="info"
                :closable="false"
                style="margin-top: 8px"
              >
                有効にすると、WireMock再起動後もマッピングが保持されます
              </el-alert>
            </el-form-item>
          </el-form>
        </el-card>
      </el-tab-pane>

      <!-- JSON表示 -->
      <el-tab-pane label="JSON" name="json">
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

// URLタイプの変更処理
watch(urlValue, (newValue) => {
  // 既存のURL設定をクリア
  delete formData.request.url
  delete formData.request.urlPattern
  delete formData.request.urlPath
  delete formData.request.urlPathPattern

  // 新しい値を設定
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

// 初期化
onMounted(async () => {
  if (!isNew.value) {
    const id = route.params.id as string
    try {
      // APIから最新のスタブデータを取得
      const stub = await stubApi.get(id)
      const mapping = stub.mapping as unknown as Mapping

      if (mapping) {
        Object.assign(formData, JSON.parse(JSON.stringify(mapping)))

        // URLタイプを検出
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

        // リクエストボディ
        if (mapping.request.bodyPatterns && mapping.request.bodyPatterns[0]?.equalTo) {
          requestBodyText.value = mapping.request.bodyPatterns[0].equalTo
        }
      }
    } catch (error) {
      console.error('Failed to load mapping:', error)
      ElMessage.error('マッピングの読み込みに失敗しました')
    }
  }
})

async function handleSave() {
  // バリデーション
  if (!formData.response.status) {
    ElMessage.error('ステータスコードを入力してください')
    return
  }

  if (!urlValue.value) {
    ElMessage.error('URLを入力してください')
    return
  }

  saving.value = true
  try {
    // リクエストボディをbodyPatternsに変換
    if (requestBodyText.value && !formData.request.bodyPatterns) {
      formData.request.bodyPatterns = [
        { equalTo: requestBodyText.value }
      ]
    }

    if (isNew.value) {
      await mappingStore.createMapping(formData)
      ElMessage.success('マッピングを作成しました')
    } else {
      const id = route.params.id as string
      await mappingStore.updateMapping(id, formData)
      ElMessage.success('マッピングを更新しました')
    }

    router.push('/mappings')
  } catch (error: any) {
    console.error('Failed to save mapping:', error)
    ElMessage.error(error.message || '保存に失敗しました')
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
