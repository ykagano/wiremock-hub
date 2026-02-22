<template>
  <div class="body-patterns-editor">
    <div
      v-for="(pattern, index) in patterns"
      :key="index"
      class="pattern-row"
    >
      <el-card>
        <el-form :label-width="isMobile ? undefined : '120px'" :label-position="isMobile ? 'top' : 'right'">
          <el-form-item :label="t('labels.patternType')">
            <el-select v-model="pattern.type" @change="updateValue">
              <el-option :label="t('labels.bodyMatch.equalTo')" value="equalTo" />
              <el-option :label="t('labels.bodyMatch.contains')" value="contains" />
              <el-option :label="t('labels.bodyMatch.matches')" value="matches" />
              <el-option :label="t('labels.bodyMatch.equalToJson')" value="equalToJson" />
              <el-option :label="t('labels.bodyMatch.matchesJsonPath')" value="matchesJsonPath" />
            </el-select>
          </el-form-item>

          <el-form-item :label="t('labels.value')">
            <el-input
              v-model="pattern.value"
              type="textarea"
              :rows="4"
              @input="updateValue"
            />
          </el-form-item>

          <el-button
            type="danger"
            size="small"
            @click="removePattern(index)"
          >
            {{ t('common.delete') }}
          </el-button>
        </el-form>
      </el-card>
    </div>

    <el-button
      type="primary"
      plain
      size="small"
      @click="addPattern"
      style="margin-top: 8px"
    >
      <el-icon><Plus /></el-icon>
      {{ t('labels.addPattern') }}
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResponsive } from '@/composables/useResponsive'
import type { BodyPattern } from '@/types/wiremock'

const { t } = useI18n()
const { isMobile } = useResponsive()

const props = defineProps<{
  modelValue?: BodyPattern[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BodyPattern[] | undefined]
}>()

interface PatternItem {
  type: 'equalTo' | 'contains' | 'matches' | 'equalToJson' | 'matchesJsonPath'
  value: string
}

const patterns = ref<PatternItem[]>([])

// Initialization
watch(() => props.modelValue, (value) => {
  if (value && Array.isArray(value)) {
    patterns.value = value.map(p => {
      const type = Object.keys(p)[0] as PatternItem['type']
      return {
        type,
        value: (p as any)[type] || ''
      }
    })
  } else {
    patterns.value = []
  }
}, { immediate: true })

function addPattern() {
  patterns.value.push({ type: 'equalTo', value: '' })
}

function removePattern(index: number) {
  patterns.value.splice(index, 1)
  updateValue()
}

function updateValue() {
  const result = patterns.value
    .filter(p => p.value)
    .map(p => ({ [p.type]: p.value }))

  emit('update:modelValue', result.length > 0 ? result as BodyPattern[] : undefined)
}
</script>

<style scoped>
.body-patterns-editor {
  width: 100%;
}

.pattern-row {
  margin-bottom: 12px;
}
</style>
