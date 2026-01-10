import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'
// vite-plugin-monaco-editor の default export の扱いが異なる場合の対応
const monacoEditorPlugin = (monacoEditorPluginModule as any).default || monacoEditorPluginModule

// Use VITE_APP_VERSION env var (from CI/CD tag) or default
const appVersion = process.env.VITE_APP_VERSION || '0.1.0'

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  plugins: [
    vue(),
    vueDevTools(),
    monacoEditorPlugin({})
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    proxy: {
      // Backend API proxy for development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      // WireMock Admin APIへのプロキシ（CORS回避）
      '/__admin': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
