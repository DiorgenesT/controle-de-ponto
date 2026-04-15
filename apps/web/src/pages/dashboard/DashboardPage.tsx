import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Users, Clock, TrendingUp, TrendingDown, FileText,
  AlertTriangle, ChevronLeft, ChevronRight, CalendarCheck,
  Stethoscope, Umbrella, Search, CircleCheck, CircleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { minutesToTime } from '@ponto/shared'
import { cn } from '@/lib/utils'

const MONTH_NAMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface EmpStat {
  id: string; name: string; role: string
  workedDays: number; workedMinutes: number
  extraMinutes: number; missingMinutes: number
  absences: number; medicalDays: number; vacationDays: number
  monthBalance: number; accumulatedBalance: number
}

interface DashData { totalEmployees: number; employees: EmpStat[] }

function avatarClass(name: string) {
  return `avatar-${(name[0] ?? 'a').toLowerCase()}`
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function statusOf(e: EmpStat): 'ok' | 'warning' | 'danger' {
  if (e.absences > 0 || e.monthBalance < -30) return 'danger'
  if (e.medicalDays > 0 || e.missingMinutes > 0) return 'warning'
  return 'ok'
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KPI({ label, value, icon: Icon, gradient, textColor }: {
  label: string; value: string | number
  icon: React.ElementType; gradient: string; textColor: string
}) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-kpi flex items-center gap-4">
      <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', gradient)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</p>
        <p className={cn('text-2xl font-bold mt-0.5 leading-none', textColor)}>{value}</p>
      </div>
    </div>
  )
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-card rounded-2xl shadow-card overflow-hidden animate-pulse">
      <div className="h-1 w-full bg-muted" />
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-muted" />
          <div className="space-y-2 flex-1">
            <div className="h-3.5 bg-muted rounded w-3/4" />
            <div className="h-2.5 bg-muted rounded w-1/2" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl" />)}
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-20 bg-muted rounded-full" />
          <div className="h-6 w-24 bg-muted rounded-full" />
        </div>
      </div>
    </div>
  )
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({ emp, month, year }: { emp: EmpStat; month: number; year: number }) {
  const status  = statusOf(emp)
  const balance = emp.monthBalance
  const accum   = emp.accumulatedBalance

  const accentColor = status === 'danger'
    ? 'from-red-500 to-rose-600'
    : status === 'warning'
    ? 'from-amber-400 to-orange-500'
    : 'from-emerald-400 to-teal-500'

  const statusLabel = status === 'danger' ? 'Pendências' : status === 'warning' ? 'Atenção' : 'Em dia'
  const statusDot   = status === 'danger' ? 'bg-red-500' : status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className={cn(
      'bg-card rounded-2xl shadow-card flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover group',
    )}>
      {/* Accent bar */}
      <div className={cn('h-[3px] w-full bg-gradient-to-r', accentColor)} />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header: avatar + name + status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white text-base font-bold shadow-sm',
              avatarClass(emp.name)
            )}>
              {initials(emp.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[14px] leading-tight truncate text-foreground">{emp.name}</p>
              <p className="text-[12px] text-muted-foreground truncate mt-0.5">{emp.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5 bg-muted/60 rounded-full px-2.5 py-1">
            <span className={cn('h-1.5 w-1.5 rounded-full', statusDot)} />
            <span className="text-[11px] font-medium text-muted-foreground">{statusLabel}</span>
          </div>
        </div>

        {/* Row 1: horas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/40 rounded-xl px-3.5 py-3 border border-border/40">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dias Trabalhados</p>
            <p className="text-xl font-bold mt-1 text-foreground leading-none">
              {emp.workedDays}
              <span className="text-[11px] font-normal text-muted-foreground ml-1">dias</span>
            </p>
          </div>
          <div className="bg-muted/40 rounded-xl px-3.5 py-3 border border-border/40">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Horas Trabalhadas</p>
            <p className="text-xl font-bold mt-1 text-foreground leading-none font-mono">
              {emp.workedMinutes > 0 ? minutesToTime(emp.workedMinutes) : <span className="text-muted-foreground text-sm">—</span>}
            </p>
          </div>
          <div className={cn('rounded-xl px-3.5 py-3 border',
            balance > 0 ? 'bg-emerald-50 border-emerald-100' : balance < 0 ? 'bg-red-50 border-red-100' : 'bg-muted/40 border-border/40'
          )}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo do Mês</p>
            <p className={cn('text-xl font-bold mt-1 leading-none font-mono flex items-center gap-1',
              balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-red-700' : 'text-muted-foreground'
            )}>
              {balance !== 0 && (balance > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />)}
              {balance === 0 ? '—' : `${balance > 0 ? '+' : '-'}${minutesToTime(Math.abs(balance))}`}
            </p>
          </div>
          <div className={cn('rounded-xl px-3.5 py-3 border',
            accum > 0 ? 'bg-emerald-50 border-emerald-100' : accum < 0 ? 'bg-red-50 border-red-100' : 'bg-muted/40 border-border/40'
          )}>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Saldo Acumulado</p>
            <p className={cn('text-xl font-bold mt-1 leading-none font-mono',
              accum > 0 ? 'text-emerald-700' : accum < 0 ? 'text-red-700' : 'text-muted-foreground'
            )}>
              {accum === 0 ? '—' : `${accum > 0 ? '+' : '-'}${minutesToTime(Math.abs(accum))}`}
            </p>
          </div>
        </div>

        {/* Row 2: faltas detalhadas */}
        {(() => {
          const totalFaltas = emp.absences + emp.medicalDays
          const hasAny = totalFaltas > 0 || emp.vacationDays > 0 || emp.extraMinutes > 0

          if (!hasAny && emp.workedDays > 0) return (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3.5 py-3">
              <CircleCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="text-[12px] font-semibold text-emerald-700">Sem ocorrências neste mês</span>
            </div>
          )

          if (!hasAny && emp.workedDays === 0) return (
            <div className="flex items-center gap-2 bg-muted/40 border border-border/40 rounded-xl px-3.5 py-3">
              <span className="text-[12px] text-muted-foreground italic">Nenhum lançamento registrado</span>
            </div>
          )

          return (
            <div className="space-y-2">
              {/* Faltas — bloco principal quando existir */}
              {totalFaltas > 0 && (
                <div className={cn(
                  'rounded-xl border px-3.5 py-3',
                  emp.absences > 0 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Total de Faltas
                    </p>
                    <span className={cn(
                      'text-[13px] font-bold',
                      emp.absences > 0 ? 'text-red-700' : 'text-amber-700'
                    )}>
                      {totalFaltas} dia{totalFaltas > 1 ? 's' : ''}
                    </span>
                  </div>
                  {/* Breakdown */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground">Sem justificativa</p>
                      <p className={cn('text-[15px] font-bold leading-tight', emp.absences > 0 ? 'text-red-700' : 'text-muted-foreground')}>
                        {emp.absences}
                        <span className="text-[10px] font-normal ml-0.5">dia{emp.absences !== 1 ? 's' : ''}</span>
                      </p>
                    </div>
                    <div className="w-px bg-border/60 self-stretch" />
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Stethoscope className="h-2.5 w-2.5" /> Com atestado
                      </p>
                      <p className={cn('text-[15px] font-bold leading-tight', emp.medicalDays > 0 ? 'text-sky-700' : 'text-muted-foreground')}>
                        {emp.medicalDays}
                        <span className="text-[10px] font-normal ml-0.5">dia{emp.medicalDays !== 1 ? 's' : ''}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Outros eventos */}
              <div className="flex flex-wrap gap-1.5">
                {emp.vacationDays > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 text-[11px] font-semibold px-2.5 py-1 border border-violet-200">
                    <Umbrella className="h-3 w-3" />{emp.vacationDays} dia{emp.vacationDays > 1 ? 's' : ''} de férias
                  </span>
                )}
                {emp.extraMinutes > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2.5 py-1 border border-emerald-200">
                    <TrendingUp className="h-3 w-3" />+{minutesToTime(emp.extraMinutes)} extras
                  </span>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* Footer action */}
      <div className="border-t bg-muted/20 px-5 py-3">
        <Link
          to={`/timesheet?employee=${emp.id}`}
          className="flex items-center gap-2 text-[12px] font-medium text-muted-foreground hover:text-primary transition-colors group/link"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          Ponto de {MONTH_NAMES[month]}/{year}
          <span className="ml-auto opacity-0 group-hover/link:opacity-100 transition-opacity text-primary">→</span>
        </Link>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const today = new Date()
  const [year,   setYear]   = useState(today.getFullYear())
  const [month,  setMonth]  = useState(today.getMonth() + 1)
  const [search, setSearch] = useState('')

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1)
  }

  const { data: resp, isLoading } = useQuery({
    queryKey: ['dashboard', year, month],
    queryFn: () => reportsApi.dashboard(year, month),
  })

  const dash = resp?.data as DashData | undefined
  const all  = dash?.employees ?? []

  const filtered = useMemo(() => {
    if (!search.trim()) return all
    const q = search.toLowerCase()
    return all.filter(e => e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q))
  }, [all, search])

  const withPending = all.filter(e => statusOf(e) === 'danger').length
  const totalAbs    = all.reduce((s, e) => s + e.absences, 0)
  const totalMed    = all.reduce((s, e) => s + e.medicalDays, 0)

  // Sort: danger → warning → ok
  const sorted = useMemo(() => {
    const order = { danger: 0, warning: 1, ok: 2 }
    return [...filtered].sort((a, b) => order[statusOf(a)] - order[statusOf(b)])
  }, [filtered])

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Visão gerencial · {MONTH_NAMES[month]} {year}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-xl h-9 text-[13px]">
            <Link to="/reports"><FileText className="h-3.5 w-3.5 mr-1.5" />Relatórios PDF</Link>
          </Button>
          <Button asChild size="sm" className="rounded-xl h-9 text-[13px]">
            <Link to="/timesheet"><Clock className="h-3.5 w-3.5 mr-1.5" />Lançar Ponto</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Funcionários" value={isLoading ? '—' : (dash?.totalEmployees ?? 0)}
          icon={Users} gradient="bg-gradient-to-br from-indigo-500 to-blue-600" textColor="text-foreground" />
        <KPI label="Com pendências" value={isLoading ? '—' : withPending}
          icon={CircleAlert} gradient="bg-gradient-to-br from-red-500 to-rose-600" textColor={withPending > 0 ? 'text-red-600' : 'text-foreground'} />
        <KPI label="Faltas no mês" value={isLoading ? '—' : totalAbs}
          icon={AlertTriangle} gradient="bg-gradient-to-br from-amber-400 to-orange-500" textColor={totalAbs > 0 ? 'text-amber-600' : 'text-foreground'} />
        <KPI label="Atestados" value={isLoading ? '—' : totalMed}
          icon={Stethoscope} gradient="bg-gradient-to-br from-sky-400 to-blue-500" textColor={totalMed > 0 ? 'text-sky-600' : 'text-foreground'} />
      </div>

      {/* Controls: month nav + search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
        {/* Month selector */}
        <div className="flex items-center bg-card rounded-xl border shadow-kpi overflow-hidden">
          <button
            onClick={prevMonth}
            className="flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold px-4 text-foreground min-w-[148px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            disabled={year === today.getFullYear() && month === today.getMonth() + 1}
            className="flex items-center justify-center h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por nome ou função..."
            className="pl-9 h-9 rounded-xl text-[13px] bg-card border shadow-kpi"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Alert banner */}
      {!isLoading && withPending > 0 && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3.5 text-[13px] text-red-800">
          <CircleAlert className="h-4 w-4 mt-0.5 shrink-0 text-red-500" />
          <span>
            <strong>{withPending}</strong> funcionário{withPending > 1 ? 's' : ''} com faltas sem justificativa ou saldo negativo em {MONTH_NAMES[month]}.
            {' '}Verifique os cards marcados como <strong>Pendências</strong> abaixo.
          </span>
        </div>
      )}

      {/* Cards */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-card flex flex-col items-center justify-center py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Users className="h-7 w-7 text-muted-foreground opacity-50" />
          </div>
          <p className="text-[15px] font-semibold text-foreground">
            {search ? 'Nenhum resultado' : 'Nenhum funcionário cadastrado'}
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">
            {search ? 'Tente outro nome ou função' : 'Comece cadastrando o primeiro funcionário'}
          </p>
          {!search && (
            <Button asChild size="sm" className="mt-5 rounded-xl">
              <Link to="/employees/new">Cadastrar funcionário</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map(emp => <EmployeeCard key={emp.id} emp={emp} month={month} year={year} />)}
        </div>
      )}
    </div>
  )
}
