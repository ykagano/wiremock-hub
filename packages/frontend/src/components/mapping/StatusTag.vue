<template>
  <el-tooltip :disabled="!tag.tooltip" :content="tag.tooltip" placement="top">
    <el-tag :type="tag.type" :size="size">{{ tag.label }}</el-tag>
  </el-tooltip>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { MappingResponse } from '@wiremock-hub/shared';
import { statusTag } from '@/utils/wiremock';

const props = defineProps<{
  response?: MappingResponse;
  size?: 'large' | 'default' | 'small';
}>();

const tag = computed(() => statusTag(props.response));
</script>
