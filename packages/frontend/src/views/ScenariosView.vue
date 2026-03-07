<template>
  <div class="scenarios-page">
    <div class="page-header">
      <h2>{{ t('scenarios.title') }}</h2>
    </div>

    <el-skeleton v-if="loading && stubs.length === 0" :rows="5" animated />

    <div v-else class="scenarios-layout" :class="{ mobile: isMobile }">
      <!-- Left pane: Scenario list -->
      <div class="scenario-list-pane">
        <div class="pane-header">
          <el-button type="primary" size="small" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            {{ t('scenarios.createNew') }}
          </el-button>
        </div>
        <div v-if="scenarioNames.length === 0" class="empty-hint">
          <el-empty :description="t('scenarios.noScenarios')" :image-size="80">
            <template #description>
              <p>{{ t('scenarios.noScenarios') }}</p>
              <p class="empty-sub">{{ t('scenarios.noScenariosHint') }}</p>
            </template>
          </el-empty>
        </div>
        <ul v-else class="scenario-name-list">
          <li
            v-for="name in scenarioNames"
            :key="name"
            :class="{ active: selectedScenario === name }"
            @click="selectedScenario = name"
          >
            {{ name }}
          </li>
        </ul>
      </div>

      <!-- Right pane: Scenario flow detail -->
      <div class="scenario-detail-pane">
        <template v-if="!selectedScenario">
          <div class="empty-hint">
            <el-empty :description="t('scenarios.selectScenario')" :image-size="80" />
          </div>
        </template>
        <template v-else>
          <div class="detail-header">
            <h3>{{ selectedScenario }}</h3>
            <el-button type="primary" size="small" @click="showAddStepDialog = true">
              <el-icon><Plus /></el-icon>
              {{ t('scenarios.addStep') }}
            </el-button>
          </div>

          <!-- Flow validation warnings -->
          <div v-if="flowWarnings.length > 0" class="flow-warnings">
            <el-alert
              v-for="(warning, idx) in flowWarnings"
              :key="idx"
              :title="warning"
              type="warning"
              show-icon
              :closable="false"
              style="margin-bottom: 8px"
            />
          </div>

          <!-- Duplicate state warning -->
          <el-alert
            v-for="dupState in duplicateStates"
            :key="dupState.state"
            type="warning"
            show-icon
            :closable="false"
            style="margin-bottom: 8px"
          >
            <template #title>
              {{
                t('scenarios.duplicateStateWarning', {
                  state: dupState.state,
                  stubs: dupState.stubs
                    .map(
                      (s) =>
                        `${getMapping(s).request?.method || 'ANY'} ${getUrl(getMapping(s).request)}`
                    )
                    .join(', ')
                })
              }}
            </template>
          </el-alert>

          <!-- Timeline flow -->
          <div class="flow-timeline">
            <draggable
              :model-value="orderedSteps"
              item-key="id"
              handle=".drag-handle"
              ghost-class="drag-ghost"
              animation="200"
              @end="onDragEnd"
            >
              <template #item="{ element: step, index }">
                <div class="flow-step">
                  <div class="step-card" @click="navigateToEditor(step)">
                    <!-- Drag handle -->
                    <div class="drag-handle" @click.stop>
                      <span class="drag-dots"></span>
                    </div>

                    <!-- Required state header -->
                    <div class="step-state-header">
                      <template
                        v-if="
                          editingField?.stubId === step.id &&
                          editingField?.field === 'requiredScenarioState'
                        "
                      >
                        <el-input
                          v-model="editingField.value"
                          size="small"
                          @blur="saveInlineEdit"
                          @keyup.enter="saveInlineEdit"
                          @click.stop
                          ref="inlineInputRef"
                          style="width: 200px"
                        />
                      </template>
                      <template v-else>
                        <span class="state-name">
                          {{ getMapping(step).requiredScenarioState || 'Started' }}
                        </span>
                        <el-icon
                          class="edit-icon"
                          @click.stop="onStartInlineEdit(step, 'requiredScenarioState')"
                        >
                          <EditPen />
                        </el-icon>
                      </template>
                    </div>

                    <!-- Stub info -->
                    <div class="step-stub-info">
                      <el-tag
                        :type="getMethodTagType(getMapping(step).request?.method)"
                        size="small"
                      >
                        {{ getMapping(step).request?.method || 'ANY' }}
                      </el-tag>
                      <code class="step-url">{{ getUrl(getMapping(step).request) }}</code>
                      <span class="step-arrow-inline">&rarr;</span>
                      <el-tag
                        :type="getStatusTagType(getMapping(step).response?.status)"
                        size="small"
                      >
                        {{ getMapping(step).response?.status }}
                      </el-tag>
                    </div>

                    <!-- New state footer -->
                    <div class="step-new-state">
                      <span class="transition-arrow">&rarr;</span>
                      <template
                        v-if="
                          editingField?.stubId === step.id &&
                          editingField?.field === 'newScenarioState'
                        "
                      >
                        <el-input
                          v-model="editingField.value"
                          size="small"
                          @blur="saveInlineEdit"
                          @keyup.enter="saveInlineEdit"
                          @click.stop
                          ref="inlineInputRef"
                          style="width: 200px"
                        />
                      </template>
                      <template v-else>
                        <span :class="{ 'end-state': !getMapping(step).newScenarioState }">
                          {{ getMapping(step).newScenarioState || t('scenarios.endState') }}
                        </span>
                        <el-icon
                          class="edit-icon"
                          @click.stop="onStartInlineEdit(step, 'newScenarioState')"
                        >
                          <EditPen />
                        </el-icon>
                      </template>
                    </div>

                    <!-- Remove button -->
                    <el-button
                      class="remove-btn"
                      type="danger"
                      :icon="Close"
                      size="small"
                      circle
                      @click.stop="confirmRemoveFromScenario(step)"
                    />
                  </div>

                  <!-- Arrow between steps -->
                  <div v-if="index < orderedSteps.length - 1" class="flow-arrow">
                    <div class="arrow-line"></div>
                    <div class="arrow-head"></div>
                  </div>
                </div>
              </template>
            </draggable>
          </div>
        </template>
      </div>
    </div>

    <!-- Create New Scenario Dialog -->
    <el-dialog
      v-model="showCreateDialog"
      :title="t('scenarios.dialog.createTitle')"
      width="min(500px, 90vw)"
      @close="resetCreateForm"
    >
      <el-form :model="createForm" label-position="top">
        <el-form-item :label="t('scenarios.scenarioName')" required>
          <el-input
            v-model="createForm.name"
            :placeholder="t('scenarios.placeholder.scenarioName')"
          />
          <div v-if="createFormError" class="form-error">{{ createFormError }}</div>
        </el-form-item>
        <el-form-item :label="t('scenarios.selectFromStubs')">
          <el-input
            v-model="createForm.stubSearch"
            :placeholder="t('scenarios.searchStubs')"
            clearable
            style="margin-bottom: 8px"
          />
          <ul class="stub-select-list">
            <li
              v-for="stub in filteredUnassignedStubs"
              :key="stub.id"
              :class="{ selected: createForm.selectedStubId === stub.id }"
              @click="toggleCreateStubSelection(stub.id)"
            >
              <el-tag :type="getMethodTagType(getMapping(stub).request?.method)" size="small">
                {{ getMapping(stub).request?.method || 'ANY' }}
              </el-tag>
              <span>{{ getUrl(getMapping(stub).request) }}</span>
            </li>
          </ul>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button type="primary" @click="handleCreateScenario" :loading="saving">
          {{ t('scenarios.createNew') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Add Step Dialog -->
    <el-dialog
      v-model="showAddStepDialog"
      :title="t('scenarios.dialog.addStepTitle')"
      width="min(500px, 90vw)"
      @close="resetAddStepForm"
    >
      <div class="add-step-options">
        <h4>{{ t('scenarios.selectExistingStub') }}</h4>
        <el-input
          v-model="addStepSearch"
          :placeholder="t('scenarios.searchStubs')"
          clearable
          style="margin-bottom: 8px"
        />
        <ul class="stub-select-list">
          <li
            v-for="stub in filteredAddStepStubs"
            :key="stub.id"
            :class="{ selected: addStepSelectedId === stub.id }"
            @click="toggleAddStepSelection(stub.id)"
          >
            <el-tag :type="getMethodTagType(getMapping(stub).request?.method)" size="small">
              {{ getMapping(stub).request?.method || 'ANY' }}
            </el-tag>
            <span>{{ getUrl(getMapping(stub).request) }}</span>
          </li>
        </ul>
        <el-divider />
        <el-button @click="createNewStubForScenario">
          <el-icon><Plus /></el-icon>
          {{ t('scenarios.createNewStub') }}
        </el-button>
      </div>
      <template #footer>
        <el-button @click="showAddStepDialog = false">{{ t('common.cancel') }}</el-button>
        <el-button
          type="primary"
          @click="handleAddStep"
          :disabled="!addStepSelectedId"
          :loading="saving"
        >
          {{ t('scenarios.addStep') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMappingStore } from '@/stores/mapping';
import { useResponsive } from '@/composables/useResponsive';
import { useScenario, toMapping } from '@/composables/useScenario';
import { ElMessage } from 'element-plus';
import { Close, EditPen, Plus } from '@element-plus/icons-vue';
import draggable from 'vuedraggable';
import type { Stub } from '@/services/api';
import { getMethodTagType, getUrl, getStatusTagType } from '@/utils/wiremock';

const { t } = useI18n();
const router = useRouter();
const mappingStore = useMappingStore();
const { stubs, loading } = storeToRefs(mappingStore);
const { isMobile } = useResponsive();
const getMapping = toMapping;

const {
  selectedScenario,
  saving,
  editingField,
  scenarioNames,
  orderedSteps,
  duplicateStates,
  flowWarnings,
  unassignedStubs,
  reorderSteps,
  confirmRemoveFromScenario,
  startInlineEdit,
  saveInlineEdit
} = useScenario();

// --- Dialog state ---
const showCreateDialog = ref(false);
const createForm = ref({ name: '', stubSearch: '', selectedStubId: '' });
const createFormError = ref('');

const showAddStepDialog = ref(false);
const addStepSearch = ref('');
const addStepSelectedId = ref('');

// UI refs
const inlineInputRef = ref<any>(null);

// --- Dialog filtered lists ---

const filteredUnassignedStubs = computed(() => {
  if (!createForm.value.stubSearch) return unassignedStubs.value;
  const query = createForm.value.stubSearch.toLowerCase();
  return unassignedStubs.value.filter((s) => {
    const m = getMapping(s);
    const url = getUrl(m.request).toLowerCase();
    const method = (m.request?.method || '').toLowerCase();
    const name = (s.name || '').toLowerCase();
    return url.includes(query) || method.includes(query) || name.includes(query);
  });
});

const filteredAddStepStubs = computed(() => {
  const available = stubs.value.filter(
    (s) => !getMapping(s).scenarioName || getMapping(s).scenarioName !== selectedScenario.value
  );
  if (!addStepSearch.value) return available;
  const query = addStepSearch.value.toLowerCase();
  return available.filter((s) => {
    const m = getMapping(s);
    const url = getUrl(m.request).toLowerCase();
    const method = (m.request?.method || '').toLowerCase();
    const name = (s.name || '').toLowerCase();
    return url.includes(query) || method.includes(query) || name.includes(query);
  });
});

// --- Dialog actions ---

function toggleCreateStubSelection(id: string) {
  createForm.value.selectedStubId = createForm.value.selectedStubId === id ? '' : id;
}

function toggleAddStepSelection(id: string) {
  addStepSelectedId.value = addStepSelectedId.value === id ? '' : id;
}

function resetCreateForm() {
  createForm.value = { name: '', stubSearch: '', selectedStubId: '' };
  createFormError.value = '';
}

function resetAddStepForm() {
  addStepSearch.value = '';
  addStepSelectedId.value = '';
}

async function handleCreateScenario() {
  const name = createForm.value.name.trim();
  if (!name) {
    createFormError.value = t('scenarios.validation.nameRequired');
    return;
  }
  if (scenarioNames.value.includes(name)) {
    createFormError.value = t('scenarios.validation.nameExists');
    return;
  }
  if (!createForm.value.selectedStubId) {
    createFormError.value = t('scenarios.validation.stubRequired');
    return;
  }

  saving.value = true;
  try {
    const stub = mappingStore.getStubById(createForm.value.selectedStubId);
    if (stub) {
      const mapping = { ...getMapping(stub) };
      mapping.scenarioName = name;
      mapping.requiredScenarioState = 'Started';
      await mappingStore.updateMapping(stub.id, mapping, stub.description || undefined);
    }
    selectedScenario.value = name;
    showCreateDialog.value = false;
    ElMessage.success(t('scenarios.messages.created'));
  } catch (e: any) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

async function handleAddStep() {
  if (!addStepSelectedId.value || !selectedScenario.value) return;

  saving.value = true;
  try {
    const stub = mappingStore.getStubById(addStepSelectedId.value);
    if (!stub) return;

    const steps = orderedSteps.value;
    let requiredState: string;

    if (steps.length === 0) {
      // First step in the scenario
      requiredState = 'Started';
    } else {
      const lastStep = steps[steps.length - 1];
      const lastMapping = getMapping(lastStep);

      if (lastMapping.newScenarioState) {
        // Last step already points to a next state — use it
        requiredState = lastMapping.newScenarioState;
      } else {
        // Last step is terminal — create a new state link
        const newStateName = generateStateName(steps);
        requiredState = newStateName;

        // Update the current last step to point to the new state
        const updatedLastMapping = { ...lastMapping };
        updatedLastMapping.newScenarioState = newStateName;
        await mappingStore.updateMapping(
          lastStep.id,
          updatedLastMapping,
          lastStep.description || undefined
        );
      }
    }

    const mapping = { ...getMapping(stub) };
    mapping.scenarioName = selectedScenario.value;
    mapping.requiredScenarioState = requiredState;
    delete mapping.newScenarioState;
    await mappingStore.updateMapping(stub.id, mapping, stub.description || undefined);
    ElMessage.success(t('scenarios.messages.stepAdded'));
    showAddStepDialog.value = false;
  } catch (e: any) {
    ElMessage.error(e.message);
  } finally {
    saving.value = false;
  }
}

/** Generate a unique state name like "Step_2", "Step_3", etc. */
function generateStateName(steps: Stub[]): string {
  const existing = new Set<string>();
  for (const s of steps) {
    const m = getMapping(s);
    if (m.requiredScenarioState) existing.add(m.requiredScenarioState);
    if (m.newScenarioState) existing.add(m.newScenarioState);
  }
  let i = 2;
  while (existing.has(`Step_${i}`)) i++;
  return `Step_${i}`;
}

// --- Navigation ---

function createNewStubForScenario() {
  showAddStepDialog.value = false;
  router.push({
    path: '/mappings/new',
    query: { scenarioName: selectedScenario.value || '' }
  });
}

function navigateToEditor(stub: Stub) {
  router.push(`/mappings/${stub.id}`);
}

// --- Inline edit with focus ---

function onStartInlineEdit(stub: Stub, field: 'requiredScenarioState' | 'newScenarioState') {
  startInlineEdit(stub, field);
  nextTick(() => {
    if (inlineInputRef.value) {
      const input = Array.isArray(inlineInputRef.value)
        ? inlineInputRef.value[0]
        : inlineInputRef.value;
      input?.focus?.();
    }
  });
}

// --- Drag & Drop handler (vuedraggable) ---

async function onDragEnd(evt: { oldIndex?: number; newIndex?: number }) {
  const from = evt.oldIndex;
  const to = evt.newIndex;
  if (from === undefined || to === undefined || from === to) return;
  await reorderSteps(from, to);
}

// --- Initialization ---

onMounted(async () => {
  await mappingStore.fetchMappings();
  if (scenarioNames.value.length > 0 && !selectedScenario.value) {
    selectedScenario.value = scenarioNames.value[0];
  }
});
</script>

<style scoped>
.scenarios-page {
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

.scenarios-layout {
  display: flex;
  gap: 20px;
  min-height: 500px;
  overflow: hidden;
}

.scenarios-layout.mobile {
  flex-direction: column;
}

.scenario-list-pane {
  width: 250px;
  flex-shrink: 0;
  min-width: 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 16px;
  background: var(--el-bg-color);
  overflow: hidden;
  box-sizing: border-box;
}

.scenarios-layout.mobile .scenario-list-pane {
  width: 100%;
  flex-shrink: 1;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.pane-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.scenario-name-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.scenario-name-list li {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.scenario-name-list li:hover {
  background-color: var(--el-fill-color-light);
}

.scenario-name-list li.active {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 500;
}

.scenario-detail-pane {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 20px;
  background: var(--el-bg-color);
  overflow-x: auto;
  box-sizing: border-box;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.detail-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.empty-hint {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
}

.empty-sub {
  color: var(--wh-text-tertiary);
  font-size: 13px;
  margin-top: 4px;
}

/* Flow timeline */
.flow-timeline {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.flow-step {
  width: 100%;
  max-width: 500px;
}

.drag-ghost {
  opacity: 0.4;
}

.drag-handle {
  position: absolute;
  top: 50%;
  left: 8px;
  transform: translateY(-50%);
  cursor: grab;
  padding: 4px;
}

.drag-handle:active {
  cursor: grabbing;
}

.drag-dots {
  display: block;
  width: 8px;
  height: 14px;
  background-image: radial-gradient(circle, var(--wh-text-tertiary) 1.2px, transparent 1.2px);
  background-size: 5px 5px;
  transition: background-image 0.2s;
}

.drag-handle:hover .drag-dots {
  background-image: radial-gradient(circle, var(--el-color-primary) 1.2px, transparent 1.2px);
}

.step-card {
  position: relative;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  padding: 14px 40px 14px 32px;
  cursor: pointer;
  transition:
    box-shadow 0.2s,
    border-color 0.2s;
  background: var(--el-bg-color);
}

.step-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.step-state-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.state-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--el-color-primary);
}

.edit-icon {
  cursor: pointer;
  color: var(--wh-text-tertiary);
  font-size: 14px;
  transition: color 0.2s;
}

.edit-icon:hover {
  color: var(--el-color-primary);
}

.step-stub-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.step-url {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: var(--wh-text-secondary);
}

.step-arrow-inline {
  color: var(--wh-text-tertiary);
}

.step-new-state {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--wh-text-secondary);
}

.transition-arrow {
  color: var(--wh-text-tertiary);
}

.end-state {
  color: var(--wh-text-tertiary);
  font-style: italic;
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
}

/* Arrow between cards */
.flow-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 0 30px;
  height: 28px;
}

.arrow-line {
  width: 2px;
  flex: 1;
  background-color: var(--el-border-color);
}

.arrow-head {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid var(--el-border-color);
}

/* Warnings */
.flow-warnings {
  margin-bottom: 16px;
}

/* Stub select list in dialogs */
.stub-select-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-light);
  border-radius: 6px;
}

.stub-select-list li {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  transition: background-color 0.2s;
}

.stub-select-list li:hover {
  background-color: var(--el-fill-color-light);
}

.stub-select-list li.selected {
  background-color: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.form-error {
  color: var(--el-color-danger);
  font-size: 12px;
  margin-top: 4px;
}

.add-step-options h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
}
</style>
