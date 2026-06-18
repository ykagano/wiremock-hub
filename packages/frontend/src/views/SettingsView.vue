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

    <el-card style="margin-bottom: 20px">
      <template #header>
        <span>{{ t('mcp.configTitle') }}</span>
      </template>

      <div class="mcp-config-block">
        <div class="mcp-config-label">{{ t('mcp.configClaudeCode') }}</div>
        <div class="mcp-code-row">
          <pre class="mcp-code"><code>{{ claudeCodeCommand }}</code></pre>
          <el-button size="small" text @click="copy(claudeCodeCommand, t('mcp.copied'))">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </div>
      </div>

      <div class="mcp-config-block">
        <div class="mcp-config-label">{{ t('mcp.configClaudeDesktop') }}</div>
        <div class="mcp-code-row">
          <pre class="mcp-code"><code>{{ jsonConfig }}</code></pre>
          <el-button size="small" text @click="copy(jsonConfig, t('mcp.copied'))">
            <el-icon><CopyDocument /></el-icon>
          </el-button>
        </div>
      </div>
    </el-card>

    <el-card>
      <template #header>
        <span>{{ t('settings.about') }}</span>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="Version">
          {{ appVersion }}
        </el-descriptions-item>
        <el-descriptions-item label="License"> Apache 2.0 </el-descriptions-item>
        <el-descriptions-item label="GitHub">
          <a href="https://github.com/ykagano/wiremock-hub" target="_blank"> wiremock-hub </a>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { CopyDocument } from '@element-plus/icons-vue';
import { saveLocale } from '@/i18n';
import { useTheme, type ThemeMode } from '@/composables/useTheme';
import { getMcpUrl } from '@/utils/mcpUrl';

const { t, locale } = useI18n({ useScope: 'global' });
const { themeMode } = useTheme();

const appVersion = __APP_VERSION__;

// MCP client configuration examples (uses the live endpoint for this deployment)
const mcpUrl = getMcpUrl();

const claudeCodeCommand = computed(() => `claude mcp add --transport http wiremock-hub ${mcpUrl}`);

const jsonConfig = computed(() =>
  JSON.stringify({ mcpServers: { 'wiremock-hub': { type: 'http', url: mcpUrl } } }, null, 2)
);

async function copy(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(successMessage);
  } catch {
    ElMessage.error(t('common.error'));
  }
}

const currentLocale = computed({
  get: () => locale.value,
  set: (value: string) => {
    locale.value = value;
    saveLocale(value);
  }
});

const currentTheme = computed({
  get: () => themeMode.value,
  set: (value: string) => {
    themeMode.value = value as ThemeMode;
  }
});
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

.mcp-config-block {
  margin-bottom: 20px;
}

.mcp-config-block:last-child {
  margin-bottom: 0;
}

.mcp-config-label {
  margin-bottom: 8px;
  font-weight: 600;
}

.mcp-code-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.mcp-code {
  flex: 1;
  margin: 0;
  padding: 12px;
  background-color: var(--wh-code-block-bg);
  border: 1px solid var(--wh-code-border);
  border-radius: 4px;
  font-size: 13px;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: auto;
}
</style>
