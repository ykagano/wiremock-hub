<template>
  <div class="key-value-editor">
    <div
      v-for="(item, index) in items"
      :key="index"
      class="kv-row"
    >
      <el-input
        v-model="item.key"
        :placeholder="t('labels.key')"
        @input="updateValue"
        style="width: 200px"
      />
      <el-input
        v-model="item.value"
        :placeholder="t('labels.value')"
        @input="updateValue"
      />
      <el-button
        type="danger"
        circle
        size="small"
        @click="removeItem(index)"
      >
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>

    <el-button
      type="primary"
      plain
      size="small"
      @click="addItem"
      style="margin-top: 8px"
    >
      <el-icon><Plus /></el-icon>
      {{ t('common.add') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  modelValue?: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any> | undefined]
}>()

interface KeyValueItem {
  key: string
  value: string
}

const items = ref<KeyValueItem[]>([])

// Initialization
watch(() => props.modelValue, (value) => {
  if (value && typeof value === 'object') {
    items.value = Object.entries(value).map(([key, val]) => ({
      key,
      value: typeof val === 'string' ? val : JSON.stringify(val)
    }))
  } else {
    items.value = []
  }
}, { immediate: true })

function addItem() {
  items.value.push({ key: '', value: '' })
}

function removeItem(index: number) {
  items.value.splice(index, 1)
  updateValue()
}

function updateValue() {
  const result: Record<string, any> = {}
  items.value.forEach(item => {
    if (item.key) {
      result[item.key] = item.value
    }
  })

  emit('update:modelValue', Object.keys(result).length > 0 ? result : undefined)
}
</script>

<style scoped>
.key-value-editor {
  width: 100%;
}

.kv-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}
</style>
