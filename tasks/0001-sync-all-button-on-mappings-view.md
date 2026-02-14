# Add "Sync All Instances" Button to MappingsView - Implementation Task

## Overview

Add a "Sync All Instances" button to the toolbar of the stub mapping view (MappingsView), allowing users to execute sync without navigating to the project detail page after editing stubs.

Currently, syncing stubs to all instances is only available from the instance management section in `ProjectDetailView.vue`. By adding the same functionality to the mapping view, the "edit -> sync -> test" workflow can be completed without page navigation.

No backend changes are required. The existing `POST /api/stubs/sync-all` endpoint and `stubApi.syncAll()` will be used as-is.

---

## Task 1: Add i18n Translation Keys

**Files**:
- `packages/frontend/src/i18n/locales/ja.json`
- `packages/frontend/src/i18n/locales/en.json`

### Changes

Add the following keys to the `mappings` section.

**ja.json**:
```json
{
  "mappings": {
    "syncAllInstances": "すべてのインスタンスを同期",
    "syncAllConfirm": "プロジェクトの全インスタンスにスタブを同期しますか？既存のWireMockマッピングはリセットされ、現在のスタブで置き換えられます。",
    "syncAllNoInstances": "このプロジェクトにはWireMockインスタンスが登録されていません。プロジェクト詳細からインスタンスを追加してください。"
  }
}
```

**en.json**:
```json
{
  "mappings": {
    "syncAllInstances": "Sync All Instances",
    "syncAllConfirm": "Sync stubs to all instances? Existing WireMock mappings will be reset and replaced with current stubs.",
    "syncAllNoInstances": "No WireMock instances are registered for this project. Please add instances from Project Detail."
  }
}
```

The existing `instances.syncAllSuccess` key will be reused for displaying sync result messages ("Sync complete: {success} succeeded, {failed} failed").

### Notes

- Add within the existing `mappings` object. Do not break the object structure.
- `instances.syncAllSuccess` and `instances.syncFailed` are existing keys, so no new additions are needed.

---

## Task 2: Add Sync Button and Sync Logic to MappingsView

**File**: `packages/frontend/src/views/MappingsView.vue`

### Template Changes

Add the "Sync All Instances" button to the existing button group inside the `header-actions` div. Place it before the "Delete All" button (positive actions should come before destructive actions).

```html
<!-- Insert after the "Export" button and before the "Delete All" button -->
<el-button
  type="success"
  @click="confirmSyncAll"
  :loading="syncing"
  :disabled="mappings.length === 0"
>
  <el-icon><Refresh /></el-icon>
  {{ t('mappings.syncAllInstances') }}
</el-button>
```

Specifically, the toolbar button order should be as follows:

1. Refresh (Refresh)
2. Import (Upload)
3. Export (Download)
4. **Sync All Instances (Refresh, type="success")** -- newly added
5. Delete All (Delete, type="danger")
6. Create New (Plus, type="primary")

### Script Changes

1. **Add imports**:
   - Import `useProjectStore` from `@/stores/project`
   - Import `wiremockInstanceApi`, `stubApi` from `@/services/api`

2. **Add variables**:
   ```typescript
   const projectStore = useProjectStore()
   const syncing = ref(false)
   ```

3. **Add `confirmSyncAll` function**:
   ```typescript
   async function confirmSyncAll() {
     if (!projectStore.currentProjectId) {
       ElMessage.warning(t('messages.project.notSelected'))
       return
     }

     // Fetch instance list
     let instances
     try {
       const response = await wiremockInstanceApi.list(projectStore.currentProjectId)
       instances = response.data.data
     } catch (error: any) {
       ElMessage.error(error.message || t('common.error'))
       return
     }

     // Filter active instances
     const activeInstances = instances.filter((i: any) => i.isActive !== false)

     if (activeInstances.length === 0) {
       ElMessage.warning(t('mappings.syncAllNoInstances'))
       return
     }

     // Confirmation dialog
     ElMessageBox.confirm(
       t('mappings.syncAllConfirm'),
       t('common.confirm'),
       {
         confirmButtonText: t('common.yes'),
         cancelButtonText: t('common.no'),
         type: 'info'
       }
     ).then(async () => {
       await syncAllInstances(activeInstances)
     }).catch(() => {
       // Cancelled
     })
   }
   ```

