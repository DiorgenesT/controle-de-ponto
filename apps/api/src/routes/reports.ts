import { Hono } from 'hono'
import { monthQuerySchema, hourBankAdjustmentSchema, calculateMonthlySummary } from '@ponto/shared'
import type { TimeEntry, HourBankAdjustment } from '@ponto/shared'
import type { Env } from '../lib/types'
import type { AuthContext } from '../middleware/auth'
import { authMiddleware, requireRole } from '../middleware/auth'
import { getAccumulatedBeforeMonth, getAccumulatedBeforeMonthByCompany } from '../lib/hourBank'

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

function rowToAdjustment(row: Record<string, unknown>): HourBankAdjustment {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    year: row.year as number,
    month: row.month as number,
    adjustmentMinutes: row.adjustment_minutes as number,
    note: row.note as string | null,
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

  const [entriesResult, previousAccumulated, currentAdjustmentRow] = await Promise.all([
    c.env.DB
      .prepare(
        `SELECT * FROM time_entries
         WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
         ORDER BY entry_date ASC`
      )
      .bind(employeeId, startDate, endDate)
      .all(),
    getAccumulatedBeforeMonth(c.env.DB, employeeId, year, month),
    c.env.DB
      .prepare('SELECT adjustment_minutes FROM hour_bank WHERE employee_id = ? AND year = ? AND month = ? LIMIT 1')
      .bind(employeeId, year, month)
      .first<{ adjustment_minutes: number }>(),
  ])

  const entries = entriesResult.results.map(r => rowToEntry(r as Record<string, unknown>))
  const summary = calculateMonthlySummary(entries)
  const currentAdjustment = currentAdjustmentRow?.adjustment_minutes ?? 0
  const accumulatedMinutes = previousAccumulated + summary.balanceMinutes + currentAdjustment

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
        saturdayMode: (employeeRow.saturday_mode as string | null) ?? 'all',
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

  return c.json({ data: rows.results.map(r => rowToAdjustment(r as Record<string, unknown>)) })
})

// POST /reports/hourbank/adjustment
reports.post('/hourbank/adjustment', requireRole('admin', 'manager'), async (c) => {
  const body = await c.req.json().catch(() => null)
  const parsed = hourBankAdjustmentSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Dados inválidos', code: 'VALIDATION_ERROR' }, 400)
  }

  const { employeeId, year, month, adjustmentMinutes, note } = parsed.data
  const { companyId } = c.get('user')

  const employee = await c.env.DB
    .prepare('SELECT id FROM employees WHERE id = ? AND company_id = ? LIMIT 1')
    .bind(employeeId, companyId)
    .first()

  if (!employee) return c.json({ error: 'Funcionário não encontrado', code: 'NOT_FOUND' }, 404)

  if (adjustmentMinutes === 0 && !note) {
    await c.env.DB
      .prepare('DELETE FROM hour_bank WHERE employee_id = ? AND year = ? AND month = ?')
      .bind(employeeId, year, month)
      .run()
    return c.json({ data: null })
  }

  await c.env.DB
    .prepare(
      `INSERT INTO hour_bank (id, employee_id, year, month, adjustment_minutes, note, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(employee_id, year, month) DO UPDATE SET
         adjustment_minutes = excluded.adjustment_minutes,
         note               = excluded.note,
         updated_at         = datetime('now')`
    )
    .bind(crypto.randomUUID(), employeeId, year, month, adjustmentMinutes, note ?? null)
    .run()

  const row = await c.env.DB
    .prepare('SELECT * FROM hour_bank WHERE employee_id = ? AND year = ? AND month = ? LIMIT 1')
    .bind(employeeId, year, month)
    .first()

  return c.json({ data: rowToAdjustment(row as Record<string, unknown>) })
})

