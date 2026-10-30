import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, ArrowRight, CircleAlert, CircleCheck, Clock, FileText, RotateCw,
  Search, Stethoscope, TrendingDown, TrendingUp, Umbrella, Users, WifiOff,
} from 'lucide-react'
import { minutesToTime } from '@ponto/shared'
import { reportsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MonthSwitcher, MONTHS } from '@/components/ui/month-switcher'
import { UserAvatar } from '@/components/ui/avatar'

interface EmpStat {
  id: string; name: string; role: string
  workedDays: number; workedMinutes: number
  extraMinutes: number; missingMinutes: number
  absences: number; medicalDays: number; vacationDays: number
  monthBalance: number; accumulatedBalance: number
}

interface DashData { totalEmployees: number; employees: EmpStat[] }

type Status = 'ok' | 'warning' | 'danger'

function statusOf(e: EmpStat): Status {
  if (e.absences > 0 || e.monthBalance < -30) return 'danger'
  if (e.medicalDays > 0 || e.missingMinutes > 0) return 'warning'
  return 'ok'
}

const STATUS_META: Record<Status, { label: string; variant: 'destructive' | 'warning' | 'success'; bar: string }> = {
  danger: { label: 'Pendências', variant: 'destructive', bar: 'bg-destructive' },
  warning: { label: 'Atenção', variant: 'warning', bar: 'bg-warning' },
  ok: { label: 'Em dia', variant: 'success', bar: 'bg-success' },
}

function signedTime(minutes: number) {
  if (minutes === 0) return '00:00'
  return `${minutes > 0 ? '+' : '−'}${minutesToTime(Math.abs(minutes))}`
}

function balanceTone(minutes: number) {
  if (minutes > 0) return 'text-success-soft-foreground'
  if (minutes < 0) return 'text-destructive-soft-foreground'
  return 'text-muted-foreground'
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function EmployeeCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-xs">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2 bg-card p-3">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-4 h-8 w-full" />
    </div>
  )
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function Metric({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-card px-3.5 py-3', className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-[17px] font-semibold leading-none tabular-nums">{children}</div>
    </div>
  )
}

