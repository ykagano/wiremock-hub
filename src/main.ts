import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import router from './router'
import i18n from './i18n'

const app = createApp(App)

// Pinia
app.use(createPinia())

// Vue Router
app.use(router)

// Element Plus
app.use(ElementPlus)

// Element Plus Icons
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

// i18n
app.use(i18n)

app.mount('#app')