4. **Add `syncAllInstances` function**:

   Implement based on the `syncAllInstances` function in `ProjectDetailView.vue`.

   ```typescript
   async function syncAllInstances(instances: any[]) {
     if (!projectStore.currentProjectId) return

     syncing.value = true
     let totalSuccess = 0
     let totalFailed = 0
     try {
       for (const instance of instances) {
         try {
           const result = await stubApi.syncAll(projectStore.currentProjectId, instance.id)
           totalSuccess += result.data.data.success || 0
           totalFailed += result.data.data.failed || 0
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
   ```

### Implementation Details

- The `syncing` state is used for the button loading indicator during sync execution
- The button is disabled when `mappings.length === 0` (there is no point in executing sync when there are no stubs to sync)
- The instance list is fetched from the API immediately before sync execution. Since MappingsView does not hold instances as reactive state, fetching each time is the appropriate approach
- Filter with `isActive !== false` to skip deactivated instances

---

## Task 3: Add E2E Tests

**File**: `e2e/tests/basic-flow.spec.ts` (add to existing file)

### Test Scenarios

Add the following scenarios to the existing E2E tests:

1. **The "Sync All Instances" button is displayed in the mappings view**:
   - Create a project, add stubs, and navigate to the mappings view
   - Verify that the sync button exists in the toolbar

2. **Clicking the sync button displays a confirmation dialog**:
   - Click the button
   - Verify that a confirmation dialog is displayed
   - Verify that it can be closed by canceling

3. **Sync executes successfully**:
   - Click the sync button with WireMock instances registered
   - Click "Yes" in the confirmation dialog
   - Verify that a success message is displayed

4. **A warning message is displayed when no instances are registered**:
   - Click the sync button with no instances registered
   - Verify that a warning message is displayed

---

## Implementation Order

```
Task 1 (Add i18n translation keys)
  └── Task 2 (MappingsView changes)
        └── Task 3 (E2E tests)
```

All changes are frontend-only, and there are ordering dependencies:
- Task 1 should be implemented first since it defines the translation keys referenced in Task 2
- Task 2 is the main UI implementation
- Task 3 should be implemented last to verify Task 2 behavior

However, Task 1 and Task 2 can be edited simultaneously (since they involve different files).

---

## Technical Notes

1. **Reuse of existing APIs**: No backend changes are required. Use `stubApi.syncAll(projectId, instanceId)` and `wiremockInstanceApi.list(projectId)` as-is. `syncAll` internally performs a WireMock reset + registration of all stubs.

2. **Consistency with ProjectDetailView**: Implement using the same logic pattern as the `syncAllInstances` function in `ProjectDetailView.vue`. Process instances sequentially and tally success/failure counts.

3. **Instance fetch timing**: MappingsView does not hold instances as reactive state. Fetch them on demand via `wiremockInstanceApi.list()` when the sync button is clicked. This keeps MappingsView's responsibilities simple.

4. **Duplicate `Refresh` icon**: The toolbar's "Refresh" button also uses the `Refresh` icon, but the sync button is visually distinguished by its green color via `type="success"`.

5. **Element Plus components**: Use the existing pattern of `ElMessageBox.confirm` for the confirmation dialog. Use `ElMessage.success` / `ElMessage.warning` for result messages.

6. **Separation of loading states**: `syncing` is a dedicated ref for sync, separated from the existing `loading` (used for mapping data loading). This allows operations like the refresh button to function independently during sync.

7. **Disabled conditions**: The sync button is disabled when there are 0 mappings. When no project is selected, the `confirmSyncAll` function returns early.
