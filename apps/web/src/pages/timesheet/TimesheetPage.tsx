import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDaysInMonth } from 'date-fns'
import { CircleAlert, Lock, Pencil, Plus, RotateCw, StickyNote, Trash2, UserRoundSearch, WifiOff } from 'lucide-react'
import { entryBankBalance, getDayOfWeek, isSunday, isWorkingSaturday, minutesToTime } from '@ponto/shared'
import type { BankTreatment, Employee, MonthlyReport, TimeEntry } from '@ponto/shared'
import { companyApi, employeesApi, reportsApi, timeEntriesApi } from '@/lib/api'
import { DAY_TYPE_BADGE, DAY_TYPE_LABELS, invalidateEntryData, signedTime, toIsoDate } from '@/lib/timesheet'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard, StatGroup } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { MonthSwitcher, MONTHS } from '@/components/ui/month-switcher'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/alert-dialog'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmployeePicker } from '@/components/employees/EmployeePicker'
import { DayEditorDialog } from '@/components/timesheet/DayEditorDialog'
import { RecalculateMonthButton } from '@/components/timesheet/RecalculateMonthButton'

interface DayRow {
  day: number
  date: string
  weekday: string
  restDay: 'sunday' | 'free_saturday' | null
  /** Past scheduled day (after admission) with nothing recorded */
  missingRecord: boolean
  isToday: boolean
  entry?: TimeEntry
}

function TimeCell({ value }: { value: string | null | undefined }) {
  return <TableCell className={cn('text-center', !value && 'text-muted-foreground/50')}>{value || '—'}</TableCell>
}

