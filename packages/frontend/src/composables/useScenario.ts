import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useMappingStore } from '@/stores/mapping';
import { ElMessage, ElMessageBox } from 'element-plus';
import { stubApi, type Stub } from '@/services/api';
import type { Mapping } from '@/types/wiremock';
import { toMapping } from '@/utils/wiremock';

export { toMapping };

/** Order stubs by following the scenario state chain from 'Started' */
export function orderByStateChain(stubs: Stub[]): Stub[] {
  if (stubs.length === 0) return [];

  const byRequired = new Map<string, Stub[]>();
  for (const stub of stubs) {
    const state = toMapping(stub).requiredScenarioState || 'Started';
    if (!byRequired.has(state)) byRequired.set(state, []);
    byRequired.get(state)!.push(stub);
  }

  const ordered: Stub[] = [];
  const visited = new Set<string>();

  let currentState: string | undefined = 'Started';
  while (currentState && byRequired.has(currentState)) {
    const candidates = byRequired.get(currentState)!;
    const stub = candidates.find((s) => !visited.has(s.id));
    if (!stub) break;
    ordered.push(stub);
    visited.add(stub.id);
    currentState = toMapping(stub).newScenarioState || undefined;
  }

  for (const stub of stubs) {
    if (!visited.has(stub.id)) {
      ordered.push(stub);
    }
  }

  return ordered;
}

export interface StateChainEntry {
  requiredScenarioState: string;
  newScenarioState?: string;
}

// --- Composable ---

type ScenarioStateField = 'requiredScenarioState' | 'newScenarioState';

