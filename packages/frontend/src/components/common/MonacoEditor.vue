<template>
  <div class="monaco-editor-wrapper" :style="{ height: height }">
    <div ref="containerRef" class="monaco-editor-container">
      <el-input
        v-if="fallback"
        v-model="fallbackText"
        type="textarea"
        :rows="10"
        @input="$emit('update:modelValue', fallbackText)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, watch, nextTick } from 'vue';
import { useTheme } from '@/composables/useTheme';
import { registerWiremockTemplateCompletions } from '@/utils/wiremockTemplateCompletions';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    language?: string;
    height?: string;
    readOnly?: boolean;
    minimap?: boolean;
  }>(),
  {
    language: 'json',
    height: '300px',
    readOnly: false,
    minimap: false
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const { isDark } = useTheme();

const containerRef = ref<HTMLElement | null>(null);
const editor = shallowRef<any>(null);
let monacoModule: typeof import('monaco-editor') | null = null;
const fallback = ref(false);
const fallbackText = ref(props.modelValue);
let isUpdatingFromParent = false;
let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  try {
    monacoModule = await import('monaco-editor');
    const monaco = monacoModule;
    registerWiremockTemplateCompletions(monaco);
    if (!containerRef.value) return;

    editor.value = monaco.editor.create(containerRef.value, {
      value: props.modelValue,
      language: props.language,
      theme: isDark.value ? 'vs-dark' : 'vs',
      readOnly: props.readOnly,
      minimap: { enabled: props.minimap },
      fontSize: 13,
      tabSize: 2,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: false,
      renderLineHighlight: 'line',
      lineNumbers: 'on',
      folding: true,
      bracketPairColorization: { enabled: true }
    });

    // Expose editor instance on DOM for E2E test access
    (containerRef.value as any).__monacoEditor = editor.value;

    editor.value.onDidChangeModelContent(() => {
      if (isUpdatingFromParent) return;
      const value = editor.value!.getValue();
      emit('update:modelValue', value);
    });

    // Observe the outer wrapper for resize (including user drag-resize)
    const wrapper = containerRef.value.parentElement;
    if (wrapper) {
      resizeObserver = new ResizeObserver(() => {
        editor.value?.layout();
      });
      resizeObserver.observe(wrapper);
    }
  } catch (e) {
    console.error('Failed to load Monaco Editor, falling back to textarea:', e);
    fallback.value = true;
  }
});

// Sync modelValue from parent
watch(
  () => props.modelValue,
  (newValue) => {
    if (!editor.value) {
      fallbackText.value = newValue;
      return;
    }
    if (editor.value.getValue() !== newValue) {
      isUpdatingFromParent = true;
      editor.value.setValue(newValue);
      isUpdatingFromParent = false;
    }
  }
);

// Sync theme
watch(isDark, (dark) => {
  if (editor.value && monacoModule) {
    monacoModule.editor.setTheme(dark ? 'vs-dark' : 'vs');
  }
});

// Sync readOnly
watch(
  () => props.readOnly,
  (readOnly) => {
    editor.value?.updateOptions({ readOnly });
  }
);

// Trigger layout when the component becomes visible (e.g. tab switch)
watch(
  () => containerRef.value?.offsetHeight,
  () => {
    nextTick(() => {
      editor.value?.layout();
    });
  }
);

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  editor.value?.dispose();
});
</script>

<style scoped>
.monaco-editor-wrapper {
  width: 100%;
  min-height: 150px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  position: relative;
  resize: vertical;
}

.monaco-editor-container {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
</style>
