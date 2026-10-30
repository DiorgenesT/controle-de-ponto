import type { DailyCalculation, TimeEntry, Employee, SaturdayMode, DayType, BankTreatment } from './types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MINUTES_PER_HOUR = 60
const SATURDAY_EXPECTED_MINUTES_FALLBACK = 4 * MINUTES_PER_HOUR  // fallback when times not configured

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Converts 'HH:MM' to total minutes from midnight */
export function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number)
  return (parts[0] ?? 0) * MINUTES_PER_HOUR + (parts[1] ?? 0)
}

/** Converts total minutes to 'HH:MM' string */
export function minutesToTime(totalMinutes: number): string {
  const abs = Math.abs(totalMinutes)
  const h = Math.floor(abs / MINUTES_PER_HOUR)
  const m = abs % MINUTES_PER_HOUR
  const sign = totalMinutes < 0 ? '-' : ''
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Returns the weekday name (pt-BR) for a ISO date string */
export function getDayOfWeek(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`)
  const days = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO']
  return days[date.getDay()] ?? 'DOMINGO'
}

/** Returns true if the ISO date falls on a Saturday */
export function isSaturday(dateStr: string): boolean {
  return new Date(`${dateStr}T12:00:00`).getDay() === 6
}

/** Returns true if the ISO date falls on a Sunday */
export function isSunday(dateStr: string): boolean {
  return new Date(`${dateStr}T12:00:00`).getDay() === 0
}

/**
 * Returns true if the Saturday on `dateStr` is a working day for the given mode.
 * 'first_two' = only the 1st and 2nd Saturday of the month.
 */
export function isWorkingSaturday(dateStr: string, mode: SaturdayMode): boolean {
  if (!isSaturday(dateStr)) return false
  if (mode === 'none') return false
  if (mode === 'all') return true
  const dayOfMonth = new Date(`${dateStr}T12:00:00`).getDate()
  return Math.ceil(dayOfMonth / 7) <= 2
}

// ─── Core Calculation ─────────────────────────────────────────────────────────

/**
 * Calculates worked minutes, extra and missing for a single day.
 *
 * Business rules:
 *   closed / vacation  → 0 for everything (company-side, no debit)
 *   absence            → missing = expected daily hours (employee no-show)
 *   medical            → worked = expected (certificate covers the day; no debit, no credit)
 *   holiday            → expected = 0; any hours worked count entirely as extra
 *   worked             → normal calculation with ±tolerance window
 *   sunday             → rest day: expected = 0; hours worked (if any) count entirely as extra
 */
export function calculateDay(
  entry: Pick<TimeEntry, 'clockIn' | 'lunchOut' | 'lunchReturn' | 'clockOut' | 'dayType' | 'entryDate'>,
  employee: Pick<Employee, 'toleranceMinutes' | 'dailyHoursExpected' | 'saturdayMode' | 'saturdayStart' | 'saturdayEnd'>
): DailyCalculation {
  if (isSunday(entry.entryDate)) {
    const workedOnSunday = (entry.dayType === 'worked' || entry.dayType === 'holiday') && entry.clockIn && entry.clockOut
    if (!workedOnSunday) {
      return { workedMinutes: 0, expectedMinutes: 0, extraMinutes: 0, missingMinutes: 0, isComplete: false }
    }
    const worked = computeWorked(entry.clockIn!, entry.clockOut!, entry.lunchOut, entry.lunchReturn)
    return { workedMinutes: worked, expectedMinutes: 0, extraMinutes: worked, missingMinutes: 0, isComplete: true }
  }

  const isSat = isSaturday(entry.entryDate)
  const saturdayExpectedMinutes = employee.saturdayStart && employee.saturdayEnd
    ? Math.max(0, timeToMinutes(employee.saturdayEnd) - timeToMinutes(employee.saturdayStart))
    : SATURDAY_EXPECTED_MINUTES_FALLBACK
  const expectedMinutes = isSat
    ? (isWorkingSaturday(entry.entryDate, employee.saturdayMode) ? saturdayExpectedMinutes : 0)
    : Math.round(employee.dailyHoursExpected * MINUTES_PER_HOUR)

  // Company closed or on vacation — neutral, no debit or credit
  if (entry.dayType === 'closed' || entry.dayType === 'vacation') {
    return { workedMinutes: 0, expectedMinutes: 0, extraMinutes: 0, missingMinutes: 0, isComplete: false }
  }

  // Absence — full expected hours are debited as missing
  if (entry.dayType === 'absence') {
    return { workedMinutes: 0, expectedMinutes, extraMinutes: 0, missingMinutes: expectedMinutes, isComplete: false }
  }

  // Banco de horas — day off compensated by previously banked extra hours; debits the balance
  if (entry.dayType === 'banco_horas') {
    return { workedMinutes: 0, expectedMinutes, extraMinutes: 0, missingMinutes: expectedMinutes, isComplete: false }
  }

  // Medical certificate — justified absence; treated as full day worked for the hour bank
  if (entry.dayType === 'medical') {
    return { workedMinutes: expectedMinutes, expectedMinutes, extraMinutes: 0, missingMinutes: 0, isComplete: true }
  }

  // Holiday — not required to work (expected = 0); every minute worked is extra
  if (entry.dayType === 'holiday') {
    if (!entry.clockIn || !entry.clockOut) {
      return { workedMinutes: 0, expectedMinutes: 0, extraMinutes: 0, missingMinutes: 0, isComplete: false }
    }
    const worked = computeWorked(entry.clockIn, entry.clockOut, entry.lunchOut, entry.lunchReturn)
    return { workedMinutes: worked, expectedMinutes: 0, extraMinutes: worked, missingMinutes: 0, isComplete: true }
  }

  // Worked — normal calculation with tolerance window
  if (!entry.clockIn || !entry.clockOut) {
    return { workedMinutes: 0, expectedMinutes, extraMinutes: 0, missingMinutes: expectedMinutes, isComplete: false }
  }

  const workedMinutes = computeWorked(entry.clockIn, entry.clockOut, entry.lunchOut, entry.lunchReturn)
  const diff = workedMinutes - expectedMinutes
  const { toleranceMinutes } = employee

  let extraMinutes = 0
  let missingMinutes = 0
  if (Math.abs(diff) > toleranceMinutes) {
    if (diff > 0) extraMinutes = diff
    else missingMinutes = Math.abs(diff)
  }

  return { workedMinutes, expectedMinutes, extraMinutes, missingMinutes, isComplete: true }
}

function computeWorked(
  clockIn: string,
  clockOut: string,
  lunchOut: string | null | undefined,
  lunchReturn: string | null | undefined
): number {
  const totalMins = timeToMinutes(clockOut) - timeToMinutes(clockIn)
  const lunchMins =
    lunchOut && lunchReturn
      ? Math.max(0, timeToMinutes(lunchReturn) - timeToMinutes(lunchOut))
      : 0
  return Math.max(0, totalMins - lunchMins)
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

export interface MonthlySummary {
  totalWorkedMinutes: number
  totalExtraMinutes: number
  totalMissingMinutes: number
  payrollExtraMinutes: number
  payrollMissingMinutes: number
  balanceMinutes: number  // hour-bank balance: extra - missing of 'bank' entries only
}

/** Hour-bank contribution of one entry; payroll-settled entries contribute nothing */
export function entryBankBalance(
  e: Pick<TimeEntry, 'extraMinutes' | 'missingMinutes' | 'bankTreatment'>
): number {
  if (e.bankTreatment === 'payroll') return 0
  return (e.extraMinutes ?? 0) - (e.missingMinutes ?? 0)
}

export function calculateMonthlySummary(
  entries: Pick<TimeEntry, 'extraMinutes' | 'missingMinutes' | 'workedMinutes' | 'bankTreatment'>[]
): MonthlySummary {
  let totalWorkedMinutes = 0
  let totalExtraMinutes = 0
  let totalMissingMinutes = 0
  let payrollExtraMinutes = 0
  let payrollMissingMinutes = 0
  let balanceMinutes = 0

  for (const e of entries) {
    totalWorkedMinutes += e.workedMinutes ?? 0
    totalExtraMinutes += e.extraMinutes ?? 0
    totalMissingMinutes += e.missingMinutes ?? 0
    if (e.bankTreatment === 'payroll') {
      payrollExtraMinutes += e.extraMinutes ?? 0
      payrollMissingMinutes += e.missingMinutes ?? 0
    }
    balanceMinutes += entryBankBalance(e)
  }

  return {
    totalWorkedMinutes,
    totalExtraMinutes,
    totalMissingMinutes,
    payrollExtraMinutes,
    payrollMissingMinutes,
    balanceMinutes,
  }
}

// ─── Hour-bank treatment ──────────────────────────────────────────────────────

/**
 * Decides where a day's extra/missing minutes are settled.
 * 'banco_horas' days always debit the bank (that is their purpose). Otherwise an
 * explicit choice from admin/manager wins; else the stored choice is kept while
 * the day type is unchanged; else absences get the company default and everything
 * else goes to the bank.
 */
export function resolveBankTreatment(params: {
  dayType: DayType
  requested: BankTreatment | undefined
  canDecide: boolean
  existing: { dayType: DayType; bankTreatment: BankTreatment } | null
  absenceDefault: BankTreatment
}): BankTreatment {
  const { dayType, requested, canDecide, existing, absenceDefault } = params
  if (dayType === 'banco_horas') return 'bank'
  if (requested && canDecide) return requested
  if (existing && existing.dayType === dayType) return existing.bankTreatment
  return dayType === 'absence' ? absenceDefault : 'bank'
}
