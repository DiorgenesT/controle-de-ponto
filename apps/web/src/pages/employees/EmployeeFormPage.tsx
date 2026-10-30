import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmployeeSchema } from '@ponto/shared'
import type { z } from 'zod'
import type { Employee } from '@ponto/shared'
import { employeesApi } from '@/lib/api'
import { ArrowLeft, Info } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/ui/page-header'

type EmployeeForm = z.infer<typeof createEmployeeSchema>

/** Fields that change how existing entries are calculated. */
const SCHEDULE_FIELDS = [
  'weekdayStart', 'weekdayEnd', 'saturdayStart', 'saturdayEnd', 'saturdayMode', 'toleranceMinutes', 'dailyHoursExpected',
] as const

const SATURDAY_OPTIONS = [
  { value: 'all', label: 'Todos os sábados', hint: 'Trabalha em todo sábado do mês' },
  { value: 'first_two', label: '1º e 2º sábado', hint: 'Apenas os dois primeiros do mês' },
  { value: 'none', label: 'Não trabalha', hint: 'Sábado é folga' },
] as const

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,15rem)_1fr] lg:gap-8">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-lg border bg-card p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function EmployeeFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: empData, isLoading: isLoadingEmp } = useQuery({
    queryKey: ['employees', id],
    queryFn: () => employeesApi.get(id!),
    enabled: isEditing,
  })

  const emp = empData?.data as Employee | undefined

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<EmployeeForm>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      weekdayStart: '08:30',
      weekdayEnd: '18:00',
      saturdayStart: '08:00',
      saturdayEnd: '12:00',
      saturdayMode: 'all' as const,
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
        saturdayMode: emp.saturdayMode,
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
    onSuccess: (_res, data) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const scheduleChanged = Boolean(emp) && SCHEDULE_FIELDS.some((f) => (data[f] ?? null) !== (emp![f] ?? null))
      toast(
        scheduleChanged
          ? {
              title: 'Funcionário atualizado',
              description: 'A jornada mudou. Lançamentos já existentes só refletem a mudança após usar "Recalcular mês" em Lançar ponto ou Relatórios.',
              variant: 'success',
              duration: 10000,
            }
          : { title: 'Funcionário atualizado!', variant: 'success' }
      )
      navigate('/employees')
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const saturdayMode = useWatch({ control, name: 'saturdayMode' })
  const isPending = createMutation.isPending || updateMutation.isPending

  async function onSubmit(data: EmployeeForm) {
    if (isEditing) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const watchedName = useWatch({ control, name: 'name' })

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-4">
      <PageHeader
        leading={
          <Button variant="outline" size="icon-sm" className="mt-0.5 shrink-0" onClick={() => navigate('/employees')} aria-label="Voltar para funcionários">
            <ArrowLeft />
          </Button>
        }
        title={isEditing ? 'Editar funcionário' : 'Novo funcionário'}
        description={isEditing ? 'Atualize os dados cadastrais e a jornada.' : 'Preencha os dados e a jornada de trabalho.'}
        actions={
          isEditing && emp ? (
            <span className="hidden max-w-[16rem] truncate text-sm text-muted-foreground sm:block">{watchedName || emp.name}</span>
          ) : undefined
        }
      />

      {isEditing && isLoadingEmp ? (
        <div className="space-y-8">
          {[0, 1].map((i) => (
            <div key={i} className="grid gap-4 lg:grid-cols-[15rem_1fr] lg:gap-8">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
              <div className="space-y-4 rounded-lg border bg-card p-6">
                <Skeleton className="h-9 w-full" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-9" />
                  <Skeleton className="h-9" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8" noValidate>
          <Section title="Dados pessoais" description="Identificação do funcionário, como aparece na folha de ponto.">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Nome completo" htmlFor="name" required error={errors.name?.message} className="sm:col-span-2">
                <Input id="name" placeholder="Ex.: Jessica Nascimento dos Santos" aria-invalid={!!errors.name} {...register('name')} />
              </FormField>

              <FormField label="Função" htmlFor="role" required error={errors.role?.message}>
                <Input id="role" placeholder="Ex.: Auxiliar Administrativo" aria-invalid={!!errors.role} {...register('role')} />
              </FormField>

              <FormField label="CPF" htmlFor="cpf" error={errors.cpf?.message} hint="Opcional">
                <Input
                  id="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="tabular-nums"
                  aria-invalid={!!errors.cpf}
                  {...register('cpf')}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11)
                    let formatted = digits
                    if (digits.length > 9) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`
                    else if (digits.length > 6) formatted = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`
                    else if (digits.length > 3) formatted = `${digits.slice(0,3)}.${digits.slice(3)}`
                    setValue('cpf', formatted || null, { shouldValidate: true })
                  }}
                />
              </FormField>

              <FormField label="Data de admissão" htmlFor="admissionDate" required error={errors.admissionDate?.message}>
                <Input id="admissionDate" type="date" aria-invalid={!!errors.admissionDate} {...register('admissionDate')} />
              </FormField>
            </div>
          </Section>

          <Section title="Jornada (segunda a sexta)" description="Horários de referência, carga líquida diária e tolerância para extras e faltas.">
            {isEditing && (
              <p className="mb-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" aria-hidden />
                Mudanças de jornada, sábados ou tolerância valem para novos lançamentos. Para reaplicar a um mês já lançado, use
                "Recalcular mês" em Lançar ponto ou Relatórios.
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Entrada" htmlFor="weekdayStart" error={errors.weekdayStart?.message}>
                <Input id="weekdayStart" type="time" aria-invalid={!!errors.weekdayStart} {...register('weekdayStart')} />
              </FormField>

              <FormField label="Saída" htmlFor="weekdayEnd" error={errors.weekdayEnd?.message}>
                <Input id="weekdayEnd" type="time" aria-invalid={!!errors.weekdayEnd} {...register('weekdayEnd')} />
              </FormField>

              <FormField label="Horas líquidas por dia" htmlFor="dailyHoursExpected" error={errors.dailyHoursExpected?.message} hint="Descontado o almoço">
                <div className="relative">
                  <Input id="dailyHoursExpected" type="number" step="0.5" min="1" max="24" className="pr-10" aria-invalid={!!errors.dailyHoursExpected} {...register('dailyHoursExpected', { valueAsNumber: true })} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">h</span>
                </div>
              </FormField>

              <FormField label="Tolerância" htmlFor="toleranceMinutes" error={errors.toleranceMinutes?.message} hint="Diferença que não gera extra nem falta">
                <div className="relative">
                  <Input id="toleranceMinutes" type="number" min="0" max="30" className="pr-12" aria-invalid={!!errors.toleranceMinutes} {...register('toleranceMinutes', { valueAsNumber: true })} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">min</span>
                </div>
              </FormField>
            </div>
          </Section>

          <Section title="Sábados" description="Defina se o funcionário trabalha aos sábados e em qual horário.">
            <div className="space-y-5">
              <fieldset>
                <legend className="mb-2 text-[13px] font-medium text-foreground">Jornada aos sábados</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {SATURDAY_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        'relative flex cursor-pointer flex-col gap-0.5 rounded-md border bg-card px-3.5 py-3 transition-colors hover:bg-accent/50',
                        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
                        saturdayMode === opt.value && 'border-primary'
                      )}
                    >
                      <input type="radio" value={opt.value} className="sr-only" {...register('saturdayMode')} />
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-4 items-center justify-center rounded-full border',
                            saturdayMode === opt.value ? 'border-primary' : 'border-input'
                          )}
                        >
                          {saturdayMode === opt.value && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                        {opt.label}
                      </span>
                      <span className="pl-6 text-xs text-muted-foreground">{opt.hint}</span>
                    </label>
                  ))}
                </div>
                {errors.saturdayMode && <p className="mt-1.5 text-xs font-medium text-destructive-soft-foreground">{errors.saturdayMode.message}</p>}
              </fieldset>

              {saturdayMode !== 'none' && (
                <div className="grid gap-5 sm:grid-cols-2">
                  <FormField label="Entrada (sábado)" htmlFor="saturdayStart">
                    <Input id="saturdayStart" type="time" {...register('saturdayStart')} />
                  </FormField>
                  <FormField label="Saída (sábado)" htmlFor="saturdayEnd">
                    <Input id="saturdayEnd" type="time" {...register('saturdayEnd')} />
                  </FormField>
                </div>
              )}
            </div>
          </Section>

          <div className="sticky bottom-0 -mx-4 flex justify-end gap-3 border-t bg-background px-4 py-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-lg lg:border lg:bg-card lg:px-5">
            <Button type="button" variant="outline" onClick={() => navigate('/employees')}>
              Cancelar
            </Button>
            <Button type="submit" loading={isPending}>
              {isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar funcionário'}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}
