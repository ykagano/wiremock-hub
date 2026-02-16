import { ref, computed, watchEffect } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'

const THEME_KEY = 'wiremock-hub-theme'

function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'system'
}

// Shared reactive state (module-level singleton)
const themeMode = ref<ThemeMode>(getStoredTheme())
const systemPrefersDark = ref(
  window.matchMedia('(prefers-color-scheme: dark)').matches
)

// Listen for OS theme changes
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
mediaQuery.addEventListener('change', (e) => {
  systemPrefersDark.value = e.matches
})

const isDark = computed(() => {
  if (themeMode.value === 'system') {
    return systemPrefersDark.value
  }
  return themeMode.value === 'dark'
})

// Apply dark class to <html> reactively
watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
})

export function useTheme() {
  function setTheme(mode: ThemeMode) {
    themeMode.value = mode
    localStorage.setItem(THEME_KEY, mode)
  }

  const themeModeComputed = computed<ThemeMode>({
    get: () => themeMode.value,
    set: (val: ThemeMode) => setTheme(val),
  })

  return {
    isDark,
    themeMode: themeModeComputed,
  }
}
