<template>
  <div class="settings">
    <h2>{{ t('settings.title') }}</h2>

    <el-card style="margin-bottom: 20px">
      <template #header>
        <span>{{ t('settings.language') }}</span>
      </template>
      <el-radio-group v-model="currentLocale" @change="handleLocaleChange">
        <el-radio value="ja">日本語</el-radio>
        <el-radio value="en">English</el-radio>
      </el-radio-group>
    </el-card>

    <el-card>
      <template #header>
        <span>{{ t('settings.about') }}</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Version">
          0.1.0
        </el-descriptions-item>
        <el-descriptions-item label="License">
          Apache 2.0
        </el-descriptions-item>
        <el-descriptions-item label="GitHub">
          <a href="https://github.com/YOUR_USERNAME/wiremock-jp" target="_blank">
            wiremock-jp
          </a>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { saveLocale } from '@/i18n'

const { t, locale } = useI18n()
const currentLocale = ref(locale.value)

function handleLocaleChange() {
  locale.value = currentLocale.value
  saveLocale(currentLocale.value)
}
</script>

<style scoped>
.settings {
  max-width: 800px;
}

.settings h2 {
  margin: 0 0 24px 0;
  font-size: 24px;
  font-weight: 600;
}
</style>
