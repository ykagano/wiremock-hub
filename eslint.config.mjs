import pluginVue from 'eslint-plugin-vue';
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfigWithVueTs(
  {
    ignores: [
      '**/node_modules',
      '**/dist',
      '**/dist-ssr',
      '**/coverage',
      'packages/backend/src/generated',
      'data',
      'e2e/test-results',
      'e2e/playwright-report',
      'pnpm-lock.yaml'
    ]
  },
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-empty-object-type': 'off'
    }
  },
  eslintConfigPrettier
);
