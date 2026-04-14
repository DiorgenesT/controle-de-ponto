import { Hono } from 'hono'
import { monthQuerySchema, calculateMonthlySummary } from '@ponto/shared'
import type { TimeEntry } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware } from '../middleware/auth'

const reports = new Hono<{ Bindings: Env } & AuthContext>()

reports.use('*', authMiddleware)

function rowToEntry(row: Record<string, unknown>): TimeEntry {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    entryDate: row.entry_date as string,
    clockIn: row.clock_in as string | null,
    lunchOut: row.lunch_out as string | null,
    lunchReturn: row.lunch_return as string | null,
    clockOut: row.clock_out as string | null,
    dayType: row.day_type as TimeEntry['dayType'],
    notes: row.notes as string | null,
    workedMinutes: row.worked_minutes as number | null,
    extraMinutes: row.extra_minutes as number | null,
    missingMinutes: row.missing_minutes as number | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// GET /reports/monthly?employeeId=&year=&month=
reports.get('/monthly', async (c) => {
  const parsed = monthQuerySchema.safeParse({
    employeeId: c.req.query('employeeId'),
    year: c.req.query('year'),
    month: c.req.query('month'),
  })

  if (!parsed.success) {
    return c.json({ error: 'Parâmetros inválidos', code: 'VALIDATION_ERROR' }, 400)
  }

  const { employeeId, year, month } = parsed.data
  const { companyId } = c.get('user')

  const [employeeRow, companyRow] = await Promise.all([
    c.env.DB
      .prepare('SELECT * FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
      .bind(employeeId, companyId)
      .first(),
    c.env.DB
      .prepare('SELECT * FROM companies WHERE id = ? LIMIT 1')
      .bind(companyId)
      .first(),
  ])

  if (!employeeRow) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`

  const [entriesResult, prevBankRow] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT * FROM time_entries
         WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
         ORDER BY entry_date ASC`
      )
      .bind(employeeId, startDate, endDate)
      .all(),
    // Previous month's accumulated balance
    c.env.DB
      .prepare(
        `SELECT accumulated_minutes FROM hour_bank
         WHERE employee_id = ? AND (year < ? OR (year = ? AND month < ?))
         ORDER BY year DESC, month DESC LIMIT 1`
      )
      .bind(employeeId, year, year, month)
      .first<{ accumulated_minutes: number }>(),
  ])

  const entries = entriesResult.results.map(r => rowToEntry(r as Record<string, unknown>))
  const summary = calculateMonthlySummary(entries)
  const previousAccumulated = prevBankRow?.accumulated_minutes ?? 0
  const accumulatedMinutes = previousAccumulated + summary.balanceMinutes

  return c.json({
    data: {
      employee: {
        id: employeeRow.id,
        companyId: employeeRow.company_id,
        name: employeeRow.name,
        role: employeeRow.role,
        admissionDate: employeeRow.admission_date,
        weekdayStart: employeeRow.weekday_start,
        weekdayEnd: employeeRow.weekday_end,
        saturdayStart: employeeRow.saturday_start,
        saturdayEnd: employeeRow.saturday_end,
        worksSaturday: employeeRow.works_saturday === 1,
        toleranceMinutes: employeeRow.tolerance_minutes,
        dailyHoursExpected: employeeRow.daily_hours_expected,
        active: employeeRow.active === 1,
        createdAt: employeeRow.created_at,
      },
      company: {
        id: companyRow?.id,
        name: companyRow?.name,
        cnpj: companyRow?.cnpj,
        address: companyRow?.address,
        city: companyRow?.city,
      },
      year,
      month,
      entries,
      ...summary,
      accumulatedMinutes,
      previousMonthAccumulated: previousAccumulated,
    },
  })
})

// GET /reports/hourbank?employeeId=
reports.get('/hourbank', async (c) => {
  const employeeId = c.req.query('employeeId')
  if (!employeeId) return c.json({ error: 'employeeId é obrigatório', code: 'VALIDATION_ERROR' }, 400)

  const { companyId } = c.get('user')

  const employee = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()

  if (!employee) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  const rows = await c.env.DB
    .prepare('SELECT * FROM hour_bank WHERE employee_id = ? ORDER BY year DESC, month DESC')
    .bind(employeeId)
    .all()

  return c.json({ data: rows.results })
})

export default reports
