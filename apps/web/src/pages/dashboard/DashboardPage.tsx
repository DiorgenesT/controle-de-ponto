import { useQuery } from '@tanstack/react-query'
import { employeesApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Clock, FileText, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Employee } from '@ponto/shared'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function DashboardPage() {
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  })

  const employees = (employeesData?.data ?? []) as Employee[]
  const today = new Date()
  const monthName = format(today, 'MMMM yyyy', { locale: ptBR })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground capitalize">{monthName}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Funcionários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Mês Atual</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{format(today, 'MMMM', { locale: ptBR })}</div>
            <p className="text-xs text-muted-foreground">Dia {format(today, 'd')} de {format(today, 'MMMM', { locale: ptBR })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lançar Ponto</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" className="w-full">
              <Link to="/timesheet">Acessar</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Relatórios PDF</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/reports">Exportar</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Employees Quick View */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Funcionários</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link to="/employees">Ver todos</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nenhum funcionário cadastrado</p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/employees/new">Cadastrar primeiro funcionário</Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {employees.slice(0, 6).map((emp) => (
                <div key={emp.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {emp.weekdayStart}–{emp.weekdayEnd}
                    </Badge>
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/timesheet?employee=${emp.id}`}>Ponto</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
