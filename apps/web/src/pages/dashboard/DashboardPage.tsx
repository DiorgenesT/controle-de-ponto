import { useQuery } from '@tanstack/react-query'
import { reportsApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users, Clock, TrendingUp, TrendingDown, FileText,
  AlertTriangle, CalendarCheck, ChevronRight, Activity,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { minutesToTime } from '@ponto/shared'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface DashboardData {
  year: number
  month: number
  totalEmployees: number
  totalWorkedMinutes: number
  totalExtraMinutes: number
  totalMissingMinutes: number
  totalAbsences: number
  employees: {
    id: string
    name: string
    role: string
    workedMinutes: number
    extraMinutes: number
    missingMinutes: number
    absences: number
  }[]
}

function KPICard({
  title, value, sub, icon: Icon, color, href,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
  color: 'blue' | 'green' | 'orange' | 'red' | 'violet'
  href?: string
}) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100' },
    green:  { bg: 'bg-emerald-50',icon: 'text-emerald-600',border: 'border-emerald-100' },
    orange: { bg: 'bg-amber-50',  icon: 'text-amber-600',  border: 'border-amber-100' },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    border: 'border-red-100' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100' },
  }
  const c = colors[color]

  return (
    <Card className={cn('card-shadow border', c.border)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', c.bg)}>
            <Icon className={cn('h-5 w-5', c.icon)} />
          </div>
        </div>
        {href && (
          <Link to={href} className="mt-3 flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Ver detalhes <ChevronRight className="h-3 w-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { user } = useAuthStore()
  const today = new Date()
  const year  = today.getFullYear()
  const month = today.getMonth() + 1
  const monthName = format(today, "MMMM 'de' yyyy", { locale: ptBR })

  const { data: dashResponse, isLoading } = useQuery({
    queryKey: ['dashboard', year, month],
    queryFn: () => reportsApi.dashboard(year, month),
  })

  const dash = dashResponse?.data as DashboardData | undefined

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm capitalize mt-0.5">{monthName}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to="/timesheet"><Clock className="h-4 w-4 mr-1.5" />Lançar Ponto</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/reports"><FileText className="h-4 w-4 mr-1.5" />Relatórios</Link>
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KPICard
          title="Funcionários Ativos"
          value={isLoading ? '—' : String(dash?.totalEmployees ?? 0)}
          sub="no mês atual"
          icon={Users}
          color="blue"
          href="/employees"
        />
        <KPICard
          title="Horas Trabalhadas"
          value={isLoading ? '—' : minutesToTime(dash?.totalWorkedMinutes ?? 0)}
          sub="total da equipe no mês"
          icon={Activity}
          color="violet"
        />
        <KPICard
          title="Horas Extras"
          value={isLoading ? '—' : minutesToTime(dash?.totalExtraMinutes ?? 0)}
          sub="acumulado da equipe"
          icon={TrendingUp}
          color="green"
        />
        <KPICard
          title="Horas Faltantes"
          value={isLoading ? '—' : minutesToTime(dash?.totalMissingMinutes ?? 0)}
          sub="acumulado da equipe"
          icon={TrendingDown}
          color="red"
        />
        <KPICard
          title="Faltas no Mês"
          value={isLoading ? '—' : String(dash?.totalAbsences ?? 0)}
          sub="dias de ausência"
          icon={AlertTriangle}
          color="orange"
        />
      </div>

      {/* Employee Performance Table */}
      <Card className="card-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold">Desempenho por Funcionário</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{monthName}</p>
          </div>
          {user?.role !== 'viewer' && (
            <Button asChild variant="outline" size="sm">
              <Link to="/employees"><Users className="h-3.5 w-3.5 mr-1.5" />Gerenciar</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : !dash?.employees?.length ? (
            <div className="py-12 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm text-muted-foreground">Nenhum funcionário cadastrado</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/employees/new">Cadastrar funcionário</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Funcionário</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">H. Trabalhadas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">H. Extras</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">H. Faltantes</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Faltas</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saldo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {dash.employees.map((emp) => {
                    const balance = emp.extraMinutes - emp.missingMinutes
                    return (
                      <tr key={emp.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs shrink-0">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">{emp.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm">
                          {emp.workedMinutes ? minutesToTime(emp.workedMinutes) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm">
                          {emp.extraMinutes > 0
                            ? <span className="text-emerald-600 font-semibold">{minutesToTime(emp.extraMinutes)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-sm">
                          {emp.missingMinutes > 0
                            ? <span className="text-red-600 font-semibold">{minutesToTime(emp.missingMinutes)}</span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          {emp.absences > 0
                            ? <Badge variant="destructive" className="text-xs">{emp.absences}</Badge>
                            : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={cn(
                            'inline-flex items-center gap-0.5 text-xs font-semibold font-mono',
                            balance > 0 ? 'text-emerald-600' : balance < 0 ? 'text-red-600' : 'text-muted-foreground'
                          )}>
                            {balance > 0 ? '+' : balance < 0 ? '-' : ''}{minutesToTime(Math.abs(balance))}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                            <Link to={`/timesheet?employee=${emp.id}`}>
                              <CalendarCheck className="h-3.5 w-3.5 mr-1" />Ponto
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
