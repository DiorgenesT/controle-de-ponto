import type { QueryClient } from '@tanstack/react-query'
import type { BankTreatment, DayType, TimeEntry } from '@ponto/shared'
import { minutesToTime } from '@ponto/shared'

export const DAY_TYPE_LABELS: Record<DayType, string> = {
  worked: 'Dia trabalhado',
  closed: 'Empresa fechada',
  holiday: 'Feriado',
  absence: 'Falta',
  vacation: 'Férias',
  medical: 'Atestado',
  banco_horas: 'Folga (banco de horas)',
}

export const DAY_TYPE_BADGE: Record<DayType, 'muted' | 'primary' | 'destructive' | 'special' | 'info' | 'warning' | null> = {
  worked: null,
  closed: 'muted',
  holiday: 'primary',
  absence: 'destructive',
  vacation: 'special',
  medical: 'info',
  banco_horas: 'warning',
}

export const BANK_TREATMENT_LABELS: Record<BankTreatment, string> = {
  bank: 'Banco de horas',
  payroll: 'Folha de pagamento',
}

/** Day types whose clock times are used by the calculation; for the others times are ignored. */
export const TIMED_DAY_TYPES: ReadonlySet<DayType> = new Set<DayType>(['worked', 'holiday'])

export const TIME_FIELDS = ['clockIn', 'lunchOut', 'lunchReturn', 'clockOut'] as const
export type TimeField = (typeof TIME_FIELDS)[number]

export const TIME_FIELD_LABELS: Record<TimeField, string> = {
  clockIn: 'Entrada',
  lunchOut: 'Saída almoço',
  lunchReturn: 'Retorno almoço',
  clockOut: 'Saída',
}

/** '+01:30', '-00:45' or '00:00'. */
export function signedTime(minutes: number) {
  if (minutes === 0) return '00:00'
  return minutes > 0 ? `+${minutesToTime(minutes)}` : minutesToTime(minutes)
}

export function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Desc. em folha" / "Pago em folha" when the day was settled in payroll. */
export function payrollLabel(e: Pick<TimeEntry, 'bankTreatment' | 'missingMinutes' | 'extraMinutes'>) {
  if (e.bankTreatment !== 'payroll') return ''
  if (e.missingMinutes) return 'Desc. em folha'
  if (e.extraMinutes) return 'Pago em folha'
  return ''
}

/**
 * Everything derived from time entries: the month grid, monthly reports (and the
 * accumulated balance of later months) and the dashboard.
 */
export function invalidateEntryData(queryClient: QueryClient, employeeId: string, year?: number, month?: number) {
  queryClient.invalidateQueries({
    queryKey: year && month ? ['timeentries', employeeId, year, month] : ['timeentries', employeeId],
  })
  queryClient.invalidateQueries({ queryKey: ['reports'] })
  queryClient.invalidateQueries({ queryKey: ['dashboard'] })
}
