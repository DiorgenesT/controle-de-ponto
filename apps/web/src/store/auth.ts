import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setToken, clearToken } from '@/lib/api'

interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  companyId: string
}

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  login: (user: AuthUser, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user, token) => {
        setToken(token)
        set({ user, isAuthenticated: true })
      },
      logout: () => {
        clearToken()
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'ponto_user',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
