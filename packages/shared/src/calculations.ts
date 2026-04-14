import type { DailyCalculation, TimeEntry, Employee } from './types'

// ─── Constants ────────────────────────────────────────────────────────────────

const MINUTES_PER_HOUR = 60
const SATURDAY_EXPECTED_MINUTES = 4 * MINUTES_PER_HOUR  // 4h

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

// ─── Core Calculation ─────────────────────────────────────────────────────────

/**
 * Calculates worked minutes, extra and missing for a single day.
 *
 * Business rules:
 * 1. worked = (clockOut - clockIn) - lunchBreak
 * 2. lunchBreak = lunchReturn - lunchOut  (0 if not set)
 * 3. diff = worked - expected
 * 4. |diff| <= tolerance → extra=0, missing=0
 * 5. diff > tolerance → extra = diff
 * 6. diff < -tolerance → missing = |diff|
 * 7. closed/holiday/vacation/absence → no extra, no missing (workedMinutes=0)
 */
export function calculateDay(
  entry: Pick<TimeEntry, 'clockIn' | 'lunchOut' | 'lunchReturn' | 'clockOut' | 'dayType' | 'entryDate'>,
  employee: Pick<Employee, 'toleranceMinutes' | 'dailyHoursExpected' | 'worksSaturday'>
): DailyCalculation {
  // Atestado não debita falta nem computa extra (equiparado a dia trabalhado para fins de banco)
  const NON_WORKING_TYPES = ['closed', 'holiday', 'vacation', 'absence', 'medical'] as const

  if (NON_WORKING_TYPES.includes(entry.dayType as typeof NON_WORKING_TYPES[number])) {
    return { workedMinutes: 0, expectedMinutes: 0, extraMinutes: 0, missingMinutes: 0, isComplete: false }
  }

  if (isSunday(entry.entryDate)) {
    return { workedMinutes: 0, expectedMinutes: 0, extraMinutes: 0, missingMinutes: 0, isComplete: false }
  }

  const saturdayDay = isSaturday(entry.entryDate)
  const expectedMinutes = saturdayDay
    ? (employee.worksSaturday ? SATURDAY_EXPECTED_MINUTES : 0)
    : employee.dailyHoursExpected * MINUTES_PER_HOUR

  // Not enough data to compute
  if (!entry.clockIn || !entry.clockOut) {
    // Only compute missing if this is a working day with no entries
    const missing = expectedMinutes > 0 ? expectedMinutes : 0
    return {
      workedMinutes: 0,
      expectedMinutes,
      extraMinutes: 0,
      missingMinutes: missing,
      isComplete: false,
    }
  }

  const clockInMins = timeToMinutes(entry.clockIn)
  const clockOutMins = timeToMinutes(entry.clockOut)

  let lunchBreakMins = 0
  if (entry.lunchOut && entry.lunchReturn) {
    lunchBreakMins = Math.max(0, timeToMinutes(entry.lunchReturn) - timeToMinutes(entry.lunchOut))
  }

  const workedMinutes = Math.max(0, clockOutMins - clockInMins - lunchBreakMins)
  const diff = workedMinutes - expectedMinutes
  const tolerance = employee.toleranceMinutes

  let extraMinutes = 0
  let missingMinutes = 0

  if (Math.abs(diff) > tolerance) {
    if (diff > 0) {
      extraMinutes = diff
    } else {
      missingMinutes = Math.abs(diff)
    }
  }

  return {
    workedMinutes,
    expectedMinutes,
    extraMinutes,
    missingMinutes,
    isComplete: true,
  }
}

// ─── Monthly Summary ──────────────────────────────────────────────────────────

export interface MonthlySummary {
  totalWorkedMinutes: number
  totalExtraMinutes: number
  totalMissingMinutes: number
  balanceMinutes: number  // extra - missing
}

export function calculateMonthlySummary(
  entries: Pick<TimeEntry, 'extraMinutes' | 'missingMinutes' | 'workedMinutes'>[]
): MonthlySummary {
  let totalWorkedMinutes = 0
  let totalExtraMinutes = 0
  let totalMissingMinutes = 0

  for (const e of entries) {
    totalWorkedMinutes += e.workedMinutes ?? 0
    totalExtraMinutes += e.extraMinutes ?? 0
    totalMissingMinutes += e.missingMinutes ?? 0
  }

  return {
    totalWorkedMinutes,
    totalExtraMinutes,
    totalMissingMinutes,
    balanceMinutes: totalExtraMinutes - totalMissingMinutes,
  }
}
