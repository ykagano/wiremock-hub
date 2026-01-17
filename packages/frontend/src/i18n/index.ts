import { createI18n } from 'vue-i18n'
import ja from './locales/ja.json'
import en from './locales/en.json'

const LOCALE_KEY = 'wiremock-hub-locale'

const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem(LOCALE_KEY) || 'en',
  fallbackLocale: 'en',
  messages: { ja, en }
})

export default i18n

// Export t function for use in non-component contexts (e.g., Pinia stores)
export function t(key: string, params?: Record<string, unknown>): string {
  return i18n.global.t(key, params as any) as string
}

export function saveLocale(locale: 'en' | 'ja') {
  localStorage.setItem(LOCALE_KEY, locale)
  i18n.global.locale.value = locale
}