// GET /reports/dashboard?year=&month=
reports.get('/dashboard', async (c) => {
  const year  = parseInt(c.req.query('year')  ?? String(new Date().getFullYear()))
  const month = parseInt(c.req.query('month') ?? String(new Date().getMonth() + 1))
  const { companyId } = c.get('user')

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const endDate   = `${year}-${String(month).padStart(2, '0')}-31`

  type EmpRow   = { id: string; name: string; role: string; cpf: string | null; admission_date: string }
  type EntryRow = { employee_id: string; day_type: string; worked_minutes: number | null; extra_minutes: number | null; missing_minutes: number | null }

  const [employeesResult, entriesResult, accumulatedBeforeMonth, currentAdjustmentsResult] = await Promise.all([
    c.env.DB
      .prepare('SELECT id, name, role, cpf, admission_date FROM employees WHERE company_id = ? AND active = 1 ORDER BY name ASC')
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
    getAccumulatedBeforeMonthByCompany(c.env.DB, companyId, year, month),
    c.env.DB
      .prepare(
        `SELECT hb.employee_id, hb.adjustment_minutes
         FROM hour_bank hb
         JOIN employees e ON e.id = hb.employee_id
         WHERE e.company_id = ? AND hb.year = ? AND hb.month = ?`
      )
      .bind(companyId, year, month)
      .all(),
  ])

  const employees = employeesResult.results as EmpRow[]
  const entries   = entriesResult.results as EntryRow[]

  const currentAdjustments: Record<string, number> = {}
  for (const row of currentAdjustmentsResult.results as { employee_id: string; adjustment_minutes: number }[]) {
    currentAdjustments[row.employee_id] = row.adjustment_minutes
  }

  type Stats = {
    workedDays: number
    workedMinutes: number
    extraMinutes: number
    missingMinutes: number
    absences: number        // faltas sem justificativa
    medicalDays: number     // atestados
    vacationDays: number    // férias
    holidays: number        // feriados
    bancoHorasDays: number  // dias de folga por banco de horas
    prevAccumulated: number
  }

  const stats: Record<string, Stats> = {}
  for (const emp of employees) {
    stats[emp.id] = {
      workedDays: 0, workedMinutes: 0, extraMinutes: 0, missingMinutes: 0,
      absences: 0, medicalDays: 0, vacationDays: 0, holidays: 0, bancoHorasDays: 0,
      prevAccumulated: accumulatedBeforeMonth[emp.id] ?? 0,
    }
  }

  for (const e of entries) {
    const s = stats[e.employee_id]
    if (!s) continue
    s.workedMinutes  += e.worked_minutes  ?? 0
    s.extraMinutes   += e.extra_minutes   ?? 0
    s.missingMinutes += e.missing_minutes ?? 0
    if (e.day_type === 'worked')      s.workedDays++
    if (e.day_type === 'absence')     s.absences++
    if (e.day_type === 'medical')     s.medicalDays++
    if (e.day_type === 'vacation')    s.vacationDays++
    if (e.day_type === 'holiday')     s.holidays++
    if (e.day_type === 'banco_horas') s.bancoHorasDays++
  }

  return c.json({
    data: {
      year, month,
      totalEmployees: employees.length,
      employees: employees.map(emp => {
        const s = stats[emp.id]!
        const monthBalance = s.extraMinutes - s.missingMinutes
        return {
          id: emp.id,
          name: emp.name,
          role: emp.role,
          cpf: emp.cpf,
          admissionDate: emp.admission_date,
          workedDays: s.workedDays,
          workedMinutes: s.workedMinutes,
          extraMinutes: s.extraMinutes,
          missingMinutes: s.missingMinutes,
          absences: s.absences,
          medicalDays: s.medicalDays,
          vacationDays: s.vacationDays,
          holidays: s.holidays,
          bancoHorasDays: s.bancoHorasDays,
          monthBalance,
          accumulatedBalance: s.prevAccumulated + monthBalance + (currentAdjustments[emp.id] ?? 0),
        }
      }),
    },
  })
})

export default reports
