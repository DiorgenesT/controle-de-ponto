import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users, Clock, TrendingUp, TrendingDown, FileText,
  AlertTriangle, ChevronLeft, ChevronRight, CalendarCheck,
  Stethoscope, Umbrella, CircleAlert,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { minutesToTime } from '@ponto/shared'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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
  year: number
  month: number
  totalEmployees: number
  employees: EmpStat[]
}

function BalanceBadge({ minutes }: { minutes: number }) {
  if (minutes === 0) return <span className="text-muted-foreground font-mono text-xs">—</span>
  const positive = minutes > 0
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 font-mono text-xs font-semibold',
      positive ? 'text-emerald-600' : 'text-red-600'
    )}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? '+' : '-'}{minutesToTime(Math.abs(minutes))}
    </span>
  )
}

export function DashboardPage() {
  const today = new Date()
  const [year,  setYear]  = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1

  const { data: resp, isLoading } = useQuery({
    queryKey: ['dashboard', year, month],
    queryFn: () => reportsApi.dashboard(year, month),
  })

  const dash = resp?.data as DashData | undefined
  const employees = dash?.employees ?? []

  // Alertas: faltas sem justificativa ou horas devendo
  const alerts = employees.filter(e => e.absences > 0 || e.missingMinutes > 0)
  const withExtra = employees.filter(e => e.extraMinutes > 0).sort((a, b) => b.extraMinutes - a.extraMinutes)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Visão gerencial por funcionário
          </p>
        </div>
        <div className="flex items-center gap-1 bg-card border rounded-lg px-1 py-1 card-shadow">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold px-2 min-w-[130px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth} disabled={isCurrentMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {!isLoading && alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 card-shadow">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <CircleAlert className="h-4 w-4" />
              Atenção — {alerts.length} funcionário{alerts.length > 1 ? 's' : ''} com pendências em {MONTH_NAMES[month]}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="flex flex-wrap gap-2">
              {alerts.map(emp => (
                <div key={emp.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-xs">
                  <span className="font-semibold text-amber-900">{emp.name.split(' ')[0]}</span>
                  {emp.absences > 0 && (
                    <span className="flex items-center gap-1 text-red-600 font-medium">
                      <AlertTriangle className="h-3 w-3" />{emp.absences} falta{emp.absences > 1 ? 's' : ''}
                    </span>
                  )}
                  {emp.missingMinutes > 0 && (
                    <span className="flex items-center gap-1 text-orange-600 font-medium">
                      <Clock className="h-3 w-3" />-{minutesToTime(emp.missingMinutes)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela principal */}
      <Card className="card-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Análise Individual — {MONTH_NAMES[month]}/{year}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isLoading ? 'Carregando...' : `${dash?.totalEmployees ?? 0} funcionário${(dash?.totalEmployees ?? 0) !== 1 ? 's' : ''} ativo${(dash?.totalEmployees ?? 0) !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/reports"><FileText className="h-3.5 w-3.5 mr-1.5" />PDF</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/timesheet"><Clock className="h-3.5 w-3.5 mr-1.5" />Lançar Ponto</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Carregando dados...</div>
          ) : employees.length === 0 ? (
            <div className="py-16 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground mb-3">Nenhum funcionário cadastrado</p>
              <Button asChild size="sm"><Link to="/employees/new">Cadastrar funcionário</Link></Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Funcionário</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Dias Trab.</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">H. Trabalhadas</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">H. Extras</th>
                    <th className="text-right px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">H. Faltantes</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" />Faltas</span>
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1"><Stethoscope className="h-3 w-3 text-blue-500" />Atestados</span>
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      <span className="flex items-center justify-center gap-1"><Umbrella className="h-3 w-3 text-violet-500" />Férias</span>
                    </th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Saldo Mês</th>
                    <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Saldo Acum.</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {employees.map((emp) => (
                    <tr key={emp.id} className={cn(
                      'hover:bg-muted/20 transition-colors',
                      emp.absences > 0 && 'bg-red-50/40 hover:bg-red-50/60'
                    )}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full font-semibold text-xs shrink-0',
                            emp.absences > 0 ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'
                          )}>
                            {emp.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm leading-tight">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">{emp.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <span className="text-sm font-medium">{emp.workedDays}</span>
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">
                        {emp.workedMinutes > 0 ? minutesToTime(emp.workedMinutes) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">
                        {emp.extraMinutes > 0
                          ? <span className="text-emerald-600 font-semibold">{minutesToTime(emp.extraMinutes)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-right font-mono text-sm">
                        {emp.missingMinutes > 0
                          ? <span className="text-red-600 font-semibold">{minutesToTime(emp.missingMinutes)}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {emp.absences > 0
                          ? <Badge variant="destructive" className="text-xs font-bold">{emp.absences}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {emp.medicalDays > 0
                          ? <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100">{emp.medicalDays}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {emp.vacationDays > 0
                          ? <Badge className="text-xs bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-100">{emp.vacationDays}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <BalanceBadge minutes={emp.monthBalance} />
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        <BalanceBadge minutes={emp.accumulatedBalance} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                          <Link to={`/timesheet?employee=${emp.id}`}>
                            <CalendarCheck className="h-3.5 w-3.5 mr-1" />Ponto
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banco de horas — ranking extras */}
      {!isLoading && withExtra.length > 0 && (
        <Card className="card-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              Ranking de Horas Extras — {MONTH_NAMES[month]}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            <div className="space-y-2">
              {withExtra.map((emp, i) => (
                <div key={emp.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-sm font-medium">{emp.name.split(' ')[0]}</span>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.min(100, (emp.extraMinutes / withExtra[0].extraMinutes) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-emerald-600 font-mono tabular-nums">
                      +{minutesToTime(emp.extraMinutes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
