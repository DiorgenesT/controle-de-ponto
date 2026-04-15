import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { Toaster } from '@/components/ui/toaster'
import {
  Clock, Users, LayoutDashboard, FileText, Settings, LogOut, Menu, X,
} from 'lucide-react'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/employees',  icon: Users,           label: 'Funcionários' },
  { href: '/timesheet',  icon: Clock,            label: 'Lançar Ponto' },
  { href: '/reports',    icon: FileText,         label: 'Relatórios / PDF' },
  { href: '/settings',   icon: Settings,         label: 'Configurações' },
]

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administrador',
  manager: 'Gerente',
  viewer:  'Visualizador',
}

export function AppLayout() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuthStore()
  const [open, setOpen] = useState(false)

  const initials = user?.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() ?? '?'
  const firstLetter = (user?.name?.[0] ?? 'a').toLowerCase()

  function handleLogout() { logout(); navigate('/login') }

  const Nav = () => (
    <div className="flex h-full flex-col" style={{
      background: 'linear-gradient(180deg, #1a1f3a 0%, #111628 100%)',
    }}>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)' }}>
            <Clock className="h-4.5 w-4.5 text-white" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-[13px] font-bold text-white tracking-tight">Controle de Ponto</p>
            <p className="text-[11px] text-white/40 mt-px">Alexandre Motos</p>
          </div>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pb-2">
        <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Menu</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-0.5">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = location.pathname.startsWith(href)
          return (
            <Link
              key={href}
              to={href}
              onClick={() => setOpen(false)}
              className={cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150',
                active
                  ? 'bg-white/10 text-white shadow-sm'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/6'
              )}
              style={active ? { boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)' } : {}}
            >
              <Icon className={cn('h-[15px] w-[15px] shrink-0 transition-colors', active ? 'text-white' : 'text-white/40 group-hover:text-white/60')} />
              {label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/60" />}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-5 my-3 h-px bg-white/8" />

      {/* User */}
      <div className="px-3 pb-4">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-xs font-bold', `avatar-${firstLetter}`)}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-white/35 truncate">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            className="text-white/25 hover:text-white/70 transition-colors p-1 rounded-lg hover:bg-white/8"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex h-full">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[220px] flex-col shrink-0">
        <Nav />
      </aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="relative w-[220px] h-full z-50"><Nav /></aside>
        </div>
      )}

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile Header */}
        <header className="flex items-center gap-3 border-b bg-card/80 backdrop-blur-sm px-4 py-3 lg:hidden shadow-sm">
          <button
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)' }}>
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-sm tracking-tight">Controle de Ponto</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-7">
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
