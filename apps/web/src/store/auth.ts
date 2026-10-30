import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { setToken, clearToken } from '@/lib/api'
import { queryClient } from '@/lib/queryClient'

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
        queryClient.clear()
        set({ user, isAuthenticated: true })
      },
      logout: () => {
        clearToken()
        queryClient.clear()
        set({ user: null, isAuthenticated: false })
      },
    }),
    {
      name: 'ponto_user',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)
