import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronRight, ChevronsUpDown, Clock, FileText, LayoutDashboard, LogOut, Menu,
  PanelLeftClose, PanelLeftOpen, Settings, Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useUiStore } from '@/store/ui'
import { Toaster } from '@/components/ui/toaster'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { SimpleTooltip, TooltipProvider } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BrandMark } from '@/components/layout/BrandMark'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

const NAV_GROUPS = [
  {
    label: 'Operação',
    items: [
      { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { href: '/timesheet', icon: Clock, label: 'Lançar Ponto' },
      { href: '/reports', icon: FileText, label: 'Relatórios / PDF' },
    ],
  },
  {
    label: 'Cadastros',
    items: [{ href: '/employees', icon: Users, label: 'Funcionários' }],
  },
  {
    label: 'Sistema',
    items: [{ href: '/settings', icon: Settings, label: 'Configurações' }],
  },
]

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  viewer: 'Visualizador',
}

const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  employees: 'Funcionários',
  timesheet: 'Lançar Ponto',
  reports: 'Relatórios',
  settings: 'Configurações',
}

function useBreadcrumb(pathname: string) {
  const [section, second, third] = pathname.split('/').filter(Boolean)
  const crumbs: { label: string; href?: string }[] = []
  if (!section) return crumbs
  crumbs.push({ label: SECTION_LABELS[section] ?? section, href: `/${section}` })
  if (section === 'employees' && second === 'new') crumbs.push({ label: 'Novo' })
  else if (section === 'employees' && third === 'edit') crumbs.push({ label: 'Editar' })
  return crumbs
}

// ─── Sidebar ────────────────────────────────────────────────────────────────

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navegação principal" className="flex-1 space-y-4 overflow-y-auto px-3 py-3 scrollbar-thin">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-px">
          {collapsed ? (
            <div className="mx-2 mb-2 h-px bg-sidebar-border" />
          ) : (
            <p className="px-2.5 pb-1 text-xs font-medium text-sidebar-muted">
              {group.label}
            </p>
          )}
          {group.items.map(({ href, icon: Icon, label }) => (
            <SimpleTooltip key={href} label={label} side="right" disabled={!collapsed}>
              <NavLink
                to={href}
                onClick={onNavigate}
                aria-label={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'size-4 shrink-0 transition-colors',
                        isActive ? 'text-sidebar-accent-foreground' : 'text-sidebar-muted group-hover:text-sidebar-accent-foreground'
                      )}
                    />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </>
                )}
              </NavLink>
            </SimpleTooltip>
          ))}
        </div>
      ))}
    </nav>
  )
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      to="/dashboard"
      className={cn(
        'flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-primary',
        collapsed && 'justify-center px-0'
      )}
    >
      <BrandMark />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-semibold text-sidebar-accent-foreground">Alexandre Motos</p>
          <p className="truncate text-xs text-sidebar-muted">Controle de ponto</p>
        </div>
      )}
    </Link>
  )
}

// ─── Layout ─────────────────────────────────────────────────────────────────

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { sidebarCollapsed: collapsed, toggleSidebar } = useUiStore()
  const [mobileOpen, setMobileOpen] = useState(false)
  const crumbs = useBreadcrumb(location.pathname)

  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-full bg-background">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            'hidden shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out lg:flex',
            collapsed ? 'w-[60px]' : 'w-56'
          )}
        >
          <SidebarBrand collapsed={collapsed} />
          <SidebarNav collapsed={collapsed} />
          <div className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}>
            <SimpleTooltip label={collapsed ? 'Expandir menu' : 'Recolher menu'} side="right">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary',
                  collapsed ? 'w-8 justify-center px-0' : 'w-full'
                )}
              >
                {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                {!collapsed && 'Recolher menu'}
              </button>
            </SimpleTooltip>
          </div>
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent className="bg-sidebar lg:hidden">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <SheetDescription className="sr-only">Navegação do sistema</SheetDescription>
            <SidebarBrand collapsed={false} />
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t border-sidebar-border p-3">
              <div className="flex items-center gap-3 rounded-lg px-2 py-2">
                <UserAvatar name={user?.name ?? '?'} className="size-8" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-sidebar-accent-foreground">{user?.name}</p>
                  <p className="truncate text-[12px] text-sidebar-muted">{roleLabel}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Sair"
                  className="cursor-pointer rounded-md p-2 text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3 sm:px-5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </Button>
            <Link to="/dashboard" className="mr-1 lg:hidden" aria-label="Início">
              <BrandMark className="size-7 text-xs" />
            </Link>

            <nav aria-label="Trilha" className="min-w-0 flex-1">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                <li className="hidden text-muted-foreground sm:block">Alexandre Motos</li>
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1
                  return (
                    <li key={c.label} className="flex min-w-0 items-center gap-1.5">
                      <ChevronRight
                        aria-hidden
                        className={cn('size-3.5 shrink-0 text-muted-foreground/60', i === 0 && 'hidden sm:block')}
                      />
                      {last || !c.href ? (
                        <span aria-current="page" className="truncate font-medium text-foreground">
                          {c.label}
                        </span>
                      ) : (
                        <Link to={c.href} className="truncate text-muted-foreground transition-colors hover:text-foreground">
                          {c.label}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ol>
            </nav>

            <ThemeToggle />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-md py-1 pl-1 pr-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-2"
                  aria-label="Menu do usuário"
                >
                  <UserAvatar name={user?.name ?? '?'} className="size-7" />
                  <span className="hidden max-w-[10rem] text-left leading-tight sm:block">
                    <span className="block truncate text-[13px] font-medium text-foreground">{user?.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{roleLabel}</span>
                  </span>
                  <ChevronsUpDown className="hidden size-3.5 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
                  <UserAvatar name={user?.name ?? '?'} className="size-9" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate('/settings')}>
                  <Settings />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  <LogOut />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
              <Outlet />
            </div>
          </main>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
