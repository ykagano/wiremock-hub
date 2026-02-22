<template>
  <el-card class="filter-card">
    <el-form :inline="true" :model="filter" class="filter-form">
      <el-form-item :label="t('requests.filter.urlPattern')">
        <el-input
          v-model="filter.urlPattern"
          :placeholder="t('requests.filter.urlPatternPlaceholder')"
          clearable
          :style="{ width: isMobile ? '100%' : '200px' }"
        />
      </el-form-item>

      <el-form-item :label="t('requests.filter.method')">
        <el-select
          v-model="filter.method"
          :placeholder="t('requests.filter.allMethods')"
          clearable
          :style="{ width: isMobile ? '100%' : '120px' }"
        >
          <el-option label="GET" value="GET" />
          <el-option label="POST" value="POST" />
          <el-option label="PUT" value="PUT" />
          <el-option label="DELETE" value="DELETE" />
          <el-option label="PATCH" value="PATCH" />
          <el-option label="HEAD" value="HEAD" />
          <el-option label="OPTIONS" value="OPTIONS" />
        </el-select>
      </el-form-item>

      <el-form-item :label="t('requests.filter.statusFrom')">
        <el-input-number
          v-model="filter.statusFrom"
          :min="100"
          :max="599"
          :placeholder="t('requests.filter.statusFromPlaceholder')"
          :style="{ width: isMobile ? '100%' : '100px' }"
          controls-position="right"
        />
      </el-form-item>

      <el-form-item :label="t('requests.filter.statusTo')">
        <el-input-number
          v-model="filter.statusTo"
          :min="100"
          :max="599"
          :placeholder="t('requests.filter.statusToPlaceholder')"
          :style="{ width: isMobile ? '100%' : '100px' }"
          controls-position="right"
        />
      </el-form-item>

      <el-form-item>
        <el-button type="primary" @click="applyFilter">
          {{ t('requests.filter.apply') }}
        </el-button>
        <el-button @click="resetFilter">
          {{ t('requests.filter.reset') }}
        </el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResponsive } from '@/composables/useResponsive'

export interface FilterState {
  urlPattern: string
  method: string
  statusFrom: number | undefined
  statusTo: number | undefined
}

const emit = defineEmits<{
  (e: 'filter-change', filter: FilterState): void
}>()

const { t } = useI18n()
const { isMobile } = useResponsive()

const filter = reactive<FilterState>({
  urlPattern: '',
  method: '',
  statusFrom: undefined,
  statusTo: undefined
})

function applyFilter() {
  emit('filter-change', { ...filter })
}

function resetFilter() {
  filter.urlPattern = ''
  filter.method = ''
  filter.statusFrom = undefined
  filter.statusTo = undefined
  emit('filter-change', { ...filter })
}

// Auto-apply filter when any value changes (debounced via watch)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(filter, () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    applyFilter()
  }, 300)
}, { deep: true })
</script>

<style scoped>
.filter-card {
  margin-bottom: 16px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: flex-end;
}
</style>
