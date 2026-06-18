<template>
  <div class="mcp">
    <h2>{{ t('mcp.title') }}</h2>
    <p class="mcp-intro">{{ t('mcp.intro') }}</p>

    <!-- Endpoint URL -->
    <el-card class="mcp-card">
      <template #header>
        <span>{{ t('mcp.endpointTitle') }}</span>
      </template>
      <p class="mcp-section-desc">{{ t('mcp.endpointDesc') }}</p>
      <div class="mcp-url-row">
        <code class="mcp-url">{{ mcpUrl }}</code>
        <el-button size="small" text @click="copy(mcpUrl, t('mcp.copied'))">
          <el-icon><CopyDocument /></el-icon>
        </el-button>
      </div>
      <el-descriptions :column="1" border class="mcp-access">
        <el-descriptions-item :label="t('mcp.accessDirect')">
          <code>http://&lt;host&gt;:3000/api/mcp</code>
        </el-descriptions-item>
        <el-descriptions-item :label="t('mcp.accessAllInOne')">
          <code>http://&lt;host&gt;:3000/hub/api/mcp</code>
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <!-- Example client configs -->
    <el-card class="mcp-card">
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

    <!-- No authentication note -->
    <el-alert
      :title="t('mcp.noAuthTitle')"
      :description="t('mcp.noAuthDesc')"
      type="warning"
      :closable="false"
      show-icon
      class="mcp-card"
    />

    <!-- Available tools -->
    <el-card class="mcp-card">
      <template #header>
        <span>{{ t('mcp.toolsTitle') }}</span>
      </template>
      <p class="mcp-section-desc">{{ t('mcp.toolsDesc') }}</p>
      <el-collapse>
        <el-collapse-item
          v-for="group in toolGroups"
          :key="group.key"
          :title="`${t(`mcp.groups.${group.key}`)} (${group.tools.length})`"
          :name="group.key"
        >
          <ul class="mcp-tool-list">
            <li v-for="tool in group.tools" :key="tool.name">
              <code class="mcp-tool-name">{{ tool.name }}</code>
              <el-tag v-if="tool.destructive" type="danger" size="small">
                {{ t('mcp.destructive') }}
              </el-tag>
            </li>
          </ul>
        </el-collapse-item>
      </el-collapse>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import { CopyDocument } from '@element-plus/icons-vue';
import { getMcpUrl } from '@/utils/mcpUrl';

const { t } = useI18n({ useScope: 'global' });

const mcpUrl = getMcpUrl();

const claudeCodeCommand = computed(() => `claude mcp add --transport http wiremock-hub ${mcpUrl}`);

const jsonConfig = computed(() =>
  JSON.stringify({ mcpServers: { 'wiremock-hub': { type: 'http', url: mcpUrl } } }, null, 2)
);

interface McpTool {
  name: string;
  destructive?: boolean;
}

interface McpToolGroup {
  key: string;
  tools: McpTool[];
}

// 33 tools grouped by category. `destructive` marks the four destructive tools.
const toolGroups: McpToolGroup[] = [
  {
    key: 'projects',
    tools: [
      { name: 'list_projects' },
      { name: 'get_project' },
      { name: 'create_project' },
      { name: 'update_project' },
      { name: 'duplicate_project' }
    ]
  },
  {
    key: 'stubs',
    tools: [
      { name: 'list_stubs' },
      { name: 'get_stub' },
      { name: 'create_stub' },
      { name: 'update_stub' },
      { name: 'delete_stub', destructive: true },
      { name: 'test_stub' }
    ]
  },
  {
    key: 'sync',
    tools: [
      { name: 'sync_all_stubs', destructive: true },
      { name: 'append_all_stubs' },
      { name: 'sync_stub' }
    ]
  },
  {
    key: 'importExport',
    tools: [{ name: 'export_stubs' }, { name: 'import_stubs' }, { name: 'import_openapi' }]
  },
  {
    key: 'instances',
    tools: [
      { name: 'list_instances' },
      { name: 'get_instance' },
      { name: 'create_instance' },
      { name: 'update_instance' }
    ]
  },
  {
    key: 'instanceOps',
    tools: [
      { name: 'get_instance_mappings' },
      { name: 'delete_instance_mapping', destructive: true },
      { name: 'get_instance_requests' },
      { name: 'get_instance_request' },
      { name: 'clear_instance_requests', destructive: true },
      { name: 'reset_scenarios' },
      { name: 'create_stub_from_request' }
    ]
  },
  {
    key: 'recording',
    tools: [
      { name: 'get_recording_status' },
      { name: 'start_recording' },
      { name: 'stop_recording' },
      { name: 'start_recording_all' },
      { name: 'stop_recording_all' }
    ]
  }
];

async function copy(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    ElMessage.success(successMessage);
  } catch {
    ElMessage.error(t('common.error'));
  }
}
</script>

<style scoped>
.mcp {
  max-width: 900px;
}

.mcp h2 {
  margin: 0 0 8px 0;
  font-size: 24px;
  font-weight: 600;
}

.mcp-intro {
  margin: 0 0 24px 0;
  color: var(--wh-text-secondary);
}

.mcp-card {
  margin-bottom: 20px;
}

.mcp-section-desc {
  margin: 0 0 16px 0;
  color: var(--wh-text-secondary);
}

.mcp-url-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.mcp-url {
  flex: 1;
  padding: 8px 12px;
  background-color: var(--wh-code-bg);
  border: 1px solid var(--wh-code-border);
  border-radius: 4px;
  font-size: 14px;
  word-break: break-all;
}

.mcp-access code {
  background-color: var(--wh-code-bg);
  padding: 2px 6px;
  border-radius: 4px;
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

.mcp-tool-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mcp-tool-list li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mcp-tool-name {
  background-color: var(--wh-code-bg);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
