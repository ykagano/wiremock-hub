<template>
  <div class="project-list">
    <div class="page-header">
      <h2>{{ t('projects.title') }}</h2>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        {{ t('projects.add') }}
      </el-button>
    </div>

    <!-- プロジェクトがない場合 -->
    <el-empty
      v-if="projects.length === 0"
      :description="t('projects.noProjects')"
    >
      <el-button type="primary" @click="showAddDialog = true">
        {{ t('projects.addFirst') }}
      </el-button>
    </el-empty>

    <!-- プロジェクト一覧 -->
    <div v-else class="project-grid">
      <el-card
        v-for="project in projects"
        :key="project.id"
        class="project-card"
        :class="{ active: currentProjectId === project.id }"
        shadow="hover"
      >
        <template #header>
          <div class="card-header">
            <span class="project-name">{{ project.name }}</span>
            <div class="card-actions">
              <el-button
                type="primary"
                size="small"
                :disabled="currentProjectId === project.id"
                @click="selectProject(project.id)"
              >
                {{ t('projects.select') }}
              </el-button>
              <el-dropdown trigger="click">
                <el-button type="default" size="small" circle>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="editProject(project)">
                      <el-icon><Edit /></el-icon>
                      {{ t('projects.edit') }}
                    </el-dropdown-item>
                    <el-dropdown-item @click="confirmDelete(project)">
                      <el-icon><Delete /></el-icon>
                      {{ t('projects.delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </template>

        <div class="project-info">
          <el-icon class="info-icon"><Link /></el-icon>
          <span class="project-url">{{ project.baseUrl }}</span>
        </div>

        <div class="project-meta">
          <el-icon><Calendar /></el-icon>
          <span>{{ formatDate(project.createdAt) }}</span>
        </div>

        <div v-if="currentProjectId === project.id" class="active-badge">
          <el-tag type="success" size="small">{{ t('common.selected') }}</el-tag>
        </div>
      </el-card>
    </div>

    <!-- プロジェクト追加/編集ダイアログ -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingProject ? t('projects.dialog.editTitle') : t('projects.dialog.addTitle')"
      width="500px"
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="120px"
      >
        <el-form-item :label="t('projects.name')" prop="name">
          <el-input
            v-model="formData.name"
            :placeholder="t('projects.placeholder.name')"
          />
        </el-form-item>
        <el-form-item :label="t('projects.baseUrl')" prop="baseUrl">
          <el-input
            v-model="formData.baseUrl"
            :placeholder="t('projects.placeholder.baseUrl')"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeDialog">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveProject">
          {{ t('common.save') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import type { Project } from '@/types/wiremock'
import dayjs from 'dayjs'

const { t } = useI18n()
const router = useRouter()
const projectStore = useProjectStore()
const { projects, currentProjectId } = storeToRefs(projectStore)

const showAddDialog = ref(false)
const editingProject = ref<Project | null>(null)
const formRef = ref<FormInstance>()

const formData = reactive({
  name: '',
  baseUrl: ''
})

const formRules = computed<FormRules>(() => ({
  name: [
    { required: true, message: t('projects.validation.nameRequired'), trigger: 'blur' }
  ],
  baseUrl: [
    { required: true, message: t('projects.validation.urlRequired'), trigger: 'blur' },
    {
      pattern: /^https?:\/\/.+/,
      message: t('projects.validation.urlInvalid'),
      trigger: 'blur'
    }
  ]
}))

function formatDate(dateString: string) {
  return dayjs(dateString).format('YYYY/MM/DD HH:mm')
}

function selectProject(id: string) {
  projectStore.setCurrentProject(id)
  ElMessage.success(t('common.success'))
  router.push('/mappings')
}

function editProject(project: Project) {
  editingProject.value = project
  formData.name = project.name
  formData.baseUrl = project.baseUrl
  showAddDialog.value = true
}

function confirmDelete(project: Project) {
  ElMessageBox.confirm(
    t('projects.confirmDelete', { name: project.name }),
    t('common.confirm'),
    {
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
      type: 'warning'
    }
  ).then(() => {
    projectStore.deleteProject(project.id)
    ElMessage.success(t('common.success'))
  }).catch(() => {
    // キャンセル
  })
}

async function saveProject() {
  if (!formRef.value) return

  await formRef.value.validate((valid) => {
    if (valid) {
      if (editingProject.value) {
        projectStore.updateProject(editingProject.value.id, formData)
        ElMessage.success(t('common.success'))
      } else {
        projectStore.addProject(formData)
        ElMessage.success(t('common.success'))
      }
      closeDialog()
    }
  })
}

function closeDialog() {
  showAddDialog.value = false
  editingProject.value = null
  formData.name = ''
  formData.baseUrl = ''
  formRef.value?.resetFields()
}
</script>

<style scoped>
.project-list {
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

.project-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.project-card {
  position: relative;
  transition: all 0.3s ease;
}

.project-card.active {
  border-color: #67c23a;
  box-shadow: 0 2px 12px rgba(103, 194, 58, 0.3);
}

.project-card:hover {
  transform: translateY(-4px);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.project-name {
  font-weight: 600;
  font-size: 16px;
}

.card-actions {
  display: flex;
  gap: 8px;
}

.project-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #606266;
}

.info-icon {
  color: #909399;
}

.project-url {
  font-family: monospace;
  font-size: 14px;
  color: #409eff;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #909399;
}

.active-badge {
  position: absolute;
  bottom: 12px;
  right: 12px;
}
</style>
