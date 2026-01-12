<template>
  <div class="json-editor">
    <el-input
      v-model="jsonText"
      type="textarea"
      :rows="rows"
      :placeholder="placeholder"
      @blur="handleBlur"
      class="json-input"
    />
    <div v-if="error" class="error-message">
      <el-icon><CircleClose /></el-icon>
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: any
  placeholder?: string
  rows?: number
}>(), {
  placeholder: '',
  rows: 10
})

const emit = defineEmits<{
  'update:modelValue': [value: any]
}>()

const jsonText = ref('')
const error = ref('')

// 初期化
watch(() => props.modelValue, (value) => {
  if (value) {
    try {
      jsonText.value = JSON.stringify(value, null, 2)
      error.value = ''
    } catch (e) {
      console.error('Failed to stringify:', e)
    }
  } else {
    jsonText.value = ''
  }
}, { immediate: true, deep: true })

function handleBlur() {
  try {
    if (jsonText.value.trim()) {
      const parsed = JSON.parse(jsonText.value)
      emit('update:modelValue', parsed)
      error.value = ''
    } else {
      emit('update:modelValue', undefined)
      error.value = ''
    }
  } catch (e: any) {
    error.value = `JSON解析エラー: ${e.message}`
  }
}
</script>

<style scoped>
.json-editor {
  position: relative;
}

.json-input :deep(textarea) {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
}

.error-message {
  margin-top: 8px;
  color: #f56c6c;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
