import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PDFDownloadLink } from '@react-pdf/renderer'
import {
  CalendarCheck, CalendarClock, FileDown, FileText, History, RotateCw, Scale, SlidersHorizontal,
  TrendingDown, TrendingUp, UserRoundSearch, Wallet, WifiOff,
} from 'lucide-react'
import { minutesToTime } from '@ponto/shared'
import type { BankTreatment, Employee, HourBankAdjustment, MonthlyReport } from '@ponto/shared'
import { employeesApi, reportsApi, timeEntriesApi } from '@/lib/api'
import { invalidateEntryData, signedTime } from '@/lib/timesheet'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { FormField } from '@/components/ui/form-field'
import { MonthSwitcher, MONTHS } from '@/components/ui/month-switcher'
import { UserAvatar } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmployeePicker } from '@/components/employees/EmployeePicker'
import { RecalculateMonthButton } from '@/components/timesheet/RecalculateMonthButton'
import { TimesheetPDF } from '@/components/pdf/TimesheetPDF'

function parseHoursInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return 0
  const match = /^([+-]?)(\d{1,3}):(\d{2})$/.exec(trimmed)
  if (!match) return null
  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3])
  if (minutes > 59) return null
  return sign * (hours * 60 + minutes)
}

function toneOf(minutes: number) {
  return minutes > 0 ? 'success' : minutes < 0 ? 'destructive' : 'default'
}

