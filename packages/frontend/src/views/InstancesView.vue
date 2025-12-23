<template>
  <div class="instances-view">
    <div class="page-header">
      <h2>{{ t('instances.title') }}</h2>
      <div class="header-actions">
        <el-button type="success" @click="syncAllInstances" :loading="syncing" :disabled="instances.length === 0">
          <el-icon><Refresh /></el-icon>
          {{ t('instances.syncAll') }}
        </el-button>
        <el-button type="primary" @click="showAddDialog = true">
          <el-icon><Plus /></el-icon>
          {{ t('instances.add') }}
        </el-button>
      </div>
    </div>

    <!-- インスタンスがない場合 -->
    <el-empty
      v-if="instances.length === 0 && !loading"
      :description="t('instances.noInstances')"
    >
      <el-button type="primary" @click="showAddDialog = true">
        {{ t('instances.addFirst') }}
      </el-button>
    </el-empty>

    <!-- インスタンス一覧 -->
    <div v-else class="instances-grid">
      <el-card
        v-for="instance in instances"
        :key="instance.id"
        class="instance-card"
        :class="{ healthy: instance.isHealthy, unhealthy: instance.isHealthy === false }"
        shadow="hover"
      >
        <template #header>
          <div class="card-header">
            <div class="instance-name">
              <el-icon :class="getHealthClass(instance)">
                <component :is="getHealthIcon(instance)" />
              </el-icon>
              <span>{{ instance.name }}</span>
            </div>
            <div class="card-actions">
              <el-button
                type="primary"
                size="small"
                @click="syncInstance(instance)"
                :loading="syncingIds.has(instance.id)"
              >
                <el-icon><Upload /></el-icon>
                {{ t('instances.sync') }}
              </el-button>
              <el-dropdown trigger="click">
                <el-button type="default" size="small" circle>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="checkHealth(instance)">
                      <el-icon><Connection /></el-icon>
                      {{ t('instances.checkHealth') }}
                    </el-dropdown-item>
                    <el-dropdown-item @click="editInstance(instance)">
                      <el-icon><Edit /></el-icon>
                      {{ t('instances.edit') }}
                    </el-dropdown-item>
                    <el-dropdown-item @click="confirmDelete(instance)">
                      <el-icon><Delete /></el-icon>
                      {{ t('instances.delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </template>

        <div class="instance-info">
          <el-icon class="info-icon"><Link /></el-icon>
          <span class="instance-url">{{ instance.url }}</span>
        </div>

        <div class="instance-status">
          <el-tag
            :type="getHealthTagType(instance)"
            size="small"
          >
            {{ getHealthText(instance) }}
          </el-tag>
          <el-tag v-if="!instance.isActive" type="info" size="small">
            {{ t('instances.inactive') }}
          </el-tag>
        </div>
      </el-card>
    </div>

    <!-- インスタンス追加/編集ダイアログ -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingInstance ? t('instances.dialog.editTitle') : t('instances.dialog.addTitle')"
      width="500px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item :label="t('instances.name')" prop="name">
          <el-input
            v-model="formData.name"
            :placeholder="t('instances.placeholder.name')"
          />
        </el-form-item>
        <el-form-item :label="t('instances.url')" prop="url">
          <el-input
            v-model="formData.url"
            :placeholder="t('instances.placeholder.url')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeDialog">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveInstance" :loading="saving">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { wiremockInstanceApi, stubApi, type WiremockInstance } from '@/services/api'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'

const { t } = useI18n()
const projectStore = useProjectStore()
const { currentProject } = storeToRefs(projectStore)

const instances = ref<WiremockInstance[]>([])
const loading = ref(false)
const saving = ref(false)
const syncing = ref(false)
const syncingIds = ref(new Set<string>())
const showAddDialog = ref(false)
const editingInstance = ref<WiremockInstance | null>(null)
const formRef = ref<FormInstance>()

const formData = reactive({
  name: '',
  url: ''
})

const formRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('instances.validation.nameRequired'), trigger: 'blur' }
  ],
  url: [
    { required: true, message: t('instances.validation.urlRequired'), trigger: 'blur' },
    {
      pattern: /^https?:\/\/.+/,
      message: t('instances.validation.urlInvalid'),
      trigger: 'blur'
    }
  ]
}))

onMounted(async () => {
  await fetchInstances()
})

async function fetchInstances() {
  if (!currentProject.value) return

  loading.value = true
  try {
    const list = await wiremockInstanceApi.list(currentProject.value.id)
    // ヘルスチェックを並列実行
    instances.value = await Promise.all(
      list.map(async (inst) => {
        try {
          const detail = await wiremockInstanceApi.get(inst.id)
          return detail
        } catch {
          return { ...inst, isHealthy: false }
        }
      })
    )
  } catch (error: any) {
    ElMessage.error(error.message || t('common.error'))
  } finally {
    loading.value = false
  }
}

