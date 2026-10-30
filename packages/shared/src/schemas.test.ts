import { describe, expect, it } from 'vitest'
import { upsertTimeEntrySchema } from './schemas'

const base = { employeeId: 'emp-1', entryDate: '2026-09-01', dayType: 'worked' as const }

function errorOf(input: Record<string, unknown>): string | undefined {
  const result = upsertTimeEntrySchema.safeParse({ ...base, ...input })
  return result.success ? undefined : result.error.issues[0]?.message
}

describe('upsertTimeEntrySchema', () => {
  it('accepts a regular day', () => {
    expect(errorOf({ clockIn: '08:30', lunchOut: '12:00', lunchReturn: '13:00', clockOut: '18:00' })).toBeUndefined()
  })

  it('rejects impossible dates and times', () => {
    expect(errorOf({ entryDate: '2025-02-30', clockIn: '08:00', clockOut: '12:00' })).toBe('Data inexistente')
    expect(errorOf({ entryDate: '2024-13-45', clockIn: '08:00', clockOut: '12:00' })).toBe('Data inexistente')
    expect(errorOf({ clockIn: '08:00', clockOut: '25:99' })).toMatch(/Horário inválido/)
  })

  it('rejects a worked day without times', () => {
    expect(errorOf({})).toMatch(/exige entrada e saída/)
    expect(errorOf({ clockOut: '18:00' })).toMatch(/exige entrada e saída/)
  })

  it('rejects incoherent sequences', () => {
    expect(errorOf({ clockIn: '18:00', clockOut: '08:30' })).toBe('Saída deve ser depois da entrada')
    expect(errorOf({ clockIn: '08:30', lunchOut: '12:00', clockOut: '18:00' })).toMatch(/almoço juntos/)
    expect(errorOf({ clockIn: '08:30', lunchOut: '19:00', lunchReturn: '20:30', clockOut: '18:00' })).toMatch(/dentro do expediente/)
    expect(errorOf({ clockIn: '08:30', lunchOut: '13:00', lunchReturn: '12:00', clockOut: '18:00' })).toMatch(/Retorno do almoço/)
  })

  it('allows non-worked days without times', () => {
    expect(errorOf({ dayType: 'absence' })).toBeUndefined()
    expect(errorOf({ dayType: 'medical' })).toBeUndefined()
  })
})
