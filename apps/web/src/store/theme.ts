import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

export function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && !!media?.matches)
  document.documentElement.classList.toggle('dark', dark)
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'ponto_theme',
      onRehydrateStorage: () => (state) => applyTheme(state?.theme ?? 'system'),
    }
  )
)

media?.addEventListener('change', () => {
  if (useThemeStore.getState().theme === 'system') applyTheme('system')
})
