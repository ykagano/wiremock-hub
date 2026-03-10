<template>
  <div class="recording-view">
    <div class="page-header">
      <h2>{{ t('recording.title') }}</h2>
      <div class="header-actions">
        <el-select
          v-model="selectedInstanceId"
          :placeholder="t('recording.selectInstance')"
          :style="{
            width: isMobile ? '100%' : '200px'
          }"
          @change="onInstanceChange"
        >
          <el-option
            v-for="instance in wiremockInstances"
            :key="instance.id"
            :label="instance.name"
            :value="instance.id"
          />
        </el-select>
      </div>
    </div>

    <el-empty v-if="wiremockInstances.length === 0" :description="t('recording.noInstances')" />
    <el-empty v-else-if="!selectedInstanceId" :description="t('recording.selectInstance')" />

    <template v-else>
      <!-- Recording Status -->
      <div class="section">
        <div class="status-row">
          <span class="status-label">{{ t('recording.status') }}:</span>
          <el-tag :type="statusTagType" size="large" effect="dark">
            {{ statusLabel }}
          </el-tag>
        </div>
      </div>

      <!-- Description -->
      <div class="section">
        <el-alert :title="t('recording.description')" type="info" :closable="false" show-icon />
      </div>

      <!-- Target URL and Start/Stop button -->
      <div class="section">
        <el-form v-if="!isRecording" @submit.prevent="handleStartRecording">
          <el-form-item :label="t('recording.targetBaseUrl')">
            <el-input
              v-model="targetBaseUrl"
              :placeholder="t('recording.targetBaseUrlPlaceholder')"
            />
          </el-form-item>
          <el-form-item>
            <el-button
              type="primary"
              class="recording-action-button"
              :loading="startLoading"
              :disabled="!targetBaseUrl"
              @click="handleStartRecording"
            >
              {{ t('recording.startRecording') }}
            </el-button>
          </el-form-item>
        </el-form>
        <el-button
          v-else
          type="danger"
          class="recording-action-button"
          :loading="stopLoading"
          @click="handleStopRecording"
        >
          {{ t('recording.stopRecording') }}
        </el-button>
      </div>

      <!-- All instances buttons -->
      <el-divider />
      <div class="section">
        <el-button
          v-if="!isRecording"
          type="primary"
          plain
          class="recording-action-button"
          :loading="startAllLoading"
          :disabled="!targetBaseUrl"
          @click="handleStartRecordingAll"
        >
          {{ t('recording.startRecordingAll') }}
        </el-button>
        <el-button
          v-else
          type="danger"
          plain
          class="recording-action-button"
          :loading="stopAllLoading"
          @click="handleStopRecordingAll"
        >
          {{ t('recording.stopRecordingAll') }}
        </el-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useProjectStore } from '@/stores/project';
import { wiremockInstanceApi } from '@/services/api';
import { ElMessage } from 'element-plus';
import { useResponsive } from '@/composables/useResponsive';

const { t } = useI18n();
const { isMobile } = useResponsive();
const projectStore = useProjectStore();
const { wiremockInstances } = storeToRefs(projectStore);

const selectedInstanceId = ref<string | null>(null);
const recordingStatus = ref<string>('NeverStarted');
const targetBaseUrl = ref('');
const startLoading = ref(false);
const stopLoading = ref(false);
const startAllLoading = ref(false);
const stopAllLoading = ref(false);

const isRecording = computed(() => recordingStatus.value === 'Recording');

const statusTagType = computed(() => {
  switch (recordingStatus.value) {
    case 'Recording':
      return 'danger';
    case 'Stopped':
      return 'warning';
    default:
      return 'info';
  }
});

const statusLabel = computed(() => {
  switch (recordingStatus.value) {
    case 'Recording':
      return t('recording.statusRecording');
    case 'Stopped':
      return t('recording.statusStopped');
    default:
      return t('recording.statusNeverStarted');
  }
});

function onInstanceChange(instanceId: string) {
  if (instanceId) {
    fetchRecordingStatus();
  }
}

async function fetchRecordingStatus() {
  if (!selectedInstanceId.value) return;

  try {
    const data = await wiremockInstanceApi.getRecordingStatus(selectedInstanceId.value);
    recordingStatus.value = data.status;
  } catch (error) {
    console.error('Failed to fetch recording status:', error);
    ElMessage.error(t('recording.statusFetchFailed'));
  }
}

async function handleStartRecording() {
  if (!selectedInstanceId.value || !targetBaseUrl.value) return;

  startLoading.value = true;
  try {
    await wiremockInstanceApi.startRecording(selectedInstanceId.value, targetBaseUrl.value);
    ElMessage.success(t('recording.startSuccess'));
    await fetchRecordingStatus();
  } catch (error) {
    console.error('Failed to start recording:', error);
    ElMessage.error(t('recording.startFailed'));
  } finally {
    startLoading.value = false;
  }
}

async function handleStopRecording() {
  if (!selectedInstanceId.value) return;

  stopLoading.value = true;
  try {
    await wiremockInstanceApi.stopRecording(selectedInstanceId.value);
    ElMessage.success(t('recording.stopSuccess'));
    await fetchRecordingStatus();
  } catch (error) {
    console.error('Failed to stop recording:', error);
    ElMessage.error(t('recording.stopFailed'));
  } finally {
    stopLoading.value = false;
  }
}

async function handleStartRecordingAll() {
  if (!projectStore.currentProjectId || !targetBaseUrl.value) return;

  startAllLoading.value = true;
  try {
    const result = await wiremockInstanceApi.startRecordingAll(
      projectStore.currentProjectId,
      targetBaseUrl.value
    );
    ElMessage.success(
      t('recording.startAllSuccess', { success: result.success, failed: result.failed })
    );
    await fetchRecordingStatus();
  } catch (error) {
    console.error('Failed to start recording on all instances:', error);
    ElMessage.error(t('recording.startFailed'));
  } finally {
    startAllLoading.value = false;
  }
}

async function handleStopRecordingAll() {
  if (!projectStore.currentProjectId) return;

  stopAllLoading.value = true;
  try {
    const result = await wiremockInstanceApi.stopRecordingAll(projectStore.currentProjectId);
    ElMessage.success(
      t('recording.stopAllSuccess', { success: result.success, failed: result.failed })
    );
    await fetchRecordingStatus();
  } catch (error) {
    console.error('Failed to stop recording on all instances:', error);
    ElMessage.error(t('recording.stopFailed'));
  } finally {
    stopAllLoading.value = false;
  }
}

onMounted(async () => {
  if (projectStore.currentProjectId) {
    await projectStore.fetchWiremockInstances(projectStore.currentProjectId);
  }

  if (wiremockInstances.value.length > 0) {
    selectedInstanceId.value = wiremockInstances.value[0].id;
    onInstanceChange(selectedInstanceId.value);
  }
});

watch(wiremockInstances, (instances) => {
  if (instances.length > 0 && !selectedInstanceId.value) {
    selectedInstanceId.value = instances[0].id;
    onInstanceChange(selectedInstanceId.value);
  } else if (instances.length === 0) {
    selectedInstanceId.value = null;
    recordingStatus.value = 'NeverStarted';
  }
});
</script>

<style scoped>
.recording-view {
  max-width: 100%;
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
  align-items: center;
  gap: 12px;
}

.section {
  margin-bottom: 20px;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--wh-text-secondary);
}

.status-row :deep(.el-tag) {
  transition: none;
  animation: none;
}

.recording-action-button {
  min-width: 280px;
}
</style>
