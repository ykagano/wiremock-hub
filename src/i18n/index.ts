import { createI18n } from 'vue-i18n'
import ja from './locales/ja.json'
import en from './locales/en.json'

const LOCALE_KEY = 'wiremock-jp-locale'

export default createI18n({
  legacy: false,
  locale: localStorage.getItem(LOCALE_KEY) || 'ja',
  fallbackLocale: 'en',
  messages: { ja, en }
})

export function saveLocale(locale: string) {
  localStorage.setItem(LOCALE_KEY, locale)
}
