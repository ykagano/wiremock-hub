<template>
  <div class="json-editor">
    <MonacoEditor
      v-model="jsonText"
      language="json"
      :height="editorHeight"
      @update:modelValue="handleChange"
    />
    <div v-if="error" class="error-message">
      <el-icon><CircleClose /></el-icon>
      {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import MonacoEditor from '@/components/common/MonacoEditor.vue';

const { t } = useI18n();

const props = withDefaults(
  defineProps<{
    modelValue: any;
    placeholder?: string;
    rows?: number;
  }>(),
  {
    placeholder: '',
    rows: 10
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const editorHeight = computed(() => `${props.rows * 22}px`);

const jsonText = ref('');
const error = ref('');
const isUpdatingFromParent = ref(false);

// Sync from parent to jsonText
watch(
  () => props.modelValue,
  (value) => {
    if (isUpdatingFromParent.value) return;
    if (value) {
      try {
        const newText = JSON.stringify(value, null, 2);
        // Only update if the parsed values differ to avoid cursor jumps
        if (jsonText.value.trim()) {
          try {
            const current = JSON.parse(jsonText.value);
            if (JSON.stringify(current) === JSON.stringify(value)) return;
          } catch {
            // Current text is invalid JSON, update it
          }
        }
        jsonText.value = newText;
        error.value = '';
      } catch (e) {
        console.error('Failed to stringify:', e);
      }
    } else {
      jsonText.value = '';
    }
  },
  { immediate: true, deep: true }
);

function handleChange(value: string) {
  jsonText.value = value;
  try {
    if (value.trim()) {
      const parsed = JSON.parse(value);
      error.value = '';
      isUpdatingFromParent.value = true;
      emit('update:modelValue', parsed);
      isUpdatingFromParent.value = false;
    } else {
      error.value = '';
      isUpdatingFromParent.value = true;
      emit('update:modelValue', undefined);
      isUpdatingFromParent.value = false;
    }
  } catch (e: any) {
    error.value = t('messages.json.parseError', { message: e.message });
  }
}
</script>

<style scoped>
.json-editor {
  position: relative;
}

.error-message {
  margin-top: 8px;
  color: var(--el-color-danger);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
