import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CircleAlert, Info, Trash2, Wand2 } from 'lucide-react'
import { calculateDay, entryBankBalance, minutesToTime, timeToMinutes, upsertTimeEntrySchema } from '@ponto/shared'
import type { BankTreatment, DayType, Employee, TimeEntry } from '@ponto/shared'
import { ApiError, timeEntriesApi } from '@/lib/api'
import {
  BANK_TREATMENT_LABELS,
  DAY_TYPE_LABELS,
  TIME_FIELD_LABELS,
  TIME_FIELDS,
  TIMED_DAY_TYPES,
  invalidateEntryData,
  signedTime,
  type TimeField,
} from '@/lib/timesheet'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { FormField } from '@/components/ui/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DayForm {
  clockIn: string
  lunchOut: string
  lunchReturn: string
  clockOut: string
  dayType: DayType
  notes: string
  /** '' = not chosen yet → the select shows the default for the day type */
  bankTreatment: BankTreatment | ''
}

type Errors = Partial<Record<keyof DayForm | 'form', string>>

export interface DayEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: string
  /** 'sunday' | 'free_saturday' when the day is not part of the schedule */
  restDay: 'sunday' | 'free_saturday' | null
  employee: Employee
  entry?: TimeEntry
  /** All entries of the month (for the "saldo insuficiente" check) */
  monthEntries: TimeEntry[]
  previousMonthAccumulated: number
  currentMonthAdjustment: number
  absenceDefault: BankTreatment
  onRequestDelete?: (entry: TimeEntry) => void
}

function initialForm(entry?: TimeEntry): DayForm {
  return {
    clockIn: entry?.clockIn ?? '',
    lunchOut: entry?.lunchOut ?? '',
    lunchReturn: entry?.lunchReturn ?? '',
    clockOut: entry?.clockOut ?? '',
    dayType: entry?.dayType ?? 'worked',
    notes: entry?.notes ?? '',
    bankTreatment: entry?.bankTreatment ?? '',
  }
}