export function TimesheetPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const isEditorRole = user?.role === 'admin' || user?.role === 'manager'

  const today = new Date()
  const todayIso = toIsoDate(today)
  const selectedEmployeeId = searchParams.get('employee') ?? ''
  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1)
  const [editingDate, setEditingDate] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimeEntry | null>(null)

  function selectEmployee(id: string) {
    setSearchParams(id ? { employee: id } : {}, { replace: true })
    setEditingDate(null)
  }

  const { data: companyData } = useQuery({ queryKey: ['company'], queryFn: () => companyApi.get() })
  const absenceDefault =
    (companyData?.data as { absence_treatment_default?: BankTreatment } | undefined)?.absence_treatment_default ?? 'bank'

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['employees', 'with-inactive'],
    queryFn: () => employeesApi.list(true),
  })
  const employees = useMemo(() => (employeesData?.data ?? []) as Employee[], [employeesData])
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)
  const canEdit = isEditorRole && Boolean(selectedEmployee?.active)

  const entriesQuery = useQuery({
    queryKey: ['timeentries', selectedEmployeeId, currentYear, currentMonth],
    queryFn: () => timeEntriesApi.list(selectedEmployeeId, currentYear, currentMonth),
    enabled: Boolean(selectedEmployee),
  })
  const entries = useMemo(() => (entriesQuery.data?.data ?? []) as TimeEntry[], [entriesQuery.data])

  const { data: monthlyReportData, isLoading: loadingReport } = useQuery({
    queryKey: ['reports', 'monthly', selectedEmployeeId, currentYear, currentMonth],
    queryFn: () => reportsApi.monthly(selectedEmployeeId, currentYear, currentMonth),
    enabled: Boolean(selectedEmployee),
  })
  const monthlyReport = monthlyReportData?.data as MonthlyReport | undefined
  const previousMonthAccumulated = monthlyReport?.previousMonthAccumulated ?? 0
  // accumulatedMinutes = previousMonthAccumulated + balanceMinutes + manual adjustment of the month
  const currentMonthAdjustment = monthlyReport
    ? monthlyReport.accumulatedMinutes - monthlyReport.previousMonthAccumulated - monthlyReport.balanceMinutes
    : 0

  const deleteMutation = useMutation({
    mutationFn: (entry: TimeEntry) => timeEntriesApi.delete(entry.id),
    onSuccess: (_d, entry) => {
      const [y, m] = entry.entryDate.split('-').map(Number)
      invalidateEntryData(queryClient, entry.employeeId, y, m)
      toast({ title: 'Lançamento excluído', variant: 'success' })
      setEditingDate(null)
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  const rows: DayRow[] = useMemo(() => {
    if (!selectedEmployee) return []
    const days = getDaysInMonth(new Date(currentYear, currentMonth - 1))
    return Array.from({ length: days }, (_, i) => {
      const day = i + 1
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const weekday = getDayOfWeek(date)
      const restDay = isSunday(date)
        ? 'sunday'
        : weekday === 'SÁBADO' && !isWorkingSaturday(date, selectedEmployee.saturdayMode)
          ? 'free_saturday'
          : null
      const entry = entries.find((e) => e.entryDate === date)
      return {
        day,
        date,
        weekday,
        restDay,
        entry,
        isToday: date === todayIso,
        missingRecord: !entry && !restDay && date < todayIso && date >= selectedEmployee.admissionDate,
      } satisfies DayRow
    })
  }, [selectedEmployee, currentYear, currentMonth, entries, todayIso])

  const totals = useMemo(() => ({
    worked: entries.reduce((s, e) => s + (e.workedMinutes ?? 0), 0),
    extra: entries.reduce((s, e) => s + (e.extraMinutes ?? 0), 0),
    missing: entries.reduce((s, e) => s + (e.missingMinutes ?? 0), 0),
    payrollMissing: entries.reduce((s, e) => s + (e.bankTreatment === 'payroll' ? (e.missingMinutes ?? 0) : 0), 0),
    balance: entries.reduce((s, e) => s + entryBankBalance(e), 0),
  }), [entries])
  const missingRecords = rows.filter((r) => r.missingRecord).length

  function navigate(dir: -1 | 1) {
    let y = currentYear
    let m = currentMonth + dir
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setCurrentYear(y)
    setCurrentMonth(m)
    setEditingDate(null)
  }

  const editingRow = editingDate ? rows.find((r) => r.date === editingDate) : undefined
  const loadingMonth = entriesQuery.isLoading

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lançar ponto"
        description="Registre entradas, saídas e ocorrências de cada dia."
        actions={
          selectedEmployee && isEditorRole && selectedEmployee.active ? (
            <RecalculateMonthButton
              employeeId={selectedEmployee.id}
              employeeName={selectedEmployee.name}
              year={currentYear}
              month={currentMonth}
            />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <EmployeePicker employees={employees} value={selectedEmployeeId} onChange={selectEmployee} loading={loadingEmployees} />
        <MonthSwitcher year={currentYear} month={currentMonth} onPrev={() => navigate(-1)} onNext={() => navigate(1)} className="self-start sm:self-auto" />
      </div>

      {!selectedEmployee ? (
        <div className="rounded-lg border border-dashed bg-card">
          <EmptyState
            icon={UserRoundSearch}
            title={selectedEmployeeId && !loadingEmployees ? 'Funcionário não encontrado' : 'Selecione um funcionário'}
            description="Escolha um funcionário acima para ver e lançar o ponto do mês."
          />
        </div>
      ) : (
        <>
          {/* Employee + schedule */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="text-[15px] font-semibold text-foreground">{selectedEmployee.name}</span>
              <span className="text-sm text-muted-foreground">{selectedEmployee.role}</span>
              {!selectedEmployee.active && <Badge variant="muted">Inativo</Badge>}
            </p>
            <p className="text-[13px] tabular-nums text-muted-foreground">
              Seg–Sex {selectedEmployee.weekdayStart}–{selectedEmployee.weekdayEnd}
              {selectedEmployee.saturdayMode !== 'none' && (
                <>
                  {' · '}Sáb {selectedEmployee.saturdayStart}–{selectedEmployee.saturdayEnd}
                  {selectedEmployee.saturdayMode === 'first_two' && ' (1º e 2º)'}
                </>
              )}
              {' · '}Tolerância ±{selectedEmployee.toleranceMinutes} min
            </p>
          </div>

          {!selectedEmployee.active && (
            <Alert variant="info">
              <Lock />
              <div>
                <AlertTitle>Somente leitura</AlertTitle>
                <AlertDescription>Funcionário desativado não recebe novos lançamentos. A folha continua disponível em Relatórios.</AlertDescription>
              </div>
            </Alert>
          )}

          {/* KPIs */}
          <StatGroup aria-label="Resumo do mês" className="grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Horas trabalhadas" value={minutesToTime(totals.worked)} loading={loadingMonth} />
            <StatCard
              label="Horas extras"
              value={totals.extra > 0 ? `+${minutesToTime(totals.extra)}` : '00:00'}
              tone={totals.extra > 0 ? 'success' : 'default'}
              loading={loadingMonth}
            />
            <StatCard
              label="Horas de falta"
              value={totals.missing > 0 ? `-${minutesToTime(totals.missing)}` : '00:00'}
              tone={totals.missing > 0 ? 'destructive' : 'default'}
              hint={totals.payrollMissing > 0 ? `${minutesToTime(totals.payrollMissing)} desc. em folha` : undefined}
              loading={loadingMonth}
            />
            <StatCard
              label="Saldo do mês (banco)"
              value={signedTime(totals.balance)}
              tone={totals.balance > 0 ? 'success' : totals.balance < 0 ? 'destructive' : 'default'}
              loading={loadingMonth}
            />
            <StatCard
              label="Saldo acumulado"
              value={monthlyReport ? signedTime(monthlyReport.accumulatedMinutes) : '—'}
              tone={monthlyReport && monthlyReport.accumulatedMinutes < 0 ? 'destructive' : monthlyReport && monthlyReport.accumulatedMinutes > 0 ? 'success' : 'default'}
              hint={monthlyReport ? `Anterior ${signedTime(previousMonthAccumulated)}${currentMonthAdjustment ? ` · ajuste ${signedTime(currentMonthAdjustment)}` : ''}` : undefined}
              loading={loadingReport}
              className="col-span-2 md:col-span-1"
            />
          </StatGroup>

          {missingRecords > 0 && !loadingMonth && (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="size-1.5 rounded-full bg-warning" aria-hidden />
              {missingRecords === 1 ? '1 dia útil já passado' : `${missingRecords} dias úteis já passados`} sem registro em{' '}
              {MONTHS[currentMonth - 1]}. Nada é descontado até que o dia seja lançado.
            </p>
          )}

          {/* Month grid */}
          <div className="overflow-hidden rounded-lg border bg-card">
            {entriesQuery.isError ? (
              <EmptyState
                icon={WifiOff}
                tone="destructive"
                title="Não foi possível carregar os lançamentos"
                action={
                  <Button variant="outline" onClick={() => entriesQuery.refetch()} loading={entriesQuery.isFetching}>
                    {!entriesQuery.isFetching && <RotateCw />}Tentar novamente
                  </Button>
                }
              />
            ) : (
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-24">Dia</TableHead>
                    <TableHead className="text-center">Entrada</TableHead>
                    <TableHead className="text-center">Saída alm.</TableHead>
                    <TableHead className="text-center">Retorno</TableHead>
                    <TableHead className="text-center">Saída</TableHead>
                    <TableHead className="text-right">Trabalhado</TableHead>
                    <TableHead className="text-right">Extra</TableHead>
                    <TableHead className="text-right">Falta</TableHead>
                    <TableHead>Situação</TableHead>
                    {canEdit && <TableHead className="w-24"><span className="sr-only">Ações</span></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingMonth
                    ? [...Array(10)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={canEdit ? 10 : 9}><Skeleton className="h-5 w-full" /></TableCell>
                        </TableRow>
                      ))
                    : rows.map((row) => {
                        const { entry } = row
                        const typeBadge = entry ? DAY_TYPE_BADGE[entry.dayType] : null
                        const isPayroll = entry?.bankTreatment === 'payroll' && Boolean(entry.missingMinutes || entry.extraMinutes)
                        const restLabel = row.restDay === 'sunday' ? 'Domingo — folga' : 'Sábado livre'
                        return (
                          <TableRow
                            key={row.date}
                            className={cn(
                              'group',
                              row.restDay && !entry && 'bg-muted/40 text-muted-foreground hover:bg-muted/50',
                              row.isToday && 'bg-muted/70 hover:bg-muted'
                            )}
                          >
                            <TableCell className="py-2">
                              <div className="flex items-baseline gap-2">
                                <span className="w-5 text-right font-medium text-foreground">{String(row.day).padStart(2, '0')}</span>
                                <span className="w-7 text-xs text-muted-foreground">{row.weekday.slice(0, 3).toLowerCase()}</span>
                                {row.isToday && <span className="text-xs font-medium text-primary">hoje</span>}
                              </div>
                            </TableCell>

                            {row.restDay && !entry ? (
                              <TableCell colSpan={8} className="py-2 text-xs">{restLabel}</TableCell>
                            ) : (
                              <>
                                <TimeCell value={entry?.clockIn} />
                                <TimeCell value={entry?.lunchOut} />
                                <TimeCell value={entry?.lunchReturn} />
                                <TimeCell value={entry?.clockOut} />
                                <TableCell className="text-right">
                                  {entry?.workedMinutes ? minutesToTime(entry.workedMinutes) : <span className="text-muted-foreground/50">—</span>}
                                </TableCell>
                                <TableCell className="text-right text-success-soft-foreground">
                                  {entry?.extraMinutes ? `+${minutesToTime(entry.extraMinutes)}` : <span className="text-muted-foreground/50">—</span>}
                                </TableCell>
                                <TableCell className="text-right text-destructive-soft-foreground">
                                  {entry?.missingMinutes ? `\u2212${minutesToTime(entry.missingMinutes)}` : <span className="text-muted-foreground/50">—</span>}
                                </TableCell>
                                <TableCell className="max-w-[16rem]">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {row.restDay && entry && <span className="text-xs text-muted-foreground">{row.restDay === 'sunday' ? 'Domingo' : 'Sáb. livre'}</span>}
                                    {entry && typeBadge && (
                                      <span className={cn('text-[13px]', entry.dayType === 'absence' ? 'font-medium text-destructive-soft-foreground' : 'text-foreground')}>
                                        {DAY_TYPE_LABELS[entry.dayType]}
                                      </span>
                                    )}
                                    {isPayroll && (
                                      <SimpleTooltip label="Acertado na folha de pagamento — não entra no banco de horas">
                                        <Badge variant="outline" tabIndex={0}>Folha</Badge>
                                      </SimpleTooltip>
                                    )}
                                    {row.missingRecord && (
                                      <span className="inline-flex items-center gap-1.5 text-[13px] text-warning-soft-foreground">
                                        <span aria-hidden className="size-1.5 rounded-full bg-warning" />
                                        Sem registro
                                      </span>
                                    )}
                                    {entry?.notes && (
                                      <SimpleTooltip label={entry.notes}>
                                        <span tabIndex={0} className="inline-flex min-w-0 max-w-[10rem] items-center gap-1 text-xs text-muted-foreground">
                                          <StickyNote className="size-3 shrink-0" aria-hidden />
                                          <span className="truncate">{entry.notes}</span>
                                        </span>
                                      </SimpleTooltip>
                                    )}
                                  </div>
                                </TableCell>
                              </>
                            )}

                            {canEdit && (
                              <TableCell className="py-1 text-right">
                                <div className="flex justify-end gap-0.5">
                                  {row.restDay && !entry ? (
                                    <SimpleTooltip label="Lançar trabalho neste dia (conta como extra)">
                                      <Button variant="ghost" size="icon-xs" className="text-muted-foreground opacity-60 group-hover:opacity-100 focus-visible:opacity-100" onClick={() => setEditingDate(row.date)} aria-label={`Lançar dia ${row.day}`}>
                                        <Plus />
                                      </Button>
                                    </SimpleTooltip>
                                  ) : (
                                    <>
                                      <SimpleTooltip label={entry ? 'Editar' : 'Lançar'}>
                                        <Button variant="ghost" size="icon-xs" className="text-muted-foreground" onClick={() => setEditingDate(row.date)} aria-label={`${entry ? 'Editar' : 'Lançar'} dia ${row.day}`}>
                                          {entry ? <Pencil /> : <Plus />}
                                        </Button>
                                      </SimpleTooltip>
                                      {entry && (
                                        <SimpleTooltip label="Excluir lançamento">
                                          <Button variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-destructive-soft-foreground" onClick={() => setDeleteTarget(entry)} aria-label={`Excluir lançamento do dia ${row.day}`}>
                                            <Trash2 />
                                          </Button>
                                        </SimpleTooltip>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        )
                      })}
                </TableBody>
              </Table>
            )}
          </div>

          {!isEditorRole && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CircleAlert className="size-3.5" aria-hidden />
              Seu acesso é de visualização. Para lançar ponto, fale com um administrador.
            </p>
          )}

          {canEdit && editingRow && (
            <DayEditorDialog
              key={editingRow.date}
              open
              onOpenChange={(open) => !open && setEditingDate(null)}
              date={editingRow.date}
              restDay={editingRow.restDay}
              employee={selectedEmployee}
              entry={editingRow.entry}
              monthEntries={entries}
              previousMonthAccumulated={previousMonthAccumulated}
              currentMonthAdjustment={currentMonthAdjustment}
              absenceDefault={absenceDefault}
              onRequestDelete={setDeleteTarget}
            />
          )}

          <ConfirmDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            title="Excluir lançamento?"
            description={
              deleteTarget
                ? `O registro de ${deleteTarget.entryDate.split('-').reverse().join('/')} será removido e os totais do mês recalculados.`
                : undefined
            }
            confirmLabel="Excluir"
            destructive
            onConfirm={() => {
              if (deleteTarget) deleteMutation.mutate(deleteTarget)
              setDeleteTarget(null)
            }}
          />

          <p className="text-xs text-muted-foreground">
            Para gerar a folha em PDF, acesse{' '}
            <Link to="/reports" className="font-medium text-primary underline-offset-4 hover:underline">Relatórios</Link>.
          </p>
        </>
      )}
    </div>
  )
}
