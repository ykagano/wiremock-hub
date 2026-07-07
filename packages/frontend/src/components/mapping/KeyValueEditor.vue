<template>
  <div class="key-value-editor">
    <div v-for="(item, index) in items" :key="index" class="kv-row">
      <el-input
        v-model="item.key"
        :placeholder="t('labels.key')"
        @input="updateValue"
        :style="{ width: isMobile ? '100%' : '200px' }"
      />
      <el-input v-model="item.value" :placeholder="t('labels.value')" @input="updateValue" />
      <el-button type="danger" circle size="small" @click="removeItem(index)">
        <el-icon><Delete /></el-icon>
      </el-button>
    </div>

    <el-button type="primary" plain size="small" @click="addItem" style="margin-top: 8px">
      <el-icon><Plus /></el-icon>
      {{ t('common.add') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, toRaw, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useResponsive } from '@/composables/useResponsive';

const { t } = useI18n();
const { isMobile } = useResponsive();

const props = defineProps<{
  modelValue?: Record<string, any>;
  /**
   * Treat values as raw strings where duplicate keys collapse into string arrays
   * (multi-value headers/params). Leave off for WireMock matcher maps, where
   * array values are invalid and object values (equalTo/hasExactly) round-trip
   * through JSON strings instead.
   */
  multiValue?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, any> | undefined];
}>();

interface KeyValueItem {
  key: string;
  value: string;
}

const items = ref<KeyValueItem[]>([]);

// Skip re-initialization when the change is our own emit echoed back via v-model,
// so rows are not rebuilt (and reordered) while the user is typing
const NOT_EMITTED = Symbol('not-emitted');
let lastEmitted: Record<string, any> | undefined | typeof NOT_EMITTED = NOT_EMITTED;

// Initialization: multi-value entries (string arrays) expand into one row per value
watch(
  () => props.modelValue,
  (value) => {
    if (lastEmitted !== NOT_EMITTED && (value === undefined ? value : toRaw(value)) === lastEmitted)
      return;
    // Record the accepted external value so a later reset to a different value
    // (e.g. undefined) is not mistaken for an echo of our own emit
    lastEmitted = value === undefined ? undefined : toRaw(value);
    if (value && typeof value === 'object') {
      items.value = Object.entries(value).flatMap(([key, val]) => {
        if (
          props.multiValue &&
          Array.isArray(val) &&
          val.length > 0 &&
          val.every((v) => typeof v === 'string')
        ) {
          return val.map((v: string) => ({ key, value: v }));
        }
        return [{ key, value: typeof val === 'string' ? val : JSON.stringify(val) }];
      });
    } else {
      items.value = [];
    }
  },
  { immediate: true }
);

function addItem() {
  items.value.push({ key: '', value: '' });
}

function removeItem(index: number) {
  items.value.splice(index, 1);
  updateValue();
}

// Matcher maps hold objects (equalTo/hasExactly) that are displayed as JSON
// strings; parse them back so editing a row does not destroy the matcher
function parseIfJson(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function updateValue() {
  const result: Record<string, any> = {};
  items.value.forEach((item) => {
    if (!item.key) return;
    if (props.multiValue && Object.hasOwn(result, item.key)) {
      // Rows sharing a key collapse back into a string array (multi-value headers)
      const existing = result[item.key];
      result[item.key] = Array.isArray(existing)
        ? [...existing, item.value]
        : [existing, item.value];
    } else {
      // Matcher maps: last row wins for duplicate keys (arrays are invalid there)
      result[item.key] = props.multiValue ? item.value : parseIfJson(item.value);
    }
  });

  lastEmitted = Object.keys(result).length > 0 ? result : undefined;
  emit('update:modelValue', lastEmitted);
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

@media (max-width: 768px) {
  .kv-row {
    flex-wrap: wrap;
  }
}
</style>
