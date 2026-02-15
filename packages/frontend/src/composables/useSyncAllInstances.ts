import { ref, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { wiremockInstanceApi, stubApi, type WiremockInstance } from '@/services/api'
import { ElMessage, ElMessageBox, ElCheckbox } from 'element-plus'

const STORAGE_KEY_SYNC_ALL = 'wiremock-hub-skip-sync-all-confirm'
const STORAGE_KEY_SYNC = 'wiremock-hub-skip-sync-confirm'

function showConfirmWithDontShowAgain(
  message: string,
  title: string,
  storageKey: string,
  t: (key: string) => string
): Promise<void> {
  const skip = localStorage.getItem(storageKey) === 'true'
  if (skip) {
    return Promise.resolve()
  }

  const dontShowAgain = ref(false)

  const MessageContent = () => h('div', [
    h('p', { style: 'margin: 0 0 12px 0' }, message),
    h(ElCheckbox, {
      modelValue: dontShowAgain.value,
      'onUpdate:modelValue': (val: boolean) => { dontShowAgain.value = val }
    }, () => t('instances.dontShowAgain'))
  ])

  return ElMessageBox.confirm(
    MessageContent,
    title,
    {
      confirmButtonText: t('common.yes'),
      cancelButtonText: t('common.no'),
      type: 'info'
    }
  ).then(() => {
    if (dontShowAgain.value) {
      localStorage.setItem(storageKey, 'true')
    }
  })
}

export function useSyncAllInstances() {
  const { t } = useI18n()
  const syncing = ref(false)

  async function confirmAndSyncAll(projectId: string) {
    let instances: WiremockInstance[]
    try {
      instances = await wiremockInstanceApi.list(projectId)
    } catch (error: any) {
      ElMessage.error(error.message || t('common.error'))
      return
    }

    confirmAndSyncAllWithInstances(projectId, instances)
  }

  async function confirmAndSyncAllWithInstances(projectId: string, instances: WiremockInstance[]) {
    const activeInstances = instances.filter(i => i.isActive !== false)

    if (activeInstances.length === 0) {
      ElMessage.warning(t('instances.syncAllNoInstances'))
      return
    }

    showConfirmWithDontShowAgain(
      t('instances.syncAllConfirm'),
      t('common.confirm'),
      STORAGE_KEY_SYNC_ALL,
      t
    ).then(async () => {
      await executeSyncAll(projectId, activeInstances)
    }).catch(() => {
      // Cancelled
    })
  }

  async function executeSyncAll(projectId: string, instances: WiremockInstance[]) {
    syncing.value = true
    let totalSuccess = 0
    let totalFailed = 0
    try {
      for (const instance of instances) {
        try {
          const result = await stubApi.syncAll(projectId, instance.id)
          totalSuccess += result.success
          totalFailed += result.failed
        } catch {
          totalFailed++
        }
      }
      const message = t('instances.syncAllSuccess', { success: totalSuccess, failed: totalFailed })
      if (totalFailed > 0) {
        ElMessage.warning(message)
      } else {
        ElMessage.success(message)
      }
    } finally {
      syncing.value = false
    }
  }

  async function confirmAndSyncInstance(
    projectId: string,
    instance: WiremockInstance,
    onStart: () => void,
    onEnd: () => void
  ) {
    showConfirmWithDontShowAgain(
      t('instances.syncConfirm', { name: instance.name }),
      t('common.confirm'),
      STORAGE_KEY_SYNC,
      t
    ).then(async () => {
      onStart()
      try {
        const result = await stubApi.syncAll(projectId, instance.id)
        ElMessage.success(t('instances.syncSuccess', { success: result.success, failed: result.failed }))
      } catch (error: any) {
        ElMessage.error(error.message || t('instances.syncFailed'))
      } finally {
        onEnd()
      }
    }).catch(() => {
      // Cancelled
    })
  }

  return { syncing, confirmAndSyncAll, confirmAndSyncAllWithInstances, confirmAndSyncInstance }
}
