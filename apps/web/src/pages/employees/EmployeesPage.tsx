import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { employeesApi } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Plus, Pencil, UserX } from 'lucide-react'
import type { Employee } from '@ponto/shared'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/hooks/use-toast'

export function EmployeesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const canEdit = user?.role === 'admin' || user?.role === 'manager'
  const [deactivating, setDeactivating] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => employeesApi.deactivate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast({ title: 'Funcionário desativado', variant: 'success' })
      setDeactivating(null)
    },
    onError: () => {
      toast({ title: 'Erro ao desativar funcionário', variant: 'destructive' })
      setDeactivating(null)
    },
  })

  const employees = (data?.data ?? []) as Employee[]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funcionários</h1>
          <p className="text-muted-foreground">{employees.length} cadastrado(s)</p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate('/employees/new')}>
            <Plus className="h-4 w-4" />
            Novo Funcionário
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lista de Funcionários</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : employees.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground text-sm">Nenhum funcionário cadastrado</p>
              {canEdit && (
                <Button className="mt-4" onClick={() => navigate('/employees/new')}>
                  <Plus className="h-4 w-4" /> Cadastrar funcionário
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
                      {emp.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.role}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="hidden sm:flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {emp.weekdayStart}–{emp.weekdayEnd}
                      </Badge>
                      {emp.worksSaturday && (
                        <span className="text-xs text-muted-foreground">
                          Sáb: {emp.saturdayStart}–{emp.saturdayEnd}
                        </span>
                      )}
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/employees/${emp.id}/edit`)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>

                        {user?.role === 'admin' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Desativar ${emp.name}?`)) {
                                setDeactivating(emp.id)
                                deactivateMutation.mutate(emp.id)
                              }
                            }}
                            disabled={deactivating === emp.id}
                            title="Desativar"
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    )}
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
