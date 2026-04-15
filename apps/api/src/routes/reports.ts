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
        cpf: employeeRow.cpf ?? null,
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

// GET /reports/dashboard?year=&month=
reports.get('/dashboard', async (c) => {
  const year  = parseInt(c.req.query('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(c.req.query('month') ?? String(new Date().getMonth() + 1))
  const { companyId } = c.get('user')

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`

  const [employeesResult, entriesResult] = await Promise.all([
    c.env.DB
      .prepare('SELECT id, name, role, cpf FROM employees WHERE company_id = ? AND active = 1 ORDER BY name ASC')
      .bind(companyId)
      .all(),
    c.env.DB
      .prepare(
        `SELECT te.employee_id, te.day_type, te.worked_minutes, te.extra_minutes, te.missing_minutes
         FROM time_entries te
         JOIN employees e ON e.id = te.employee_id
         WHERE e.company_id = ? AND te.entry_date >= ? AND te.entry_date <= ?`
      )
      .bind(companyId, startDate, endDate)
      .all(),
  ])

  type EmpRow = { id: string; name: string; role: string; cpf: string | null }
  type EntryRow = { employee_id: string; day_type: string; worked_minutes: number | null; extra_minutes: number | null; missing_minutes: number | null }

  const employees = employeesResult.results as EmpRow[]
  const entries   = entriesResult.results as EntryRow[]

  const stats: Record<string, { workedMinutes: number; extraMinutes: number; missingMinutes: number; absences: number }> = {}
  for (const emp of employees) stats[emp.id] = { workedMinutes: 0, extraMinutes: 0, missingMinutes: 0, absences: 0 }

  for (const e of entries) {
    if (!stats[e.employee_id]) continue
    stats[e.employee_id].workedMinutes  += e.worked_minutes  ?? 0
    stats[e.employee_id].extraMinutes   += e.extra_minutes   ?? 0
    stats[e.employee_id].missingMinutes += e.missing_minutes ?? 0
    if (e.day_type === 'absence') stats[e.employee_id].absences++
  }

  return c.json({
    data: {
      year, month,
      totalEmployees:     employees.length,
      totalWorkedMinutes: Object.values(stats).reduce((s, v) => s + v.workedMinutes,  0),
      totalExtraMinutes:  Object.values(stats).reduce((s, v) => s + v.extraMinutes,   0),
      totalMissingMinutes:Object.values(stats).reduce((s, v) => s + v.missingMinutes, 0),
      totalAbsences:      Object.values(stats).reduce((s, v) => s + v.absences,       0),
      employees: employees.map(emp => ({ ...emp, ...stats[emp.id] })),
    },
  })
})

export default reports
