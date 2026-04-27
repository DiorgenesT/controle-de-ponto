import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, getDaysInMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { employeesApi, timeEntriesApi } from '@/lib/api'
import { calculateDay, getDayOfWeek, isSunday, isWorkingSaturday, minutesToTime } from '@ponto/shared'
import type { Employee, TimeEntry, DayType } from '@ponto/shared'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Save, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

const DAY_TYPE_LABELS: Record<DayType, string> = {
  worked:  'Dia Trabalhado',
  closed:  'Empresa Fechada',
  holiday: 'Feriado',
  absence: 'Falta',
  vacation:'Férias',
  medical: 'Atestado',
}

interface DayRow {
  day: number
  date: string
  dayOfWeek: string
  isSunday: boolean
  isFreeSaturday: boolean
  entry?: TimeEntry
}

export function TimesheetPage() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const [selectedEmployeeId, setSelectedEmployeeId] = useState(searchParams.get('employee') ?? '')
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1)
  const [editingDay, setEditingDay] = useState<string | null>(null)
  const [formData, setFormData] = useState<Record<string, { clockIn: string; lunchOut: string; lunchReturn: string; clockOut: string; dayType: DayType; notes: string }>>({})

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.list(),
  })

  const employees = (employeesData?.data ?? []) as Employee[]
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId)

  const { data: entriesData } = useQuery({
    queryKey: ['timeentries', selectedEmployeeId, currentYear, currentMonth],
    queryFn: () => timeEntriesApi.list(selectedEmployeeId, currentYear, currentMonth),
    enabled: Boolean(selectedEmployeeId),
  })

  const entries = (entriesData?.data ?? []) as TimeEntry[]

  const upsertMutation = useMutation({
    mutationFn: (data: unknown) => timeEntriesApi.upsert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeentries', selectedEmployeeId, currentYear, currentMonth] })
      toast({ title: 'Registro salvo!', variant: 'success' })
      setEditingDay(null)
    },
    onError: (err: Error) => toast({ title: err.message, variant: 'destructive' }),
  })

  // Build calendar rows
  const daysInMonth = getDaysInMonth(new Date(currentYear, currentMonth - 1))
  const rows: DayRow[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const isFreeSaturday = Boolean(
      selectedEmployee &&
      getDayOfWeek(date) === 'SÁBADO' &&
      !isWorkingSaturday(date, selectedEmployee.saturdayMode)
    )
    return {
      day,
      date,
      dayOfWeek: getDayOfWeek(date),
      isSunday: isSunday(date),
      isFreeSaturday,
      entry: entries.find((e) => e.entryDate === date),
    }
  })

  function startEdit(row: DayRow) {
    if (row.isSunday || row.isFreeSaturday) return
    setEditingDay(row.date)
    setFormData((prev) => ({
      ...prev,
      [row.date]: {
        clockIn: row.entry?.clockIn ?? '',
        lunchOut: row.entry?.lunchOut ?? '',
        lunchReturn: row.entry?.lunchReturn ?? '',
        clockOut: row.entry?.clockOut ?? '',
        dayType: row.entry?.dayType ?? 'worked',
        notes: row.entry?.notes ?? '',
      },
    }))
  }

  function saveDay(date: string) {
    const fd = formData[date]
    if (!fd || !selectedEmployee) return
    upsertMutation.mutate({
      employeeId: selectedEmployee.id,
      entryDate: date,
      clockIn: fd.clockIn || null,
      lunchOut: fd.lunchOut || null,
      lunchReturn: fd.lunchReturn || null,
      clockOut: fd.clockOut || null,
      dayType: fd.dayType,
      notes: fd.notes || null,
    })
  }

  function navigate(dir: -1 | 1) {
    let y = currentYear
    let m = currentMonth + dir
    if (m < 1) { m = 12; y-- }
    if (m > 12) { m = 1; y++ }
    setCurrentYear(y)
    setCurrentMonth(m)
    setEditingDay(null)
  }

  // Monthly totals
  const totalExtra = entries.reduce((s, e) => s + (e.extraMinutes ?? 0), 0)
  const totalMissing = entries.reduce((s, e) => s + (e.missingMinutes ?? 0), 0)
  const balance = totalExtra - totalMissing

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Lançamento de Ponto</h1>
        <p className="text-muted-foreground">Insira os horários manualmente</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
        >
          <option value="">Selecione um funcionário</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize min-w-28 text-center">
            {format(new Date(currentYear, currentMonth - 1), 'MMMM yyyy', { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!selectedEmployee ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Selecione um funcionário para lançar o ponto</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{selectedEmployee.name}</Badge>
            <Badge variant="secondary">{selectedEmployee.weekdayStart}–{selectedEmployee.weekdayEnd}</Badge>
            <Badge variant={balance >= 0 ? 'success' : 'destructive'}>
              Saldo: {balance >= 0 ? '+' : ''}{minutesToTime(balance)}
            </Badge>
            {totalExtra > 0 && <Badge variant="outline" className="text-success">Extra: {minutesToTime(totalExtra)}</Badge>}
            {totalMissing > 0 && <Badge variant="outline" className="text-destructive">Falta: -{minutesToTime(totalMissing)}</Badge>}
          </div>

          {/* Timesheet table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base capitalize">
                {format(new Date(currentYear, currentMonth - 1), 'MMMM yyyy', { locale: ptBR })} — {selectedEmployee.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground w-12">Dia</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground w-24">Semana</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entrada</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Saída Alm.</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Retorno</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Saída</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">H. Trab.</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Extra</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Falta</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const isEditing = editingDay === row.date
                      const fd = formData[row.date]

                      // Preview calculation while editing
                      const preview = isEditing && fd && selectedEmployee
                        ? calculateDay(
                            { clockIn: fd.clockIn || null, lunchOut: fd.lunchOut || null, lunchReturn: fd.lunchReturn || null, clockOut: fd.clockOut || null, dayType: fd.dayType, entryDate: row.date },
                            selectedEmployee
                          )
                        : null

                      return (
                        <tr
                          key={row.date}
                          className={cn(
                            'border-b transition-colors',
                            (row.isSunday || row.isFreeSaturday) ? 'bg-muted/30 text-muted-foreground' : 'hover:bg-muted/20',
                            row.dayOfWeek === 'SÁBADO' && !row.isFreeSaturday && 'bg-blue-50/50',
                            isEditing && 'bg-primary/5 ring-1 ring-inset ring-primary/20'
                          )}
                        >
                          <td className="px-4 py-2 font-mono font-medium">{row.day}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{row.dayOfWeek}</td>

                          {row.isSunday ? (
                            <td colSpan={7} className="px-4 py-2 text-xs text-muted-foreground italic">Domingo — Folga</td>
                          ) : row.isFreeSaturday ? (
                            <td colSpan={7} className="px-4 py-2 text-xs text-muted-foreground italic">Sábado livre — não trabalha</td>
                          ) : isEditing ? (
                            <>
                              {(['clockIn', 'lunchOut', 'lunchReturn', 'clockOut'] as const).map((field) => (
                                <td key={field} className="px-2 py-1">
                                  <Input
                                    type="time"
                                    className="h-7 w-24 text-xs"
                                    value={fd[field] ?? ''}
                                    onChange={(e) => setFormData((prev) => ({ ...prev, [row.date]: { ...prev[row.date]!, [field]: e.target.value } }))}
                                  />
                                </td>
                              ))}
                              <td className="px-2 py-1 font-mono text-xs">{preview ? minutesToTime(preview.workedMinutes) : '—'}</td>
                              <td className="px-2 py-1 font-mono text-xs text-success">{preview && preview.extraMinutes > 0 ? '+' + minutesToTime(preview.extraMinutes) : '—'}</td>
                              <td className="px-2 py-1 font-mono text-xs text-destructive">{preview && preview.missingMinutes > 0 ? '-' + minutesToTime(preview.missingMinutes) : '—'}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2 font-mono text-xs">{row.entry?.clockIn ?? '—'}</td>
                              <td className="px-4 py-2 font-mono text-xs">{row.entry?.lunchOut ?? '—'}</td>
                              <td className="px-4 py-2 font-mono text-xs">{row.entry?.lunchReturn ?? '—'}</td>
                              <td className="px-4 py-2 font-mono text-xs">{row.entry?.clockOut ?? '—'}</td>
                              <td className="px-4 py-2 font-mono text-xs">{row.entry?.workedMinutes != null ? minutesToTime(row.entry.workedMinutes) : '—'}</td>
                              <td className="px-4 py-2 font-mono text-xs text-success">
                                {row.entry?.extraMinutes ? '+' + minutesToTime(row.entry.extraMinutes) : '—'}
                              </td>
                              <td className="px-4 py-2 font-mono text-xs text-destructive">
                                {row.entry?.missingMinutes ? '-' + minutesToTime(row.entry.missingMinutes) : '—'}
                              </td>
                            </>
                          )}

                          {/* Day type */}
                          <td className="px-2 py-1">
                            {isEditing ? (
                              <select
                                className="h-7 rounded border border-input bg-background px-1 text-xs"
                                value={fd.dayType}
                                onChange={(e) => {
                                  const newType = e.target.value as DayType
                                  setFormData((prev) => {
                                    const current = prev[row.date]!
                                    // Atestado: preenche horários padrão automaticamente
                                    if (newType === 'medical' && selectedEmployee) {
                                      const isSat = row.dayOfWeek === 'SÁBADO'
                                      return {
                                        ...prev,
                                        [row.date]: {
                                          ...current,
                                          dayType: newType,
                                          clockIn: isSat ? (selectedEmployee.saturdayStart ?? '') : selectedEmployee.weekdayStart,
                                          lunchOut: isSat ? '' : '12:00',
                                          lunchReturn: isSat ? '' : '13:00',
                                          clockOut: isSat ? (selectedEmployee.saturdayEnd ?? '') : selectedEmployee.weekdayEnd,
                                        },
                                      }
                                    }
                                    return { ...prev, [row.date]: { ...current, dayType: newType } }
                                  })
                                }}
                              >
                                {Object.entries(DAY_TYPE_LABELS).map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {row.entry ? DAY_TYPE_LABELS[row.entry.dayType] : '—'}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-2 py-1">
                            {!row.isSunday && !row.isFreeSaturday && (
                              isEditing ? (
                                <div className="flex gap-1">
                                  <Button size="sm" className="h-7 text-xs px-2" onClick={() => saveDay(row.date)} disabled={upsertMutation.isPending}>
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingDay(null)}>
                                    ✕
                                  </Button>
                                </div>
                              ) : (
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => startEdit(row)}>
                                  Editar
                                </Button>
                              )
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
