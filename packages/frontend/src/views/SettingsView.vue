<template>
  <div class="settings">
    <h2>{{ t('settings.title') }}</h2>

    <el-card style="margin-bottom: 20px">
      <template #header>
        <span>{{ t('settings.language') }}</span>
      </template>
      <el-radio-group v-model="currentLocale">
        <el-radio value="en">English</el-radio>
        <el-radio value="ja">日本語</el-radio>
      </el-radio-group>
    </el-card>

    <el-card style="margin-bottom: 20px">
      <template #header>
        <span>{{ t('settings.theme') }}</span>
      </template>
      <el-radio-group v-model="currentTheme">
        <el-radio value="light">{{ t('settings.themeLight') }}</el-radio>
        <el-radio value="dark">{{ t('settings.themeDark') }}</el-radio>
        <el-radio value="system">{{ t('settings.themeSystem') }}</el-radio>
      </el-radio-group>
    </el-card>

    <el-card>
      <template #header>
        <span>{{ t('settings.about') }}</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Version">
          {{ appVersion }}
        </el-descriptions-item>
        <el-descriptions-item label="License">
          Apache 2.0
        </el-descriptions-item>
        <el-descriptions-item label="GitHub">
          <a href="https://github.com/ykagano/wiremock-hub" target="_blank">
            wiremock-hub
          </a>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { saveLocale } from '@/i18n'
import { useTheme } from '@/composables/useTheme'

const { t, locale } = useI18n({ useScope: 'global' })
const { themeMode } = useTheme()

const appVersion = __APP_VERSION__

const currentLocale = computed({
  get: () => locale.value,
  set: (value: string) => {
    locale.value = value
    saveLocale(value)
  }
})

const currentTheme = computed({
  get: () => themeMode.value,
  set: (value: string) => {
    themeMode.value = value as 'light' | 'dark' | 'system'
  }
})
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
