<template>
  <div class="project-detail">
    <!-- Header -->
    <div class="page-header">
      <div class="header-left">
        <el-button text @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          {{ t('common.back') }}
        </el-button>
        <h2>{{ project?.name }}</h2>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="editProject">
          <el-icon><Edit /></el-icon>
          {{ t('projects.edit') }}
        </el-button>
      </div>
    </div>

    <!-- Project information -->
    <el-card class="info-card" v-if="project">
      <template #header>
        <span>{{ t('projectDetail.info') }}</span>
      </template>
      <el-descriptions :column="2" border>
        <el-descriptions-item :label="t('projectDetail.projectId')" :span="2">
          <div class="project-id-cell">
            <span class="project-id">{{ project.id }}</span>
            <el-button size="small" text @click="copyProjectId">
              <el-icon><CopyDocument /></el-icon>
            </el-button>
          </div>
        </el-descriptions-item>
        <el-descriptions-item :label="t('projects.name')">
          {{ project.name }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('projects.description')">
          {{ project.description || '-' }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('projectDetail.createdAt')">
          {{ formatDate(project.createdAt) }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('projectDetail.updatedAt')">
          {{ formatDate(project.updatedAt) }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Instance list -->
    <div class="instances-section">
      <div class="section-header">
        <el-button type="success" @click="handleSyncAll" :loading="syncing" :disabled="instances.length === 0">
          <el-icon><Refresh /></el-icon>
          {{ t('instances.syncAll') }}
        </el-button>
        <el-button type="primary" @click="showInstanceDialog = true">
          <el-icon><Plus /></el-icon>
          {{ t('instances.add') }}
        </el-button>
      </div>

      <el-empty v-if="instances.length === 0" :description="t('instances.noInstances')">
        <el-button type="primary" @click="showInstanceDialog = true">
          {{ t('instances.addFirst') }}
        </el-button>
      </el-empty>

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
                      <el-dropdown-item @click="confirmDeleteInstance(instance)">
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
            <el-tag :type="getHealthTagType(instance)" size="small">
              {{ getHealthText(instance) }}
            </el-tag>
          </div>
        </el-card>
      </div>
    </div>

    <!-- Instance add/edit dialog -->
    <el-dialog
      v-model="showInstanceDialog"
      :title="editingInstance ? t('instances.dialog.editTitle') : t('instances.dialog.addTitle')"
      width="min(500px, 90vw)"
    >
      <el-form
        ref="instanceFormRef"
        :model="instanceFormData"
        :rules="instanceFormRules"
        :label-width="isMobile ? undefined : '120px'"
        :label-position="isMobile ? 'top' : 'right'"
      >
        <el-form-item :label="t('instances.name')" prop="name">
          <el-input
            v-model="instanceFormData.name"
            :placeholder="t('instances.placeholder.name')"
          />
        </el-form-item>
        <el-form-item :label="t('instances.url')" prop="url">
          <el-input
            v-model="instanceFormData.url"
            :placeholder="t('instances.placeholder.url')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeInstanceDialog">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveInstance" :loading="savingInstance">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Project edit dialog -->
    <el-dialog
      v-model="showProjectDialog"
      :title="t('projects.dialog.editTitle')"
      width="min(500px, 90vw)"
    >
      <el-form
        ref="projectFormRef"
        :model="projectFormData"
        :rules="projectFormRules"
        :label-width="isMobile ? undefined : '120px'"
        :label-position="isMobile ? 'top' : 'right'"
      >
        <el-form-item :label="t('projects.name')" prop="name">
          <el-input v-model="projectFormData.name" />
        </el-form-item>
        <el-form-item :label="t('projects.description')" prop="description">
          <el-input
            v-model="projectFormData.description"
            type="textarea"
            :rows="3"
            :placeholder="t('projects.placeholder.description')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showProjectDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveProject" :loading="savingProject">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useProjectStore } from '@/stores/project'
import { useSyncAllInstances } from '@/composables/useSyncAllInstances'
import { useResponsive } from '@/composables/useResponsive'
import { projectApi, wiremockInstanceApi, type Project, type WiremockInstance } from '@/services/api'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import dayjs from 'dayjs'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isMobile } = useResponsive()
const projectStore = useProjectStore()

const project = ref<Project | null>(null)
const instances = ref<WiremockInstance[]>([])
const { syncing, confirmAndSyncAllWithInstances, confirmAndSyncInstance } = useSyncAllInstances()
const syncingIds = ref(new Set<string>())

// Instance dialog
const showInstanceDialog = ref(false)
const editingInstance = ref<WiremockInstance | null>(null)
const savingInstance = ref(false)
const instanceFormRef = ref<FormInstance>()
const instanceFormData = reactive({ name: '', url: '' })

// Project dialog
const showProjectDialog = ref(false)
const savingProject = ref(false)
const projectFormRef = ref<FormInstance>()
const projectFormData = reactive({ name: '', description: '' })

const instanceFormRules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('instances.validation.nameRequired'), trigger: 'blur' }],
  url: [
    { required: true, message: t('instances.validation.urlRequired'), trigger: 'blur' },
    { pattern: /^https?:\/\/.+/, message: t('instances.validation.urlInvalid'), trigger: 'blur' }
  ]
}))

const projectFormRules = computed<FormRules>(() => ({
  name: [{ required: true, message: t('projects.validation.nameRequired'), trigger: 'blur' }]
}))

