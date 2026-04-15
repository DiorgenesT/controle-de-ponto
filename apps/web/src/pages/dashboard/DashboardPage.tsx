import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
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
  id: string
  name: string
  role: string
  workedDays: number
  workedMinutes: number
  extraMinutes: number
  missingMinutes: number
  absences: number
  medicalDays: number
  vacationDays: number
  monthBalance: number
  accumulatedBalance: number
}

interface DashData {
  totalEmployees: number
  employees: EmpStat[]
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KPI({ label, value, sub, icon: Icon, iconClass, bgClass }: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; iconClass: string; bgClass: string
}) {
  return (
    <Card className="card-shadow">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', bgClass)}>
          <Icon className={cn('h-5 w-5', iconClass)} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{label}</p>
          <p className="text-xl font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Status indicator ─────────────────────────────────────────────────────────

function statusOf(emp: EmpStat): 'ok' | 'warning' | 'danger' {
  if (emp.absences > 0 || emp.monthBalance < -30) return 'danger'
  if (emp.medicalDays > 0 || emp.missingMinutes > 0) return 'warning'
  return 'ok'
}

const STATUS_CONFIG = {
  ok:      { dot: 'bg-emerald-400', label: 'Em dia' },
  warning: { dot: 'bg-amber-400',   label: 'Atenção' },
  danger:  { dot: 'bg-red-500',     label: 'Pendência' },
}

// ─── Employee Card ────────────────────────────────────────────────────────────

function EmployeeCard({ emp, month, year }: { emp: EmpStat; month: number; year: number }) {
  const status = statusOf(emp)
  const cfg = STATUS_CONFIG[status]
  const balance = emp.monthBalance
  const initials = emp.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <Card className={cn(
      'card-shadow flex flex-col transition-shadow hover:card-shadow-md',
      status === 'danger'  && 'border-red-200',
      status === 'warning' && 'border-amber-200',
    )}>
      <CardContent className="p-4 flex flex-col gap-3 flex-1">

        {/* Top: avatar + name + status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              status === 'danger'  ? 'bg-red-100 text-red-700'
              : status === 'warning' ? 'bg-amber-100 text-amber-700'
              : 'bg-primary/10 text-primary'
            )}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm leading-tight truncate">{emp.name}</p>
              <p className="text-xs text-muted-foreground truncate">{emp.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 pt-0.5">
            <span className={cn('h-2 w-2 rounded-full', cfg.dot)} />
            <span className="text-xs text-muted-foreground">{cfg.label}</span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Dias trabalhados</p>
            <p className="text-sm font-bold mt-0.5">{emp.workedDays} <span className="text-xs font-normal text-muted-foreground">dias</span></p>
          </div>
          <div className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">Horas trabalhadas</p>
            <p className="text-sm font-bold mt-0.5">
              {emp.workedMinutes > 0 ? minutesToTime(emp.workedMinutes) : <span className="text-muted-foreground">—</span>}
            </p>
          </div>
          <div className={cn('rounded-lg px-3 py-2', balance >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
            <p className="text-xs text-muted-foreground">Saldo do mês</p>
            <p className={cn('text-sm font-bold mt-0.5 flex items-center gap-1', balance >= 0 ? 'text-emerald-700' : 'text-red-700')}>
              {balance >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {balance >= 0 ? '+' : '-'}{minutesToTime(Math.abs(balance))}
            </p>
          </div>
          <div className={cn('rounded-lg px-3 py-2', emp.accumulatedBalance >= 0 ? 'bg-muted/40' : 'bg-red-50')}>
            <p className="text-xs text-muted-foreground">Saldo acumulado</p>
            <p className={cn('text-sm font-bold mt-0.5', emp.accumulatedBalance < 0 && 'text-red-700')}>
              {emp.accumulatedBalance >= 0 ? '+' : '-'}{minutesToTime(Math.abs(emp.accumulatedBalance))}
            </p>
          </div>
        </div>

        {/* Occurrences */}
        <div className="flex flex-wrap gap-1.5">
          {emp.absences > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-xs font-medium px-2.5 py-1">
              <AlertTriangle className="h-3 w-3" />{emp.absences} falta{emp.absences > 1 ? 's' : ''}
            </span>
          )}
          {emp.medicalDays > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1">
              <Stethoscope className="h-3 w-3" />{emp.medicalDays} atestado{emp.medicalDays > 1 ? 's' : ''}
            </span>
          )}
          {emp.vacationDays > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-700 text-xs font-medium px-2.5 py-1">
              <Umbrella className="h-3 w-3" />{emp.vacationDays} d. férias
            </span>
          )}
          {emp.extraMinutes > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1">
              <TrendingUp className="h-3 w-3" />+{minutesToTime(emp.extraMinutes)} extras
            </span>
          )}
          {emp.absences === 0 && emp.medicalDays === 0 && emp.vacationDays === 0 && emp.extraMinutes === 0 && emp.workedDays === 0 && (
            <span className="text-xs text-muted-foreground italic">Sem lançamentos</span>
          )}
          {emp.absences === 0 && emp.medicalDays === 0 && emp.vacationDays === 0 && emp.extraMinutes === 0 && emp.workedDays > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1">
              <CircleCheck className="h-3 w-3" />Sem ocorrências
            </span>
          )}
        </div>

        {/* Action */}
        <div className="pt-1 border-t">
          <Button asChild variant="ghost" size="sm" className="w-full h-8 text-xs justify-start text-muted-foreground hover:text-foreground">
            <Link to={`/timesheet?employee=${emp.id}`}>
              <CalendarCheck className="h-3.5 w-3.5 mr-1.5" />Lançar / Ver ponto de {MONTH_NAMES[month]}/{year}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
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
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

  const { data: resp, isLoading } = useQuery({
    queryKey: ['dashboard', year, month],
    queryFn: () => reportsApi.dashboard(year, month),
  })

  const dash = resp?.data as DashData | undefined
  const allEmployees = dash?.employees ?? []

  const filtered = useMemo(() => {
    if (!search.trim()) return allEmployees
    const q = search.toLowerCase()
    return allEmployees.filter(e =>
      e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)
    )
  }, [allEmployees, search])

  // KPI counts
  const withPending   = allEmployees.filter(e => statusOf(e) === 'danger').length
  const withWarning   = allEmployees.filter(e => statusOf(e) === 'warning').length
  const totalAbsences = allEmployees.reduce((s, e) => s + e.absences, 0)
  const totalMedical  = allEmployees.reduce((s, e) => s + e.medicalDays, 0)

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Visão gerencial por funcionário</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/reports"><FileText className="h-3.5 w-3.5 mr-1.5" />Relatórios PDF</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/timesheet"><Clock className="h-3.5 w-3.5 mr-1.5" />Lançar Ponto</Link>
          </Button>
        </div>
      </div>

      {/* Month selector + KPIs */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        {/* Month nav */}
        <div className="flex items-center gap-1 bg-card border rounded-xl px-1 py-1 card-shadow self-start">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold px-3 min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={nextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar funcionário..."
            className="pl-9 h-9 text-sm"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="Funcionários Ativos"  value={dash?.totalEmployees ?? '—'} icon={Users}         iconClass="text-blue-600"    bgClass="bg-blue-50" />
        <KPI label="Com pendências"       value={isLoading ? '—' : withPending}  sub="faltas ou horas devendo" icon={CircleAlert}     iconClass="text-red-600"     bgClass="bg-red-50" />
        <KPI label="Faltas no mês"        value={isLoading ? '—' : totalAbsences} icon={AlertTriangle} iconClass="text-amber-600"   bgClass="bg-amber-50" />
        <KPI label="Atestados no mês"     value={isLoading ? '—' : totalMedical}  icon={Stethoscope}   iconClass="text-sky-600"     bgClass="bg-sky-50" />
      </div>

      {/* Alert strip */}
      {!isLoading && (withPending > 0 || withWarning > 0) && (
        <div className={cn(
          'rounded-xl border px-4 py-3 flex items-center gap-3 text-sm',
          withPending > 0 ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'
        )}>
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span>
            {withPending > 0 && <><strong>{withPending}</strong> funcionário{withPending > 1 ? 's' : ''} com faltas ou horas devendo. </>}
            {withWarning > 0 && <><strong>{withWarning}</strong> com atestados ou horas faltantes. </>}
            Verifique os cards em destaque abaixo.
          </span>
        </div>
      )}

      {/* Employee grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="card-shadow animate-pulse">
              <CardContent className="p-4 space-y-3">
                <div className="h-10 bg-muted rounded-lg" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-12 bg-muted rounded-lg" />
                  <div className="h-12 bg-muted rounded-lg" />
                  <div className="h-12 bg-muted rounded-lg" />
                  <div className="h-12 bg-muted rounded-lg" />
                </div>
                <div className="h-6 bg-muted rounded-full w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="card-shadow">
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Nenhum funcionário encontrado' : 'Nenhum funcionário cadastrado'}
            </p>
            {!search && (
              <Button asChild size="sm" className="mt-4">
                <Link to="/employees/new">Cadastrar funcionário</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Danger first, then warning, then ok */}
          {['danger', 'warning', 'ok'].map(status => {
            const group = filtered.filter(e => statusOf(e) === status)
            if (group.length === 0) return null
            const labels: Record<string, string> = { danger: 'Pendências', warning: 'Atenção', ok: 'Em dia' }
            return (
              <div key={status}>
                {filtered.some(e => statusOf(e) !== status) && (
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    {labels[status]} ({group.length})
                  </p>
                )}
                <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {group.map(emp => (
                    <EmployeeCard key={emp.id} emp={emp} month={month} year={year} />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
