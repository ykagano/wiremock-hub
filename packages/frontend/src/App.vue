<template>
  <el-config-provider :locale="elementLocale">
    <el-container class="app-container">
      <!-- Header -->
      <el-header class="app-header">
        <div class="header-content">
          <div class="header-left">
            <h1>{{ t('app.title') }}</h1>
            <el-tag v-if="currentProject" type="success" size="small">
              {{ currentProject.name }}
            </el-tag>
          </div>
          <div class="header-right">
            <el-select
              v-model="currentLocale"
              size="small"
              style="width: 120px"
            >
              <el-option label="日本語" value="ja" />
              <el-option label="English" value="en" />
            </el-select>
          </div>
        </div>
      </el-header>

      <el-container>
        <!-- Sidebar -->
        <el-aside width="200px" class="app-aside">
          <el-menu
            :default-active="currentRoute"
            router
            class="app-menu"
          >
            <el-menu-item index="/projects">
              <el-icon><FolderOpened /></el-icon>
              <span>{{ t('nav.projectList') }}</span>
            </el-menu-item>
            <el-menu-item
              :index="currentProject ? `/projects/${currentProject.id}` : '/projects'"
              :disabled="!currentProject"
            >
              <el-icon><Folder /></el-icon>
              <span>{{ t('nav.projects') }}</span>
            </el-menu-item>
            <el-menu-item
              index="/mappings"
              :disabled="!currentProject"
            >
              <el-icon><Document /></el-icon>
              <span>{{ t('nav.mappings') }}</span>
            </el-menu-item>
            <el-menu-item
              index="/requests"
              :disabled="!currentProject"
            >
              <el-icon><List /></el-icon>
              <span>{{ t('nav.requests') }}</span>
            </el-menu-item>
            <el-menu-item index="/settings">
              <el-icon><Setting /></el-icon>
              <span>{{ t('nav.settings') }}</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <!-- Main content -->
        <el-main class="app-main">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </el-main>
      </el-container>
    </el-container>
  </el-config-provider>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '@/stores/project'
import { saveLocale } from '@/i18n'
import jaLocale from 'element-plus/es/locale/lang/ja'
import enLocale from 'element-plus/es/locale/lang/en'

const route = useRoute()
const { t, locale } = useI18n({ useScope: 'global' })
const projectStore = useProjectStore()
const { currentProject } = storeToRefs(projectStore)

const currentRoute = computed(() => route.path)

const currentLocale = computed({
  get: () => locale.value,
  set: (value: string) => {
    locale.value = value
    saveLocale(value)
  }
})

const elementLocale = computed(() => {
  return locale.value === 'ja' ? jaLocale : enLocale
})
</script>

<style>
:root {
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI',
    'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Meiryo', 'Yu Gothic UI',
    'Yu Gothic', sans-serif;
}

body,
#app,
.el-button,
.el-input__inner,
.el-select__wrapper,
.el-dialog,
.el-message,
.el-message-box,
.el-table,
.el-tabs,
.el-card,
.el-menu {
  font-family: var(--font-family-base) !important;
}
</style>

<style scoped>
.app-container {
  height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.app-aside {
  background-color: #f5f7fa;
  border-right: 1px solid #e4e7ed;
}

.app-menu {
  border: none;
  background-color: transparent;
}

.app-main {
  background-color: #ffffff;
  padding: 24px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