onMounted(async () => {
  const projectId = route.params.id as string
  await loadProject(projectId)
})

async function loadProject(projectId: string) {
  try {
    project.value = await projectApi.get(projectId)
    projectStore.setCurrentProject(projectId)
    await loadInstances(projectId)
  } catch (error: any) {
    ElMessage.error(error.message || t('common.error'))
    router.push('/projects')
  }
}

async function loadInstances(projectId: string) {
  const list = await wiremockInstanceApi.list(projectId)
  instances.value = await Promise.all(
    list.map(async (inst) => {
      try {
        return await wiremockInstanceApi.get(inst.id)
      } catch {
        return { ...inst, isHealthy: false }
      }
    })
  )
}

function formatDate(dateString: string) {
  return dayjs(dateString).format('YYYY/MM/DD HH:mm')
}

function goBack() {
  router.push('/projects')
}

async function copyProjectId() {
  if (!project.value) return
  try {
    await navigator.clipboard.writeText(project.value.id)
    ElMessage.success(t('projectDetail.copyProjectId'))
  } catch {
    ElMessage.error(t('common.error'))
  }
}

// Project
function editProject() {
  if (!project.value) return
  projectFormData.name = project.value.name
  projectFormData.description = project.value.description || ''
  showProjectDialog.value = true
}

async function saveProject() {
  if (!projectFormRef.value || !project.value) return
  try {
    await projectFormRef.value.validate()
    savingProject.value = true
    project.value = await projectApi.update(project.value.id, projectFormData)
    showProjectDialog.value = false
    ElMessage.success(t('common.success'))
  } catch (error: any) {
    if (error.message) ElMessage.error(error.message)
  } finally {
    savingProject.value = false
  }
}

// Instances
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
    if (idx !== -1) instances.value[idx] = detail
    ElMessage[detail.isHealthy ? 'success' : 'warning'](
      detail.isHealthy ? t('instances.healthOk') : t('instances.healthFailed')
    )
  } catch (error: any) {
    ElMessage.error(error.message)
  }
}

function syncInstance(instance: WiremockInstance) {
  if (!project.value) return
  confirmAndSyncInstance(
    project.value.id,
    instance,
    () => syncingIds.value.add(instance.id),
    () => syncingIds.value.delete(instance.id)
  )
}

function handleSyncAll() {
  if (!project.value) return
  confirmAndSyncAllWithInstances(project.value.id, instances.value)
}

function editInstance(instance: WiremockInstance) {
  editingInstance.value = instance
  instanceFormData.name = instance.name
  instanceFormData.url = instance.url
  showInstanceDialog.value = true
}

function confirmDeleteInstance(instance: WiremockInstance) {
  ElMessageBox.confirm(t('instances.confirmDelete', { name: instance.name }), t('common.confirm'), {
    confirmButtonText: t('common.yes'),
    cancelButtonText: t('common.no'),
    type: 'warning'
  }).then(async () => {
    await wiremockInstanceApi.delete(instance.id)
    instances.value = instances.value.filter(i => i.id !== instance.id)
    ElMessage.success(t('common.success'))
  }).catch(() => {})
}

async function saveInstance() {
  if (!instanceFormRef.value || !project.value) return
  try {
    await instanceFormRef.value.validate()
    savingInstance.value = true
    if (editingInstance.value) {
      const updated = await wiremockInstanceApi.update(editingInstance.value.id, instanceFormData)
      const idx = instances.value.findIndex(i => i.id === editingInstance.value!.id)
      if (idx !== -1) instances.value[idx] = { ...instances.value[idx], ...updated }
    } else {
      const created = await wiremockInstanceApi.create({ ...instanceFormData, projectId: project.value.id })
      instances.value.unshift(created)
    }
    closeInstanceDialog()
    ElMessage.success(t('common.success'))
  } catch (error: any) {
    if (error.message) ElMessage.error(error.message)
  } finally {
    savingInstance.value = false
  }
}

function closeInstanceDialog() {
  showInstanceDialog.value = false
  editingInstance.value = null
  instanceFormData.name = ''
  instanceFormData.url = ''
  instanceFormRef.value?.resetFields()
}
</script>

<style scoped>
.project-detail {
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

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.info-card {
  margin-bottom: 24px;
}

.project-id-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-id {
  color: var(--wh-text-secondary);
}

.instances-section {
  margin-top: 24px;
}

.section-header {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-bottom: 16px;
}

.instances-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

@media (max-width: 768px) {
  .instances-grid {
    grid-template-columns: 1fr;
  }
}

.instance-card {
  transition: all 0.3s ease;
}

.instance-card:hover {
  transform: translateY(-4px);
}

.instance-card.healthy {
  border-left: 4px solid var(--el-color-success);
}

.instance-card.unhealthy {
  border-left: 4px solid var(--el-color-danger);
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
}

.health-ok { color: var(--el-color-success); }
.health-error { color: var(--el-color-danger); }
.health-unknown { color: var(--wh-text-tertiary); }

.card-actions {
  display: flex;
  gap: 8px;
}

.instance-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.info-icon { color: var(--wh-text-tertiary); }

.instance-url {
  font-family: monospace;
  font-size: 14px;
  color: var(--wh-text-secondary);
  word-break: break-all;
}

.instance-status {
  display: flex;
  gap: 8px;
}
</style>