export function useScenario() {
  const { t } = useI18n();
  const mappingStore = useMappingStore();
  const { stubs } = storeToRefs(mappingStore);

  const selectedScenario = ref<string | null>(null);
  const saving = ref(false);

  // --- Computed: scenario analysis ---

  const scenarioNames = computed(() => {
    const names = new Set<string>();
    for (const stub of stubs.value) {
      const m = toMapping(stub);
      if (m.scenarioName) names.add(m.scenarioName);
    }
    return Array.from(names).sort();
  });

  watch(scenarioNames, (names) => {
    if (selectedScenario.value && !names.includes(selectedScenario.value)) {
      selectedScenario.value = names.length > 0 ? names[0] : null;
    }
  });

  const scenarioStubs = computed(() => {
    if (!selectedScenario.value) return [];
    return stubs.value.filter((s) => toMapping(s).scenarioName === selectedScenario.value);
  });

  const orderedSteps = computed(() => orderByStateChain(scenarioStubs.value));

  const duplicateStates = computed(() => {
    const byRequired = new Map<string, Stub[]>();
    for (const stub of scenarioStubs.value) {
      const state = toMapping(stub).requiredScenarioState || 'Started';
      if (!byRequired.has(state)) byRequired.set(state, []);
      byRequired.get(state)!.push(stub);
    }
    const duplicates: { state: string; stubs: Stub[] }[] = [];
    for (const [state, stateStubs] of byRequired) {
      if (stateStubs.length > 1) {
        duplicates.push({ state, stubs: stateStubs });
      }
    }
    return duplicates;
  });

  const flowWarnings = computed(() => {
    const warnings: string[] = [];
    if (scenarioStubs.value.length === 0) return warnings;

    const hasStarted = scenarioStubs.value.some((s) => {
      const state = toMapping(s).requiredScenarioState;
      return !state || state === 'Started';
    });
    if (!hasStarted) {
      warnings.push(t('scenarios.noStartState'));
    }

    const allRequired = new Set(
      scenarioStubs.value.map((s) => toMapping(s).requiredScenarioState || 'Started')
    );
    for (const stub of scenarioStubs.value) {
      const newState = toMapping(stub).newScenarioState;
      if (newState && !allRequired.has(newState)) {
        warnings.push(t('scenarios.unreachableState', { state: newState }));
      }
    }

    return warnings;
  });

  const unassignedStubs = computed(() => {
    return stubs.value.filter((s) => !toMapping(s).scenarioName);
  });

  function getLastNewState(): string | undefined {
    const steps = orderedSteps.value;
    if (steps.length === 0) return 'Started';
    return toMapping(steps[steps.length - 1]).newScenarioState || undefined;
  }

  // --- Actions ---

  async function reorderSteps(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;

    const steps = orderedSteps.value;

    // 1. Deep-copy all stub data upfront (escape Vue reactivity)
    const allStubs = steps.map((s) => ({
      id: s.id,
      description: s.description || undefined,
      mapping: JSON.parse(JSON.stringify(toMapping(s))) as Mapping
    }));

    // 2. Extract the fixed state chain (positions stay, stubs move)
    const chain = allStubs.map((d) => ({
      requiredScenarioState: d.mapping.requiredScenarioState || 'Started',
      newScenarioState: d.mapping.newScenarioState as string | undefined
    }));

    // 3. Reorder stubs
    const [moved] = allStubs.splice(fromIndex, 1);
    allStubs.splice(toIndex, 0, moved);

    // 4. Reassign state fields and update ALL stubs via direct API
    //    (bypass store to prevent intermediate reactivity / UI re-renders)
    saving.value = true;
    try {
      for (let i = 0; i < allStubs.length; i++) {
        const { id, description, mapping } = allStubs[i];
        mapping.requiredScenarioState = chain[i].requiredScenarioState;
        if (chain[i].newScenarioState) {
          mapping.newScenarioState = chain[i].newScenarioState;
        } else {
          delete mapping.newScenarioState;
        }
        await stubApi.update(id, {
          description: description !== undefined ? description || null : undefined,
          mapping
        });
      }
      await mappingStore.fetchMappings();
      ElMessage.success(t('scenarios.messages.reordered'));
    } catch (e: any) {
      ElMessage.error(e.message);
    } finally {
      saving.value = false;
    }
  }

  function confirmRemoveFromScenario(stub: Stub) {
    ElMessageBox.confirm(t('scenarios.confirmRemove'), t('common.confirm'), {
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
      type: 'warning'
    })
      .then(() => removeFromScenario(stub))
      .catch(() => {});
  }

  async function removeFromScenario(stub: Stub) {
    saving.value = true;
    try {
      const mapping = { ...toMapping(stub) };
      delete mapping.scenarioName;
      delete mapping.requiredScenarioState;
      delete mapping.newScenarioState;
      await mappingStore.updateMapping(stub.id, mapping, stub.description || undefined);
      ElMessage.success(t('scenarios.messages.stepRemoved'));
    } catch (e: any) {
      ElMessage.error(e.message);
    } finally {
      saving.value = false;
    }
  }

  // --- Inline editing with chain update ---

  const editingField = ref<{
    stubId: string;
    field: ScenarioStateField;
    value: string;
  } | null>(null);

  function startInlineEdit(stub: Stub, field: ScenarioStateField) {
    const m = toMapping(stub);
    editingField.value = {
      stubId: stub.id,
      field,
      value: m[field] || (field === 'requiredScenarioState' ? 'Started' : '')
    };
  }

  async function saveInlineEdit() {
    if (!editingField.value) return;

    const { stubId, field, value } = editingField.value;
    const stub = mappingStore.getStubById(stubId);
    if (!stub) {
      editingField.value = null;
      return;
    }

    const mapping = { ...toMapping(stub) };
    const oldValue = mapping[field] || (field === 'requiredScenarioState' ? 'Started' : '');

    if (value === oldValue) {
      editingField.value = null;
      return;
    }

    saving.value = true;
    try {
      if (value) {
        mapping[field] = value;
      } else {
        delete mapping[field];
      }
      await mappingStore.updateMapping(stub.id, mapping, stub.description || undefined);

      // Update the adjacent stub to keep the chain linked
      await propagateStateChange(stubId, field, oldValue, value);

      ElMessage.success(t('scenarios.messages.updated'));
    } catch (e: any) {
      ElMessage.error(e.message);
    } finally {
      saving.value = false;
      editingField.value = null;
    }
  }

  /**
   * Propagate a state name change to the adjacent stub in the chain.
   *
   * When `newScenarioState` is edited, the next stub's `requiredScenarioState`
   * must match the new value to keep the chain linked.
   * When `requiredScenarioState` is edited, the previous stub's `newScenarioState`
   * must match the new value.
   */
  async function propagateStateChange(
    stubId: string,
    field: ScenarioStateField,
    oldValue: string,
    newValue: string
  ) {
    if (!newValue) return;

    if (field === 'newScenarioState') {
      const nextStub = scenarioStubs.value.find(
        (s) => s.id !== stubId && (toMapping(s).requiredScenarioState || 'Started') === oldValue
      );
      if (nextStub) {
        const nextMapping = { ...toMapping(nextStub) };
        nextMapping.requiredScenarioState = newValue;
        await mappingStore.updateMapping(
          nextStub.id,
          nextMapping,
          nextStub.description || undefined
        );
      }
    } else {
      const prevStub = scenarioStubs.value.find(
        (s) => s.id !== stubId && toMapping(s).newScenarioState === oldValue
      );
      if (prevStub) {
        const prevMapping = { ...toMapping(prevStub) };
        prevMapping.newScenarioState = newValue;
        await mappingStore.updateMapping(
          prevStub.id,
          prevMapping,
          prevStub.description || undefined
        );
      }
    }
  }

  return {
    selectedScenario,
    saving,
    editingField,
    scenarioNames,
    scenarioStubs,
    orderedSteps,
    duplicateStates,
    flowWarnings,
    unassignedStubs,
    getLastNewState,
    reorderSteps,
    confirmRemoveFromScenario,
    startInlineEdit,
    saveInlineEdit
  };
}
