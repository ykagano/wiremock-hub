import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { wiremockInstanceApi, stubApi, type WiremockInstance } from '@/services/api'
import { ElMessage, ElMessageBox } from 'element-plus'

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

    const activeInstances = instances.filter(i => i.isActive !== false)

    if (activeInstances.length === 0) {
      ElMessage.warning(t('instances.syncAllNoInstances'))
      return
    }

    ElMessageBox.confirm(
      t('instances.syncAllConfirm'),
      t('common.confirm'),
      {
        confirmButtonText: t('common.yes'),
        cancelButtonText: t('common.no'),
        type: 'info'
      }
    ).then(async () => {
      await executeSyncAll(projectId, activeInstances)
    }).catch(() => {
      // Cancelled
    })
  }

  async function confirmAndSyncAllWithInstances(projectId: string, instances: WiremockInstance[]) {
    const activeInstances = instances.filter(i => i.isActive !== false)

    if (activeInstances.length === 0) {
      ElMessage.warning(t('instances.syncAllNoInstances'))
      return
    }

    ElMessageBox.confirm(
      t('instances.syncAllConfirm'),
      t('common.confirm'),
      {
        confirmButtonText: t('common.yes'),
        cancelButtonText: t('common.no'),
        type: 'info'
      }
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
      ElMessage.success(
        t('instances.syncAllSuccess', { success: totalSuccess, failed: totalFailed })
      )
    } finally {
      syncing.value = false
    }
  }

  return { syncing, confirmAndSyncAll, confirmAndSyncAllWithInstances }
}
