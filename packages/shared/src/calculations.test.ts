import { describe, expect, it } from 'vitest'
import { calculateDay, calculateMonthlySummary, entryBankBalance, resolveBankTreatment } from './calculations'
import type { BankTreatment } from './types'

function entry(extra: number, missing: number, bankTreatment: BankTreatment, worked = 0) {
  return { extraMinutes: extra, missingMinutes: missing, workedMinutes: worked, bankTreatment }
}

describe('entryBankBalance', () => {
  it('counts bank entries', () => {
    expect(entryBankBalance(entry(30, 0, 'bank'))).toBe(30)
    expect(entryBankBalance(entry(0, 480, 'bank'))).toBe(-480)
  })

  it('ignores payroll-settled entries', () => {
    expect(entryBankBalance(entry(0, 480, 'payroll'))).toBe(0)
    expect(entryBankBalance(entry(60, 0, 'payroll'))).toBe(0)
  })
})

describe('calculateMonthlySummary', () => {
  it('keeps totals for every entry but balances only the bank ones', () => {
    const summary = calculateMonthlySummary([
      entry(60, 0, 'bank', 540),
      entry(0, 480, 'payroll'),   // falta descontada em folha
      entry(0, 20, 'bank', 460),
      entry(120, 0, 'payroll', 600), // hora extra paga
    ])

    expect(summary.totalWorkedMinutes).toBe(1600)
    expect(summary.totalExtraMinutes).toBe(180)
    expect(summary.totalMissingMinutes).toBe(500)
    expect(summary.payrollExtraMinutes).toBe(120)
    expect(summary.payrollMissingMinutes).toBe(480)
    expect(summary.balanceMinutes).toBe(40)
  })
})

describe('resolveBankTreatment', () => {
  const base = { requested: undefined, canDecide: true, existing: null, absenceDefault: 'payroll' as const }

  it('always debits the bank on banco_horas days', () => {
    expect(resolveBankTreatment({ ...base, dayType: 'banco_horas', requested: 'payroll' })).toBe('bank')
  })

  it('honors an explicit choice from admin/manager', () => {
    expect(resolveBankTreatment({ ...base, dayType: 'absence', requested: 'bank' })).toBe('bank')
    expect(resolveBankTreatment({ ...base, dayType: 'worked', requested: 'payroll' })).toBe('payroll')
  })

  it('ignores the choice from users who cannot decide', () => {
    expect(resolveBankTreatment({ ...base, dayType: 'worked', requested: 'payroll', canDecide: false })).toBe('bank')
  })

  it('keeps the stored treatment while the day type is unchanged', () => {
    const existing = { dayType: 'absence' as const, bankTreatment: 'bank' as const }
    expect(resolveBankTreatment({ ...base, dayType: 'absence', existing })).toBe('bank')
  })

  it('applies the company default to new absences and bank to other days', () => {
    expect(resolveBankTreatment({ ...base, dayType: 'absence' })).toBe('payroll')
    expect(resolveBankTreatment({ ...base, dayType: 'absence', absenceDefault: 'bank' })).toBe('bank')
    expect(resolveBankTreatment({ ...base, dayType: 'worked' })).toBe('bank')
    const existing = { dayType: 'worked' as const, bankTreatment: 'bank' as const }
    expect(resolveBankTreatment({ ...base, dayType: 'absence', existing })).toBe('payroll')
  })
})

describe('calculateDay', () => {
  const employee = { toleranceMinutes: 10, dailyHoursExpected: 8, saturdayMode: 'all' as const, saturdayStart: '08:00', saturdayEnd: '12:00' }
  const day = (entryDate: string, dayType: 'worked' | 'holiday' | 'absence', clockIn: string | null, clockOut: string | null) =>
    calculateDay({ entryDate, dayType, clockIn, clockOut, lunchOut: null, lunchReturn: null }, employee)

  it('counts hours worked on a Sunday entirely as extra', () => {
    expect(day('2025-03-09', 'worked', '08:00', '12:00')).toMatchObject({ workedMinutes: 240, extraMinutes: 240, missingMinutes: 0 })
    expect(day('2025-03-09', 'holiday', '08:00', '12:00')).toMatchObject({ extraMinutes: 240 })
  })

  it('never debits a Sunday', () => {
    expect(day('2025-03-09', 'absence', null, null)).toMatchObject({ missingMinutes: 0, extraMinutes: 0 })
  })

  it('rounds fractional daily hours to whole minutes', () => {
    const result = calculateDay(
      { entryDate: '2026-09-02', dayType: 'absence', clockIn: null, clockOut: null, lunchOut: null, lunchReturn: null },
      { ...employee, dailyHoursExpected: 7.33 }
    )
    expect(result.missingMinutes).toBe(440)
  })
})