function addMinutes(time: string, minutes: number) {
  const total = timeToMinutes(time) + minutes
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function DayEditorDialog({
  open,
  onOpenChange,
  date,
  restDay,
  employee,
  entry,
  monthEntries,
  previousMonthAccumulated,
  currentMonthAdjustment,
  absenceDefault,
  onRequestDelete,
}: DayEditorDialogProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<DayForm>(() => initialForm(entry))
  const [errors, setErrors] = useState<Errors>({})

  const isSaturday = new Date(`${date}T12:00:00`).getDay() === 6
  const timesApply = TIMED_DAY_TYPES.has(form.dayType)

  function update<K extends keyof DayForm>(key: K, value: DayForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }))
  }

  const preview = useMemo(
    () =>
      calculateDay(
        {
          clockIn: timesApply ? form.clockIn || null : null,
          lunchOut: timesApply ? form.lunchOut || null : null,
          lunchReturn: timesApply ? form.lunchReturn || null : null,
          clockOut: timesApply ? form.clockOut || null : null,
          dayType: form.dayType,
          entryDate: date,
        },
        employee
      ),
    [form, timesApply, date, employee]
  )

  const defaultTreatment: BankTreatment = form.dayType === 'absence' ? absenceDefault : 'bank'
  const showTreatment = form.dayType !== 'banco_horas' && (preview.extraMinutes > 0 || preview.missingMinutes > 0)
  // What the select shows is exactly what gets saved
  const displayedTreatment: BankTreatment = form.bankTreatment || defaultTreatment

  const bankWarning = useMemo(() => {
    if (form.dayType !== 'banco_horas') return null
    const others = monthEntries.filter((e) => e.entryDate !== date).reduce((s, e) => s + entryBankBalance(e), 0)
    const available = previousMonthAccumulated + currentMonthAdjustment + others
    const consumption = preview.missingMinutes
    return available < consumption ? { available, consumption, after: available - consumption } : null
  }, [form.dayType, monthEntries, date, previousMonthAccumulated, currentMonthAdjustment, preview.missingMinutes])

  // Standard schedule exists only on scheduled days
  const standard = useMemo(() => {
    if (restDay) return null
    if (isSaturday) {
      return employee.saturdayStart && employee.saturdayEnd
        ? { clockIn: employee.saturdayStart, clockOut: employee.saturdayEnd, lunchOut: '', lunchReturn: '' }
        : null
    }
    const span = timeToMinutes(employee.weekdayEnd) - timeToMinutes(employee.weekdayStart)
    const lunch = Math.max(0, span - Math.round(employee.dailyHoursExpected * 60))
    return {
      clockIn: employee.weekdayStart,
      clockOut: employee.weekdayEnd,
      lunchOut: lunch > 0 ? '12:00' : '',
      lunchReturn: lunch > 0 ? addMinutes('12:00', lunch) : '',
    }
  }, [restDay, isSaturday, employee])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => timeEntriesApi.upsert(payload),
    onSuccess: (_data, variables) => {
      const [y, m] = String(variables.entryDate).split('-').map(Number)
      invalidateEntryData(queryClient, employee.id, y, m)
      toast({ title: 'Registro salvo', description: format(new Date(`${date}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR }), variant: 'success' })
      onOpenChange(false)
    },
    onError: (err: Error) => {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        const next: Errors = {}
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          if (messages?.[0]) next[(field in form ? field : 'form') as keyof Errors] = messages[0]
        }
        setErrors(next)
      } else {
        setErrors({ form: err.message })
      }
      toast({ title: 'Não foi possível salvar', description: err.message, variant: 'destructive' })
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      employeeId: employee.id,
      entryDate: date,
      clockIn: timesApply ? form.clockIn || null : null,
      lunchOut: timesApply ? form.lunchOut || null : null,
      lunchReturn: timesApply ? form.lunchReturn || null : null,
      clockOut: timesApply ? form.clockOut || null : null,
      dayType: form.dayType,
      notes: form.notes.trim() || null,
      ...(showTreatment ? { bankTreatment: displayedTreatment } : {}),
    }

    // Same rules the API enforces, checked before the round-trip
    const parsed = upsertTimeEntrySchema.safeParse(payload)
    if (!parsed.success) {
      const next: Errors = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        const field = (key in form ? key : 'form') as keyof Errors
        next[field] ??= issue.message
      }
      setErrors(next)
      return
    }
    mutation.mutate(payload)
  }

  const title = format(new Date(`${date}T12:00:00`), "EEEE, d 'de' MMMM", { locale: ptBR })
  const timeError = TIME_FIELDS.map((f) => errors[f]).find(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="first-letter:uppercase">{title}</DialogTitle>
          <DialogDescription>
            {employee.name}
            {restDay === 'sunday' && ' · Domingo (folga) — horas trabalhadas contam como extra'}
            {restDay === 'free_saturday' && ' · Sábado livre — horas trabalhadas contam como extra'}
          </DialogDescription>
        </DialogHeader>

        <form id="day-editor-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
          <FormField label="Tipo do dia" htmlFor="dayType" error={errors.dayType}>
            <NativeSelect
              id="dayType"
              value={form.dayType}
              onChange={(e) => {
                update('dayType', e.target.value as DayType)
                update('bankTreatment', '')
              }}
            >
              {(Object.entries(DAY_TYPE_LABELS) as [DayType, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </NativeSelect>
          </FormField>

          {timesApply ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium text-foreground">Horários</p>
                {standard && form.dayType === 'worked' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground"
                    onClick={() => {
                      setForm((prev) => ({ ...prev, ...standard }))
                      setErrors({})
                    }}
                  >
                    <Wand2 />
                    Preencher jornada padrão
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {TIME_FIELDS.map((field: TimeField, i) => (
                  <div key={field} className="space-y-1">
                    <label htmlFor={field} className="text-xs text-muted-foreground">
                      {TIME_FIELD_LABELS[field]}
                    </label>
                    <Input
                      id={field}
                      type="time"
                      autoFocus={i === 0}
                      value={form[field]}
                      aria-invalid={!!errors[field]}
                      onChange={(e) => update(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              {timeError && (
                <p role="alert" className="text-xs font-medium text-destructive-soft-foreground">{timeError}</p>
              )}
            </div>
          ) : (
            <p className="flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-px size-3.5 shrink-0" aria-hidden />
              {form.dayType === 'medical'
                ? 'Atestado abona o dia inteiro: não é preciso informar horários.'
                : 'Horários não se aplicam a este tipo de dia.'}
            </p>
          )}

          {/* Live calculation */}
          <div className="grid grid-cols-3 divide-x overflow-hidden rounded-md border text-center tabular-nums">
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Trabalhado</p>
              <p className="text-sm font-semibold">{minutesToTime(preview.workedMinutes)}</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Extra</p>
              <p className={cn('text-sm font-semibold', preview.extraMinutes > 0 ? 'text-success-soft-foreground' : 'text-muted-foreground')}>
                {preview.extraMinutes > 0 ? signedTime(preview.extraMinutes) : '—'}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">Falta</p>
              <p className={cn('text-sm font-semibold', preview.missingMinutes > 0 ? 'text-destructive-soft-foreground' : 'text-muted-foreground')}>
                {preview.missingMinutes > 0 ? signedTime(-preview.missingMinutes) : '—'}
              </p>
            </div>
          </div>

          {showTreatment && (
            <FormField
              label="Onde acertar as horas deste dia"
              htmlFor="bankTreatment"
              error={errors.bankTreatment}
              hint="Banco de horas soma/desconta no saldo. Folha: falta descontada ou extra paga no salário (não entra no banco)."
            >
              <NativeSelect
                id="bankTreatment"
                value={displayedTreatment}
                onChange={(e) => update('bankTreatment', e.target.value as BankTreatment)}
              >
                {(Object.entries(BANK_TREATMENT_LABELS) as [BankTreatment, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </NativeSelect>
            </FormField>
          )}

          {bankWarning && (
            <Alert variant="warning">
              <CircleAlert />
              <AlertDescription>
                Saldo insuficiente: disponível <strong className="tabular-nums">{signedTime(bankWarning.available)}</strong>, este dia
                consome <strong className="tabular-nums">{minutesToTime(bankWarning.consumption)}</strong>. O saldo ficará{' '}
                <strong className="tabular-nums">{signedTime(bankWarning.after)}</strong>.
              </AlertDescription>
            </Alert>
          )}

          <FormField label="Observação" htmlFor="notes" error={errors.notes} hint="Aparece na coluna OBS. da folha de ponto.">
            <Textarea
              id="notes"
              rows={2}
              maxLength={500}
              placeholder="Ex.: saiu mais cedo para consulta"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </FormField>

          {errors.form && (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>{errors.form}</AlertDescription>
            </Alert>
          )}
        </form>

        <DialogFooter className="sm:justify-between">
          {entry && onRequestDelete ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive-soft-foreground hover:bg-accent hover:text-destructive-soft-foreground"
              onClick={() => onRequestDelete(entry)}
            >
              <Trash2 />
              Excluir lançamento
            </Button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="day-editor-form" loading={mutation.isPending}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