function getHealthIcon(instance: WiremockInstance) {
  if (instance.isHealthy === undefined) return 'QuestionFilled'
  return instance.isHealthy ? 'CircleCheckFilled' : 'CircleCloseFilled'
}

function getHealthClass(instance: WiremockInstance) {
  if (instance.isHealthy === undefined) return 'health-unknown'
  return instance.isHealthy ? 'health-ok' : 'health-error'
}

function getHealthTagType(instance: WiremockInstance) {
  if (instance.isHealthy === undefined) return 'info'
  return instance.isHealthy ? 'success' : 'danger'
}

function getHealthText(instance: WiremockInstance) {
  if (instance.isHealthy === undefined) return t('instances.statusUnknown')
  return instance.isHealthy ? t('instances.statusHealthy') : t('instances.statusUnhealthy')
}

async function checkHealth(instance: WiremockInstance) {
  try {
    const detail = await wiremockInstanceApi.get(instance.id)
    const idx = instances.value.findIndex(i => i.id === instance.id)
    if (idx !== -1) {
      instances.value[idx] = detail
    }
    if (detail.isHealthy) {
      ElMessage.success(t('instances.healthOk'))
    } else {
      ElMessage.warning(t('instances.healthFailed'))
    }
  } catch (error: any) {
    ElMessage.error(error.message)
  }
}

async function syncInstance(instance: WiremockInstance) {
  if (!currentProject.value) return

  syncingIds.value.add(instance.id)
  try {
    const result = await stubApi.syncAll(currentProject.value.id, instance.id)
    ElMessage.success(t('instances.syncSuccess', { success: result.success, failed: result.failed }))
  } catch (error: any) {
    ElMessage.error(error.message || t('instances.syncFailed'))
  } finally {
    syncingIds.value.delete(instance.id)
  }
}

async function syncAllInstances() {
  if (!currentProject.value || instances.value.length === 0) return

  syncing.value = true
  let totalSuccess = 0
  let totalFailed = 0

  try {
    for (const instance of instances.value) {
      if (!instance.isActive) continue
      try {
        const result = await stubApi.syncAll(currentProject.value.id, instance.id)
        totalSuccess += result.success
        totalFailed += result.failed
      } catch {
        totalFailed++
      }
    }
    ElMessage.success(t('instances.syncAllSuccess', { success: totalSuccess, failed: totalFailed }))
  } finally {
    syncing.value = false
  }
}

function editInstance(instance: WiremockInstance) {
  editingInstance.value = instance
  formData.name = instance.name
  formData.url = instance.url
  showAddDialog.value = true
}

function confirmDelete(instance: WiremockInstance) {
  ElMessageBox.confirm(
    t('instances.confirmDelete', { name: instance.name }),
    t('common.confirm'),
    {
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
      type: 'warning'
    }
  ).then(async () => {
    try {
      await wiremockInstanceApi.delete(instance.id)
      instances.value = instances.value.filter(i => i.id !== instance.id)
      ElMessage.success(t('common.success'))
    } catch (error: any) {
      ElMessage.error(error.message)
    }
  }).catch(() => {})
}

async function saveInstance() {
  if (!formRef.value || !currentProject.value) return

  try {
    await formRef.value.validate()
    saving.value = true

    if (editingInstance.value) {
      const updated = await wiremockInstanceApi.update(editingInstance.value.id, formData)
      const idx = instances.value.findIndex(i => i.id === editingInstance.value!.id)
      if (idx !== -1) {
        instances.value[idx] = { ...instances.value[idx], ...updated }
      }
    } else {
      const created = await wiremockInstanceApi.create({
        ...formData,
        projectId: currentProject.value.id
      })
      instances.value.unshift(created)
    }

    closeDialog()
    ElMessage.success(t('common.success'))
  } catch (error: any) {
    if (error.message) {
      ElMessage.error(error.message)
    }
  } finally {
    saving.value = false
  }
}

function closeDialog() {
  showAddDialog.value = false
  editingInstance.value = null
  formData.name = ''
  formData.url = ''
  formRef.value?.resetFields()
}
</script>

<style scoped>
.instances-view {
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

.instances-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.instance-card {
  transition: all 0.3s ease;
}

.instance-card:hover {
  transform: translateY(-4px);
}

.instance-card.healthy {
  border-left: 4px solid #67c23a;
}

.instance-card.unhealthy {
  border-left: 4px solid #f56c6c;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.instance-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}

.health-ok {
  color: #67c23a;
}

.health-error {
  color: #f56c6c;
}

.health-unknown {
  color: #909399;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.instance-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #606266;
}

.info-icon {
  color: #909399;
}

.instance-url {
  font-family: monospace;
  font-size: 14px;
  color: #409eff;
  word-break: break-all;
}

.instance-status {
  display: flex;
  gap: 8px;
}
</style>
