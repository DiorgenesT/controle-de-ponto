import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployeeSchema } from '@ponto/shared'
import type { z } from 'zod'
import type { Employee } from '@ponto/shared'
import { employeesApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

type EmployeeForm = z.infer<typeof createEmployeeSchema>

export function EmployeeFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: empData } = useQuery({
    queryKey: ['employees', id],
    queryFn: () => employeesApi.get(id!),
    enabled: isEditing,
  })

  const emp = empData?.data as Employee | undefined

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      weekdayStart: '08:30',
      weekdayEnd: '18:00',
      saturdayStart: '08:00',
      saturdayEnd: '12:00',
      worksSaturday: true,
      toleranceMinutes: 10,
      dailyHoursExpected: 8,
    },
  })

  useEffect(() => {
    if (emp) {
      reset({
        name: emp.name,
        role: emp.role,
        cpf: emp.cpf ?? undefined,
        admissionDate: emp.admissionDate,
        weekdayStart: emp.weekdayStart,
        weekdayEnd: emp.weekdayEnd,
        saturdayStart: emp.saturdayStart ?? '08:00',
        saturdayEnd: emp.saturdayEnd ?? '12:00',
        worksSaturday: emp.worksSaturday,
        toleranceMinutes: emp.toleranceMinutes,
        dailyHoursExpected: emp.dailyHoursExpected,
      })
    }
  }, [emp, reset])

  const createMutation = useMutation({
    mutationFn: (data: EmployeeForm) => employeesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast({ title: 'Funcionário cadastrado!', variant: 'success' })
      navigate('/employees')
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const updateMutation = useMutation({
    mutationFn: (data: EmployeeForm) => employeesApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast({ title: 'Funcionário atualizado!', variant: 'success' })
      navigate('/employees')
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const worksSaturday = watch('worksSaturday')
  const isPending = createMutation.isPending || updateMutation.isPending

  async function onSubmit(data: EmployeeForm) {
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/employees')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}</h1>
          <p className="text-muted-foreground text-sm">
            {isEditing ? 'Atualize os dados do funcionário' : 'Preencha os dados do novo funcionário'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" placeholder="Ex: Jessica Nascimento dos Santos" {...register('name')} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="role">Função *</Label>
                <Input id="role" placeholder="Ex: Auxiliar Administrativo" {...register('role')} />
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  {...register('cpf')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                    let formatted = digits
                    if (digits.length > 9) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
                    else if (digits.length > 6) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`
                    else if (digits.length > 3) formatted = `${digits.slice(0,3)}.${digits.slice(3)}`
                    setValue('cpf', formatted || undefined, { shouldValidate: true })
                  }}
                />
                {errors.cpf && <p className="text-xs text-destructive">{errors.cpf.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="admissionDate">Data de Admissão *</Label>
                <Input id="admissionDate" type="date" {...register('admissionDate')} />
                {errors.admissionDate && <p className="text-xs text-destructive">{errors.admissionDate.message}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Jornada de Trabalho</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Entrada (Seg–Sex)</Label>
                <Input type="time" {...register('weekdayStart')} />
                {errors.weekdayStart && <p className="text-xs text-destructive">{errors.weekdayStart.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Saída (Seg–Sex)</Label>
                <Input type="time" {...register('weekdayEnd')} />
                {errors.weekdayEnd && <p className="text-xs text-destructive">{errors.weekdayEnd.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dailyHoursExpected">Horas líquidas/dia</Label>
                <Input id="dailyHoursExpected" type="number" step="0.5" min="1" max="24" {...register('dailyHoursExpected', { valueAsNumber: true })} />
                {errors.dailyHoursExpected && <p className="text-xs text-destructive">{errors.dailyHoursExpected.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="toleranceMinutes">Tolerância (minutos)</Label>
                <Input id="toleranceMinutes" type="number" min="0" max="30" {...register('toleranceMinutes', { valueAsNumber: true })} />
                {errors.toleranceMinutes && <p className="text-xs text-destructive">{errors.toleranceMinutes.message}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <input
                id="worksSaturday"
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                {...register('worksSaturday')}
              />
              <Label htmlFor="worksSaturday">Trabalha aos sábados</Label>
            </div>

            {worksSaturday && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Entrada (Sábado)</Label>
                  <Input type="time" {...register('saturdayStart')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Saída (Sábado)</Label>
                  <Input type="time" {...register('saturdayEnd')} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/employees')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
          </Button>
        </div>
      </form>
    </div>
  )
}
