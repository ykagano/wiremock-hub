import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import monacoEditorPluginModule from 'vite-plugin-monaco-editor'

// vite-plugin-monaco-editor の default export の扱いが異なる場合の対応
const monacoEditorPlugin = (monacoEditorPluginModule as any).default || monacoEditorPluginModule

export default defineConfig({
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
      // WireMock Admin APIへのプロキシ（CORS回避）
      '/__admin': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
