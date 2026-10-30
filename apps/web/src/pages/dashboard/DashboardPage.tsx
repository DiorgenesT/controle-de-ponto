import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronRight, Clock, FileText, RotateCw, Search, Users, WifiOff } from 'lucide-react'
import { minutesToTime } from '@ponto/shared'
import { reportsApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard, StatGroup } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { MonthSwitcher, MONTHS } from '@/components/ui/month-switcher'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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

const STATUS_META: Record<Status, { label: string; dot: string }> = {
  danger: { label: 'Pendência', dot: 'bg-destructive' },
  warning: { label: 'Atenção', dot: 'bg-warning' },
  ok: { label: 'Em dia', dot: 'bg-border' },
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

const Dash = () => <span className="text-muted-foreground/60">—</span>

function Count({ n, danger }: { n: number; danger?: boolean }) {
  if (n === 0) return <Dash />
  return <span className={cn(danger && 'font-medium text-destructive-soft-foreground')}>{n}</span>
}

function StatusLabel({ status }: { status: Status }) {
  const meta = STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-muted-foreground">
      <span aria-hidden className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

// ─── Team table (desktop) ─────────────────────────────────────────────────────

const num = 'text-right tabular-nums'

function TeamTable({ rows, loading }: { rows: EmpStat[]; loading: boolean }) {
  return (
    <Table className="min-w-[880px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Funcionário</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead className="text-right">Dias</TableHead>
          <TableHead className="text-right">Horas trab.</TableHead>
          <TableHead className="text-right">Extras</TableHead>
          <TableHead className="text-right">Faltas</TableHead>
          <TableHead className="text-right">Atestados</TableHead>
          <TableHead className="text-right">Férias</TableHead>
          <TableHead className="text-right">Saldo do mês</TableHead>
          <TableHead className="text-right">Acumulado</TableHead>
          <TableHead className="w-10"><span className="sr-only">Abrir</span></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? [...Array(6)].map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={11}><Skeleton className="h-5 w-full" /></TableCell>
              </TableRow>
            ))
          : rows.map((emp) => (
              <TableRow key={emp.id} className="group">
                <TableCell className="max-w-[16rem]">
                  <Link
                    to={`/timesheet?employee=${emp.id}`}
                    className="block truncate font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {emp.name}
                  </Link>
                  <p className="truncate text-xs text-muted-foreground">{emp.role || '—'}</p>
                </TableCell>
                <TableCell><StatusLabel status={statusOf(emp)} /></TableCell>
                <TableCell className={num}>{emp.workedDays || <Dash />}</TableCell>
                <TableCell className={num}>{emp.workedMinutes > 0 ? minutesToTime(emp.workedMinutes) : <Dash />}</TableCell>
                <TableCell className={num}>{emp.extraMinutes > 0 ? `+${minutesToTime(emp.extraMinutes)}` : <Dash />}</TableCell>
                <TableCell className={num}><Count n={emp.absences} danger /></TableCell>
                <TableCell className={num}><Count n={emp.medicalDays} /></TableCell>
                <TableCell className={num}><Count n={emp.vacationDays} /></TableCell>
                <TableCell className={cn(num, 'font-medium', balanceTone(emp.monthBalance))}>
                  {emp.monthBalance === 0 ? '00:00' : signedTime(emp.monthBalance)}
                </TableCell>
                <TableCell className={cn(num, 'font-medium', balanceTone(emp.accumulatedBalance))}>
                  {emp.accumulatedBalance === 0 ? '00:00' : signedTime(emp.accumulatedBalance)}
                </TableCell>
                <TableCell className="text-right">
                  <Link
                    to={`/timesheet?employee=${emp.id}`}
                    aria-label={`Ver ponto de ${emp.name}`}
                    className="inline-flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}

// ─── Team list (mobile) ───────────────────────────────────────────────────────

function TeamList({ rows, loading }: { rows: EmpStat[]; loading: boolean }) {
  if (loading) {
    return (
      <ul className="divide-y">
        {[...Array(6)].map((_, i) => (
          <li key={i} className="space-y-2 px-4 py-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="divide-y">
      {rows.map((emp) => {
        const details = [
          `${emp.workedDays} dias`,
          emp.absences > 0 && `${emp.absences} falta${emp.absences === 1 ? '' : 's'}`,
          emp.medicalDays > 0 && `${emp.medicalDays} atestado${emp.medicalDays === 1 ? '' : 's'}`,
          emp.vacationDays > 0 && `${emp.vacationDays} dia${emp.vacationDays === 1 ? '' : 's'} de férias`,
        ].filter(Boolean)
        return (
          <li key={emp.id}>
            <Link
              to={`/timesheet?employee=${emp.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                  <span className="truncate">{emp.name}</span>
                  {statusOf(emp) !== 'ok' && (
                    <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', STATUS_META[statusOf(emp)].dot)} />
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">{details.join(' · ')}</p>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                <p className={cn('text-sm font-medium', balanceTone(emp.monthBalance))}>{signedTime(emp.monthBalance)}</p>
                <p className="text-xs text-muted-foreground">
                  acum. <span className={balanceTone(emp.accumulatedBalance)}>{signedTime(emp.accumulatedBalance)}</span>
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        )
      })}
    </ul>
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
        description={`Equipe em ${MONTHS[month - 1]} de ${year}`}
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

      <StatGroup aria-label="Indicadores do mês" className="grid-cols-2 lg:grid-cols-4">
        <StatCard label="Funcionários ativos" value={dash?.totalEmployees ?? 0} loading={isLoading} />
        <StatCard
          label="Com pendências"
          value={withPending}
          tone={withPending > 0 ? 'destructive' : 'default'}
          hint="Falta sem justificativa ou saldo negativo"
          loading={isLoading}
        />
        <StatCard label="Faltas no mês" value={totalAbs} tone={totalAbs > 0 ? 'destructive' : 'default'} loading={isLoading} />
        <StatCard label="Atestados" value={totalMed} loading={isLoading} />
      </StatGroup>

      <section aria-label="Equipe" className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <MonthSwitcher year={year} month={month} onPrev={prevMonth} onNext={nextMonth} disableNext={isCurrentMonth} className="self-start" />
          <div className="relative w-full sm:w-64">
            <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Buscar funcionário"
              placeholder="Buscar por nome ou função"
              className="pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isError ? (
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
        ) : !isLoading && sorted.length === 0 ? (
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
        ) : (
          <>
            <div className="hidden md:block">
              <TeamTable rows={sorted} loading={isLoading} />
            </div>
            <div className="md:hidden">
              <TeamList rows={sorted} loading={isLoading} />
            </div>
          </>
        )}
      </section>

      {!isLoading && withPending > 0 && (
        <p className="text-xs text-muted-foreground">
          Funcionários com pendência em {MONTHS[month - 1]} aparecem primeiro. Clique no nome para abrir o ponto do mês.
        </p>
      )}
    </div>
  )
}