function EmployeeCard({ emp, month, year }: { emp: EmpStat; month: number; year: number }) {
  const status = statusOf(emp)
  const meta = STATUS_META[status]
  const totalFaltas = emp.absences + emp.medicalDays
  const hasEvents = totalFaltas > 0 || emp.vacationDays > 0 || emp.extraMinutes > 0

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-md">
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-[3px]', meta.bar)} />

      <div className="flex flex-1 flex-col gap-4 p-5">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar name={emp.name} className="size-10" />
            <div className="min-w-0">
              <h3 className="truncate text-[14px] font-semibold leading-tight text-foreground">{emp.name}</h3>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{emp.role || '—'}</p>
            </div>
          </div>
          <Badge variant={meta.variant} shape="pill" dot className="shrink-0">
            {meta.label}
          </Badge>
        </header>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
          <Metric label="Dias trabalhados">
            {emp.workedDays}
            <span className="ml-1 text-[11px] font-normal text-muted-foreground">dias</span>
          </Metric>
          <Metric label="Horas trabalhadas">
            {emp.workedMinutes > 0 ? minutesToTime(emp.workedMinutes) : <span className="text-muted-foreground">—</span>}
          </Metric>
          <Metric label="Saldo do mês">
            <span className={cn('inline-flex items-center gap-1', balanceTone(emp.monthBalance))}>
              {emp.monthBalance > 0 && <TrendingUp className="size-3.5" aria-hidden />}
              {emp.monthBalance < 0 && <TrendingDown className="size-3.5" aria-hidden />}
              {emp.monthBalance === 0 ? '—' : signedTime(emp.monthBalance)}
            </span>
          </Metric>
          <Metric label="Banco acumulado">
            <span className={balanceTone(emp.accumulatedBalance)}>
              {emp.accumulatedBalance === 0 ? '—' : signedTime(emp.accumulatedBalance)}
            </span>
          </Metric>
        </div>

        {!hasEvents ? (
          emp.workedDays > 0 ? (
            <p className="flex items-center gap-2 text-[13px] font-medium text-success-soft-foreground">
              <CircleCheck className="size-4 shrink-0" aria-hidden />
              Sem ocorrências neste mês
            </p>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nenhum lançamento registrado</p>
          )
        ) : (
          <div className="space-y-2.5">
            {totalFaltas > 0 && (
              <div
                className={cn(
                  'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5',
                  emp.absences > 0
                    ? 'border-destructive-soft-border bg-destructive-soft'
                    : 'border-warning-soft-border bg-warning-soft'
                )}
              >
                <span
                  className={cn(
                    'flex items-center gap-1.5 text-[13px] font-semibold',
                    emp.absences > 0 ? 'text-destructive-soft-foreground' : 'text-warning-soft-foreground'
                  )}
                >
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {plural(totalFaltas, 'falta')}
                </span>
                <span className="flex items-center gap-3 text-[12px] text-muted-foreground">
                  <span>
                    <strong className={cn('font-semibold', emp.absences > 0 && 'text-destructive-soft-foreground')}>
                      {emp.absences}
                    </strong>{' '}
                    sem justif.
                  </span>
                  <span className="flex items-center gap-1">
                    <Stethoscope className="size-3" aria-hidden />
                    <strong className={cn('font-semibold', emp.medicalDays > 0 && 'text-info-soft-foreground')}>
                      {emp.medicalDays}
                    </strong>{' '}
                    atestado
                  </span>
                </span>
              </div>
            )}
            {(emp.vacationDays > 0 || emp.extraMinutes > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {emp.vacationDays > 0 && (
                  <Badge variant="special" shape="pill">
                    <Umbrella />
                    {plural(emp.vacationDays, 'dia')} de férias
                  </Badge>
                )}
                {emp.extraMinutes > 0 && (
                  <Badge variant="success" shape="pill" className="tabular-nums">
                    <TrendingUp />+{minutesToTime(emp.extraMinutes)} extras
                  </Badge>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <Link
        to={`/timesheet?employee=${emp.id}`}
        className="flex items-center gap-2 border-t px-5 py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <Clock className="size-3.5" aria-hidden />
        Ver ponto de {MONTHS[month - 1]}/{year}
        <ArrowRight className="ml-auto size-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden />
      </Link>
    </article>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [search, setSearch] = useState('')

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const { data: resp, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', year, month],
    queryFn: () => reportsApi.dashboard(year, month),
  })

  const dash = resp?.data as DashData | undefined
  const all = useMemo(() => dash?.employees ?? [], [dash])

  const filtered = useMemo(() => {
    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter(e => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q))
  }, [all, search])

  const withPending = all.filter(e => statusOf(e) === 'danger').length
  const totalAbs = all.reduce((s, e) => s + e.absences, 0)
  const totalMed = all.reduce((s, e) => s + e.medicalDays, 0)

  // Sort: danger → warning → ok
  const sorted = useMemo(() => {
    const order = { danger: 0, warning: 1, ok: 2 }
    return [...filtered].sort((a, b) => order[statusOf(a)] - order[statusOf(b)])
  }, [filtered])

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Visão gerencial da equipe · ${MONTHS[month - 1]} de ${year}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/reports"><FileText />Relatórios PDF</Link>
            </Button>
            <Button asChild>
              <Link to="/timesheet"><Clock />Lançar ponto</Link>
            </Button>
          </>
        }
      />

      <section aria-label="Indicadores do mês" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard label="Funcionários ativos" value={dash?.totalEmployees ?? 0} icon={Users} tone="primary" loading={isLoading} />
        <StatCard
          label="Com pendências"
          value={withPending}
          icon={CircleAlert}
          tone={withPending > 0 ? 'destructive' : 'default'}
          emphasize={withPending > 0}
          loading={isLoading}
        />
        <StatCard
          label="Faltas no mês"
          value={totalAbs}
          icon={AlertTriangle}
          tone={totalAbs > 0 ? 'warning' : 'default'}
          emphasize={totalAbs > 0}
          loading={isLoading}
        />
        <StatCard
          label="Atestados"
          value={totalMed}
          icon={Stethoscope}
          tone={totalMed > 0 ? 'info' : 'default'}
          emphasize={totalMed > 0}
          loading={isLoading}
        />
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MonthSwitcher year={year} month={month} onPrev={prevMonth} onNext={nextMonth} disableNext={isCurrentMonth} />
        <div className="relative w-full sm:w-72">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            aria-label="Buscar funcionário"
            placeholder="Buscar por nome ou função..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {!isLoading && withPending > 0 && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>
            <strong>{withPending}</strong> funcionário{withPending > 1 ? 's' : ''} com faltas sem justificativa ou saldo
            negativo em {MONTHS[month - 1]}. Os cards marcados como <strong>Pendências</strong> aparecem primeiro.
          </AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => <EmployeeCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <div className="rounded-xl border bg-card shadow-xs">
          <EmptyState
            icon={WifiOff}
            tone="destructive"
            title="Não foi possível carregar o dashboard"
            description="Verifique sua conexão e tente novamente."
            action={
              <Button variant="outline" onClick={() => refetch()} loading={isFetching}>
                {!isFetching && <RotateCw />}Tentar novamente
              </Button>
            }
          />
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card">
          <EmptyState
            icon={search ? Search : Users}
            title={search ? 'Nenhum resultado' : 'Nenhum funcionário cadastrado'}
            description={search ? 'Tente buscar por outro nome ou função.' : 'Comece cadastrando o primeiro funcionário da oficina.'}
            action={
              !search && (
                <Button asChild>
                  <Link to="/employees/new">Cadastrar funcionário</Link>
                </Button>
              )
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map(emp => <EmployeeCard key={emp.id} emp={emp} month={month} year={year} />)}
        </div>
      )}
    </div>
  )
}
