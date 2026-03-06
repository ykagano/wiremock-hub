import { ref, h, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { wiremockInstanceApi, stubApi, type WiremockInstance } from '@/services/api';
import { ElMessage, ElMessageBox, ElCheckbox } from 'element-plus';

const STORAGE_KEY_SYNC_ALL = 'wiremock-hub-skip-sync-all-confirm';
const STORAGE_KEY_SYNC = 'wiremock-hub-skip-sync-confirm';
const STORAGE_KEY_APPEND_ALL = 'wiremock-hub-skip-append-all-confirm';
const STORAGE_KEY_APPEND = 'wiremock-hub-skip-append-confirm';

type SyncMode = 'sync' | 'append';

interface ModeConfig {
  storageKeyAll: string;
  storageKey: string;
  confirmAllKey: string;
  confirmKey: string;
  successAllKey: string;
  successKey: string;
  failedKey: string;
  resetBeforeSync: boolean;
  loadingRef: Ref<boolean>;
}

function showConfirmWithDontShowAgain(
  message: string,
  title: string,
  storageKey: string,
  t: (key: string) => string
): Promise<void> {
  const skip = localStorage.getItem(storageKey) === 'true';
  if (skip) {
    return Promise.resolve();
  }

  const dontShowAgain = ref(false);

  const MessageContent = () =>
    h('div', [
      h('p', { style: 'margin: 0 0 12px 0' }, message),
      h(
        ElCheckbox,
        {
          modelValue: dontShowAgain.value,
          'onUpdate:modelValue': (val: boolean) => {
            dontShowAgain.value = val;
          }
        },
        () => t('instances.dontShowAgain')
      )
    ]);

  return ElMessageBox.confirm(MessageContent, title, {
    confirmButtonText: t('common.yes'),
    cancelButtonText: t('common.no'),
    type: 'info'
  }).then(() => {
    if (dontShowAgain.value) {
      localStorage.setItem(storageKey, 'true');
    }
  });
}

export function useSyncAllInstances() {
  const { t } = useI18n();
  const syncing = ref(false);
  const appending = ref(false);

  const modeConfigs: Record<SyncMode, ModeConfig> = {
    sync: {
      storageKeyAll: STORAGE_KEY_SYNC_ALL,
      storageKey: STORAGE_KEY_SYNC,
      confirmAllKey: 'instances.syncAllConfirm',
      confirmKey: 'instances.syncConfirm',
      successAllKey: 'instances.syncAllSuccess',
      successKey: 'instances.syncSuccess',
      failedKey: 'instances.syncFailed',
      resetBeforeSync: true,
      loadingRef: syncing
    },
    append: {
      storageKeyAll: STORAGE_KEY_APPEND_ALL,
      storageKey: STORAGE_KEY_APPEND,
      confirmAllKey: 'instances.appendAllConfirm',
      confirmKey: 'instances.appendConfirm',
      successAllKey: 'instances.appendAllSuccess',
      successKey: 'instances.appendSuccess',
      failedKey: 'instances.appendFailed',
      resetBeforeSync: false,
      loadingRef: appending
    }
  };

  async function confirmAndOperateAll(projectId: string, mode: SyncMode) {
    let instances: WiremockInstance[];
    try {
      instances = await wiremockInstanceApi.list(projectId);
    } catch (error: any) {
      ElMessage.error(error.message || t('common.error'));
      return;
    }

    confirmAndOperateAllWithInstances(projectId, instances, mode);
  }

  async function confirmAndOperateAllWithInstances(
    projectId: string,
    instances: WiremockInstance[],
    mode: SyncMode
  ) {
    const config = modeConfigs[mode];
    const activeInstances = instances.filter((i) => i.isActive !== false);

    if (activeInstances.length === 0) {
      ElMessage.warning(t('instances.syncAllNoInstances'));
      return;
    }

    showConfirmWithDontShowAgain(
      t(config.confirmAllKey),
      t('common.confirm'),
      config.storageKeyAll,
      t
    )
      .then(async () => {
        await executeAll(projectId, activeInstances, mode);
      })
      .catch(() => {
        // Cancelled
      });
  }

  async function executeAll(projectId: string, instances: WiremockInstance[], mode: SyncMode) {
    const config = modeConfigs[mode];
    config.loadingRef.value = true;
    let totalSuccess = 0;
    let totalFailed = 0;
    try {
      for (const instance of instances) {
        try {
          const result = await stubApi.syncAll(projectId, instance.id, config.resetBeforeSync);
          totalSuccess += result.success;
          totalFailed += result.failed;
        } catch (error) {
          console.warn(`Failed to ${mode} stubs to instance ${instance.name}:`, error);
          totalFailed++;
        }
      }
      const message = t(config.successAllKey, { success: totalSuccess, failed: totalFailed });
      if (totalFailed > 0) {
        ElMessage.warning(message);
      } else {
        ElMessage.success(message);
      }
    } finally {
      config.loadingRef.value = false;
    }
  }

  async function confirmAndOperateInstance(
    projectId: string,
    instance: WiremockInstance,
    mode: SyncMode,
    onStart: () => void,
    onEnd: () => void
  ) {
    const config = modeConfigs[mode];
    showConfirmWithDontShowAgain(
      t(config.confirmKey, { name: instance.name }),
      t('common.confirm'),
      config.storageKey,
      t
    )
      .then(async () => {
        onStart();
        try {
          const result = await stubApi.syncAll(projectId, instance.id, config.resetBeforeSync);
          ElMessage.success(
            t(config.successKey, { success: result.success, failed: result.failed })
          );
        } catch (error: any) {
          ElMessage.error(error.message || t(config.failedKey));
        } finally {
          onEnd();
        }
      })
      .catch(() => {
        // Cancelled
      });
  }

  // Public API: thin wrappers for backward compatibility
  const confirmAndSyncAll = (projectId: string) => confirmAndOperateAll(projectId, 'sync');
  const confirmAndAppendAll = (projectId: string) => confirmAndOperateAll(projectId, 'append');
  const confirmAndSyncAllWithInstances = (projectId: string, instances: WiremockInstance[]) =>
    confirmAndOperateAllWithInstances(projectId, instances, 'sync');
  const confirmAndAppendAllWithInstances = (projectId: string, instances: WiremockInstance[]) =>
    confirmAndOperateAllWithInstances(projectId, instances, 'append');
  const confirmAndSyncInstance = (
    projectId: string,
    instance: WiremockInstance,
    onStart: () => void,
    onEnd: () => void
  ) => confirmAndOperateInstance(projectId, instance, 'sync', onStart, onEnd);
  const confirmAndAppendInstance = (
    projectId: string,
    instance: WiremockInstance,
    onStart: () => void,
    onEnd: () => void
  ) => confirmAndOperateInstance(projectId, instance, 'append', onStart, onEnd);

  return {
    syncing,
    appending,
    confirmAndSyncAll,
    confirmAndSyncAllWithInstances,
    confirmAndSyncInstance,
    confirmAndAppendAll,
    confirmAndAppendAllWithInstances,
    confirmAndAppendInstance
  };
}
