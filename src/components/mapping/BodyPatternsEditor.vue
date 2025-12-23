<template>
  <div class="body-patterns-editor">
    <div
      v-for="(pattern, index) in patterns"
      :key="index"
      class="pattern-row"
    >
      <el-card>
        <el-form label-width="120px">
          <el-form-item label="パターンタイプ">
            <el-select v-model="pattern.type" @change="updateValue">
              <el-option label="Equal To" value="equalTo" />
              <el-option label="Contains" value="contains" />
              <el-option label="Matches (Regex)" value="matches" />
              <el-option label="Equal To JSON" value="equalToJson" />
              <el-option label="Matches JSON Path" value="matchesJsonPath" />
            </el-select>
          </el-form-item>

          <el-form-item label="値">
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
            削除
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
      パターン追加
    </el-button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { BodyPattern } from '@/types/wiremock'

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

// 初期化
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