function Section({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
      <header className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/60 text-muted-foreground">
            <Icon className="size-4" aria-hidden />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold leading-tight text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

// ─── Ajuste manual ──────────────────────────────────────────────────────────

interface AdjustmentFormProps {
  employeeId: string
  year: number
  month: number
  initial?: HourBankAdjustment
}

/** Remounted (via key) whenever the employee, month or saved adjustment changes, so no state syncing is needed. */
function AdjustmentForm({ employeeId, year, month, initial }: AdjustmentFormProps) {
  const queryClient = useQueryClient()
  const initialMinutes = initial?.adjustmentMinutes ?? 0
  const [hours, setHours] = useState(initialMinutes === 0 ? '' : signedTime(initialMinutes))
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (minutes: number) => reportsApi.setAdjustment(employeeId, year, month, minutes, note.trim() || null),
    onSuccess: () => {
      invalidateEntryData(queryClient, employeeId)
      toast({ title: 'Ajuste salvo', variant: 'success' })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const minutes = parseHoursInput(hours)
    if (minutes === null) {
      setError('Formato inválido. Use +HH:MM ou -HH:MM')
      return
    }
    setError(null)
    mutation.mutate(minutes)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <FormField label="Horas (±HH:MM)" htmlFor="adjustment-minutes" error={error ?? undefined} className="sm:w-36">
        <Input
          id="adjustment-minutes"
          className="tabular-nums"
          placeholder="+02:30"
          inputMode="numeric"
          value={hours}
          aria-invalid={!!error}
          onChange={(e) => { setHours(e.target.value); setError(null) }}
        />
      </FormField>
      <FormField label="Observação" htmlFor="adjustment-note" className="flex-1">
        <Input
          id="adjustment-note"
          placeholder="Ex.: saldo migrado do controle anterior"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </FormField>
      <Button type="submit" loading={mutation.isPending} className="sm:mt-[1.375rem]">
        Salvar ajuste
      </Button>
    </form>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const canAdjust = user?.role === 'admin' || user?.role === 'manager'

  const today = new Date()
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)

  // Inactive employees included so the sheet of a dismissed employee can still be issued
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', 'with-inactive'],
    queryFn: () => employeesApi.list(true),
  })
  const employees = useMemo(() => (employeesData?.data ?? []) as Employee[], [employeesData])
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  const reportQuery = useQuery({
    queryKey: ['reports', 'monthly', selectedEmployeeId, currentYear, currentMonth],
    queryFn: () => reportsApi.monthly(selectedEmployeeId, currentYear, currentMonth),
    enabled: Boolean(selectedEmployeeId),
  })
  const report = reportQuery.data?.data as MonthlyReport | undefined

  const hourBankQuery = useQuery({
    queryKey: ['reports', 'hourbank', selectedEmployeeId],
    queryFn: () => reportsApi.hourBank(selectedEmployeeId),
    enabled: Boolean(selectedEmployeeId),
  })
  const hourBankRecords = (hourBankQuery.data?.data ?? []) as HourBankAdjustment[]
  const currentMonthBank = hourBankRecords.find((r) => r.year === currentYear && r.month === currentMonth)

  const bulkTreatmentMutation = useMutation({
    mutationFn: (bankTreatment: BankTreatment) =>
      timeEntriesApi.bulkSetBankTreatment({
        employeeId: selectedEmployeeId,
        year: currentYear,
        month: currentMonth,
        bankTreatment,
        dayTypes: ['absence'],
      }),
    onSuccess: ({ data }, bankTreatment) => {
      invalidateEntryData(queryClient, selectedEmployeeId)
      toast({
        title: data.updated === 0
          ? 'Nenhuma falta precisou ser alterada'
          : `${data.updated} falta(s) ${bankTreatment === 'payroll' ? 'marcada(s) como descontada(s) em folha' : 'lançada(s) no banco de horas'}`,
        variant: 'success',
      })
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  function navigate(dir: -1 | 1) {
    let y = currentYear
    let m = currentMonth + dir
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setCurrentYear(y)
    setCurrentMonth(m)
  }

  const monthLabel = `${MONTHS[currentMonth - 1]} de ${currentYear}`
  const adjustment = report ? report.accumulatedMinutes - report.previousMonthAccumulated - report.balanceMinutes : 0
  const absences = report?.entries.filter((e) => e.dayType === 'absence') ?? []
  const absencesInPayroll = absences.filter((e) => e.bankTreatment === 'payroll').length
  const absencesInBank = absences.length - absencesInPayroll
  const isActive = Boolean(selectedEmployee?.active)

  return (
    <div className="space-y-6">
      <PageHeader title="Relatórios" description="Confira o fechamento do mês, ajuste o banco de horas e exporte a folha em PDF." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <EmployeePicker employees={employees} value={selectedEmployeeId} onChange={setSelectedEmployeeId} loading={loadingEmployees} />
        <MonthSwitcher year={currentYear} month={currentMonth} onPrev={() => navigate(-1)} onNext={() => navigate(1)} className="self-start sm:self-auto" />
      </div>

      {!selectedEmployeeId ? (
        <div className="rounded-xl border border-dashed bg-card">
          <EmptyState icon={UserRoundSearch} title="Selecione um funcionário" description="Escolha um funcionário para ver o resumo do mês e gerar a folha de ponto." />
        </div>
      ) : reportQuery.isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => <StatCard key={i} label="…" value="" loading />)}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : reportQuery.isError || !report ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={WifiOff}
            tone="destructive"
            title="Não foi possível carregar o relatório"
            description={reportQuery.error?.message}
            action={
              <Button variant="outline" onClick={() => reportQuery.refetch()} loading={reportQuery.isFetching}>
                {!reportQuery.isFetching && <RotateCw />}Tentar novamente
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <section aria-label="Resumo do mês" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <StatCard
              label="Horas extras"
              value={`+${minutesToTime(report.totalExtraMinutes)}`}
              icon={TrendingUp}
              tone={report.totalExtraMinutes > 0 ? 'success' : 'default'}
              emphasize={report.totalExtraMinutes > 0}
              hint={report.payrollExtraMinutes > 0 ? `${minutesToTime(report.payrollExtraMinutes)} pagas em folha` : undefined}
            />
            <StatCard
              label="Horas de falta"
              value={`-${minutesToTime(report.totalMissingMinutes)}`}
              icon={TrendingDown}
              tone={report.totalMissingMinutes > 0 ? 'destructive' : 'default'}
              emphasize={report.totalMissingMinutes > 0}
              hint={report.payrollMissingMinutes > 0 ? `${minutesToTime(report.payrollMissingMinutes)} descontadas em folha` : undefined}
            />
            <StatCard
              label="Saldo do mês (banco)"
              value={signedTime(report.balanceMinutes)}
              icon={Wallet}
              tone={toneOf(report.balanceMinutes)}
              emphasize={report.balanceMinutes !== 0}
            />
            <StatCard
              label="Saldo acumulado"
              value={signedTime(report.accumulatedMinutes)}
              icon={CalendarClock}
              tone={report.accumulatedMinutes < 0 ? 'destructive' : 'primary'}
              emphasize
            />
          </section>

          {/* Folha de ponto */}
          <section className="overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-primary-soft-border bg-primary-soft text-primary-soft-foreground">
                  <FileText className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-[15px] font-semibold text-foreground">Folha de ponto — {monthLabel}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <UserAvatar name={report.employee.name} className="size-5 text-[9px]" />
                      {report.employee.name}
                    </span>
                    {!report.employee.active && <Badge variant="muted" shape="pill">Inativo</Badge>}
                    <Badge variant="secondary">{report.employee.role}</Badge>
                    <Badge variant="outline">{report.entries.length} registros</Badge>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canAdjust && isActive && (
                  <RecalculateMonthButton
                    employeeId={report.employee.id}
                    employeeName={report.employee.name}
                    year={currentYear}
                    month={currentMonth}
                  />
                )}
                <PDFDownloadLink
                  document={<TimesheetPDF report={report} />}
                  fileName={`folha-ponto-${report.employee.name.toLowerCase().replace(/\s+/g, '-')}-${currentYear}-${String(currentMonth).padStart(2, '0')}.pdf`}
                >
                  {({ loading }) => (
                    <Button loading={loading} tabIndex={-1}>
                      {!loading && <FileDown />}
                      {loading ? 'Gerando PDF...' : 'Baixar PDF'}
                    </Button>
                  )}
                </PDFDownloadLink>
              </div>
            </div>

            {/* How the accumulated balance closes */}
            <dl className="grid grid-cols-2 gap-px border-t bg-border text-sm tabular-nums sm:grid-cols-4">
              {[
                { label: 'Saldo anterior', value: report.previousMonthAccumulated },
                { label: 'Saldo do mês', value: report.balanceMinutes },
                { label: 'Ajuste manual', value: adjustment },
                { label: 'Total acumulado', value: report.accumulatedMinutes, strong: true },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center justify-between gap-2 bg-card px-5 py-3">
                  <dt className="text-muted-foreground">
                    {i > 0 && <span aria-hidden className="mr-1.5 text-muted-foreground/60">{i === 3 ? '=' : '+'}</span>}
                    {item.label}
                  </dt>
                  <dd className={cn(item.strong ? 'font-semibold text-foreground' : 'font-medium', !item.strong && item.value === 0 && 'text-muted-foreground')}>
                    {signedTime(item.value)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Faltas: banco de horas x folha */}
          {canAdjust && absences.length > 0 && (
            <Section
              icon={Scale}
              title="Faltas do mês"
              description={
                <>
                  Falta descontada no salário não deve abater o banco de horas. Escolha onde as faltas de {monthLabel} são
                  acertadas — dá para ajustar dia a dia em{' '}
                  <Link to={`/timesheet?employee=${selectedEmployeeId}`} className="font-medium text-primary underline-offset-4 hover:underline">Lançar ponto</Link>.
                </>
              }
            >
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="warning" shape="pill">{absencesInBank} no banco de horas</Badge>
                  <Badge variant="info" shape="pill">{absencesInPayroll} descontada(s) em folha</Badge>
                </div>
                <div className="flex flex-wrap gap-2 sm:ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={absencesInBank === 0 || bulkTreatmentMutation.isPending}
                    onClick={() => bulkTreatmentMutation.mutate('payroll')}
                  >
                    Descontar todas em folha
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={absencesInPayroll === 0 || bulkTreatmentMutation.isPending}
                    onClick={() => bulkTreatmentMutation.mutate('bank')}
                  >
                    Lançar todas no banco
                  </Button>
                </div>
              </div>
            </Section>
          )}

          {/* Ajuste de banco de horas */}
          {canAdjust && (
            <Section
              icon={SlidersHorizontal}
              title="Ajuste de banco de horas"
              description={`Ajuste manual de saldo em ${monthLabel} — para trazer saldo de antes do sistema ou corrigir divergências.`}
            >
              <div className="p-5">
                {hourBankQuery.isLoading ? (
                  <div className="flex gap-4">
                    <Skeleton className="h-9 w-36" />
                    <Skeleton className="h-9 flex-1" />
                    <Skeleton className="h-9 w-28" />
                  </div>
                ) : (
                  <AdjustmentForm
                    key={`${selectedEmployeeId}-${currentYear}-${currentMonth}-${currentMonthBank?.updatedAt ?? 'none'}`}
                    employeeId={selectedEmployeeId}
                    year={currentYear}
                    month={currentMonth}
                    initial={currentMonthBank}
                  />
                )}
              </div>
            </Section>
          )}

          {/* Histórico */}
          {hourBankRecords.length > 0 && (
            <Section icon={History} title="Histórico de ajustes" description="Últimos 12 ajustes manuais do banco de horas.">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Competência</TableHead>
                    <TableHead>Observação</TableHead>
                    <TableHead className="text-right">Ajuste</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hourBankRecords.slice(0, 12).map((r) => (
                    <TableRow key={r.id} className={cn(r.year === currentYear && r.month === currentMonth && 'bg-primary-soft/50')}>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          <CalendarCheck className="size-3.5 text-muted-foreground" aria-hidden />
                          {MONTHS[r.month - 1]} {r.year}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.note || '—'}</TableCell>
                      <TableCell className={cn('text-right font-medium', r.adjustmentMinutes >= 0 ? 'text-success-soft-foreground' : 'text-destructive-soft-foreground')}>
                        {signedTime(r.adjustmentMinutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          )}
        </>
      )}
    </div>
  )
}
