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
import { Badge } from '@/components/ui/badge'
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
    <nav aria-label="Navegação principal" className="flex-1 space-y-5 overflow-y-auto px-3 py-2 scrollbar-thin">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          {collapsed ? (
            <div className="mx-2 mb-2 h-px bg-sidebar-border" />
          ) : (
            <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted/80">
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
                    'group relative flex h-9 items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary',
                    collapsed && 'justify-center px-0',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-muted hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                    )}
                    <Icon
                      className={cn(
                        'size-[17px] shrink-0 transition-colors',
                        isActive ? 'text-sidebar-primary' : 'text-sidebar-muted group-hover:text-sidebar-accent-foreground'
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
        'flex h-16 shrink-0 items-center gap-3 px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-primary',
        collapsed && 'justify-center px-0'
      )}
    >
      <BrandMark />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[14px] font-semibold tracking-tight text-sidebar-accent-foreground">Controle de Ponto</p>
          <p className="truncate text-[12px] text-sidebar-muted">Alexandre Motos</p>
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
            collapsed ? 'w-[68px]' : 'w-64'
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
                  'flex h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary',
                  collapsed ? 'w-9 justify-center px-0' : 'w-full'
                )}
              >
                {collapsed ? <PanelLeftOpen className="size-[17px]" /> : <PanelLeftClose className="size-[17px]" />}
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
          <header className="z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-5">
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
              <BrandMark className="size-7 [&_svg]:size-4" />
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
                  className="flex cursor-pointer items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:pr-2"
                  aria-label="Menu do usuário"
                >
                  <UserAvatar name={user?.name ?? '?'} className="size-8" />
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
                  </div>
                </DropdownMenuLabel>
                <div className="px-2 pb-2">
                  <Badge variant="primary" shape="pill">{roleLabel}</Badge>
                </div>
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
            <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  )
}
