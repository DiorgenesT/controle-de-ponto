import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import '@/store/theme'
import App from './App.tsx'
import { queryClient } from '@/lib/queryClient'
import { setUnauthorizedHandler } from '@/lib/api'
import { useAuthStore } from '@/store/auth'

// Expired/revoked session: drop credentials and cached data; RequireAuth then redirects to /login.
setUnauthorizedHandler(() => {
  if (useAuthStore.getState().isAuthenticated) useAuthStore.getState().logout()
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
)
